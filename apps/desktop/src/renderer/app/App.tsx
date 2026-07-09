import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Building2,
  Users,
  Megaphone,
  GitBranch,
  Settings,
  Search,
  ChevronRight,
  Terminal,
  Sparkles,
  BarChart3,
  Sun,
  Moon
} from 'lucide-react'

// Modular screen imports
import DashboardScreen from '../screens/DashboardScreen'
import CompaniesScreen from '../screens/CompaniesScreen'
import ContactsScreen from '../screens/ContactsScreen'
import OpportunitiesScreen from '../screens/OpportunitiesScreen'
import DiscoveryScreen from '../screens/DiscoveryScreen'
import CampaignsScreen from '../screens/CampaignsScreen'
import WorkflowsScreen from '../screens/WorkflowsScreen'
import ReportsScreen from '../screens/ReportsScreen'
import SettingsScreen from '../screens/SettingsScreen'

const initialIntegrations = [
  { id: 'salesforce', name: 'Salesforce', description: 'Sync accounts, contacts, and opportunities.', connected: true, logo: 'SF' },
  { id: 'hubspot', name: 'HubSpot', description: 'Import list leads and track deals.', connected: true, logo: 'HS' },
  { id: 'gmail', name: 'Google Workspace', description: 'Send outreach emails and track replies.', connected: false, logo: 'GW' },
  { id: 'slack', name: 'Slack notifications', description: 'Receive system notifications and alerts.', connected: true, logo: 'SL' }
]

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)
  const [darkMode, setDarkMode] = useState<boolean>(false)
  const [systemRunning, setSystemRunning] = useState<boolean>(true)
  const [integrations, setIntegrations] = useState(initialIntegrations)

  const [ipcStatus, setIpcStatus] = useState<string>('Connecting...')
  const [timestamp, setTimestamp] = useState<string>('N/A')

  useEffect(() => {
    const root = window.document.documentElement
    if (darkMode) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [darkMode])

  useEffect(() => {
    if (window.ipc && typeof window.ipc.test === 'function') {
      window.ipc.test()
        .then((res) => {
          setIpcStatus('Connected')
          setTimestamp(new Date(res.timestamp).toLocaleTimeString())
        })
        .catch((err) => setIpcStatus(`Error: ${err.message}`))
    } else {
      setIpcStatus('Not connected (Web)')
    }
  }, [])

  const toggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(item => item.id === id ? { ...item, connected: !item.connected } : item))
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen systemRunning={systemRunning} onToggleSystem={() => setSystemRunning(!systemRunning)} ipcStatus={ipcStatus} timestamp={timestamp} />
      case 'companies':
        return <CompaniesScreen />
      case 'contacts':
        return <ContactsScreen />
      case 'opportunities':
        return <OpportunitiesScreen />
      case 'discovery':
        return <DiscoveryScreen />
      case 'campaigns':
        return <CampaignsScreen />
      case 'workflows':
        return <WorkflowsScreen />
      case 'reports':
        return <ReportsScreen />
      case 'settings':
        return <SettingsScreen integrations={integrations} onToggleIntegration={toggleIntegration} darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />
      default:
        return <DashboardScreen systemRunning={systemRunning} onToggleSystem={() => setSystemRunning(!systemRunning)} ipcStatus={ipcStatus} timestamp={timestamp} />
    }
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className={`h-screen border-r border-border-subtle bg-card flex flex-col py-4 shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-14 px-1' : 'w-[240px] px-2'}`}>
        <div className={`mb-6 flex items-center gap-3 px-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-accent rounded flex items-center justify-center shrink-0 shadow-sm shadow-accent/25">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="font-semibold text-sm tracking-tight text-foreground leading-tight">LeadForge</h1>
              <p className="text-[10px] text-muted-foreground truncate">Global Workspace</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'companies', label: 'Companies', icon: Building2 },
            { id: 'contacts', label: 'Contacts', icon: Users },
            { id: 'opportunities', label: 'Opportunities', icon: ChevronRight },
            { id: 'discovery', label: 'Discovery', icon: Search },
            { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
            { id: 'workflows', label: 'Workflows', icon: GitBranch },
            { id: 'reports', label: 'Reports', icon: BarChart3 },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors font-medium text-xs leading-none relative group ${isActive ? 'bg-accent-tint text-accent border-l-2 border-accent' : 'text-secondary hover:bg-sunken'}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-accent' : 'text-secondary'}`} />
                {!sidebarCollapsed && <span>{tab.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto px-2 pt-4 border-t border-border-subtle">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : 'px-1'}`}>
            <img className="w-8 h-8 rounded-full border border-border-default object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" alt="Profile" />
            {!sidebarCollapsed && (
              <div className="overflow-hidden min-w-0 flex-1">
                <p className="text-xs font-semibold truncate text-foreground">Alex Rivera</p>
                <p className="text-[10px] text-muted-foreground truncate">Pro Workspace</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex justify-between items-center h-12 px-6 w-full sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-sm group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search workspace..." className="w-full pl-9 pr-4 py-1 bg-sunken focus:bg-card border-none rounded text-xs placeholder:text-muted-foreground/80 focus:ring-1 focus:ring-accent/20 outline-none" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 text-secondary hover:bg-sunken rounded transition-colors">
              {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1.5 text-secondary hover:bg-sunken rounded transition-colors hidden sm:block">
              <ChevronRight className={`h-4.5 w-4.5 transform transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
            <div className="h-4 w-px bg-border-subtle" />
            <button className="text-xs text-secondary hover:text-accent font-medium flex items-center gap-1.5 bg-sunken px-2.5 py-1 rounded border border-border-subtle">
              <Terminal className="h-3.5 w-3.5" />
              <span>Command Palette</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {renderTabContent()}
        </div>
      </main>
    </div>
  )
}
