import React, { useState } from 'react';

const initialDeals = [
  { id: 1, name: 'Acme Enterprise License', company: 'Acme Corp', value: '$12,000', stage: 'Lead' },
  {
    id: 2,
    name: 'Stellar Tech Pilot',
    company: 'Stellar Tech',
    value: '$4,500',
    stage: 'Contacted'
  },
  { id: 3, name: 'Delta AI Expansion', company: 'Delta AI', value: '$25,000', stage: 'Meeting' },
  { id: 4, name: 'Summit Scale Annual', company: 'Summit Scale', value: '$8,000', stage: 'Won' }
];

const stages = ['Lead', 'Contacted', 'Meeting', 'Won'];

export default function OpportunitiesScreen() {
  const [deals, setDeals] = useState(initialDeals);

  const moveStage = (id: number, nextStage: string) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage: nextStage } : d)));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Opportunities</h2>
        <p className="text-[11px] text-secondary mt-0.5">
          Track deal pipelines and estimated revenue values.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-200px)] overflow-y-auto">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage);
          return (
            <div
              key={stage}
              className="bg-sunken border border-border-subtle rounded-lg p-3 flex flex-col space-y-3 h-fit min-h-[150px]"
            >
              <div className="flex justify-between items-center px-1">
                <span className="font-semibold text-foreground">{stage}</span>
                <span className="bg-card text-muted-foreground font-mono px-1.5 py-0.5 rounded text-[10px] border border-border-subtle">
                  {stageDeals.length}
                </span>
              </div>

              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="bg-card border border-border-subtle p-3 rounded shadow-sm hover:border-border-default transition-colors space-y-2"
                  >
                    <div className="font-medium text-foreground">{deal.name}</div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span className="font-mono">{deal.company}</span>
                      <span className="font-semibold text-accent font-mono">{deal.value}</span>
                    </div>

                    <div className="flex gap-1 pt-1 justify-end">
                      {stages.map(
                        (st) =>
                          st !== stage && (
                            <button
                              key={st}
                              onClick={() => moveStage(deal.id, st)}
                              className="px-1 py-0.5 bg-sunken text-[9px] hover:bg-border-subtle border border-border-subtle rounded font-mono text-secondary"
                            >
                              {st[0]}
                            </button>
                          )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
