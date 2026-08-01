import React from 'react';
import { Workflow, Plus } from 'lucide-react';

export default function WorkflowsScreen() {
  const workflows = [
    {
      name: 'Lead Acquisition & Verification',
      active: true,
      steps: [
        'Enrich contact via scraper engines',
        'Verify email deliverability status',
        'Send Slack notification alert',
        'Sync with CRM integration'
      ]
    },
    {
      name: 'Trigger Campaign outreach on Sign Up',
      active: false,
      steps: [
        'Wait for sign up trigger',
        'Add lead into Q3 Campaign list',
        'Wait 1 day',
        'Send Intro sequence email'
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Enrichment & Outreach Workflows</h2>
          <p className="text-[11px] text-secondary mt-0.5">
            Automate leads qualification, scraping, and follow-ups sequences.
          </p>
        </div>
        <button className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white text-[11px] font-medium rounded flex items-center gap-1 shadow-sm transition-all active:scale-[0.98]">
          <Plus className="h-3.5 w-3.5" />
          <span>New Workflow</span>
        </button>
      </div>

      <div className="bg-card border border-border-subtle rounded-xl divide-y divide-border-subtle/50 overflow-hidden">
        {workflows.map((wf, idx) => (
          <div key={idx} className="p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Workflow className="h-4.5 w-4.5 text-accent" />
                <h4 className="text-xs font-semibold text-foreground">{wf.name}</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${wf.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-sunken text-muted'}`}
              >
                {wf.active ? 'ACTIVE TRIGGER' : 'DISABLED'}
              </span>
            </div>

            <div className="space-y-2.5 pl-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
              {wf.steps.map((step, sIdx) => (
                <div key={sIdx} className="flex items-center gap-2 text-xs text-secondary">
                  <div className="w-4 h-4 rounded-full bg-sunken border border-border-subtle flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-muted">{sIdx + 1}</span>
                  </div>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
