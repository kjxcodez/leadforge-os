import { z } from 'zod';

export const objectIdField = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: 'Invalid ObjectId format',
});

export const emailField = z.string().email({ message: 'Invalid email address' });

export const urlField = z.string().url({ message: 'Invalid URL format' }).nullable();

export const domainField = z.preprocess((val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (!trimmed) return '';
  try {
    const url = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return trimmed;
  }
}, z.string().regex(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/, { message: 'Invalid domain format' }).or(z.string().length(0)).nullable());

export const nameField = z.string().min(1, { message: 'Name must not be empty' }).max(100);

export const phoneField = z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number' }).nullable();
