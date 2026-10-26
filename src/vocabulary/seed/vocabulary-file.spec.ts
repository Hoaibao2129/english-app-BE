import { parse_vocabulary_file } from './vocabulary-file.js';

describe('parse_vocabulary_file', () => {
  it('maps topic_name_en/topic_name_vn/words[].en/vn', () => {
    expect(
      parse_vocabulary_file([
        {
          topic_name_en: 'Time',
          topic_name_vn: 'Thời gian',
          words: [{ en: 'day', vn: 'ngày' }],
        },
      ]),
    ).toEqual([
      {
        name_en: 'Time',
        name_vi: 'Thời gian',
        words: [{ en: 'day', vi: 'ngày' }],
      },
    ]);
  });

  it('trims strings', () => {
    const [topic] = parse_vocabulary_file([
      {
        topic_name_en: ' Time ',
        topic_name_vn: ' Thời gian ',
        words: [{ en: ' day ', vn: ' ngày ' }],
      },
    ]);
    expect(topic).toEqual({
      name_en: 'Time',
      name_vi: 'Thời gian',
      words: [{ en: 'day', vi: 'ngày' }],
    });
  });

  it('throws "topic 2: missing topic_name_en"', () => {
    expect(() =>
      parse_vocabulary_file([
        { topic_name_en: 'A', topic_name_vn: 'B', words: [] },
        { topic_name_vn: 'B', words: [] },
      ]),
    ).toThrow('topic 2: missing topic_name_en');
  });

  it('throws "topic 1 word 3: missing vn"', () => {
    expect(() =>
      parse_vocabulary_file([
        {
          topic_name_en: 'A',
          topic_name_vn: 'B',
          words: [{ en: 'a', vn: 'b' }, { en: 'c', vn: 'd' }, { en: 'e' }],
        },
      ]),
    ).toThrow('topic 1 word 3: missing vn');
  });

  it('throws when root is not an array', () => {
    expect(() => parse_vocabulary_file({ topics: [] })).toThrow(/array/);
  });
});
