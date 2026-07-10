import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

/**
 * VerifyEmailScreen is shown after registration to prompt email verification.
 * Actual verification link processing is handled by the IPC layer in Phase 2.
 */
export function VerifyEmailScreen() {
  return (
    <div className="space-y-6 text-center w-full">
      <div className="w-14 h-14 rounded-2xl bg-info-bg flex items-center justify-center mx-auto">
        <Mail className="w-7 h-7 text-info-text" />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Check your inbox</h2>
        <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
          We&apos;ve sent a verification link to your email address. Click the link to activate your account.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-[10px] text-muted-foreground">Didn&apos;t receive an email? Check spam or</p>
        <button className="text-xs text-accent hover:underline font-medium">
          Resend verification email
        </button>
      </div>

      <div className="pt-4 border-t border-border-subtle">
        <Link to="/auth/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
