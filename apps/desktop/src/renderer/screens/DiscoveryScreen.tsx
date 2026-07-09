import React, { useState } from 'react'
import { Search, Sparkles, Cpu, RefreshCw } from 'lucide-react'

export default function DiscoveryScreen() {
  const [running, setRunning] = useState(false)
  const [domain, setDomain] = useState('')
  const [results, setResults] = useState<string[]>([])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain) return
    setRunning(true)
    setResults([])
    setTimeout(() => {
      setRunning(false)
      setResults([
        `ceo@${domain}`,
        `growth@${domain}`,
        `sales@${domain}`,
        `info@${domain}`
      ])
    }, 1500)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Discovery Search</h2>
        <p className="text-[11px] text-secondary mt-0.5">Scrape contacts, verify emails, and enrich target domain records.</p>
      </div>

      <div className="max-w-xl bg-card border border-border-subtle p-5 rounded-lg space-y-4">
        <form onSubmit={handleSearch} className="space-y-3">
          <label className="text-[10px] text-muted uppercase tracking-wider font-bold">Target domain</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. stripe.com" 
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="bg-sunken border border-border-subtle rounded px-3 py-1.5 flex-1 focus:ring-1 focus:ring-accent/20 outline-none text-xs font-mono"
            />
            <button 
              type="submit"
              disabled={running}
              className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-white rounded font-medium text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              <span>Find Leads</span>
            </button>
          </div>
        </form>

        <div className="border-t border-border-subtle/50 pt-4 space-y-2">
          <span className="text-[10px] text-muted uppercase tracking-wider font-bold block">Discovery Engines</span>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-sunken border border-border-subtle rounded flex items-center justify-between">
              <span className="font-medium text-foreground">LinkedIn Scraper</span>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">READY</span>
            </div>
            <div className="p-3 bg-sunken border border-border-subtle rounded flex items-center justify-between">
              <span className="font-medium text-foreground">MX Verification</span>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">READY</span>
            </div>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-card border border-border-subtle rounded-lg p-4 max-w-xl space-y-2">
          <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Scraping Results for {domain}</span>
          <div className="space-y-1.5">
            {results.map((email, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 px-3 bg-sunken/40 border border-border-subtle/30 rounded font-mono text-xs">
                <span className="text-foreground">{email}</span>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> Verified
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
