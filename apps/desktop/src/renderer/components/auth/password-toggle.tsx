import { motion } from 'motion/react';

interface PasswordToggleProps {
  show: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * PasswordToggle — interactive password visibility control.
 *
 * Animates between Eye (revealed) and EyeOff (hidden) states:
 *   - Pupil scales to 0 and back dynamically
 *   - Diagonal slash line draws itself using pathLength animation
 *   - Follows DESIGN.md §7: smooth, instant, micro-animations
 */
export function PasswordToggle({ show, onToggle, disabled = false }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="absolute right-3 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
      aria-label={!show ? 'Hide password' : 'Show password'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        {/* Outer eye contour */}
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />

        {/* Pupil - scales down when password is hidden (show = false) */}
        <motion.circle
          cx="12"
          cy="12"
          r="3"
          animate={{
            scale: !show ? 1 : 0,
            opacity: !show ? 1 : 0
          }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          style={{ originX: '12px', originY: '12px' }}
        />

        {/* Diagonal slash - draws itself when password is hidden (!show = false) */}
        <motion.line
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: !show ? 0 : 1,
            opacity: !show ? 0 : 1
          }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        />
      </svg>
    </button>
  );
}
