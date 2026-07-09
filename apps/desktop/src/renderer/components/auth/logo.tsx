import { Hexagon } from "lucide-react";

interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * Standard product logo mark.
 * Uses a clean geometric Hexagon representation matching the design system.
 */
export function Logo({ className = "", size = 20 }: LogoProps) {
  return (
    <Hexagon
      className={`text-neutral-200 ${className}`}
      size={size}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );
}
