import { build_otp_email } from './otp-email.template.js';

describe('build_otp_email', () => {
  it('includes the otp and expiry in text and html', () => {
    const email = build_otp_email('012345', 5);
    expect(email.subject).toBe('Your password reset code');
    expect(email.text).toContain('012345');
    expect(email.text).toContain('5 minutes');
    expect(email.html).toContain('012345');
    expect(email.html).toContain('5 minutes');
  });
});
