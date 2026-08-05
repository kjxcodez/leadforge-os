import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/auth-store';
import { AuthService } from '../services/auth-service';

/**
 * VerifyEmailScreen is shown after registration to prompt email verification.
 * Actual verification link processing is handled by the API hosted webpage.
 */
export function VerifyEmailScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { state } = useAuthStore();
  const email = location.state?.email || state.user?.email || '';

  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('Email address is missing. Please sign in again.');
      return;
    }
    setResending(true);
    try {
      await AuthService.resendVerificationEmail(email);
      toast.success('Verification email resent successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToSignIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await logout();
    } catch {}
    navigate('/auth/login', { replace: true });
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
          We&apos;ve sent a verification link to{' '}
          <span className="font-bold text-foreground">{email || 'your email address'}</span>. Click the
          link to activate your account.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-[10px] text-muted-foreground">
          Didn&apos;t receive an email? Check spam or
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-xs text-primary hover:underline font-bold select-none cursor-pointer disabled:opacity-50"
        >
          {resending ? 'Resending...' : 'Resend verification email'}
        </button>
      </div>

      <div className="pt-4 border-t border-border-subtle">
        <a
          href="#/auth/login"
          onClick={handleBackToSignIn}
          className="text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
        >
          Back to sign in
        </a>
      </div>
    </motion.div>
  );
}
