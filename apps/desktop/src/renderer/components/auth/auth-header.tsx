interface AuthHeaderProps {
  title: string;
  subtitle: string;
  className?: string;
}

/**
 * Centered text header for authentication forms.
 * Typography follows DESIGN.md §3: heading-md (20px/28px, 600) for title,
 * body-sm (13px/20px, 400) for subtitle.
 */
export function AuthHeader({ title, subtitle, className = '' }: AuthHeaderProps) {
  return (
    <div className={`space-y-1.5 text-center ${className}`}>
      <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
      <p className="text-[13px] leading-5 text-muted-foreground">{subtitle}</p>
    </div>
  );
}
