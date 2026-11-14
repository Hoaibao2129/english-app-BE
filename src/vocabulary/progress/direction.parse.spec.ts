import { BadRequestException } from '@nestjs/common';
import {
  parse_direction,
  parse_optional_direction,
} from './direction.parse.js';

describe('parse_direction', () => {
  it('returns en_vi and vi_en unchanged', () => {
    expect(parse_direction('en_vi')).toBe('en_vi');
    expect(parse_direction('vi_en')).toBe('vi_en');
  });

  it.each([
    ['missing', undefined],
    ['empty string', ''],
    ['wrong case', 'EN_VI'],
    ['unknown value', 'foo'],
    ['array', ['en_vi', 'vi_en']],
    ['number', 1],
    ['null', null],
  ])('throws 400 when direction is %s', (_label, value) => {
    expect(() => parse_direction(value)).toThrow(BadRequestException);
    expect(() => parse_direction(value)).toThrow(
      'direction must be one of: en_vi, vi_en',
    );
  });
});

describe('parse_optional_direction', () => {
  it('returns null when direction is missing', () => {
    expect(parse_optional_direction(undefined)).toBeNull();
  });

  it('returns a valid direction unchanged', () => {
    expect(parse_optional_direction('vi_en')).toBe('vi_en');
  });

  it.each([
    ['empty string', ''],
    ['unknown value', 'foo'],
    ['array', ['en_vi']],
  ])('throws 400 when direction is %s', (_label, value) => {
    expect(() => parse_optional_direction(value)).toThrow(
      'direction must be one of: en_vi, vi_en',
    );
  });
});
