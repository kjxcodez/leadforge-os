import React from 'react'
import { BarChart3, Download, FileText } from 'lucide-react'

export default function ReportsScreen() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Reports & Analytics</h2>
          <p className="text-[11px] text-secondary mt-0.5">Analyze email delivery rates, conversion metrics, and scraping quality.</p>
        </div>
        <button className="h-8 px-3 border border-border-default rounded text-[11px] font-medium text-secondary bg-card hover:bg-sunken flex items-center gap-1.5 transition-colors">
          <Download className="h-3.5 w-3.5" />
          Export Reports
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border-subtle p-5 rounded-lg space-y-4">
          <h3 className="text-xs font-semibold text-foreground">Outreach Funnel</h3>
          <div className="space-y-3">
            {[
              { label: 'Emails Sent', count: '2,410', pct: '100%', width: 'w-full' },
              { label: 'Opened', count: '1,638', pct: '68%', width: 'w-[68%]' },
              { label: 'Replied', count: '433', pct: '18%', width: 'w-[18%]' }
            ].map((step, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-secondary font-medium">{step.label}</span>
                  <span className="font-mono text-foreground font-semibold">{step.count} ({step.pct})</span>
                </div>
                <div className="w-full bg-sunken h-2 rounded-full overflow-hidden">
                  <div className={`bg-accent h-2 rounded-full ${step.width}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border-subtle p-5 rounded-lg space-y-4 md:col-span-2">
          <h3 className="text-xs font-semibold text-foreground">Top Performing Domains</h3>
          <div className="space-y-2">
            {[
              { rank: 1, domain: 'google.com', conversions: 24, rate: '4.2%' },
              { rank: 2, domain: 'stripe.com', conversions: 18, rate: '5.8%' },
              { rank: 3, domain: 'microsoft.com', conversions: 12, rate: '2.1%' }
            ].map((item) => (
              <div key={item.rank} className="flex justify-between items-center py-2 px-3 bg-sunken/45 border border-border-subtle/30 rounded">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted text-[10px]">#{item.rank}</span>
                  <span className="font-mono text-foreground font-semibold">{item.domain}</span>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-secondary font-mono">{item.conversions} replies</span>
                  <span className="text-accent font-mono font-semibold">{item.rate} conv</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
