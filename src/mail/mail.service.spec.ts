import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { MailService } from './mail.service.js';
import type { MailTransport } from './mail.service.js';

function make_service(values: Record<string, unknown>): MailService {
  return new MailService(new ConfigService(values));
}

describe('MailService', () => {
  it('sends the otp email to the recipient with the template content', async () => {
    const send_mail = jest.fn<MailTransport['sendMail']>();
    send_mail.mockResolvedValue({});
    const service = make_service({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 465,
      SMTP_USER: 'me@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'Study English <me@example.com>',
    });
    service.transport = { sendMail: send_mail };

    await service.send_otp_email('user@example.com', '123456', 5);

    expect(send_mail).toHaveBeenCalledTimes(1);
    const message = send_mail.mock.calls[0][0];
    expect(message.to).toBe('user@example.com');
    expect(message.from).toBe('Study English <me@example.com>');
    expect(message.text).toContain('123456');
    expect(message.html).toContain('123456');
  });

  it('does not send when SMTP is not configured', async () => {
    const service = make_service({});
    expect(service.transport).toBeNull();
    await expect(
      service.send_otp_email('user@example.com', '123456', 5),
    ).resolves.toBeUndefined();
  });

  it('rethrows when sending fails', async () => {
    const send_mail = jest.fn<MailTransport['sendMail']>();
    send_mail.mockRejectedValue(new Error('smtp down'));
    const service = make_service({ SMTP_HOST: 'smtp.example.com' });
    service.transport = { sendMail: send_mail };

    await expect(
      service.send_otp_email('user@example.com', '123456', 5),
    ).rejects.toThrow('smtp down');
  });
});
