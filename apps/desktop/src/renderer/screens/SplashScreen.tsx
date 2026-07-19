import { useEffect, useState } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';

interface BootStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed';
}

/**
 * SplashScreen displays LeadForge startup branding, checklist progress,
 * and handles transitions from booting to ready states.
 */
export function SplashScreen() {
  const [steps, setSteps] = useState<BootStep[]>([
    { id: 'session', label: 'Restoring user session', status: 'loading' },
    { id: 'database:open', label: 'Opening workspace database', status: 'pending' },
    { id: 'database:migrations', label: 'Applying database migrations', status: 'pending' },
    { id: 'scheduler:start', label: 'Starting job scheduler', status: 'pending' },
    { id: 'sync:start', label: 'Starting cloud sync engine', status: 'pending' },
    { id: 'automation:start', label: 'Starting automation runtime', status: 'pending' },
  ]);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Listen for progress updates from the main process
    const handleProgress = (data: any) => {
      setSteps((prev) => {
        return prev.map((s) => {
          if (s.id === 'session') {
            return { ...s, status: 'completed' };
          }
          if (s.id === data.step) {
            return { ...s, status: 'loading' };
          }
          const targetIndex = prev.findIndex((item) => item.id === data.step);
          const currentIndex = prev.findIndex((item) => item.id === s.id);
          if (currentIndex !== -1 && targetIndex !== -1 && currentIndex < targetIndex) {
            return { ...s, status: 'completed' };
          }
          return s;
        });
      });

      if (data.step === 'ready') {
        setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
        setIsFadingOut(true);
      }
    };

    const unsubscribe = window.ipc.on('workspace:boot-progress' as any, handleProgress);
    return () => {
      try {
        unsubscribe();
      } catch (err) {
        // Ignore
      }
    };
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center gap-8 select-none max-w-sm w-full p-6 transition-all duration-500 ease-in-out ${isFadingOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
      {/* Logo mark */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30 animate-in zoom-in duration-300">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-accent/20 animate-ping" />
      </div>

      {/* App name */}
      <div className="text-center space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">LeadForge</h1>
        <p className="text-[11px] text-secondary">Initializing workspace runtime environment...</p>
      </div>

      {/* Checklist */}
      <div className="w-full bg-card border border-border-subtle rounded-xl p-4 space-y-3.5 shadow-sm">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between text-xs">
            <span className={`font-medium ${step.status === 'loading' ? 'text-accent' : step.status === 'completed' ? 'text-secondary' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
            <div className="flex items-center shrink-0">
              {step.status === 'completed' && (
                <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
              {step.status === 'loading' && (
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
              )}
              {step.status === 'pending' && (
                <div className="w-3.5 h-3.5 rounded-full border border-border-subtle bg-sunken" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tagline info */}
      <p className="text-[10px] text-muted tracking-wider uppercase">Local-first • SQLite Isolated • Sync Queue</p>
    </div>
  );
}
