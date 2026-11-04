import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export function as_object(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

export function is_object_id_string(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-fA-F]{24}$/.test(value) &&
    Types.ObjectId.isValid(value)
  );
}
