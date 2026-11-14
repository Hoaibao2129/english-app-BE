import { BadRequestException } from '@nestjs/common';
import {
  parse_forgot_password,
  parse_login,
  parse_reset_password,
  parse_verify_otp,
} from './auth-input.parse.js';

describe('parse_forgot_password', () => {
  it('returns the trimmed email', () => {
    expect(parse_forgot_password({ email: '  a@x.com ' })).toEqual({
      email: 'a@x.com',
    });
  });

  it('throws when email is invalid or missing', () => {
    for (const body of [{}, { email: 5 }, { email: 'nope' }, { email: '' }]) {
      expect(() => parse_forgot_password(body)).toThrow(
        'email must be a valid email address',
      );
    }
  });

  it('throws when body is not an object', () => {
    expect(() => parse_forgot_password(null)).toThrow(BadRequestException);
    expect(() => parse_forgot_password([])).toThrow(
      'Request body must be a JSON object',
    );
  });
});

describe('parse_verify_otp', () => {
  it('returns email and otp', () => {
    expect(parse_verify_otp({ email: 'a@x.com', otp: '012345' })).toEqual({
      email: 'a@x.com',
      otp: '012345',
    });
  });

  it('throws when email is invalid', () => {
    expect(() => parse_verify_otp({ email: 'bad', otp: '123456' })).toThrow(
      'email must be a valid email address',
    );
  });

  it('throws when otp is not exactly 6 digits', () => {
    for (const otp of [
      undefined,
      123456,
      '12345',
      '1234567',
      'abcdef',
      '12 456',
    ]) {
      expect(() => parse_verify_otp({ email: 'a@x.com', otp })).toThrow(
        'otp must be a 6-digit code',
      );
    }
  });
});

describe('parse_reset_password', () => {
  const valid = {
    reset_token: ' token ',
    new_password: 'password1',
    confirm_password: 'password2',
  };

  it('returns trimmed token and both passwords', () => {
    expect(parse_reset_password(valid)).toEqual({
      reset_token: 'token',
      new_password: 'password1',
      confirm_password: 'password2',
    });
  });

  it('throws when reset_token is missing or blank', () => {
    for (const reset_token of [undefined, 5, '', '   ']) {
      expect(() => parse_reset_password({ ...valid, reset_token })).toThrow(
        'reset_token must be a non-empty string',
      );
    }
  });

  it('throws when new_password is outside 8 to 72 bytes', () => {
    for (const new_password of [undefined, 'short', 'x'.repeat(73)]) {
      expect(() => parse_reset_password({ ...valid, new_password })).toThrow(
        'new_password must be between 8 and 72 bytes',
      );
    }
  });

  it('throws when confirm_password is not a string', () => {
    expect(() =>
      parse_reset_password({ ...valid, confirm_password: undefined }),
    ).toThrow('confirm_password must be a string');
  });
});

describe('parse_login', () => {
  it('keeps the existing password error message', () => {
    expect(() => parse_login({ email: 'a@x.com', password: 'short' })).toThrow(
      'password must be between 8 and 72 bytes',
    );
  });
});
