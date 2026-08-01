interface DividerProps {
  label?: string;
  className?: string;
}

/**
 * Clean separator for layouts.
 * If a label is provided, it centers it within the line path.
 */
export function Divider({ label, className = '' }: DividerProps) {
  return (
    <div className={`relative flex items-center ${className}`} role="separator">
      <div className="flex-grow border-t border-neutral-900" />
      {label && (
        <span className="mx-3 shrink-0 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
          {label}
        </span>
      )}
      <div className="flex-grow border-t border-neutral-900" />
    </div>
  );
}
