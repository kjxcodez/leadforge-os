import React from 'react';
import { useEntityList } from '../hooks/useEntity';
import {
  SyncCompanyRepository,
  SyncContactRepository,
  SyncCampaignRepository,
  SyncActivityRepository
} from '../repositories/sync';
import { TimelineView } from '../components/crm/TimelineView';
import { Building2, Users, Megaphone, Activity, Play } from 'lucide-react';
import { Button } from '../components/ui/button';

interface DashboardProps {
  systemRunning: boolean;
  onToggleSystem: () => void;
  ipcStatus: string;
  timestamp: string;
}

/**
 * DashboardScreen displays workspace-wide aggregate metrics and the real-time activity log.
 */
export default function DashboardScreen({ systemRunning, onToggleSystem, ipcStatus, timestamp }: DashboardProps) {
  const companiesQuery = useEntityList(SyncCompanyRepository);
  const contactsQuery = useEntityList(SyncContactRepository);
  const campaignsQuery = useEntityList(SyncCampaignRepository);
  const activitiesQuery = useEntityList(SyncActivityRepository);

  const totalCompanies = companiesQuery.data?.length || 0;
  const totalContacts = contactsQuery.data?.length || 0;
  const totalCampaigns = campaignsQuery.data?.length || 0;

  // Map activities to TimelineEvents
  const activities = (activitiesQuery.data || []).map((act: any) => ({
    id: act.id || act._id || Math.random().toString(),
    type: act.type || 'info',
    content: act.content || 'Action logged',
    createdAt: act.createdAt || new Date().toISOString(),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div className="flex justify-between items-end border-b border-border-subtle pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Workspace Overview</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Track lead performance, campaigns progress, and audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground bg-sunken border border-border-subtle px-2 py-0.5 rounded">
            IPC status: {ipcStatus}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Companies', value: totalCompanies, icon: Building2, color: 'text-accent' },
          { label: 'Total Contacts', value: totalContacts, icon: Users, color: 'text-indigo-500' },
          { label: 'Outreach Campaigns', value: totalCampaigns, icon: Megaphone, color: 'text-orange-500' },
          { label: 'System Uptime', value: '99.98%', icon: Activity, color: 'text-emerald-500' },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-card border border-border-subtle p-4 rounded-xl flex items-center justify-between hover:shadow-sm transition-shadow"
          >
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                {item.label}
              </span>
              <div className="text-lg font-bold text-foreground leading-none">{item.value}</div>
            </div>
            <div className={`w-8 h-8 rounded bg-card border border-border-subtle flex items-center justify-center ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Graph and Recent activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border-subtle rounded-xl flex flex-col justify-between p-4 space-y-4">
          <div className="flex justify-between items-center border-b border-border-subtle pb-2">
            <h3 className="text-[10px] font-bold uppercase text-foreground tracking-wider">Outreach Activity</h3>
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span>Sent</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>Replied</span>
              </div>
            </div>
          </div>
          <div className="h-[180px] flex items-end justify-between gap-2.5">
            {[35, 55, 75, 45, 65, 40, 50, 85, 60, 70, 48, 38].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end h-full">
                <div className="bg-accent rounded-t w-full" style={{ height: `${h}%` }} />
                <div className="bg-indigo-500 w-full rounded-t opacity-40" style={{ height: `${h * 0.25}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
            <span>Day 1</span>
            <span>Day 15</span>
            <span>Today</span>
          </div>
        </div>

        <div className="bg-card border border-border-subtle rounded-xl flex flex-col p-4 space-y-3">
          <div className="border-b border-border-subtle pb-2">
            <h3 className="text-[10px] font-bold uppercase text-foreground tracking-wider">Recent Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[220px]">
            <TimelineView events={activities} isLoading={activitiesQuery.isLoading} />
          </div>
        </div>
      </div>

      {/* Infrastructure control banner */}
      <div className="bg-card border border-border-subtle rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
            System Infrastructure
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Job Worker', active: systemRunning },
              { label: 'Scraper Engine', active: systemRunning },
              { label: 'Email Worker', active: false },
            ].map((worker, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1 bg-sunken border border-border-subtle rounded-lg text-xs"
              >
                <span className={`w-2 h-2 rounded-full ${worker.active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="font-semibold text-foreground">{worker.label}</span>
                <span className={`text-[9px] font-bold ${worker.active ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {worker.active ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right text-[10px] text-muted-foreground font-mono leading-normal">
            <div>Uptime: 99.98%</div>
            <div>Latency: {timestamp !== 'N/A' ? '42ms' : 'Offline'}</div>
          </div>
          <Button
            onClick={onToggleSystem}
            size="sm"
            className="text-xs font-semibold gap-1.5 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{systemRunning ? 'Stop Infrastructure' : 'Start Infrastructure'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
