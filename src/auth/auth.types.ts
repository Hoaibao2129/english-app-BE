export type Role = 'user' | 'admin';

export interface PublicUser {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
}

export interface AuthUser {
  user_id: string;
  email: string;
  role: Role;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export type AuthResult = TokenPair & { user: PublicUser };

export interface RegisterInput {
  email: string;
  password: string;
  display_name?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export interface ResetPasswordInput {
  reset_token: string;
  new_password: string;
  confirm_password: string;
}

export interface OtpSentResult {
  message: string;
  expires_in_seconds: number;
}

export interface ResetTokenResult {
  reset_token: string;
  expires_in_seconds: number;
}

export interface MessageResult {
  message: string;
}
