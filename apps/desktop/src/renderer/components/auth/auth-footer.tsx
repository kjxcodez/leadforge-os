interface AuthFooterProps {
  message: string;
  linkText: string;
  onLinkClick: () => void;
  className?: string;
}

/**
 * Standard bottom footer for forms providing action links.
 * Incorporates a secondary note for Terms and Privacy policies.
 */
export function AuthFooter({ message, linkText, onLinkClick, className = '' }: AuthFooterProps) {
  return (
    <div className={`space-y-4 text-center ${className}`}>
      <p className="text-xs text-neutral-500">
        {message}{' '}
        <button
          type="button"
          onClick={onLinkClick}
          className="font-medium text-neutral-300 hover:text-neutral-100 focus:outline-none focus:underline cursor-pointer"
        >
          {linkText}
        </button>
      </p>

      <p className="text-[10px] leading-relaxed text-neutral-600">
        By continuing, you agree to our{' '}
        <a href="#" className="underline hover:text-neutral-400">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="underline hover:text-neutral-400">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
