import type { ReactNode } from "react";

interface FormCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Clean wrapper component providing standard spacing and alignments for auth forms.
 */
export function FormCard({ children, className = "" }: FormCardProps) {
  return (
    <div className={`space-y-5 w-full ${className}`}>
      {children}
    </div>
  );
}
