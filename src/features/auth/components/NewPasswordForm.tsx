import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/Form';
import { updatePassword } from '../api';
import { authErrorMessage } from '../errors';
import { newPasswordSchema, type NewPasswordValues } from '../schemas';
import { FormAlert } from './AuthLayout';
import { PasswordInput } from './PasswordInput';

interface Props {
  submitLabel: string;
  onDone: () => void;
}

/** Sets a new password for the signed-in user and refreshes their profile. */
export function NewPasswordForm({ submitLabel, onDone }: Props) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await updatePassword(password);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
      reset();
      onDone();
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <FormField
        label="New password"
        hint="At least 10 characters, including a letter and a number."
        error={errors.password?.message}
      >
        {(field) => <PasswordInput {...field} {...register('password')} autoComplete="new-password" />}
      </FormField>
      <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
        {(field) => <PasswordInput {...field} {...register('confirmPassword')} autoComplete="new-password" />}
      </FormField>
      <Button type="submit" className="w-full sm:w-auto" loading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
