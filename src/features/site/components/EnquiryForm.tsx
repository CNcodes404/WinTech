import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, Send } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Form';
import { UserFacingError } from '@/lib/errors';
import { ENQUIRY_INTERESTS } from '../content';
import { useSubmitEnquiry } from '../api';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your name.').max(120, 'Use at most 120 characters.'),
  email: z.string().trim().email('Please enter a valid email address.').max(254),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Please enter a valid phone number.'),
  city: z.string().trim().max(80, 'Use at most 80 characters.'),
  interest: z.string(),
  message: z
    .string()
    .trim()
    .min(10, 'Please write at least 10 characters.')
    .max(2000, 'Use at most 2000 characters.'),
  consent: z.boolean().refine((v) => v, 'Please agree so that we can respond to your enquiry.'),
  website: z.string(),
});
type Values = z.infer<typeof schema>;

/** Public enquiry form. Stored via a rate-limited server function; visible to admins only. */
export function EnquiryForm() {
  const formId = useId();
  const submit = useSubmitEnquiry();
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      city: '',
      interest: 'investment',
      message: '',
      consent: false,
      website: '',
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    setFailure(null);
    try {
      await submit.mutateAsync(v);
      setSent(true);
      reset();
    } catch (err) {
      setFailure(
        err instanceof UserFacingError ? err.message : 'Your enquiry could not be sent. Please try again.',
      );
    }
  });

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CircleCheck aria-hidden="true" className="size-8" />
        </span>
        <h3 className="mt-4 text-xl font-bold">Thank you — we have received your enquiry</h3>
        <p className="mt-2 max-w-md text-sm text-muted">
          Our team will get back to you. Eligibility, disclosures and documentation are reviewed before any
          investment arrangement is entered into.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="relative space-y-4 p-6 sm:p-8">
      {failure && (
        <p role="alert" className="rounded-[var(--radius-control)] bg-loss-soft px-3 py-2 text-sm text-loss">
          {failure}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" required error={errors.fullName?.message}>
          {(f) => <Input {...f} {...register('fullName')} autoComplete="name" />}
        </FormField>
        <FormField label="Email" required error={errors.email?.message}>
          {(f) => <Input {...f} {...register('email')} type="email" autoComplete="email" />}
        </FormField>
        <FormField label="Phone" hint="Optional" error={errors.phone?.message}>
          {(f) => <Input {...f} {...register('phone')} type="tel" autoComplete="tel" />}
        </FormField>
        <FormField label="City" hint="Optional" error={errors.city?.message}>
          {(f) => <Input {...f} {...register('city')} autoComplete="address-level2" />}
        </FormField>
      </div>
      <FormField label="I'm interested in" error={errors.interest?.message}>
        {(f) => (
          <Select {...f} {...register('interest')}>
            {ENQUIRY_INTERESTS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Your message" required error={errors.message?.message}>
        {(f) => <Textarea {...f} {...register('message')} rows={4} maxLength={2000} />}
      </FormField>

      {/* Honeypot for bots: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
      </div>

      <div>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            {...register('consent')}
            aria-invalid={errors.consent ? 'true' : undefined}
            className="mt-0.5 size-4 shrink-0 accent-emerald-600"
          />
          <span className="text-muted">
            I agree that WINTECH may contact me about this enquiry and store my details as described in the{' '}
            <Link to="/privacy" className="font-medium text-emerald-700 underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.consent && <p className="mt-1 text-sm text-loss">{errors.consent.message}</p>}
      </div>

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
        <Send aria-hidden="true" className="size-4" />
        Send enquiry
      </Button>
      <p className="text-xs text-muted">
        Submitting an enquiry does not create an investment arrangement. No return or profit is guaranteed.
      </p>
    </form>
  );
}
