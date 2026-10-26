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
