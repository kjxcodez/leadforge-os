interface DividerProps {
  label?: string;
  className?: string;
}

/**
 * Clean separator for layouts.
 * If a label is provided, it centers it within the line.
 * Uses border-subtle and text-tertiary per DESIGN.md §2.
 */
export function Divider({ label, className = '' }: DividerProps) {
  return (
    <div className={`relative flex items-center ${className}`} role="separator">
      <div className="flex-grow border-t border-border-subtle" />
      {label && (
        <span className="mx-3 shrink-0 text-[11px] font-medium uppercase tracking-[0.04em] text-text-tertiary">
          {label}
        </span>
      )}
      <div className="flex-grow border-t border-border-subtle" />
    </div>
  );
}
