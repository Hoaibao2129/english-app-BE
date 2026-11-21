import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { isObjectIdString } from '../../common/object-id.util.js';
import { AnswerGrader } from '../grading/answer-grader.service.js';
import { AnswerLogsRepository } from '../repositories/answer-logs.repository.js';
import { TopicsRepository } from '../repositories/topics.repository.js';
import { WordProgressRepository } from '../repositories/word-progress.repository.js';
import { WordsRepository } from '../repositories/words.repository.js';
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

interface Counts {
  correct: number;
  wrong: number;
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly topics_repo: TopicsRepository,
    private readonly words_repo: WordsRepository,
    private readonly progress_repo: WordProgressRepository,
    private readonly logs_repo: AnswerLogsRepository,
    private readonly grader: AnswerGrader,
  ) {}

  async listTopics(
    user_id: string,
    direction: Direction,
  ): Promise<TopicSummaryDto[]> {
    const [topics, counts] = await Promise.all([
      this.topics_repo.listAllOrdered(),
      this.countsByTopic(user_id, direction),
    ]);
    return topics.map((t) =>
      this.toSummary(
        t,
        counts.get(String(t._id)) ?? { correct: 0, wrong: 0 },
        direction,
      ),
    );
  }

  async getTopic(
    user_id: string,
    topic_id: string,
    direction: Direction,
  ): Promise<TopicDetailDto> {
    if (!isObjectIdString(topic_id))
      throw new BadRequestException('Invalid topic id');
    const topic = await this.topics_repo.findByIdLean(topic_id);
    if (!topic) throw new NotFoundException('Topic not found');

    const [words, progress] = await Promise.all([
      this.words_repo.listByTopicOrdered(topic._id),
      this.progress_repo.listForTopic(user_id, topic._id, direction),
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
      ...this.toSummary(topic, counts, direction, dtos.length),
      words: dtos,
    };
  }

  /** Topic detail restricted to the words whose last answer was wrong. */
  async getReview(
    user_id: string,
    topic_id: string,
    direction: Direction,
  ): Promise<TopicDetailDto> {
    const topic = await this.getTopic(user_id, topic_id, direction);
    return { ...topic, words: topic.words.filter((w) => w.status === 'wrong') };
  }

  async submitAnswer(
    user_id: string,
    input: SubmitAnswerInput,
  ): Promise<SubmitAnswerResult> {
    const owner = new Types.ObjectId(user_id);
    const word = await this.words_repo.findByIdLean(input.word_id);
    if (!word) throw new NotFoundException('Word not found');
    const topic = await this.topics_repo.findByIdLean(word.topic_id);
    if (!topic) throw new NotFoundException('Topic not found');

    const result = await this.grader.grade({
      word: { _id: word._id, en: word.en, vi: word.vi },
      topic_name: topic.name_en,
      direction: input.direction,
      answer: input.answer,
    });

    const at = new Date();
    await this.logs_repo.createLog({
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
      await this.progress_repo.upsertProgress(
        owner,
        word._id,
        word.topic_id,
        input.direction,
        result.is_correct,
        at,
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
      this.topics_repo.listAllOrdered(),
      this.countsByTopic(user_id, direction),
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
      this.progress_repo.deleteForScope(owner),
      this.logs_repo.deleteForScope(owner),
    ]);
  }

  /** A null direction resets both directions of the topic. */
  async resetTopic(
    user_id: string,
    topic_id: string,
    direction: Direction | null,
  ): Promise<void> {
    if (!isObjectIdString(topic_id))
      throw new BadRequestException('Invalid topic id');
    const topic = await this.topics_repo.existsById(topic_id);
    if (!topic) throw new NotFoundException('Topic not found');
    const scope = {
      user_id: new Types.ObjectId(user_id),
      topic_id: new Types.ObjectId(topic_id),
      ...(direction ? { direction } : {}),
    };
    await Promise.all([
      this.progress_repo.deleteForScope(scope),
      this.logs_repo.deleteForScope(scope),
    ]);
  }

  private async countsByTopic(
    user_id: string,
    direction: Direction,
  ): Promise<Map<string, Counts>> {
    const rows = await this.progress_repo.aggregateTopicCounts(
      user_id,
      direction,
    );
    const map = new Map<string, Counts>();
    for (const r of rows) {
      const key = String(r._id.topic_id);
      const c = map.get(key) ?? { correct: 0, wrong: 0 };
      c[r._id.last_result] += r.n;
      map.set(key, c);
    }
    return map;
  }

  private toSummary(
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
