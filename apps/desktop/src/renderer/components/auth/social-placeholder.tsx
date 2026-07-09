import { Chrome } from "lucide-react";

interface SocialLoginPlaceholderProps {
  className?: string;
  onGoogleClick?: () => void;
}

/**
 * Visual placeholder for social authentication.
 * Kept disabled since OAuth integration is scheduled for later phases.
 */
export function SocialLoginPlaceholder({
  className = "",
  onGoogleClick,
}: SocialLoginPlaceholderProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        disabled={!onGoogleClick}
        onClick={onGoogleClick}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-neutral-900 bg-neutral-950 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-900/50 hover:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-800 disabled:opacity-50 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-300 cursor-pointer"
      >
        <Chrome className="h-3.5 w-3.5" strokeWidth={1.5} />
        Continue with Google
      </button>
    </div>
  );
}
