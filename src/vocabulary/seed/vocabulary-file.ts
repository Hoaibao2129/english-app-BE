export interface SourceWord {
  en: string;
  vi: string;
}

export interface SourceTopic {
  name_en: string;
  name_vi: string;
  words: SourceWord[];
}

function read_string(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Maps the source JSON ({ topic_name_en, topic_name_vn, words: [{ en, vn }] }). */
export function parse_vocabulary_file(json: unknown): SourceTopic[] {
  if (!Array.isArray(json)) {
    throw new Error('vocabulary file: root must be an array of topics');
  }

  return json.map((raw_topic: unknown, topic_index) => {
    const label = `topic ${topic_index + 1}`;
    if (!is_record(raw_topic)) {
      throw new Error(`${label}: must be an object`);
    }

    const name_en = read_string(raw_topic.topic_name_en);
    if (name_en === null) {
      throw new Error(`${label}: missing topic_name_en`);
    }
    const name_vi = read_string(raw_topic.topic_name_vn);
    if (name_vi === null) {
      throw new Error(`${label}: missing topic_name_vn`);
    }
    if (!Array.isArray(raw_topic.words)) {
      throw new Error(`${label}: missing words array`);
    }

    const words = raw_topic.words.map((raw_word: unknown, word_index) => {
      const word_label = `${label} word ${word_index + 1}`;
      if (!is_record(raw_word)) {
        throw new Error(`${word_label}: must be an object`);
      }
      const en = read_string(raw_word.en);
      if (en === null) {
        throw new Error(`${word_label}: missing en`);
      }
      const vi = read_string(raw_word.vn);
      if (vi === null) {
        throw new Error(`${word_label}: missing vn`);
      }
      return { en, vi };
    });

    return { name_en, name_vi, words };
  });
}
