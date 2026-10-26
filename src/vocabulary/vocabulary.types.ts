export type Direction = 'en_vi' | 'vi_en';
export type StudyMode = 'flashcard' | 'quiz';
export type GradedBy = 'exact' | 'cache' | 'ai' | 'skipped' | 'ungraded';

export interface GradeResult {
  is_correct: boolean | null;
  graded_by: GradedBy;
}

export type TopicStatus = 'not_started' | 'in_progress' | 'completed';

export interface TopicSummaryDto {
  id: string;
  order: number;
  title: string;
  title_vi: string;
  total_words: number;
  correct: number;
  wrong: number;
  not_started: number;
  status: TopicStatus;
}

export interface WordDto {
  id: string;
  word: string;
  pronunciation: string | null;
  part_of_speech: string | null;
  meaning: string;
  example: string | null;
  example_meaning: string | null;
  status: 'correct' | 'wrong' | 'new';
}

export type TopicDetailDto = TopicSummaryDto & { words: WordDto[] };

export interface SubmitAnswerInput {
  word_id: string;
  direction: Direction;
  mode: StudyMode;
  answer: string;
}

export interface SubmitAnswerResult {
  is_correct: boolean | null;
  correct_answer: string;
  graded_by: GradedBy;
}

export interface SummaryDto {
  total_words: number;
  learned_words: number;
  wrong_words: number;
  not_started: number;
}
