export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

interface Environment {
  MONGODB_URI: string;
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  GROQ_API_KEY?: string;
  GROQ_MODEL: string;
  JWT_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  CORS_ORIGINS: string[] | null;
}

const DURATION_PATTERN = /^(\d+)([smhd])$/;
const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

export function parse_duration_ms(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

const ORIGIN_PATTERN = /^https?:\/\/[^/\s]+$/;

function read_cors_origins(
  environment: Record<string, unknown>,
  node_env: string,
): string[] | null {
  const raw = environment.CORS_ORIGINS;
  const origins = (typeof raw === 'string' ? raw.split(',') : [])
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => origin.length > 0);
  if (origins.length === 0) {
    if (node_env === 'production') {
      throw new Error('CORS_ORIGINS is required in production');
    }
    return null;
  }
  for (const origin of origins) {
    if (!ORIGIN_PATTERN.test(origin)) {
      throw new Error(
        `CORS_ORIGINS entry "${origin}" must be an origin like https://example.com`,
      );
    }
  }
  return origins;
}

function read_ttl(
  environment: Record<string, unknown>,
  name: 'JWT_ACCESS_TTL' | 'JWT_REFRESH_TTL',
  fallback: string,
): string {
  const value = environment[name] ?? fallback;
  if (typeof value !== 'string' || !DURATION_PATTERN.test(value)) {
    throw new Error(`${name} must match <number><s|m|h|d>, e.g. 15m`);
  }
  return value;
}

export function validate_environment(
  environment: Record<string, unknown>,
): Environment {
  const mongodb_uri = environment.MONGODB_URI;
  if (
    typeof mongodb_uri !== 'string' ||
    (!mongodb_uri.startsWith('mongodb://') &&
      !mongodb_uri.startsWith('mongodb+srv://'))
  ) {
    throw new Error(
      'MONGODB_URI must be a valid mongodb:// or mongodb+srv:// URI',
    );
  }

  const port = Number(environment.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const node_env = environment.NODE_ENV ?? 'development';
  if (
    typeof node_env !== 'string' ||
    !['development', 'test', 'production'].includes(node_env)
  ) {
    throw new Error('NODE_ENV must be one of: development, test, production');
  }

  // Handle GROQ_API_KEY - optional, trim whitespace
  let groq_api_key: string | undefined;
  if (typeof environment.GROQ_API_KEY === 'string') {
    const trimmed = environment.GROQ_API_KEY.trim();
    groq_api_key = trimmed.length > 0 ? trimmed : undefined;
  }

  // Handle GROQ_MODEL - defaults to DEFAULT_GROQ_MODEL, trim whitespace
  let groq_model = DEFAULT_GROQ_MODEL;
  if (typeof environment.GROQ_MODEL === 'string') {
    const trimmed = environment.GROQ_MODEL.trim();
    if (trimmed.length > 0) {
      groq_model = trimmed;
    }
  }

  const jwt_secret = environment.JWT_SECRET;
  if (typeof jwt_secret !== 'string' || jwt_secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  const jwt_access_ttl = read_ttl(environment, 'JWT_ACCESS_TTL', '15m');
  const jwt_refresh_ttl = read_ttl(environment, 'JWT_REFRESH_TTL', '1d');
  const cors_origins = read_cors_origins(environment, node_env);

  return {
    ...environment,
    MONGODB_URI: mongodb_uri,
    NODE_ENV: node_env as Environment['NODE_ENV'],
    PORT: port,
    GROQ_API_KEY: groq_api_key,
    GROQ_MODEL: groq_model,
    JWT_SECRET: jwt_secret,
    JWT_ACCESS_TTL: jwt_access_ttl,
    JWT_REFRESH_TTL: jwt_refresh_ttl,
    CORS_ORIGINS: cors_origins,
  };
}
