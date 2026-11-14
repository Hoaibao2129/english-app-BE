import { BadRequestException } from '@nestjs/common';
import type { Direction } from '../vocabulary.types.js';

export const DIRECTIONS: readonly Direction[] = ['en_vi', 'vi_en'];

export function parse_direction(value: unknown): Direction {
  if (!DIRECTIONS.includes(value as Direction)) {
    throw new BadRequestException(
      `direction must be one of: ${DIRECTIONS.join(', ')}`,
    );
  }
  return value as Direction;
}

/** Missing value means "both directions" and is returned as null. */
export function parse_optional_direction(value: unknown): Direction | null {
  return value === undefined ? null : parse_direction(value);
}
