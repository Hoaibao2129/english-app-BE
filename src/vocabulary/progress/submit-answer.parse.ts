import { BadRequestException } from '@nestjs/common';
import { as_object, is_object_id_string } from '../../common/input.parse.js';
import type {
  Direction,
  StudyMode,
  SubmitAnswerInput,
} from '../vocabulary.types.js';
import { DIRECTIONS } from './direction.parse.js';

const MODES: readonly StudyMode[] = ['flashcard', 'quiz', 'review'];
export const MAX_ANSWER_LENGTH = 200;

export function parse_submit_answer(body: unknown): SubmitAnswerInput {
  const { word_id, direction, mode, answer } = as_object(body);
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
