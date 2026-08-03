import { Clock, RefreshCw, Zap, Terminal, Server, Play, StopCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { StatusDot } from '../common/StatusDot';
import { SectionCard } from '../common/SectionCard';
import { useFormatters } from '../../hooks/useFormatters';

interface InfraStatus {
  workspaceRuntime?: {
    status: string;
    uptimeMs: number;
    restartCount: number;
    memoryUsage?: number;
    startupDuration?: number;
    averageStartupTime?: number;
  };
  scheduler?: { status: string; uptimeMs: number };
  syncEngine?: { status: string; uptimeMs: number };
  automationRuntime?: { status: string; uptimeMs: number };
  workerHost?: { status: string; activeWorkers: number };
  database?: { status: string };
}

interface InfraStatusPanelProps {
  infraStatus: InfraStatus;
  isSystemRunning: boolean;
  isToggling: boolean;
  onToggle: () => void;
}

/**
 * InfraStatusPanel — live infrastructure monitoring panel.
 *
 * Shows per-service status dots, uptime readouts, and a toggle button.
 * Uses StatusDot (semantic tokens) and Button variants from the design system.
 */
export function InfraStatusPanel({
  infraStatus,
  isSystemRunning,
  isToggling,
  onToggle
}: InfraStatusPanelProps) {
  const { formatUptime, formatBytes } = useFormatters();

  const services = [
    {
      name: 'Scheduler Engine',
      status: infraStatus.scheduler?.status || 'Stopped',
      detail: formatUptime(infraStatus.scheduler?.uptimeMs),
      Icon: Clock
    },
    {
      name: 'Sync Engine',
      status: infraStatus.syncEngine?.status || 'Stopped',
      detail: formatUptime(infraStatus.syncEngine?.uptimeMs),
      Icon: RefreshCw
    },
    {
      name: 'Automation Evaluator',
      status: infraStatus.automationRuntime?.status || 'Stopped',
      detail: formatUptime(infraStatus.automationRuntime?.uptimeMs),
      Icon: Zap
    },
    {
      name: 'Worker Thread Pool',
      status: infraStatus.workerHost?.status || 'Stopped',
      detail: `${infraStatus.workerHost?.activeWorkers || 0} threads`,
      Icon: Terminal
    }
  ];

  return (
    <SectionCard className="space-y-4">
      {/* Panel header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-subtle pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Server className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground">
              System Infrastructure
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Monitor syncs, trigger monitors, and database latency.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {/* Runtime telemetry */}
          <div className="text-right text-[10px] text-muted-foreground font-mono leading-relaxed">
            <div>
              Uptime:{' '}
              <span className="text-foreground font-medium">
                {formatUptime(infraStatus.workspaceRuntime?.uptimeMs)}
              </span>
            </div>
            <div>
              Restarts:{' '}
              <span className="text-foreground font-medium">
                {infraStatus.workspaceRuntime?.restartCount || 0}
              </span>
            </div>
            <div>
              Memory:{' '}
              <span className="text-foreground font-medium">
                {formatBytes(infraStatus.workspaceRuntime?.memoryUsage)}
              </span>
            </div>
            <div>
              Startup:{' '}
              <span className="text-foreground font-medium">
                {infraStatus.workspaceRuntime?.startupDuration || 0}ms
              </span>
            </div>
          </div>

          {/* Toggle button */}
          <Button
            onClick={onToggle}
            size="sm"
            disabled={isToggling}
            variant={isSystemRunning ? 'destructive' : 'default'}
            className="shrink-0"
          >
            {isSystemRunning ? (
              <StopCircle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isSystemRunning ? 'Stop Engine' : 'Start Engine'}</span>
          </Button>
        </div>
      </div>

      {/* Service grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {services.map((srv) => (
          <div
            key={srv.name}
            className="bg-surface-3 border border-border-subtle rounded-[--radius-lg] p-3.5 flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {srv.name}
              </span>
              <srv.Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-1.5">
                <StatusDot
                  variant={srv.status === 'Running' ? 'running' : 'stopped'}
                  pulse={srv.status === 'Running'}
                />
                <span className="font-semibold text-[10px] text-foreground uppercase tracking-[0.04em]">
                  {srv.status}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{srv.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
