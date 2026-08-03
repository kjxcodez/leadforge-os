import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { BarChart3, TrendingUp, ShieldCheck, MailWarning } from 'lucide-react';

/**
 * ReportsScreen — displays reports telemetry dashboard.
 *
 * Design updates:
 *   - Squared corners: all cards, badges, and layout widgets use rounded-none.
 *   - Design System Colors: matches primary/success/warning/info theme tokens.
 *   - Layout: Standard PageHeader top wrapper and section card grids matching Dashboard.
 */
export default function ReportsScreen() {
  return (
    <div className="space-y-6 text-xs font-sans h-full overflow-y-auto pr-1">
      <PageHeader
        title="Advanced Analytics & Reports"
        description="Analyze conversion funnels, outbound campaigns performance, and domain deliverability ratings."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Analytics Card 1 */}
        <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Deliverability Rate
            </span>
            <ShieldCheck className="w-4 h-4 text-success" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground font-mono">99.4%</h3>
            <p className="text-[10px] text-muted-foreground">
              Average sender score across 4 connected mailboxes.
            </p>
          </div>
        </div>

        {/* Analytics Card 2 */}
        <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Reply Funnel Rate
            </span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground font-mono">18.2%</h3>
            <p className="text-[10px] text-muted-foreground">
              +2.4% increase in replies since last week.
            </p>
          </div>
        </div>

        {/* Analytics Card 3 */}
        <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Bounce Thresholds
            </span>
            <MailWarning className="w-4 h-4 text-warning" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground font-mono">0.8%</h3>
            <p className="text-[10px] text-muted-foreground">
              Safely below the 2.0% campaign bounce warning limit.
            </p>
          </div>
        </div>
      </div>

      {/* Under Construction Container */}
      <div className="bg-card border border-border-subtle rounded-none p-8 flex flex-col items-center justify-center text-center space-y-5 h-[280px]">
        <div className="w-12 h-12 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Premium Reports Under Construction
          </h3>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            We are actively designing conversion funnel indicators, CSV/PDF reports export, and custom filter builders.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-3 border border-border-subtle rounded-none text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="w-1.5 h-1.5 bg-primary rounded-none animate-ping" />
          Development Phase
        </div>
      </div>
    </div>
  );
}
