import { BadRequestException } from '@nestjs/common';
import type { LoginInput, RegisterInput } from './auth.types.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_BYTES = 8;
const MAX_PASSWORD_BYTES = 72;
const MAX_DISPLAY_NAME_LENGTH = 50;

function as_object(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

function parse_credentials(body: Record<string, unknown>): LoginInput {
  const { email, password } = body;
  const trimmed_email = typeof email === 'string' ? email.trim() : '';
  if (
    trimmed_email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(trimmed_email)
  ) {
    throw new BadRequestException('email must be a valid email address');
  }
  if (
    typeof password !== 'string' ||
    Buffer.byteLength(password) < MIN_PASSWORD_BYTES ||
    Buffer.byteLength(password) > MAX_PASSWORD_BYTES
  ) {
    throw new BadRequestException(
      `password must be between ${MIN_PASSWORD_BYTES} and ${MAX_PASSWORD_BYTES} bytes`,
    );
  }
  return { email: trimmed_email, password };
}

export function parse_login(body: unknown): LoginInput {
  return parse_credentials(as_object(body));
}

export function parse_register(body: unknown): RegisterInput {
  const object = as_object(body);
  const credentials = parse_credentials(object);
  const { display_name } = object;
  if (display_name === undefined || display_name === null) {
    return { ...credentials, display_name: null };
  }
  if (typeof display_name !== 'string') {
    throw new BadRequestException('display_name must be a string');
  }
  const trimmed = display_name.trim();
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new BadRequestException(
      `display_name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`,
    );
  }
  return { ...credentials, display_name: trimmed.length > 0 ? trimmed : null };
}

export function parse_refresh_token(body: unknown): string {
  const { refresh_token } = as_object(body);
  if (typeof refresh_token !== 'string') {
    throw new BadRequestException('refresh_token must be a string');
  }
  return refresh_token;
}
