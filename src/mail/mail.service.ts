import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { build_otp_email } from './otp-email.template.js';

const SMTP_TIMEOUT_MS = 10_000;
const SMTP_SECURE_PORT = 465;

export interface MailTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** Overridable so tests can inject a fake transport. */
  transport: MailTransport | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.from =
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('SMTP_USER') ??
      '';
    if (!host) {
      this.transport = null;
      return;
    }
    const port = this.config.get<number>('SMTP_PORT') ?? SMTP_SECURE_PORT;
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure: port === SMTP_SECURE_PORT,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }

  /**
   * Sends the OTP email. Resolves without sending when SMTP is not
   * configured; rejects when sending fails.
   */
  async send_otp_email(
    to: string,
    otp: string,
    ttl_minutes: number,
  ): Promise<void> {
    if (!this.transport) {
      this.logger.warn('SMTP is not configured; OTP email was not sent');
      return;
    }
    const email = build_otp_email(otp, ttl_minutes);
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send OTP email: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw error;
    }
  }
}
