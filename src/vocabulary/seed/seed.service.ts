import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { base_word_key, slugify } from '../text/answer-text.js';
import { Topic } from '../schemas/topic.schema.js';
import { Word } from '../schemas/word.schema.js';
import { SourceTopic } from './vocabulary-file.js';

export interface SeedReport {
  topics: number;
  inserted: number;
  updated: number;
  unchanged: number;
  missing_keys: string[];
}

@Injectable()
export class SeedService {
  constructor(
    @InjectModel(Topic.name) private readonly topic_model: Model<Topic>,
    @InjectModel(Word.name) private readonly word_model: Model<Word>,
  ) {}

  async seed(source_topics: SourceTopic[]): Promise<SeedReport> {
    const report: SeedReport = {
      topics: source_topics.length,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      missing_keys: [],
    };
    const slugs = source_topics.map((t) => slugify(t.name_en));
    const problems: string[] = [];
    slugs.forEach((slug, i) => {
      const label = `#${i + 1} "${source_topics[i].name_en}"`;
      if (!slug) problems.push(`${label} has an empty slug`);
      else if (slugs.indexOf(slug) !== i) {
        problems.push(
          `${label} duplicates slug "${slug}" of #${slugs.indexOf(slug) + 1} "${source_topics[slugs.indexOf(slug)].name_en}"`,
        );
      }
    });
    if (problems.length > 0) {
      throw new Error(`Invalid topic names: ${problems.join('; ')}`);
    }
    const seen_keys = new Set<string>();
    const topic_ids: Types.ObjectId[] = [];

    for (const [topic_index, source] of source_topics.entries()) {
      const slug = slugs[topic_index];
      const topic = await this.topic_model.findOneAndUpdate(
        { slug },
        {
          $set: {
            order: topic_index + 1,
            name_en: source.name_en,
            name_vi: source.name_vi,
          },
          $setOnInsert: { slug, word_count: 0 },
        },
        { upsert: true, returnDocument: 'after' },
      );
      topic_ids.push(topic._id);

      const existing = await this.word_model
        .find({ topic_id: topic._id })
        .lean();
      const existing_by_key = new Map(existing.map((w) => [w.key, w]));
      const occurrences = new Map<string, number>();
      const ops: Parameters<Model<Word>['bulkWrite']>[0] = [];

      for (const [word_index, word] of source.words.entries()) {
        const base = base_word_key(slug, word.en);
        const count = (occurrences.get(base) ?? 0) + 1;
        occurrences.set(base, count);
        const key = count === 1 ? base : `${base}#${count}`;
        seen_keys.add(key);
        const order = word_index + 1;
        const current = existing_by_key.get(key);

        if (!current) {
          report.inserted++;
          ops.push({
            updateOne: {
              filter: { key },
              update: {
                $set: { topic_id: topic._id, order, en: word.en, vi: word.vi },
                $setOnInsert: { key, enrichment: { status: 'pending' } },
              },
              upsert: true,
            },
          });
          continue;
        }

        const text_changed = current.en !== word.en || current.vi !== word.vi;
        if (!text_changed && current.order === order) {
          report.unchanged++;
          continue;
        }

        report.updated++;
        const set: Record<string, unknown> = {
          order,
          en: word.en,
          vi: word.vi,
        };
        if (text_changed && current.enrichment?.status !== 'edited') {
          set['enrichment.status'] = 'pending';
        }
        ops.push({ updateOne: { filter: { key }, update: { $set: set } } });
      }

      if (ops.length > 0) {
        await this.word_model.bulkWrite(ops);
      }

      const word_count = await this.word_model.countDocuments({
        topic_id: topic._id,
      });
      await this.topic_model.updateOne({ _id: topic._id }, { word_count });
    }

    const missing = await this.word_model
      .find({ key: { $nin: [...seen_keys] } }, { key: 1 })
      .sort({ key: 1 })
      .lean();
    report.missing_keys = missing.map((w) => w.key);

    return report;
  }
}
