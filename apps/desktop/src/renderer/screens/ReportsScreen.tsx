import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function ReportsScreen() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-xs animate-in fade-in duration-200">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl border border-border-subtle bg-card/45 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Ambient glow decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-accent/10 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/5 rounded-full filter blur-3xl"></div>

        <div className="relative flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
            <BarChart3 className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-2 relative">
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
            Advanced Analytics & Reports
          </h2>
          <p className="text-[11px] text-secondary leading-relaxed">
            We are actively developing premium charts, conversion funnel indicators, and domain-performance reports.
          </p>
        </div>

        <div className="relative pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sunken border border-border-subtle/50 text-[10px] font-bold text-muted uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
            Under Construction
          </div>
        </div>
      </div>
    </div>
  );
}

