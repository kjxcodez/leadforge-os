import { Sparkles } from 'lucide-react';

/**
 * SplashScreen is shown during the initial session restoration check.
 * It renders on the BlankLayout and replaces itself once the auth status resolves.
 */
export function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 select-none">
      {/* Logo mark */}
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-2xl bg-accent/20 animate-ping" />
      </div>

      {/* App name */}
      <div className="text-center space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">LeadForge</h1>
        <p className="text-xs text-muted-foreground">Starting up...</p>
      </div>

      {/* Loading bar */}
      <div className="w-32 h-0.5 rounded-full bg-border-subtle overflow-hidden">
        <div className="h-full bg-accent rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
