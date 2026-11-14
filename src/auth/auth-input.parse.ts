import { BadRequestException } from '@nestjs/common';
import { as_object } from '../common/input.parse.js';
import { OTP_LENGTH } from './auth.constants.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from './auth.types.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = new RegExp(`^[0-9]{${OTP_LENGTH}}$`);
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_BYTES = 8;
const MAX_PASSWORD_BYTES = 72;
const MAX_DISPLAY_NAME_LENGTH = 50;

function parse_email(email: unknown): string {
  const trimmed_email = typeof email === 'string' ? email.trim() : '';
  if (
    trimmed_email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(trimmed_email)
  ) {
    throw new BadRequestException('email must be a valid email address');
  }
  return trimmed_email;
}

function is_valid_password(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    Buffer.byteLength(password) >= MIN_PASSWORD_BYTES &&
    Buffer.byteLength(password) <= MAX_PASSWORD_BYTES
  );
}

function parse_credentials(body: Record<string, unknown>): LoginInput {
  const { email, password } = body;
  const trimmed_email = parse_email(email);
  if (!is_valid_password(password)) {
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

export function parse_forgot_password(body: unknown): ForgotPasswordInput {
  const { email } = as_object(body);
  return { email: parse_email(email) };
}

export function parse_verify_otp(body: unknown): VerifyOtpInput {
  const { email, otp } = as_object(body);
  const trimmed_email = parse_email(email);
  if (typeof otp !== 'string' || !OTP_PATTERN.test(otp)) {
    throw new BadRequestException(`otp must be a ${OTP_LENGTH}-digit code`);
  }
  return { email: trimmed_email, otp };
}

export function parse_reset_password(body: unknown): ResetPasswordInput {
  const { reset_token, new_password, confirm_password } = as_object(body);
  if (typeof reset_token !== 'string' || reset_token.trim().length === 0) {
    throw new BadRequestException('reset_token must be a non-empty string');
  }
  if (!is_valid_password(new_password)) {
    throw new BadRequestException(
      `new_password must be between ${MIN_PASSWORD_BYTES} and ${MAX_PASSWORD_BYTES} bytes`,
    );
  }
  if (typeof confirm_password !== 'string') {
    throw new BadRequestException('confirm_password must be a string');
  }
  return {
    reset_token: reset_token.trim(),
    new_password,
    confirm_password,
  };
}
