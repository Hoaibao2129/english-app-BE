import { BadRequestException } from '@nestjs/common';
import { as_object, is_object_id_string } from './input.parse.js';

describe('as_object', () => {
  it('returns the body when it is a plain object', () => {
    const body = { a: 1 };
    expect(as_object(body)).toBe(body);
  });

  it.each([null, undefined, 'text', 1, []])(
    'throws BadRequestException when body is %p',
    (body) => {
      expect(() => as_object(body)).toThrow(BadRequestException);
    },
  );
});

describe('is_object_id_string', () => {
  it('returns true for a 24-char hex string', () => {
    expect(is_object_id_string('507f1f77bcf86cd799439011')).toBe(true);
  });

  it.each(['', 'abc', '507f1f77bcf86cd79943901z', 12, null])(
    'returns false for %p',
    (value) => {
      expect(is_object_id_string(value)).toBe(false);
    },
  );
});
