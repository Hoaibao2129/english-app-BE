import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { GroqService } from './groq.service.js';

async function build(env: Record<string, string | undefined>) {
  const module_ref = await Test.createTestingModule({
    providers: [
      GroqService,
      {
        provide: ConfigService,
        useValue: { get: (k: string, d?: string) => env[k] ?? d },
      },
    ],
  }).compile();
  return module_ref.get(GroqService);
}

function reply(content: unknown, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
  });
}

describe('GroqService', () => {
  let fetch_spy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetch_spy = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('returns null and never calls fetch without key', async () => {
    const svc = await build({});
    expect(svc.is_configured()).toBe(false);
    expect(await svc.complete_json('s', 'u')).toBeNull();
    expect(fetch_spy).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only key as not configured and trims keys', async () => {
    const blank = await build({ GROQ_API_KEY: '   ' });
    expect(blank.is_configured()).toBe(false);
    expect(await blank.complete_json('s', 'u')).toBeNull();
    expect(fetch_spy).not.toHaveBeenCalled();
    fetch_spy.mockResolvedValue(reply('{"a":1}'));
    const svc = await build({ GROQ_API_KEY: ' k1 ' });
    await svc.complete_json('s', 'u');
    const init = fetch_spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer k1',
    );
  });

  it('uses the given timeout', async () => {
    fetch_spy.mockResolvedValue(reply('{"a":1}'));
    const timeout_spy = jest.spyOn(AbortSignal, 'timeout');
    const svc = await build({ GROQ_API_KEY: 'k1' });
    await svc.complete_json('s', 'u');
    await svc.complete_json('s', 'u', 30000);
    expect(timeout_spy.mock.calls).toEqual([[8000], [30000]]);
  });

  it('sends bearer key, model, json response_format', async () => {
    fetch_spy.mockResolvedValue(reply('{"a":1}'));
    const svc = await build({ GROQ_API_KEY: 'k1', GROQ_MODEL: 'm1' });
    expect(svc.is_configured()).toBe(true);
    await svc.complete_json('sys', 'usr');
    const [url, init] = fetch_spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer k1',
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('m1');
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
    expect(init.signal).toBeDefined();
  });

  it('parses choices[0].message.content into an object', async () => {
    fetch_spy.mockResolvedValue(reply('{"correct":true}'));
    const svc = await build({ GROQ_API_KEY: 'k' });
    expect(await svc.complete_json('s', 'u')).toEqual({ correct: true });
  });

  it('returns null on 500', async () => {
    fetch_spy.mockResolvedValue(new Response('err', { status: 500 }));
    const svc = await build({ GROQ_API_KEY: 'k' });
    expect(await svc.complete_json('s', 'u')).toBeNull();
  });

  it('returns null on content "not json"', async () => {
    fetch_spy.mockResolvedValue(reply('not json'));
    const svc = await build({ GROQ_API_KEY: 'k' });
    expect(await svc.complete_json('s', 'u')).toBeNull();
  });

  it('returns null for non-object content (array, null, number)', async () => {
    const svc = await build({ GROQ_API_KEY: 'k' });
    for (const c of ['[1]', 'null', '5', '"x"']) {
      fetch_spy.mockResolvedValueOnce(reply(c));
      expect(await svc.complete_json('s', 'u')).toBeNull();
    }
  });

  it('returns null when fetch rejects (timeout)', async () => {
    fetch_spy.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    const svc = await build({ GROQ_API_KEY: 'k' });
    expect(await svc.complete_json('s', 'u')).toBeNull();
  });
});
