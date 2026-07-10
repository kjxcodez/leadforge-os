import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type ForgotForm = z.infer<typeof schema>;

/**
 * ForgotPasswordScreen allows users to request a password reset link.
 * In Phase 1 this is a UI-only stub with real IPC wiring deferred to Phase 2.
 */
export function ForgotPasswordScreen() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (_data: ForgotForm) => {
    // TODO: Wire to auth:forgot-password IPC in Phase 2
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center mx-auto">
          <span className="text-success-text text-xl">✓</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Check your email</p>
          <p className="text-xs text-muted-foreground mt-1">
            A password reset link has been sent if that email exists in our system.
          </p>
        </div>
        <Link to="/auth/login" className="text-xs text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Reset password</h2>
        <p className="text-xs text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="forgot-email" className="text-xs font-medium text-foreground">
            Work email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
            className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.email && (
            <p className="text-[10px] text-danger-text">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-accent text-accent-foreground text-xs font-semibold rounded-md transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/auth/login" className="text-accent hover:underline font-medium">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
