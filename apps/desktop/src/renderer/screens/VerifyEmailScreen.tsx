import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/auth-store';
import { AuthService } from '../services/auth-service';

const POLL_INTERVAL_MS = 4000; // check every 4 seconds
const MAX_POLL_ATTEMPTS = 30; // ~2 minutes

/**
 * VerifyEmailScreen is shown after registration to prompt email verification.
 *
 * Two mechanisms bring the user forward once their email is verified:
 *  1. Automatic polling: every 4 seconds we re-fetch the session. When
 *     emailVerified is true, the ProtectedRoute guard lets the user through.
 *  2. Manual check: a prominent "I've verified my email" button immediately
 *     re-fetches and navigates, giving the user an explicit escape hatch.
 */
export function VerifyEmailScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, refreshSession } = useAuth();
  const { state } = useAuthStore();
  const email = location.state?.email || state.user?.email || '';

  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-poll ────────────────────────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      setPollAttempts((n) => n + 1);
      try {
        const verified = await refreshSession();
        if (verified) {
          clearInterval(pollRef.current!);
          // ProtectedRoute will now pass through — just navigate to dashboard
          navigate('/', { replace: true });
        }
      } catch {
        // silent — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Stop polling after MAX attempts
  useEffect(() => {
    if (pollAttempts >= MAX_POLL_ATTEMPTS && pollRef.current) {
      clearInterval(pollRef.current);
    }
  }, [pollAttempts]);

  // ── Manual check ─────────────────────────────────────────────────────────
  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const verified = await refreshSession();
      if (verified) {
        toast.success('Email verified! Taking you to the app…');
        navigate('/', { replace: true });
      } else {
        toast.error('Email not verified yet. Please click the link in your inbox first.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not check verification status. Try again.');
    } finally {
      setChecking(false);
    }
  };

  // ── Resend ───────────────────────────────────────────────────────────────
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

  // ── Back to sign in ───────────────────────────────────────────────────────
  const handleBackToSignIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      await logout();
    } catch {}
    navigate('/auth/login', { replace: true });
  };

  const stillPolling = pollAttempts < MAX_POLL_ATTEMPTS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      className="space-y-6 text-center w-full select-none"
    >
      {/* Icon */}
      <div className="w-14 h-14 rounded-none bg-info-muted border border-info/20 flex items-center justify-center mx-auto text-info relative">
        <Mail className="w-7 h-7" />
        {/* Subtle pulse to show polling is active */}
        <AnimatePresence>
          {stillPolling && (
            <motion.span
              key="pulse"
              className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full"
              initial={{ scale: 0.8, opacity: 1 }}
              animate={{ scale: [0.8, 1.3, 0.8], opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-foreground">Check your inbox</h2>
        <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
          We&apos;ve sent a verification link to{' '}
          <span className="font-bold text-foreground">{email || 'your email address'}</span>. Click
          the link to activate your account.
        </p>
        {stillPolling && (
          <p className="text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Checking automatically every few seconds…
          </p>
        )}
      </div>

      {/* Primary CTA — manual check */}
      <button
        type="button"
        onClick={handleCheckNow}
        disabled={checking}
        className="w-full h-9 bg-primary text-primary-foreground text-xs font-semibold rounded-none transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
      >
        {checking ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Checking…
          </>
        ) : (
          <>
            <CheckCircle className="w-3.5 h-3.5" />
            I&apos;ve verified my email
          </>
        )}
      </button>

      {/* Resend */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground">Didn&apos;t receive an email? Check spam or</p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-xs text-primary hover:underline font-bold cursor-pointer disabled:opacity-50"
        >
          {resending ? 'Resending…' : 'Resend verification email'}
        </button>
      </div>

      {/* Footer */}
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
