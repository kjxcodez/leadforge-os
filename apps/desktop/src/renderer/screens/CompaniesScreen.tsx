import React, { useState } from 'react'
import { Building2, Plus, ArrowRight, Sparkles } from 'lucide-react'

const initialCompanies = [
  { id: 1, name: 'Acme Corp', domain: 'acme.com', industry: 'SaaS / Sales tech', contacts: 12, leads: 4 },
  { id: 2, name: 'Stellar Tech', domain: 'stellar.io', industry: 'Artificial Intelligence', contacts: 8, leads: 2 },
  { id: 3, name: 'Delta AI', domain: 'delta.ai', industry: 'Data Enrichment', contacts: 15, leads: 5 }
]

export default function CompaniesScreen() {
  const [companies, setCompanies] = useState<any[]>(initialCompanies)
  const [search, setSearch] = useState('')

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const handleAddCompany = () => {
    const name = prompt('Enter Company Name:')
    if (name) {
      const domain = name.toLowerCase().replace(/\s+/g, '') + '.com'
      setCompanies([...companies, {
        id: Date.now(),
        name,
        domain,
        industry: 'B2B Services',
        contacts: 1,
        leads: 0
      }])
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Companies</h2>
          <p className="text-[11px] text-secondary mt-0.5">Manage target corporate organizations and search domains.</p>
        </div>
        <button 
          onClick={handleAddCompany}
          className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white text-[11px] font-semibold rounded transition-all active:scale-95 flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Company
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input 
          type="text" 
          placeholder="Filter companies..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card border border-border-subtle rounded px-3 py-1.5 w-full max-w-xs focus:ring-1 focus:ring-accent/20 outline-none text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center p-6 bg-sunken/20 rounded border border-border-subtle relative overflow-hidden">
          <div className="max-w-md w-full flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-sunken border border-border-subtle flex items-center justify-center">
              <Building2 className="h-8 w-8 text-secondary" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">No companies match search</h3>
              <p className="text-[10px] text-secondary mt-1">Start by adding a company or adjusting filters.</p>
            </div>
            <button 
              onClick={handleAddCompany}
              className="px-5 py-1.5 bg-accent hover:bg-accent/90 text-white text-[10px] font-semibold rounded transition-all"
            >
              + Add Company
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border-subtle rounded overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-sunken border-b border-border-subtle text-[10px] font-semibold text-muted uppercase tracking-wider">
                <th className="px-4 py-2">Company Name</th>
                <th className="px-4 py-2">Domain</th>
                <th className="px-4 py-2">Industry</th>
                <th className="px-4 py-2 text-right">Contacts</th>
                <th className="px-4 py-2 text-right">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-sunken/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-2.5 font-mono text-accent">{item.domain}</td>
                  <td className="px-4 py-2.5 text-secondary">{item.industry}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-secondary">{item.contacts}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-secondary">{item.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
