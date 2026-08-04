import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useWorkspace } from '../hooks/useWorkspace';
import { useUIStore } from '../stores/ui-store';
import { toast } from 'sonner';
import {
  Sparkles,
  Key,
  Terminal,
  Monitor,
  Eye,
  EyeOff,
  Keyboard,
  ShieldCheck,
  Brain
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function PreferencesScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const { state: uiState, setTheme } = useUIStore();

  const [openRouterKey, setOpenRouterKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [aiMode, setAiMode] = useState<'mock' | 'cloud'>('mock');
  const [loggingLevel, setLoggingLevel] = useState('info');
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load configuration settings from database
  useEffect(() => {
    if (!workspaceId) return;

    window.ipc.invoke('settings:get-all' as any, { workspaceId })
      .then((settings: Record<string, string>) => {
        if (settings.openrouter_key) setOpenRouterKey(settings.openrouter_key);
        if (settings.ai_mode) setAiMode(settings.ai_mode as 'mock' | 'cloud');
        if (settings.logging_level) setLoggingLevel(settings.logging_level);
        if (settings.telemetry_enabled) {
          setTelemetryEnabled(settings.telemetry_enabled === 'true');
        }
      })
      .catch(() => {
        toast.error('Failed to load user preferences.');
      });
  }, [workspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setSaving(true);

    try {
      // Save AI mode
      await window.ipc.invoke('onboarding:save-setting' as any, {
        workspaceId,
        key: 'ai_mode',
        value: aiMode
      });

      // Save OpenRouter key
      await window.ipc.invoke('onboarding:save-setting' as any, {
        workspaceId,
        key: 'openrouter_key',
        value: openRouterKey.trim()
      });

      // Save Logging Level
      await window.ipc.invoke('onboarding:save-setting' as any, {
        workspaceId,
        key: 'logging_level',
        value: loggingLevel
      });

      // Save Telemetry
      await window.ipc.invoke('onboarding:save-setting' as any, {
        workspaceId,
        key: 'telemetry_enabled',
        value: String(telemetryEnabled)
      });

      toast.success('Preferences saved successfully.');
    } catch (err: any) {
      toast.error(`Failed to save preferences: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-xs font-sans h-full overflow-y-auto pr-1 select-none">
      <PageHeader
        title="Personal Preferences"
        description="Configure your personal workspace settings, theme choices, AI engines, and telemetry levels."
      />

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        {/* SECTION 1: Theme & Display Preferences */}
        <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-2">
            <Monitor className="w-3.5 h-3.5 text-primary" />
            Display & UI Theme
          </h3>
          <div className="space-y-3">
            <Label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
              Select Theme Accent
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`px-4 py-3 rounded-none border text-[11px] font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer flex flex-col items-center gap-1.5 ${
                    uiState.theme === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-subtle bg-surface-3/50 text-muted-foreground hover:text-foreground hover:bg-surface-3'
                  }`}
                >
                  <span className="capitalize">{t} Mode</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 2: AI Engine Configuration */}
        <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-2">
            <Brain className="w-3.5 h-3.5 text-primary" />
            AI Language Engine Settings
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                AI Generation Provider
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAiMode('mock')}
                  className={`px-4 py-3 rounded-none border text-[11px] font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                    aiMode === 'mock'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-subtle bg-surface-3/50 text-muted-foreground hover:text-foreground hover:bg-surface-3'
                  }`}
                >
                  Mock Engine (Developer Mode)
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode('cloud')}
                  className={`px-4 py-3 rounded-none border text-[11px] font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                    aiMode === 'cloud'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-subtle bg-surface-3/50 text-muted-foreground hover:text-foreground hover:bg-surface-3'
                  }`}
                >
                  OpenRouter API (Cloud Mode)
                </button>
              </div>
            </div>

            {aiMode === 'cloud' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1.5"
              >
                <Label htmlFor="openrouter-key" className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                  OpenRouter API Authorization Key
                </Label>
                <div className="relative">
                  <Input
                    id="openrouter-key"
                    type={showKey ? 'text' : 'password'}
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="rounded-none pr-9 font-mono border-border-subtle"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed pt-0.5">
                  Your API Key will be securely encrypted locally on your hard disk using system-level cryptography.
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* SECTION 3: System Logging & Telemetry */}
        <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-2">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            Telemetry & System Logs
          </h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                Logging Output Verbosity
              </Label>
              <select
                value={loggingLevel}
                onChange={(e) => setLoggingLevel(e.target.value)}
                className="w-full bg-card border border-border-subtle rounded-none px-3 py-2 text-xs outline-none text-foreground focus:ring-1 focus:ring-ring h-9"
              >
                <option value="debug">DEBUG (Verbose trace logs)</option>
                <option value="info">INFO (Recommended default)</option>
                <option value="warn">WARNINGS (Only highlights errors)</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <div className="space-y-0.5">
                <span className="block font-semibold text-foreground">Enable Performance Telemetry</span>
                <span className="text-[10px] text-muted-foreground">Anonymous usage and performance statistics.</span>
              </div>
              <input
                type="checkbox"
                checked={telemetryEnabled}
                onChange={(e) => setTelemetryEnabled(e.target.checked)}
                className="h-4 w-4 rounded-none border-border-subtle text-primary focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Keyboard Shortcuts Quick Reference */}
        <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border-subtle pb-2">
            <Keyboard className="w-3.5 h-3.5 text-primary" />
            Global Keyboard Shortcuts
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
              <span className="text-muted-foreground">Trigger Command Search Palette</span>
              <kbd className="px-1.5 py-0.5 bg-surface-3 border border-border-subtle font-mono text-[10px] rounded-none">
                Ctrl + K
              </kbd>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
              <span className="text-muted-foreground">Dismiss Panel/Overlay</span>
              <kbd className="px-1.5 py-0.5 bg-surface-3 border border-border-subtle font-mono text-[10px] rounded-none">
                ESC
              </kbd>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
              <span className="text-muted-foreground">Submit Form Dialogs</span>
              <kbd className="px-1.5 py-0.5 bg-surface-3 border border-border-subtle font-mono text-[10px] rounded-none">
                Enter
              </kbd>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
              <span className="text-muted-foreground">Navigation Sidebar Collapse</span>
              <kbd className="px-1.5 py-0.5 bg-surface-3 border border-border-subtle font-mono text-[10px] rounded-none">
                Ctrl + B
              </kbd>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={saving} className="rounded-none w-32 h-9 font-semibold">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}
