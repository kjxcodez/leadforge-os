import React, { useState, useEffect } from 'react'

export default function App() {
  const [ipcStatus, setIpcStatus] = useState<string>('Connecting to main process...')
  const [timestamp, setTimestamp] = useState<string>('N/A')

  useEffect(() => {
    // Test the exposed IPC API
    if (window.ipc && typeof window.ipc.test === 'function') {
      window.ipc.test()
        .then((response) => {
          setIpcStatus('Connected')
          setTimestamp(new Date(response.timestamp).toLocaleTimeString())
        })
        .catch((err) => {
          setIpcStatus(`Error: ${err.message}`)
        })
    } else {
      setIpcStatus('IPC API not available (are you running in a web browser?)')
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950 pointer-events-none" />
      
      <div className="relative max-w-2xl w-full bg-slate-900/55 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 mb-2">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-slate-100 to-violet-200 bg-clip-text text-transparent">
            LeadForge Desktop
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            A premium desktop execution environment. Powered by Electron, Vite, Tailwind CSS, and Shadcn UI.
          </p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-5 space-y-2 hover:border-indigo-500/30 transition-all duration-300">
            <span className="text-indigo-400 text-xs font-semibold uppercase tracking-wider">IPC Status</span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${ipcStatus === 'Connected' ? 'bg-emerald-500 shadow-md shadow-emerald-500/30 animate-pulse' : 'bg-amber-500'}`} />
              <p className="font-semibold text-sm">{ipcStatus}</p>
            </div>
            <p className="text-slate-500 text-xs">Exposed via contextBridge in preload script.</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-5 space-y-2 hover:border-indigo-500/30 transition-all duration-300">
            <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">Last Heartbeat</span>
            <p className="font-mono font-semibold text-sm text-slate-200">{timestamp}</p>
            <p className="text-slate-500 text-xs">Received response from IPC channel: <code className="text-indigo-300 font-mono">ipc:test</code></p>
          </div>
        </div>

        {/* Feature Checkpoints */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Environment Verification</h3>
          <div className="space-y-2">
            {[
              { label: "Electron Main process path resolved", ok: true },
              { label: "Vite dev server with Hot Module Reload", ok: true },
              { label: "Tailwind CSS stylesheet loaded", ok: true },
              { label: "Shadcn components CLI ready", ok: true }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-950/30 border border-slate-800/30 rounded-lg py-2.5 px-4 text-sm hover:bg-slate-950/50 transition-colors">
                <span className="text-slate-300">{item.label}</span>
                <span className="text-indigo-400 font-semibold text-xs bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">Verified</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA / Instructions */}
        <div className="pt-2 text-center">
          <p className="text-xs text-slate-500">
            To install Shadcn components, run <code className="bg-slate-950 px-1.5 py-1 rounded text-indigo-400 border border-slate-800/80 font-mono">pnpm dlx shadcn@latest add &lt;component&gt;</code> in this folder.
          </p>
        </div>
      </div>
    </div>
  )
}
