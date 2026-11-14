export interface OtpEmail {
  subject: string;
  text: string;
  html: string;
}

/** Builds the password reset OTP email (subject, plain text and HTML). */
export function build_otp_email(otp: string, ttl_minutes: number): OtpEmail {
  const subject = 'Your password reset code';
  const text = [
    'Hello,',
    '',
    `Your password reset code is: ${otp}`,
    `This code expires in ${ttl_minutes} minutes and can only be used once.`,
    '',
    'If you did not request a password reset, you can ignore this email.',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222">
  <h2 style="margin:0 0 16px">Password reset</h2>
  <p>Use the code below to reset your password:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0">${otp}</p>
  <p>This code expires in <strong>${ttl_minutes} minutes</strong> and can only be used once.</p>
  <p style="color:#666;font-size:13px">If you did not request a password reset, you can ignore this email.</p>
</div>`;
  return { subject, text, html };
}
