import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * SessionExpiredScreen is shown when a session token has expired.
 * It clears navigation state and prompts the user to sign back in.
 */
export function SessionExpiredScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-6 text-center select-none max-w-xs">
      <div className="w-14 h-14 rounded-2xl bg-warning-bg flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-warning-text" />
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Session expired</h2>
        <p className="text-xs text-muted-foreground">
          Your session has timed out for security. Please sign back in to continue.
        </p>
      </div>

      <button
        onClick={() => navigate('/auth/login', { replace: true })}
        className="px-6 py-2 bg-accent text-accent-foreground text-xs font-semibold rounded-md hover:opacity-90 transition-opacity"
      >
        Sign back in
      </button>
    </div>
  );
}
