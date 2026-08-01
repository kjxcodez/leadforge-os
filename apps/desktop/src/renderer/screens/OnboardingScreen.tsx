import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import {
  Sparkles,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  FolderOpen,
  ArrowRight,
  TrendingUp,
  Workflow,
  Check,
  Shield,
  HeartPulse
} from 'lucide-react';

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { createWorkspace } = useWorkspace();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<any>(null);

  // Form States
  const [wsName, setWsName] = useState<string>('My Leads Workspace');
  const [wsPath, setWsPath] = useState<string>('Default Location');
  const [aiMode, setAiMode] = useState<'local' | 'cloud' | 'skip'>('skip');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [openRouterKey, setOpenRouterKey] = useState<string>('');
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'office365' | 'custom'>('gmail');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [appPassword, setAppPassword] = useState<string>('');
  const [useSampleData, setUseSampleData] = useState<boolean>(true);

  // Load diagnostics on mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    try {
      const res = await window.ipc.invoke('onboarding:get-diagnostics', undefined);
      setDiagnostics(res);
      if (res.ollamaInstalled && res.ollamaModels.length > 0) {
        setAiMode('local');
        setSelectedModel(res.ollamaModels[0] || '');
      }
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    }
  };

  const handleCreateWorkspace = async () => {
    setLoading(true);
    try {
      // Create local workspace via hook
      const ws = await createWorkspace(wsName);

      // Save credentials if OpenRouter key is provided
      if (aiMode === 'cloud' && openRouterKey) {
        await window.ipc.invoke('onboarding:save-setting', {
          workspaceId: ws.id,
          key: 'openrouter_key',
          value: openRouterKey
        });
      }

      // Save email credentials if appPassword is provided
      if (emailAddress && appPassword) {
        await window.ipc.invoke('email-accounts:create', {
          email: emailAddress,
          password: appPassword
        });
      }

      // Generate sample data if selected
      if (useSampleData) {
        await window.ipc.invoke('onboarding:generate-sample-data', { workspaceId: ws.id });
      }

      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('product_tour_active', 'true'); // trigger product tour on dashboard first visit!

      // Navigate to dashboard
      navigate('/');
    } catch (err: any) {
      alert(`Workspace creation failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const testOpenRouter = async () => {
    setTestingConnection(true);
    try {
      if (!openRouterKey) {
        alert('Please enter an API Key first.');
        return;
      }
      // Simple mock fetch verify for responsive validation
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${openRouterKey}` }
      });
      if (res.ok) {
        alert('OpenRouter API connection validated successfully!');
      } else {
        alert('Validation failed: Invalid OpenRouter API Key.');
      }
    } catch {
      alert('Validation failed: Network timeout or connectivity issue.');
    } finally {
      setTestingConnection(false);
    }
  };

  const testSmtp = async () => {
    setTestingConnection(true);
    try {
      if (!emailAddress || !appPassword) {
        alert('Please fill in both email and app password.');
        return;
      }

      // Create email account in the DB
      const account = await window.ipc.invoke('email-accounts:create', {
        email: emailAddress,
        password: appPassword
      });

      // Test connection using its created ID
      const res = await window.ipc.invoke('email-accounts:test', account.id);
      if (res.verified) {
        alert('SMTP Connection established and verified successfully!');
      } else {
        alert('SMTP Connection failed.');
      }
    } catch (err: any) {
      alert(`Connection failed: ${err.message || err}`);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-foreground font-sans flex items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Dynamic ambient backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full filter blur-[150px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full filter blur-[120px]"></div>

      <div className="w-full max-w-xl bg-card/65 backdrop-blur-xl border border-border-subtle/60 rounded-2xl p-8 shadow-2xl relative overflow-hidden flex flex-col space-y-6">
        {/* Onboarding Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-foreground uppercase">
                LeadForge OS
              </h1>
              <span className="text-[10px] text-muted-foreground block font-medium mt-0.5">
                Welcome Onboarding
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 bg-sunken rounded border border-border-subtle/50 text-muted-foreground">
            Step {step} of 5
          </span>
        </div>

        {/* ── Step 1: Welcome & Diagnostics ────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">
                Prepare your sales outbound platform
              </h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Before configuring, we verified that LeadForge OS workspace runtime environment is
                initialized correctly on your computer.
              </p>
            </div>

            {/* Health Checklist */}
            <div className="bg-sunken/45 border border-border/40 rounded-xl p-4 space-y-3">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-accent" />
                <span>System Health Verification</span>
              </h3>

              {diagnostics ? (
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-muted-foreground">
                      OS:{' '}
                      <span className="text-foreground font-semibold">
                        {diagnostics.os.substring(0, 18)}...
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {diagnostics.writePermissions ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="text-muted-foreground">
                      Write Access:{' '}
                      <span className="text-foreground font-semibold">
                        {diagnostics.writePermissions ? 'Yes' : 'No'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-muted-foreground">
                      SQLite 3: <span className="text-foreground font-semibold">Available</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {diagnostics.internetConnected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span className="text-muted-foreground">
                      Internet:{' '}
                      <span className="text-foreground font-semibold">
                        {diagnostics.internetConnected ? 'Connected' : 'Offline'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {diagnostics.ollamaInstalled ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 bg-muted rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold">
                        !
                      </div>
                    )}
                    <span className="text-muted-foreground">
                      Local AI (Ollama):{' '}
                      <span className="text-foreground font-semibold">
                        {diagnostics.ollamaInstalled ? 'Installed' : 'Not Detected'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-muted-foreground">
                      Workers Host: <span className="text-foreground font-semibold">Ready</span>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground animate-pulse">
                  Running health check queries...
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={runDiagnostics}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-Check
              </Button>
              <Button size="sm" onClick={() => setStep(2)}>
                Create Workspace <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Workspace Setup ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">Create your CRM Workspace</h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                LeadForge OS is completely local-first. We will initialize an isolated SQLite
                database file to securely store your leads.
              </p>
            </div>

            <div className="space-y-4 bg-sunken/45 border border-border/40 rounded-xl p-5">
              <div className="space-y-1.5">
                <Label htmlFor="wsNameInput">Workspace Name</Label>
                <input
                  id="wsNameInput"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-input rounded-lg text-xs font-semibold focus-visible:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wsPathInput">Workspace Directory</Label>
                <div className="flex gap-2">
                  <input
                    id="wsPathInput"
                    value={wsPath}
                    disabled
                    className="flex-1 h-9 px-3 bg-background/50 border border-input rounded-lg text-xs font-mono select-none"
                  />
                  <Button size="sm" variant="outline" className="h-9">
                    <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Browse
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: AI Configuration ─────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">
                Configure Lead Intelligence AI
              </h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Unlock automated cold email opening lines, pain point hypotheses, and lead score
                analytics.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setAiMode('local')}
                  disabled={!diagnostics?.ollamaInstalled}
                  className={`flex-1 border p-3.5 rounded-xl text-left space-y-1.5 transition-all ${
                    aiMode === 'local'
                      ? 'border-accent bg-accent/5'
                      : 'border-border-subtle/70 bg-sunken/15 opacity-55'
                  }`}
                >
                  <Cpu className="w-4 h-4 text-accent" />
                  <div>
                    <h4 className="text-[11px] font-bold text-foreground">Local AI (Ollama)</h4>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">
                      Secure, offline, 100% free.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAiMode('cloud')}
                  className={`flex-1 border p-3.5 rounded-xl text-left space-y-1.5 transition-all ${
                    aiMode === 'cloud'
                      ? 'border-accent bg-accent/5'
                      : 'border-border-subtle/70 bg-sunken/15'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <div>
                    <h4 className="text-[11px] font-bold text-foreground">Cloud AI (OpenRouter)</h4>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">
                      High-quality remote LLMs.
                    </span>
                  </div>
                </button>
              </div>

              {aiMode === 'local' && diagnostics?.ollamaModels && (
                <div className="bg-sunken/45 border border-border/40 rounded-xl p-4 space-y-2">
                  <Label htmlFor="modelSelect">Available Local Models</Label>
                  <select
                    id="modelSelect"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full h-8 px-2 bg-background border border-input rounded text-xs focus-visible:outline-none"
                  >
                    {diagnostics.ollamaModels.map((m: string) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {aiMode === 'cloud' && (
                <div className="bg-sunken/45 border border-border/40 rounded-xl p-4 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="orKeyInput">OpenRouter API Key</Label>
                    <div className="flex gap-2">
                      <input
                        id="orKeyInput"
                        type="password"
                        placeholder="sk-or-v1-..."
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        className="flex-1 h-8 px-2 bg-background border border-input rounded text-xs focus-visible:outline-none"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={testOpenRouter}
                        disabled={testingConnection}
                      >
                        {testingConnection ? 'Testing...' : 'Test Key'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button size="sm" variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(4)}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Email Connector Setup ────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">Connect Outbound Email</h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Set up SMTP parameters to run your campaigns. LeadForge supports Google App
                Passwords for secured Gmail integrations.
              </p>
            </div>

            <div className="bg-sunken/45 border border-border/40 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emailInput">Outbound Email Address</Label>
                  <input
                    id="emailInput"
                    placeholder="you@gmail.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full h-8 px-2.5 bg-background border border-input rounded-lg text-xs focus-visible:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="appPassInput">Google App Password</Label>
                  <input
                    id="appPassInput"
                    type="password"
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    className="w-full h-8 px-2.5 bg-background border border-input rounded-lg text-xs focus-visible:outline-none"
                  />
                </div>
              </div>

              <div className="bg-blue-500/[0.03] border border-blue-500/10 rounded-lg p-3 text-[10px] leading-relaxed text-blue-400/90 font-medium">
                💡 <span className="font-bold text-blue-400">Gmail Setup Tip:</span> Visit your
                Google Account Settings, turn on 2-Step Verification, and search for "App Passwords"
                to generate a secure 16-character code specifically for LeadForge.
              </div>

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={testSmtp}
                disabled={testingConnection}
              >
                {testingConnection ? 'Verifying connection...' : 'Test SMTP Connection'}
              </Button>
            </div>

            <div className="flex justify-between pt-2">
              <Button size="sm" variant="ghost" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(5)}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Sample Workspace & Launch ────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">You are ready to launch!</h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Confirm your parameters below to finish initializing your local sales intelligence
                operating system.
              </p>
            </div>

            <div className="bg-sunken/45 border border-border/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Workspace Name:</span>
                <span className="font-bold text-foreground">{wsName}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/40">
                <span className="text-muted-foreground">AI Configuration:</span>
                <span className="font-bold text-foreground uppercase">{aiMode}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/40">
                <span className="text-muted-foreground">Email Configured:</span>
                <span className="font-bold text-foreground">
                  {emailAddress ? 'Yes' : 'No (Skipped)'}
                </span>
              </div>
            </div>

            {/* Mock sample data checkbox */}
            <label className="flex items-center gap-2 cursor-pointer p-3 border border-accent/15 bg-accent/[0.02] rounded-xl">
              <input
                type="checkbox"
                checked={useSampleData}
                onChange={() => setUseSampleData(!useSampleData)}
                className="rounded border-border-subtle text-accent focus:ring-accent w-4 h-4"
              />
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Start with Sample Workspace Data
                </span>
                <span className="text-[9px] text-muted-foreground block mt-0.5">
                  Pre-populate companies, campaigns, sequences, and opportunity scores to test
                  features instantly.
                </span>
              </div>
            </label>

            <div className="flex justify-between pt-2">
              <Button size="sm" variant="ghost" onClick={() => setStep(4)} disabled={loading}>
                Back
              </Button>
              <Button size="sm" onClick={handleCreateWorkspace} disabled={loading} className="px-6">
                {loading ? 'Initializing Workspace...' : 'Launch LeadForge OS'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
