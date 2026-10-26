import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_GROQ_MODEL } from '../../config/env.validation.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 8000;

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly config: ConfigService) {}

  is_configured(): boolean {
    return !!this.api_key();
  }

  private api_key(): string {
    return (this.config.get<string>('GROQ_API_KEY') ?? '').trim();
  }

  async complete_json(
    system: string,
    user: string,
    timeout_ms = DEFAULT_TIMEOUT_MS,
  ): Promise<Record<string, unknown> | null> {
    const key = this.api_key();
    if (!key) {
      this.logger.warn('GROQ_API_KEY not set; skipping Groq call');
      return null;
    }
    const model = this.config.get<string>('GROQ_MODEL') ?? DEFAULT_GROQ_MODEL;
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(timeout_ms),
      });
      if (!res.ok) {
        this.logger.warn(`Groq returned HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        this.logger.warn('Groq reply had no message content');
        return null;
      }
      const parsed: unknown = JSON.parse(content);
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        this.logger.warn('Groq reply was not a JSON object');
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch (err) {
      this.logger.warn(
        `Groq request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
