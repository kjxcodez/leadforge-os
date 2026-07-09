import React, { useState } from 'react'
import { Plus, Megaphone, Check } from 'lucide-react'

const initialCampaigns = [
  { id: 1, name: 'Q3 Enterprise Outreach', status: 'Active', sent: 1240, opened: '68%', replied: '18%', progress: 85 },
  { id: 2, name: 'Inbound Growth Followup', status: 'Active', sent: 850, opened: '74%', replied: '22%', progress: 54 },
  { id: 3, name: 'AI Product Lead Magnet', status: 'Draft', sent: 0, opened: '0%', replied: '0%', progress: 0 },
  { id: 4, name: 'Founder Networking Campaign', status: 'Completed', sent: 320, opened: '82%', replied: '31%', progress: 100 }
]

export default function CampaignsScreen() {
  const [campaigns, setCampaigns] = useState(initialCampaigns)

  const handleCreateCampaign = () => {
    const name = prompt('Enter Campaign Name:')
    if (name) {
      setCampaigns([...campaigns, {
        id: Date.now(),
        name,
        status: 'Draft',
        sent: 0,
        opened: '0%',
        replied: '0%',
        progress: 0
      }])
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Campaigns</h2>
          <p className="text-[11px] text-secondary mt-0.5">Manage automated email sequences and target demographics.</p>
        </div>
        <button 
          onClick={handleCreateCampaign}
          className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white text-[11px] font-medium rounded flex items-center gap-1 shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create Campaign</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((item) => (
          <div key={item.id} className="bg-card border border-border-subtle rounded p-5 space-y-4 hover:border-border-default transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-xs font-semibold text-foreground">{item.name}</h4>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  item.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  item.status === 'Completed' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                  'bg-sunken text-muted'
                }`}>
                  {item.status}
                </span>
              </div>
              <span className="text-[10px] text-muted font-mono">Progress {item.progress}%</span>
            </div>

            <div className="w-full bg-sunken rounded-full h-1.5 overflow-hidden">
              <div className="bg-accent h-1.5 rounded-full transition-all duration-500" style={{ width: `${item.progress}%` }} />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs border-t border-border-subtle/50">
              <div>
                <span className="text-[9px] text-muted block font-medium uppercase">Emails Sent</span>
                <span className="font-mono text-foreground font-semibold mt-0.5 inline-block">{item.sent}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted block font-medium uppercase">Open Rate</span>
                <span className="font-mono text-foreground font-semibold mt-0.5 inline-block">{item.opened}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted block font-medium uppercase">Reply Rate</span>
                <span className="font-mono text-accent font-semibold mt-0.5 inline-block">{item.replied}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
