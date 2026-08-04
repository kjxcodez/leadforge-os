import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '../ui/skeleton';
import { SectionCard } from '../common/SectionCard';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number;
  Icon: LucideIcon;
  /** Tailwind text color class for the icon — must use design tokens */
  iconClass?: string;
  isLoading: boolean;
}

/**
 * MetricCard — a single KPI card in the dashboard metrics grid.
 *
 * Enhancements:
 *  - CountUp: animates the displayed number from 0 → value on first mount.
 *  - Hover lift: subtle y-translate + border-color glow on mouse enter.
 *  - Loading state uses Skeleton per design system §7.
 */
export function MetricCard({ label, value, Icon, iconClass, isLoading }: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const DURATION = 900; // ms

  useEffect(() => {
    if (isLoading || value === 0) {
      setDisplayValue(value);
      return;
    }

    // Easing: easeOutCubic for a snappy deceleration feel
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      setDisplayValue(Math.floor(easeOutCubic(progress) * value));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        startTimeRef.current = null;
      }
    };
  }, [value, isLoading]);

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.15, ease: 'easeOut' } }}
      className="cursor-default"
    >
      <SectionCard compact className="flex items-center justify-between gap-3 border border-border-subtle transition-colors duration-150 hover:border-primary/30">
        <div className="space-y-1.5 flex-1 min-w-0">
          <span className="block text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground truncate">
            {label}
          </span>
          {isLoading ? (
            <Skeleton className="h-6 w-16" />
          ) : (
            <div className="text-xl font-semibold text-foreground leading-none tabular-nums font-mono">
              {displayValue.toLocaleString()}
            </div>
          )}
        </div>

        {/* Icon cell — surface-1 card border so it sits at the same elevation */}
        <motion.div
          whileHover={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={[
            'w-8 h-8 rounded-none bg-card border border-border-subtle',
            'flex items-center justify-center shrink-0',
            iconClass ?? 'text-primary'
          ].join(' ')}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4" />
        </motion.div>
      </SectionCard>
    </motion.div>
  );
}
