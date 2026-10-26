import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  mongoose_test_module,
  start_mongo,
} from '../../test-utils/mongo-memory.js';
import { VocabularyModule } from '../vocabulary.module.js';
import { GroqService } from '../groq/groq.service.js';
import { EnrichService } from './enrich.service.js';
import { Topic } from '../schemas/topic.schema.js';
import { Word } from '../schemas/word.schema.js';

describe('EnrichService', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let app: INestApplicationContext;
  let enrich: EnrichService;
  let topics: Model<Topic>;
  let words: Model<Word>;
  const groq = {
    is_configured: jest.fn<() => boolean>(),
    complete_json:
      jest.fn<
        (s: string, u: string) => Promise<Record<string, unknown> | null>
      >(),
  };

  beforeAll(async () => {
    mongo = await start_mongo();
    const module_ref = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'x'.repeat(32) })],
        }),
        mongoose_test_module(mongo.uri),
        VocabularyModule,
      ],
    })
      .overrideProvider(GroqService)
      .useValue(groq)
      .compile();
    app = await module_ref.init();
    enrich = app.get(EnrichService);
    topics = app.get(getModelToken(Topic.name));
    words = app.get(getModelToken(Word.name));
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    groq.is_configured.mockReset().mockReturnValue(true);
    groq.complete_json.mockReset();
    await topics.deleteMany({});
    await words.deleteMany({});
    const topic = await topics.create({
      slug: 'food',
      order: 1,
      name_en: 'Food',
      name_vi: 'Đồ ăn',
      word_count: 2,
    });
    await words.create([
      {
        key: 'food:apple',
        topic_id: topic._id,
        order: 1,
        en: 'apple',
        vi: 'táo',
      },
      { key: 'food:eat', topic_id: topic._id, order: 2, en: 'eat', vi: 'ăn' },
    ]);
  });

  const item = (key: string, extra: Record<string, unknown> = {}) => ({
    key,
    ipa: '/x/',
    pos: 'noun',
    example: { en: 'An apple.', vi: 'Một quả táo.' },
    ...extra,
  });
  const get = (key: string) => words.findOne({ key }).lean();

  it('fills ipa/pos/example and sets status done with model and at', async () => {
    groq.complete_json.mockResolvedValue({
      items: [item('food:apple'), item('food:eat', { pos: 'verb' })],
    });
    const r = await enrich.enrich_pending();
    expect(r).toEqual({ done: 2, failed: 0, skipped: false });
    const w = await get('food:apple');
    expect(w?.ipa).toBe('/x/');
    expect(w?.pos).toBe('noun');
    expect(w?.example).toEqual({ en: 'An apple.', vi: 'Một quả táo.' });
    expect(w?.enrichment.status).toBe('done');
    expect(w?.enrichment.model).toEqual(expect.any(String));
    expect(w?.enrichment.at).toBeInstanceOf(Date);
  });

  it('invalid pos is stored as null, empty ipa as null', async () => {
    groq.complete_json.mockResolvedValue({
      items: [
        item('food:apple', { pos: 'thing', ipa: '' }),
        item('food:eat', { example: { en: 'x' } }),
      ],
    });
    const r = await enrich.enrich_pending();
    expect(r).toMatchObject({ done: 1, failed: 1 });
    const a = await get('food:apple');
    expect(a?.pos).toBeNull();
    expect(a?.ipa).toBeNull();
    expect((await get('food:eat'))?.enrichment.status).toBe('failed');
  });

  it('uses the long enrich timeout', async () => {
    groq.complete_json.mockResolvedValue({ items: [item('food:apple')] });
    await enrich.enrich_pending();
    expect(groq.complete_json.mock.calls[0][2]).toBe(30000);
  });

  it('word missing from reply → status failed', async () => {
    groq.complete_json.mockResolvedValue({ items: [item('food:apple')] });
    const r = await enrich.enrich_pending();
    expect(r).toMatchObject({ done: 1, failed: 1 });
    expect((await get('food:eat'))?.enrichment.status).toBe('failed');
  });

  it("never touches status 'edited' or 'done'", async () => {
    await words.updateOne(
      { key: 'food:apple' },
      { $set: { 'enrichment.status': 'edited', ipa: '/mine/' } },
    );
    await words.updateOne(
      { key: 'food:eat' },
      { $set: { 'enrichment.status': 'done' } },
    );
    const r = await enrich.enrich_pending();
    expect(r).toEqual({ done: 0, failed: 0, skipped: false });
    expect(groq.complete_json).not.toHaveBeenCalled();
    expect((await get('food:apple'))?.ipa).toBe('/mine/');
  });

  it('does not overwrite a word edited while the request was in flight', async () => {
    groq.complete_json.mockImplementation(async () => {
      await words.updateOne(
        { key: 'food:apple' },
        { $set: { 'enrichment.status': 'edited', ipa: '/mine/' } },
      );
      return { items: [item('food:apple'), item('food:eat')] };
    });
    await enrich.enrich_pending();
    const w = await get('food:apple');
    expect(w?.ipa).toBe('/mine/');
    expect(w?.enrichment.status).toBe('edited');
  });

  it("retries 'failed' words on next run", async () => {
    groq.complete_json.mockResolvedValueOnce({ items: [item('food:apple')] });
    await enrich.enrich_pending();
    groq.complete_json.mockResolvedValueOnce({
      items: [item('food:eat', { pos: 'verb' })],
    });
    const r = await enrich.enrich_pending();
    expect(r).toEqual({ done: 1, failed: 0, skipped: false });
    expect((await get('food:eat'))?.enrichment.status).toBe('done');
  });

  it('groq null for a batch → whole batch failed, run continues', async () => {
    groq.complete_json
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ items: [item('food:eat', { pos: 'verb' })] });
    const r = await enrich.enrich_pending(1);
    expect(r).toEqual({ done: 1, failed: 1, skipped: false });
    expect((await get('food:apple'))?.enrichment.status).toBe('failed');
    expect((await get('food:eat'))?.enrichment.status).toBe('done');
  });

  it('skipped when not configured', async () => {
    groq.is_configured.mockReturnValue(false);
    const r = await enrich.enrich_pending();
    expect(r).toEqual({ done: 0, failed: 0, skipped: true });
    expect(groq.complete_json).not.toHaveBeenCalled();
    expect((await get('food:apple'))?.enrichment.status).toBe('pending');
  });
});
