import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

/**
 * VerifyEmailScreen is shown after registration to prompt email verification.
 * Actual verification link processing is handled by the IPC layer in Phase 2.
 *
 * Design updates:
 *   - Squared borders (rounded-none on icon and containers).
 *   - Design system aligned colors (success-muted, info-muted, primary).
 *   - Framer motion entrance spring transition.
 */
export function VerifyEmailScreen() {
  const handleResend = () => {
    toast.success('Verification email resent successfully!');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      className="space-y-6 text-center w-full select-none"
    >
      <div className="w-14 h-14 rounded-none bg-info-muted border border-info/20 flex items-center justify-center mx-auto text-info">
        <Mail className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold text-foreground">Check your inbox</h2>
        <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
          We&apos;ve sent a verification link to your email address. Click the link to activate your
          account.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-[10px] text-muted-foreground">
          Didn&apos;t receive an email? Check spam or
        </p>
        <button
          type="button"
          onClick={handleResend}
          className="text-xs text-primary hover:underline font-bold select-none cursor-pointer"
        >
          Resend verification email
        </button>
      </div>

      <div className="pt-4 border-t border-border-subtle">
        <Link
          to="/auth/login"
          className="text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </motion.div>
  );
}
