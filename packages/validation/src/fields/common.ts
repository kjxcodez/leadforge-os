import { z } from 'zod';
import { isValidObjectId } from '@leadforge/shared';

export const objectIdField = z.string().refine((val) => isValidObjectId(val), {
  message: 'Invalid ObjectId format',
});

export const emailField = z.string().email({ message: 'Invalid email address' });

export const urlField = z.string().url({ message: 'Invalid URL format' }).nullable();

export const nameField = z.string().min(1, { message: 'Name must not be empty' }).max(100);

export const phoneField = z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number' }).nullable();
