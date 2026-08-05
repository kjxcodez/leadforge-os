import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { AuthService } from '../services/auth-service';

const schema = z.object({
  email: z.string().email('Please enter a valid email address')
});
type ForgotForm = z.infer<typeof schema>;

/**
 * ForgotPasswordScreen allows users to request a password reset link.
 * In Phase 1 this is a UI-only stub with real IPC wiring deferred to Phase 2.
 *
 * Design updates:
 *   - Squared borders (rounded-none on input, buttons, status indicators).
 *   - Forge primary color accents.
 *   - Entrance animations with Framer Motion.
 *   - Removed raw alerts, linked to sonner toast.
 */
export function ForgotPasswordScreen() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: ForgotForm) => {
    try {
      await AuthService.forgotPassword(data.email);
      setSent(true);
      toast.success(`Reset link dispatched to ${data.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to request password reset.');
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="space-y-6 text-center select-none"
      >
        <div className="w-14 h-14 rounded-none bg-success-muted border border-success/20 flex items-center justify-center mx-auto text-success">
          <Check className="w-6 h-6 stroke-[3]" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">Check your email</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A password reset link has been sent if that email exists in our system.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/auth/login" className="text-xs text-primary hover:underline font-bold">
            Back to sign in
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      className="space-y-6 w-full select-none"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Reset password</h2>
        <p className="text-xs text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="forgot-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Work email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
            className="w-full h-9 px-3 bg-card border border-border-subtle rounded-none text-foreground text-xs placeholder:text-muted-foreground/60 focus-visible:outline-none focus:border-primary font-semibold"
          />
          {errors.email && <p className="text-[10px] text-danger font-semibold mt-0.5">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-9 bg-primary text-primary-foreground text-xs font-semibold rounded-none transition-opacity hover:opacity-90 disabled:opacity-50 select-none cursor-pointer"
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground pt-2">
        <Link to="/auth/login" className="text-primary hover:underline font-bold">
          Back to sign in
        </Link>
      </p>
    </motion.div>
  );
}
