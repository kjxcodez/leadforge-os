export interface LoginDto {
  email: string;
  password?: string; // Optional if using magic links/SSO
}

export interface RegisterDto {
  email: string;
  name: string;
  password?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface AuthResponse {
  token: string;
  user: import('../entities/user').User;
}
