interface AuthHeaderProps {
  title: string;
  subtitle: string;
  className?: string;
}

/**
 * Centered text header for authentication forms.
 * Displays a clean title and description subtitle.
 */
export function AuthHeader({ title, subtitle, className = "" }: AuthHeaderProps) {
  return (
    <div className={`space-y-1.5 text-center ${className}`}>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
        {title}
      </h1>
      <p className="text-xs text-neutral-500">
        {subtitle}
      </p>
    </div>
  );
}
