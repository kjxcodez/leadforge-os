import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * SessionExpiredScreen is shown when a session token has expired.
 * It clears navigation state and prompts the user to sign back in.
 *
 * Design updates:
 *   - Squared layout card (rounded-none, border, card background).
 *   - Circular ambient pulsing glows in the background.
 *   - Decorative corner dot matrices.
 *   - Entrance animations using Framer Motion.
 */
export function SessionExpiredScreen() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 h-screen w-screen bg-[#05070a] text-foreground font-sans flex items-center justify-center p-6 select-none overflow-hidden">
      {/* Background ambient glowing shapes */}
      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.12, 0.22, 0.12]
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="absolute top-[-25%] left-[-15%] w-[65%] h-[65%] bg-primary/20 rounded-none filter blur-[150px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.18, 1],
          opacity: [0.08, 0.16, 0.08]
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2
        }}
        className="absolute bottom-[-20%] right-[-15%] w-[55%] h-[55%] bg-info/12 rounded-none filter blur-[130px] pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-sm bg-card border border-border-subtle rounded-none p-10 shadow-elevation-3 relative overflow-hidden flex flex-col items-center justify-center text-center space-y-6"
      >
        {/* Top-left decorative dots */}
        <svg
          className="absolute top-3 left-3 opacity-30 text-primary w-10 h-10"
          fill="currentColor"
          viewBox="0 0 100 100"
        >
          {[...Array(4)].map((_, r) =>
            [...Array(4)].map((_, c) => (
              <circle key={`${r}-${c}`} cx={15 + c * 23} cy={15 + r * 23} r="3" />
            ))
          )}
        </svg>

        {/* Bottom-right decorative dots */}
        <svg
          className="absolute bottom-3 right-3 opacity-30 text-info w-10 h-10"
          fill="currentColor"
          viewBox="0 0 100 100"
        >
          {[...Array(4)].map((_, r) =>
            [...Array(4)].map((_, c) => (
              <circle key={`${r}-${c}`} cx={15 + c * 23} cy={15 + r * 23} r="3" />
            ))
          )}
        </svg>

        {/* Alarm Alert Icon Frame */}
        <div className="w-14 h-14 rounded-none bg-warning-muted border border-warning/20 flex items-center justify-center text-warning relative">
          <div className="absolute inset-0 bg-warning/5 blur-lg rounded-none scale-125" />
          <AlertTriangle className="w-7 h-7 relative z-10" />
        </div>

        <div className="space-y-2 relative z-10">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground">Session expired</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your session has timed out for security. Please sign back in to continue.
          </p>
        </div>

        <button
          onClick={() => navigate('/auth/login', { replace: true })}
          className="w-full h-9 bg-primary text-primary-foreground text-xs font-semibold rounded-none hover:opacity-90 transition-opacity select-none cursor-pointer relative z-10"
        >
          Sign back in
        </button>
      </motion.div>
    </div>
  );
}
