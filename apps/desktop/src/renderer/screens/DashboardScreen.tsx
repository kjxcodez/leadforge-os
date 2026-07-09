import React from 'react'
import { LayoutDashboard, ArrowUp, ArrowDown, CheckCircle2, Rocket, MessageSquare, Database, Play } from 'lucide-react'

interface DashboardProps {
  systemRunning: boolean
  onToggleSystem: () => void
  ipcStatus: string
  timestamp: string
}

export default function DashboardScreen({ systemRunning, onToggleSystem, ipcStatus, timestamp }: DashboardProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Workspace Overview</h2>
          <p className="text-[11px] text-secondary mt-0.5">Track your lead generation performance and system status in real-time.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted bg-sunken border border-border-subtle px-2 py-1 rounded">
            IPC API: {ipcStatus}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'New Companies', value: '124', percent: '12%', up: true, accent: true },
          { label: 'Contacts Enriched', value: '852', percent: '5%', up: true },
          { label: 'Emails Sent', value: '2,410', percent: '2%', up: false },
          { label: 'Reply Rate', value: '3.8%', percent: '0.4%', up: true, accent: true }
        ].map((item, i) => (
          <div key={i} className="bg-card border border-border-subtle p-4 rounded flex flex-col justify-between hover:border-border-default transition-colors">
            <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">{item.label}</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`font-mono text-lg font-semibold leading-none ${item.accent ? 'text-accent' : 'text-foreground'}`}>{item.value}</span>
              <div className={`flex items-center text-[9px] px-1.5 py-0.5 rounded font-medium ${item.up ? 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/20' : 'text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/20'}`}>
                {item.up ? <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDown className="h-2.5 w-2.5 mr-0.5" />} {item.percent}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Graph and Recent activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border-subtle rounded flex flex-col justify-between">
          <div className="p-4 border-b border-border-subtle flex justify-between items-center">
            <h3 className="text-[11px] font-semibold uppercase text-foreground tracking-wider">Outreach Activity</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-[10px] text-secondary">Sent</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-300 dark:bg-indigo-700" />
                <span className="text-[10px] text-secondary">Replied</span>
              </div>
            </div>
          </div>
          <div className="p-5 h-[200px] flex items-end justify-between gap-1.5">
            {[35, 55, 75, 45, 65, 40, 50, 85, 60, 70, 48, 38].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end h-full">
                <div className="bg-accent rounded-t w-full" style={{ height: `${h}%` }} />
                <div className="bg-indigo-300 dark:bg-indigo-800 w-full rounded-t opacity-40" style={{ height: `${h * 0.25}%` }} />
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border-subtle flex justify-between text-[9px] text-muted font-mono">
            <span>Day 1</span>
            <span>Day 15</span>
            <span>Today</span>
          </div>
        </div>

        <div className="bg-card border border-border-subtle rounded flex flex-col">
          <div className="p-4 border-b border-border-subtle">
            <h3 className="text-[11px] font-semibold uppercase text-foreground tracking-wider">Recent Activity</h3>
          </div>
          <div className="flex-1 divide-y divide-border-subtle/40 overflow-y-auto max-h-[220px]">
            {[
              { icon: CheckCircle2, text: 'Contact verified: jane@acme.com', time: '2m ago', color: 'text-emerald-500' },
              { icon: Rocket, text: 'Campaign started: Q4 Outreach', time: '14m ago', color: 'text-indigo-500' },
              { icon: ArrowUp, text: 'New opportunity: Stellar Corp', time: '1h ago', color: 'text-accent' },
              { icon: MessageSquare, text: 'Reply received: Mike Ross', time: '3h ago', color: 'text-amber-500' },
              { icon: Database, text: 'Export completed: Leads.csv', time: '5h ago', color: 'text-slate-500' }
            ].map((item, i) => (
              <div key={i} className="p-3 flex items-start gap-3 hover:bg-sunken/45 transition-colors">
                <item.icon className={`h-4 w-4 shrink-0 mt-0.5 ${item.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground font-medium truncate">{item.text}</p>
                  <span className="text-[9px] text-muted block mt-0.5">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Infrastructure switch */}
      <div className="bg-card border border-border-subtle rounded p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <span className="text-[10px] text-secondary uppercase tracking-wider font-bold">System Infrastructure</span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Job Worker', active: systemRunning },
              { label: 'Scraper Engine', active: systemRunning },
              { label: 'Email Worker', active: false }
            ].map((worker, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-sunken border border-border-subtle rounded text-xs">
                <span className={`w-2 h-2 rounded-full ${worker.active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="font-medium text-foreground">{worker.label}</span>
                <span className={`text-[9px] font-bold ${worker.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {worker.active ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right text-[10px] text-muted font-mono">
            <div>Uptime: 99.98%</div>
            <div>Latency: {timestamp !== 'N/A' ? '42ms' : 'Offline'}</div>
          </div>
          <button 
            onClick={onToggleSystem}
            className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-white font-medium text-xs rounded transition-all flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{systemRunning ? 'Stop Infrastructure' : 'Start Infrastructure'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
