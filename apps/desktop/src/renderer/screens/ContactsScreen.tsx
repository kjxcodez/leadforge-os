import React, { useState } from 'react'
import { Filter, Users, X, Sparkles } from 'lucide-react'

const initialContacts = [
  { id: 1, name: 'Jane Doe', title: 'VP of Sales', company: 'Acme Corp', email: 'jane@acme.com', phone: '+1 (555) 234-5678', status: 'Enriched', date: '2m ago', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { id: 2, name: 'Alex Rivera', title: 'Head of Growth', company: 'Stellar Tech', email: 'alex@stellar.io', phone: '+1 (555) 876-5432', status: 'Contacted', date: '14m ago', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { id: 3, name: 'Sarah Chen', title: 'Director of Outreach', company: 'Delta AI', email: 'sarah@delta.ai', phone: '+1 (555) 456-7890', status: 'Enriched', date: '1h ago', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80' },
  { id: 4, name: 'Marcus Brody', title: 'Chief Revenue Officer', company: 'Summit Scale', email: 'marcus@summit.co', phone: '+1 (555) 987-6543', status: 'Bounced', date: '3h ago', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80' },
  { id: 5, name: 'Olivia Vance', title: 'Director of Sales', company: 'Vortex Inc', email: 'olivia@vortex.com', phone: '+1 (555) 345-6789', status: 'Enriched', date: '5h ago', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' }
]

export default function ContactsScreen() {
  const [contacts, setContacts] = useState(initialContacts)
  const [selected, setSelected] = useState<any>(initialContacts[0])
  const [search, setSearch] = useState('')

  const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)] overflow-hidden animate-in fade-in duration-200 text-xs">
      {/* Left side table */}
      <div className="flex-1 flex flex-col bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-foreground">All Contacts</h2>
            <span className="px-2 py-0.5 bg-sunken border border-border-subtle text-[10px] text-secondary font-bold rounded-full">
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="Search contacts..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-sunken border border-border-subtle rounded px-2.5 py-1 w-full max-w-xs focus:ring-1 focus:ring-accent/20 outline-none text-xs"
            />
            <button className="px-2.5 py-1 bg-sunken text-secondary text-xs rounded border border-border-subtle hover:border-border-default flex items-center gap-1">
              <Filter className="h-3 w-3" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-sunken border-b border-border-subtle text-[10px] font-semibold text-muted uppercase tracking-wider text-left">
                <th className="px-4 py-2 w-8"><input type="checkbox" className="rounded-sm border-border-default text-accent focus:ring-accent" /></th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50 text-xs">
              {filtered.map((item) => {
                const isSelected = selected?.id === item.id
                return (
                  <tr 
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-accent-tint border-l-2 border-accent text-accent' : 'hover:bg-sunken/45 text-foreground'}`}
                  >
                    <td className="px-4 py-3"><input type="checkbox" checked={isSelected} readOnly className="rounded-sm border-border-default text-accent focus:ring-accent" /></td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <img src={item.avatar} alt={item.name} className="w-6 h-6 rounded-full object-cover" />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary">{item.title}</td>
                    <td className="px-4 py-3 text-secondary font-mono">{item.company}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        item.status === 'Enriched' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        item.status === 'Contacted' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                        'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{item.date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Drawer */}
      {selected && (
        <div className="w-[280px] bg-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between shadow-sm animate-in slide-in-from-right-4 duration-300 shrink-0">
          <div className="space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <img src={selected.avatar} alt={selected.name} className="w-10 h-10 rounded-full object-cover border border-border-default" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">{selected.name}</h4>
                  <p className="text-[10px] text-secondary mt-0.5">{selected.title}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-sunken rounded">
                <X className="h-4 w-4 text-muted" />
              </button>
            </div>

            <div className="space-y-3 pt-3 border-t border-border-subtle text-xs">
              <div>
                <span className="text-[9px] text-muted block uppercase font-medium">Company</span>
                <p className="font-semibold text-foreground mt-0.5">{selected.company}</p>
              </div>
              <div>
                <span className="text-[9px] text-muted block uppercase font-medium">Email</span>
                <p className="font-mono text-accent mt-0.5 break-all">{selected.email}</p>
              </div>
              <div>
                <span className="text-[9px] text-muted block uppercase font-medium">Phone</span>
                <p className="font-mono text-foreground mt-0.5">{selected.phone}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border-subtle flex gap-2">
            <button className="flex-1 py-1.5 bg-accent hover:bg-accent/90 text-white text-[11px] font-semibold rounded text-center">
              Edit Profile
            </button>
            <button className="flex-1 py-1.5 bg-sunken hover:bg-border-subtle text-secondary text-[11px] font-semibold rounded border border-border-subtle text-center">
              Enrich
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
