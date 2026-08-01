import React from 'react';

interface SettingsProps {
  integrations: any[];
  onToggleIntegration: (id: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function SettingsScreen({
  integrations,
  onToggleIntegration,
  darkMode,
  onToggleDarkMode
}: SettingsProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Workspace Settings</h2>
        <p className="text-[11px] text-secondary mt-0.5">
          Integrate third-party platform databases and modify appearances.
        </p>
      </div>

      {/* Integrations panel */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Active Integrations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border-subtle rounded-lg p-4 flex items-center justify-between gap-4 hover:border-border-default transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-sunken flex items-center justify-center text-xs font-mono font-bold text-accent border border-border-subtle shrink-0">
                  {item.logo}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-foreground">{item.name}</h4>
                  <p className="text-[10px] text-secondary mt-0.5 truncate max-w-sm">
                    {item.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onToggleIntegration(item.id)}
                className={`px-3 py-1 text-[10px] font-semibold rounded border transition-colors shrink-0 ${
                  item.connected
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/20'
                    : 'bg-sunken text-secondary border-border-subtle hover:bg-border-subtle'
                }`}
              >
                {item.connected ? 'Connected' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preference settings */}
      <div className="border-t border-border-subtle pt-6 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">Preferences</h3>
        <div className="bg-card border border-border-subtle rounded-lg p-4 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-foreground">Dark Mode</h4>
            <p className="text-[10px] text-secondary mt-0.5">
              Adapt screen layouts to low light levels.
            </p>
          </div>
          <button
            onClick={onToggleDarkMode}
            className="px-4 py-1.5 bg-sunken hover:bg-border-subtle text-secondary font-medium text-xs rounded border border-border-subtle transition-all"
          >
            {darkMode ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>
      </div>
    </div>
  );
}
