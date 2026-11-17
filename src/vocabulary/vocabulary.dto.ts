import { z } from 'zod';
import { isObjectIdString } from '../common/object-id.util.js';

export const DIRECTIONS = ['en_vi', 'vi_en'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const MODES = ['flashcard', 'quiz', 'review'] as const;
export type StudyMode = (typeof MODES)[number];

export const MAX_ANSWER_LENGTH = 200;

export const DirectionSchema = z.enum(DIRECTIONS, {
  message: `direction must be one of: ${DIRECTIONS.join(', ')}`,
});

export const OptionalDirectionSchema = z.preprocess(
  (val) => (val === undefined ? null : val),
  z.nullable(DirectionSchema),
);

export const SubmitAnswerDtoSchema = z.object({
  word_id: z
    .string({ message: 'word_id must be a valid ObjectId' })
    .refine((v) => isObjectIdString(v), {
      message: 'word_id must be a valid ObjectId',
    }),
  direction: DirectionSchema,
  mode: z.enum(MODES, {
    message: `mode must be one of: ${MODES.join(', ')}`,
  }),
  answer: z
    .string({
      message: `answer must be a string of at most ${MAX_ANSWER_LENGTH} characters`,
    })
    .max(
      MAX_ANSWER_LENGTH,
      `answer must be a string of at most ${MAX_ANSWER_LENGTH} characters`,
    ),
});
export type SubmitAnswerDto = z.infer<typeof SubmitAnswerDtoSchema>;

