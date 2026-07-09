import { z } from 'zod';
import { emailField } from '../fields/common';
import { userSchema } from '../entities/user';

export const loginDtoSchema = z.object({
  email: emailField,
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).optional(),
});
export type LoginDto = z.infer<typeof loginDtoSchema>;

export const registerDtoSchema = z.object({
  email: emailField,
  name: z.string().min(1, { message: 'Name is required' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).optional(),
});
export type RegisterDto = z.infer<typeof registerDtoSchema>;

export const forgotPasswordDtoSchema = z.object({
  email: emailField,
});
export type ForgotPasswordDto = z.infer<typeof forgotPasswordDtoSchema>;

export const resetPasswordDtoSchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
  newPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});
export type ResetPasswordDto = z.infer<typeof resetPasswordDtoSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
