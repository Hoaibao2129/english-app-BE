import { Direction } from '../vocabulary.types.js';

export function normalize_answer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

export function accepted_answers(
  word: { en: string; vi: string },
  direction: Direction,
): string[] {
  const text = direction === 'en_vi' ? word.vi : word.en;

  if (!text || !text.trim()) {
    return [];
  }

  const split_pattern = direction === 'en_vi' ? /[,/]/ : /\//;

  const answers = text
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .split(split_pattern)
    .map((part) => normalize_answer(part))
    .filter((answer) => answer.length > 0);

  const seen = new Set<string>();
  const deduplicated: string[] = [];

  for (const answer of answers) {
    if (!seen.has(answer)) {
      seen.add(answer);
      deduplicated.push(answer);
    }
  }

  return deduplicated;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function base_word_key(topic_slug: string, en: string): string {
  const normalized_en = en.trim().toLowerCase().replace(/\s+/g, ' ');

  return `${topic_slug}:${normalized_en}`;
}
