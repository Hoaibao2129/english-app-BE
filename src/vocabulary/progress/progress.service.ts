import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnswerGrader } from '../grading/answer-grader.service.js';
import { AnswerLog } from '../schemas/answer-log.schema.js';
import { Topic } from '../schemas/topic.schema.js';
import { WordProgress } from '../schemas/word-progress.schema.js';
import { Word } from '../schemas/word.schema.js';
import type {
  Direction,
  SubmitAnswerInput,
  SubmitAnswerResult,
  SummaryDto,
  TopicDetailDto,
  TopicStatus,
  TopicSummaryDto,
  WordDto,
} from '../vocabulary.types.js';
import { is_object_id_string } from '../../common/input.parse.js';

interface Counts {
  correct: number;
  wrong: number;
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(Topic.name) private readonly topics: Model<Topic>,
    @InjectModel(Word.name) private readonly words: Model<Word>,
    @InjectModel(WordProgress.name)
    private readonly progress: Model<WordProgress>,
    @InjectModel(AnswerLog.name) private readonly logs: Model<AnswerLog>,
    private readonly grader: AnswerGrader,
  ) {}

  async list_topics(
    user_id: string,
    direction: Direction,
  ): Promise<TopicSummaryDto[]> {
    const [topics, counts] = await Promise.all([
      this.topics.find().sort({ order: 1 }).lean(),
      this.counts_by_topic(user_id, direction),
    ]);
    return topics.map((t) =>
      this.to_summary(
        t,
        counts.get(String(t._id)) ?? { correct: 0, wrong: 0 },
        direction,
      ),
    );
  }

  async get_topic(
    user_id: string,
    topic_id: string,
    direction: Direction,
  ): Promise<TopicDetailDto> {
    if (!is_object_id_string(topic_id))
      throw new BadRequestException('Invalid topic id');
    const topic = await this.topics.findById(topic_id).lean();
    if (!topic) throw new NotFoundException('Topic not found');

    const [words, progress] = await Promise.all([
      this.words.find({ topic_id: topic._id }).sort({ order: 1 }).lean(),
      this.progress
        .find({
          user_id: new Types.ObjectId(user_id),
          topic_id: topic._id,
          direction,
        })
        .lean(),
    ]);
    const last = new Map(
      progress.map((p) => [String(p.word_id), p.last_result]),
    );
    const dtos: WordDto[] = words.map((w) => ({
      id: String(w._id),
      word: w.en,
      pronunciation: w.ipa ?? null,
      part_of_speech: w.pos ?? null,
      meaning: w.vi,
      example: w.example?.en ?? null,
      example_meaning: w.example?.vi ?? null,
      status: last.get(String(w._id)) ?? 'new',
    }));
    const counts: Counts = { correct: 0, wrong: 0 };
    for (const w of dtos) {
      if (w.status === 'correct') counts.correct++;
      else if (w.status === 'wrong') counts.wrong++;
    }
    return {
      ...this.to_summary(topic, counts, direction, dtos.length),
      words: dtos,
    };
  }

  /** Topic detail restricted to the words whose last answer was wrong. */
  async get_review(
    user_id: string,
    topic_id: string,
    direction: Direction,
  ): Promise<TopicDetailDto> {
    const topic = await this.get_topic(user_id, topic_id, direction);
    return { ...topic, words: topic.words.filter((w) => w.status === 'wrong') };
  }

  async submit_answer(
    user_id: string,
    input: SubmitAnswerInput,
  ): Promise<SubmitAnswerResult> {
    const owner = new Types.ObjectId(user_id);
    const word = await this.words.findById(input.word_id).lean();
    if (!word) throw new NotFoundException('Word not found');
    const topic = await this.topics.findById(word.topic_id).lean();
    if (!topic) throw new NotFoundException('Topic not found');

    const result = await this.grader.grade({
      word: { _id: word._id, en: word.en, vi: word.vi },
      topic_name: topic.name_en,
      direction: input.direction,
      answer: input.answer,
    });

    const at = new Date();
    await this.logs.create({
      user_id: owner,
      word_id: word._id,
      topic_id: word.topic_id,
      mode: input.mode,
      direction: input.direction,
      answer: input.answer,
      is_correct: result.is_correct,
      graded_by: result.graded_by,
      at,
    });

    if (result.is_correct !== null) {
      await this.progress.updateOne(
        { user_id: owner, word_id: word._id, direction: input.direction },
        {
          $set: {
            last_result: result.is_correct ? 'correct' : 'wrong',
            last_answered_at: at,
            topic_id: word.topic_id,
          },
          $inc: result.is_correct ? { correct_count: 1 } : { wrong_count: 1 },
        },
        { upsert: true },
      );
    }

    return {
      is_correct: result.is_correct,
      correct_answer: input.direction === 'en_vi' ? word.vi : word.en,
      graded_by: result.graded_by,
    };
  }

  async summary(user_id: string, direction: Direction): Promise<SummaryDto> {
    const [topics, counts] = await Promise.all([
      this.topics.find().lean(),
      this.counts_by_topic(user_id, direction),
    ]);
    const total_words = topics.reduce((n, t) => n + t.word_count, 0);
    let learned_words = 0;
    let wrong_words = 0;
    for (const c of counts.values()) {
      learned_words += c.correct;
      wrong_words += c.wrong;
    }
    return {
      total_words,
      learned_words,
      wrong_words,
      not_started: total_words - learned_words - wrong_words,
      direction,
    };
  }

  /** A null direction resets both directions. */
  async reset(user_id: string, direction: Direction | null): Promise<void> {
    const owner = {
      user_id: new Types.ObjectId(user_id),
      ...(direction ? { direction } : {}),
    };
    await Promise.all([
      this.progress.deleteMany(owner),
      this.logs.deleteMany(owner),
    ]);
  }

  /** A null direction resets both directions of the topic. */
  async reset_topic(
    user_id: string,
    topic_id: string,
    direction: Direction | null,
  ): Promise<void> {
    if (!is_object_id_string(topic_id))
      throw new BadRequestException('Invalid topic id');
    const topic = await this.topics.exists({ _id: topic_id });
    if (!topic) throw new NotFoundException('Topic not found');
    const scope = {
      user_id: new Types.ObjectId(user_id),
      topic_id: new Types.ObjectId(topic_id),
      ...(direction ? { direction } : {}),
    };
    await Promise.all([
      this.progress.deleteMany(scope),
      this.logs.deleteMany(scope),
    ]);
  }

  private async counts_by_topic(
    user_id: string,
    direction: Direction,
  ): Promise<Map<string, Counts>> {
    const rows = await this.progress.aggregate<{
      _id: { topic_id: Types.ObjectId; last_result: 'correct' | 'wrong' };
      n: number;
    }>([
      { $match: { user_id: new Types.ObjectId(user_id), direction } },
      {
        $group: {
          _id: { topic_id: '$topic_id', last_result: '$last_result' },
          n: { $sum: 1 },
        },
      },
    ]);
    const map = new Map<string, Counts>();
    for (const r of rows) {
      const key = String(r._id.topic_id);
      const c = map.get(key) ?? { correct: 0, wrong: 0 };
      c[r._id.last_result] += r.n;
      map.set(key, c);
    }
    return map;
  }

  private to_summary(
    t: {
      _id: Types.ObjectId;
      order: number;
      name_en: string;
      name_vi: string;
      word_count: number;
    },
    c: Counts,
    direction: Direction,
    total_words: number = t.word_count,
  ): TopicSummaryDto {
    let status: TopicStatus = 'in_progress';
    if (c.correct + c.wrong === 0) status = 'not_started';
    else if (c.correct === total_words) status = 'completed';
    return {
      id: String(t._id),
      order: t.order,
      title: t.name_en,
      title_vi: t.name_vi,
      total_words,
      correct: c.correct,
      wrong: c.wrong,
      not_started: total_words - c.correct - c.wrong,
      status,
      direction,
    };
  }
}
