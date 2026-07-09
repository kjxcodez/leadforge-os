import { z } from 'zod';
import { emailField } from '../fields/common';

export const loginDtoSchema = z.object({
  email: emailField,
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).optional(),
});

export const registerDtoSchema = z.object({
  email: emailField,
  name: z.string().min(1, { message: 'Name is required' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).optional(),
});

export const forgotPasswordDtoSchema = z.object({
  email: emailField,
});

export const resetPasswordDtoSchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
  newPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});
