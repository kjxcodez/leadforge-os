import { z } from 'zod';

export const objectIdField = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'Invalid ObjectId format',
});

export const emailField = z.string().email({ message: 'Invalid email address' });

export const urlField = z.string().url({ message: 'Invalid URL format' }).nullable();

export const nameField = z.string().min(1, { message: 'Name must not be empty' }).max(100);

export const phoneField = z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number' }).nullable();
