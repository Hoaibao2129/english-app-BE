import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (
      metadata.type === 'body' &&
      (typeof value !== 'object' || value === null || Array.isArray(value))
    ) {
      throw new BadRequestException('Request body must be a JSON object');
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new BadRequestException(issue.message);
    }
    return result.data;
  }
}

