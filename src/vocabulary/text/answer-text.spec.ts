import {
  normalize_answer,
  accepted_answers,
  slugify,
  base_word_key,
} from './answer-text.js';

describe('answer text utilities', () => {
  describe('normalize_answer', () => {
    it('should lowercase and normalize unicode', () => {
      expect(normalize_answer('  Xin  Chào ')).toBe('xin chao');
    });

    it('should handle characters with diacritics', () => {
      expect(normalize_answer('Đường')).toBe('duong');
    });
  });

  describe('accepted_answers', () => {
    it('should split Vietnamese answers by comma and normalize', () => {
      expect(
        accepted_answers({ en: 'period', vi: 'giai đoạn, thời kỳ' }, 'en_vi'),
      ).toEqual(['giai doan', 'thoi ky']);
    });

    it('should remove parenthesized parts from Vietnamese', () => {
      expect(
        accepted_answers({ en: 'x', vi: 'mũ (có vành)' }, 'en_vi'),
      ).toEqual(['mu']);
    });

    it('should return empty array when Vietnamese is empty', () => {
      expect(accepted_answers({ en: 'chị/em gái', vi: '' }, 'en_vi')).toEqual(
        [],
      );
    });

    it('should split English answers by slash', () => {
      expect(
        accepted_answers({ en: 'theatre/theater', vi: 'rạp hát' }, 'vi_en'),
      ).toEqual(['theatre', 'theater']);
    });

    it('should handle multiple forms separated by slash', () => {
      expect(
        accepted_answers({ en: 'go/went/gone', vi: 'đi' }, 'vi_en'),
      ).toEqual(['go', 'went', 'gone']);
    });

    it('should remove parenthesized parts from English', () => {
      expect(
        accepted_answers({ en: 'shelf (shelves)', vi: 'kệ' }, 'vi_en'),
      ).toEqual(['shelf']);
    });

    it('should split Vietnamese by slash', () => {
      expect(accepted_answers({ en: 'x', vi: 'chị/em gái' }, 'en_vi')).toEqual([
        'chi',
        'em gai',
      ]);
    });

    it('should not split English by comma in vi_en direction', () => {
      expect(
        accepted_answers({ en: 'hello, world', vi: 'x' }, 'vi_en'),
      ).toEqual(['hello, world']);
    });
  });

  describe('slugify', () => {
    it('should convert to lowercase and replace special chars with hyphens', () => {
      expect(slugify('Places, Buildings & Rooms')).toBe(
        'places-buildings-rooms',
      );
    });
  });

  describe('base_word_key', () => {
    it('should create key from topic slug and normalized English word', () => {
      expect(base_word_key('time-calendar', '  Living  Room ')).toBe(
        'time-calendar:living room',
      );
    });
  });
});
