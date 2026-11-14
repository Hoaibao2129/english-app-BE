import {
  validate_environment,
  parse_duration_ms,
  DEFAULT_GROQ_MODEL,
} from './env.validation.js';

const JWT_SECRET = 'x'.repeat(32);
const SMTP = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '465',
  SMTP_USER: 'me@gmail.com',
  SMTP_PASS: 'app-password',
  SMTP_FROM: 'Study English <me@gmail.com>',
};

describe('validate_environment', () => {
  describe('GROQ_API_KEY', () => {
    it('accepts missing GROQ_API_KEY', () => {
      const result = validate_environment({
        MONGODB_URI: 'mongodb://x',
        JWT_SECRET,
      });
      expect(result.GROQ_API_KEY).toBeUndefined();
    });

    it('treats blank GROQ_API_KEY as missing', () => {
      const result = validate_environment({
        MONGODB_URI: 'mongodb://x',
        JWT_SECRET,
        GROQ_API_KEY: '  ',
      });
      expect(result.GROQ_API_KEY).toBeUndefined();
    });

    it('keeps provided values', () => {
      const result = validate_environment({
        MONGODB_URI: 'mongodb://x',
        JWT_SECRET,
        GROQ_API_KEY: 'gsk_1',
      });
      expect(result.GROQ_API_KEY).toBe('gsk_1');
    });
  });

  describe('GROQ_MODEL', () => {
    it('defaults GROQ_MODEL', () => {
      const result = validate_environment({
        MONGODB_URI: 'mongodb://x',
        JWT_SECRET,
      });
      expect(result.GROQ_MODEL).toBe(DEFAULT_GROQ_MODEL);
    });

    it('keeps provided values', () => {
      const result = validate_environment({
        MONGODB_URI: 'mongodb://x',
        JWT_SECRET,
        GROQ_MODEL: 'm',
      });
      expect(result.GROQ_MODEL).toBe('m');
    });
  });

  describe('JWT', () => {
    const base = { MONGODB_URI: 'mongodb://x' };

    it('requires JWT_SECRET of at least 32 chars', () => {
      expect(() => validate_environment(base)).toThrow(
        'JWT_SECRET must be at least 32 characters',
      );
      expect(() =>
        validate_environment({ ...base, JWT_SECRET: 'short' }),
      ).toThrow('JWT_SECRET must be at least 32 characters');
      expect(validate_environment({ ...base, JWT_SECRET }).JWT_SECRET).toBe(
        JWT_SECRET,
      );
    });

    it('defaults TTLs', () => {
      const result = validate_environment({ ...base, JWT_SECRET });
      expect(result.JWT_ACCESS_TTL).toBe('15m');
      expect(result.JWT_REFRESH_TTL).toBe('1d');
    });

    it('rejects JWT_ACCESS_TTL "15 minutes"', () => {
      expect(() =>
        validate_environment({
          ...base,
          JWT_SECRET,
          JWT_ACCESS_TTL: '15 minutes',
        }),
      ).toThrow('JWT_ACCESS_TTL');
    });

    it('rejects a bad JWT_REFRESH_TTL', () => {
      expect(() =>
        validate_environment({ ...base, JWT_SECRET, JWT_REFRESH_TTL: 'x' }),
      ).toThrow('JWT_REFRESH_TTL');
    });

    it('parse_duration_ms converts units', () => {
      expect(parse_duration_ms('30s')).toBe(30000);
    });
  });

  describe('CORS_ORIGINS', () => {
    const base = { MONGODB_URI: 'mongodb://x', JWT_SECRET };

    it('is null (allow all) when unset outside production', () => {
      expect(validate_environment(base).CORS_ORIGINS).toBeNull();
      expect(
        validate_environment({ ...base, CORS_ORIGINS: '  ' }).CORS_ORIGINS,
      ).toBeNull();
    });

    it('is required in production', () => {
      expect(() =>
        validate_environment({ ...base, NODE_ENV: 'production' }),
      ).toThrow('CORS_ORIGINS is required in production');
    });

    it('parses a comma-separated list, trimming spaces and a trailing slash', () => {
      const result = validate_environment({
        ...base,
        ...SMTP,
        NODE_ENV: 'production',
        CORS_ORIGINS:
          ' https://study-english.vercel.app/ , http://localhost:5173,',
      });
      expect(result.CORS_ORIGINS).toEqual([
        'https://study-english.vercel.app',
        'http://localhost:5173',
      ]);
    });

    it('rejects entries that are not an http(s) origin', () => {
      for (const bad of [
        'study-english.vercel.app',
        'https://a.com/path',
        '*',
      ]) {
        expect(() =>
          validate_environment({ ...base, CORS_ORIGINS: bad }),
        ).toThrow('CORS_ORIGINS');
      }
    });
  });

  describe('SMTP', () => {
    const base = { MONGODB_URI: 'mongodb://x', JWT_SECRET };
    const production = {
      ...base,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://a.com',
    };

    it('allows blank SMTP settings outside production', () => {
      const result = validate_environment(base);
      expect(result.SMTP_HOST).toBeUndefined();
      expect(result.SMTP_PORT).toBeUndefined();
      expect(result.SMTP_PASS).toBeUndefined();
    });

    it('parses valid SMTP settings', () => {
      const result = validate_environment({ ...production, ...SMTP });
      expect(result.SMTP_HOST).toBe('smtp.gmail.com');
      expect(result.SMTP_PORT).toBe(465);
      expect(result.SMTP_USER).toBe('me@gmail.com');
      expect(result.SMTP_PASS).toBe('app-password');
      expect(result.SMTP_FROM).toBe('Study English <me@gmail.com>');
    });

    it('requires every SMTP setting in production', () => {
      for (const name of Object.keys(SMTP)) {
        const partial: Record<string, unknown> = { ...production, ...SMTP };
        delete partial[name];
        expect(() => validate_environment(partial)).toThrow(
          `${name} is required in production`,
        );
      }
    });

    it('rejects an invalid SMTP_PORT', () => {
      for (const bad of ['abc', '0', '70000', '1.5']) {
        expect(() => validate_environment({ ...base, SMTP_PORT: bad })).toThrow(
          'SMTP_PORT must be an integer between 1 and 65535',
        );
      }
    });
  });

  describe('parse_duration_ms', () => {
    it('converts units', () => {
      expect(parse_duration_ms('15m')).toBe(900000);
      expect(parse_duration_ms('1d')).toBe(86400000);
      expect(parse_duration_ms('30s')).toBe(30000);
      expect(parse_duration_ms('2h')).toBe(7200000);
    });
  });
});
