import { z } from 'zod';
import { OTP_LENGTH } from './auth.constants.js';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const OTP_PATTERN = new RegExp(`^[0-9]{${OTP_LENGTH}}$`);
export const MAX_EMAIL_LENGTH = 254;
export const MIN_PASSWORD_BYTES = 8;
export const MAX_PASSWORD_BYTES = 72;
export const MAX_DISPLAY_NAME_LENGTH = 50;

export const EmailSchema = z
  .string({ message: 'email must be a valid email address' })
  .transform((v) => v.trim())
  .refine(
    (v) =>
      v.length > 0 && v.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(v),
    { message: 'email must be a valid email address' },
  );

export const PasswordSchema = z
  .string({
    message: `password must be between ${MIN_PASSWORD_BYTES} and ${MAX_PASSWORD_BYTES} bytes`,
  })
  .refine(
    (v) => {
      const bytes = Buffer.byteLength(v);
      return bytes >= MIN_PASSWORD_BYTES && bytes <= MAX_PASSWORD_BYTES;
    },
    {
      message: `password must be between ${MIN_PASSWORD_BYTES} and ${MAX_PASSWORD_BYTES} bytes`,
    },
  );

export const LoginDtoSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const RegisterDtoSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  display_name: z
    .unknown()
    .optional()
    .refine((v) => v === undefined || v === null || typeof v === 'string', {
      message: 'display_name must be a string',
    })
    .refine(
      (v) =>
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim().length <= MAX_DISPLAY_NAME_LENGTH),
      {
        message: `display_name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`,
      },
    )
    .transform((v) => {
      if (typeof v === 'string') {
        const trimmed = v.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
      return null;
    }),
});
export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

export const RefreshTokenDtoSchema = z.object({
  refresh_token: z.string({
    message: 'refresh_token must be a string',
  }),
});
export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;

export const ForgotPasswordDtoSchema = z.object({
  email: EmailSchema,
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>;

export const VerifyOtpDtoSchema = z.object({
  email: EmailSchema,
  otp: z
    .string({
      message: `otp must be a ${OTP_LENGTH}-digit code`,
    })
    .regex(OTP_PATTERN, { message: `otp must be a ${OTP_LENGTH}-digit code` }),
});
export type VerifyOtpDto = z.infer<typeof VerifyOtpDtoSchema>;

export const ResetPasswordDtoSchema = z.object({
  reset_token: z
    .string({
      message: 'reset_token must be a non-empty string',
    })
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, {
      message: 'reset_token must be a non-empty string',
    }),
  new_password: z
    .string({
      message: `new_password must be between ${MIN_PASSWORD_BYTES} and ${MAX_PASSWORD_BYTES} bytes`,
    })
    .refine(
      (v) => {
        const bytes = Buffer.byteLength(v);
        return bytes >= MIN_PASSWORD_BYTES && bytes <= MAX_PASSWORD_BYTES;
      },
      {
        message: `new_password must be between ${MIN_PASSWORD_BYTES} and ${MAX_PASSWORD_BYTES} bytes`,
      },
    ),
  confirm_password: z.string({
    message: 'confirm_password must be a string',
  }),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;
