import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import type {
  Direction,
  StudyMode,
  SubmitAnswerInput,
} from '../vocabulary.types.js';

const DIRECTIONS: readonly Direction[] = ['en_vi', 'vi_en'];
const MODES: readonly StudyMode[] = ['flashcard', 'quiz', 'review'];
export const MAX_ANSWER_LENGTH = 200;

export function is_object_id_string(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-fA-F]{24}$/.test(value) &&
    Types.ObjectId.isValid(value)
  );
}

export function parse_submit_answer(body: unknown): SubmitAnswerInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Request body must be a JSON object');
  }
  const { word_id, direction, mode, answer } = body as Record<string, unknown>;
  if (!is_object_id_string(word_id)) {
    throw new BadRequestException('word_id must be a valid ObjectId');
  }
  if (!DIRECTIONS.includes(direction as Direction)) {
    throw new BadRequestException(
      `direction must be one of: ${DIRECTIONS.join(', ')}`,
    );
  }
  if (!MODES.includes(mode as StudyMode)) {
    throw new BadRequestException(`mode must be one of: ${MODES.join(', ')}`);
  }
  if (typeof answer !== 'string' || answer.length > MAX_ANSWER_LENGTH) {
    throw new BadRequestException(
      `answer must be a string of at most ${MAX_ANSWER_LENGTH} characters`,
    );
  }
  return {
    word_id,
    direction: direction as Direction,
    mode: mode as StudyMode,
    answer,
  };
}
