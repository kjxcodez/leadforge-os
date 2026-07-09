import type { ReactNode } from "react";

interface ContentPanelProps {
  children?: ReactNode;
}

/**
 * Left-side container for authentication content.
 * Centers a fixed-width column vertically and horizontally.
 * Currently renders placeholder content — forms slot in here later.
 */
export function ContentPanel({ children }: ContentPanelProps) {
  return (
    <div className="flex h-full w-full items-center justify-center px-8">
      <div className="w-full max-w-[360px]">
        {children ?? (
          <div className="rounded-md border border-dashed border-neutral-800 p-8 text-center">
            <p className="text-sm text-neutral-500">
              Authentication content placeholder
            </p>
          </div>
        )}
      </div>
    </div>
  );
}