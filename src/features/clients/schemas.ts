import { z } from 'zod';

/** Must match the rules in supabase/functions/admin-create-client/validation.ts and the DB check. */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

const fullName = z
  .string()
  .trim()
  .min(2, 'Enter the client’s full name.')
  .max(120, 'Use at most 120 characters.');

const phone = z
  .string()
  .trim()
  .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Enter a valid phone number, e.g. +91 98765 43210.');

export const clientContactSchema = z.object({ fullName, phone });
export type ClientContactValues = z.infer<typeof clientContactSchema>;

export const createClientSchema = z.object({
  fullName,
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address.')
    .max(320)
    .pipe(z.email('Enter a valid email address.')),
  phone,
  temporaryPassword: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(128, 'Use at most 128 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
});
export type CreateClientValues = z.infer<typeof createClientSchema>;
