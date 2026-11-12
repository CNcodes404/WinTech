import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(320, 'Email address is too long.')
  .pipe(z.email('Enter a valid email address.'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(128),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/** Password policy for new passwords (also configure the same minimum in Supabase Auth settings). */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(128, 'Use at most 128 characters.')
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/[0-9]/, 'Include at least one number.'),
    confirmPassword: z.string().min(1, 'Re-enter your new password.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
