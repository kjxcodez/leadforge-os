import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Slash,
  Eye,
  MousePointerClick,
  Reply,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { Badge } from '../ui/badge';
import type { EmailDeliveryStatus } from '@leadforge/schema';

export interface EmailStatusBadgeProps {
  status?: EmailDeliveryStatus | string;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'default';
}

export const EmailStatusBadge: React.FC<EmailStatusBadgeProps> = ({
  status,
  className = '',
  showIcon = true,
  size = 'default'
}) => {
  const normStatus = (status || 'QUEUED').toUpperCase();

  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
  let colorClass = 'bg-muted text-muted-foreground border-border';
  let label = normStatus;
  let icon = <Clock className="w-3 h-3 mr-1" />;

  switch (normStatus) {
    case 'SENT':
      colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      icon = <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />;
      label = 'Sent';
      break;
    case 'SENDING':
      colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      icon = <Loader2 className="w-3 h-3 mr-1 text-blue-400 animate-spin" />;
      label = 'Sending';
      break;
    case 'RETRYING':
      colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      icon = <RefreshCw className="w-3 h-3 mr-1 text-amber-400 animate-spin" />;
      label = 'Retrying';
      break;
    case 'AMBIGUOUS':
      colorClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold';
      icon = <AlertTriangle className="w-3 h-3 mr-1 text-amber-400" />;
      label = 'Ambiguous';
      break;
    case 'FAILED':
      colorClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      icon = <XCircle className="w-3 h-3 mr-1 text-rose-400" />;
      label = 'Failed';
      break;
    case 'QUEUED':
      colorClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      icon = <Clock className="w-3 h-3 mr-1 text-slate-400" />;
      label = 'Queued';
      break;
    case 'CANCELLED':
      colorClass = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      icon = <Slash className="w-3 h-3 mr-1 text-zinc-400" />;
      label = 'Cancelled';
      break;
    case 'SUPPRESSED':
      colorClass = 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
      icon = <Slash className="w-3 h-3 mr-1 text-neutral-400" />;
      label = 'Suppressed';
      break;
    default:
      label = normStatus;
      break;
  }

  const paddingClass = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <Badge
      variant={variant}
      className={`inline-flex items-center font-medium border ${colorClass} ${paddingClass} ${className}`}
    >
      {showIcon && icon}
      <span>{label}</span>
    </Badge>
  );
};

export interface EngagementPillsProps {
  openCount?: number;
  clickCount?: number;
  replyCount?: number;
  firstOpenedAt?: Date | string | null;
  firstClickedAt?: Date | string | null;
  lastRepliedAt?: Date | string | null;
  className?: string;
  size?: 'sm' | 'default';
}

export const EngagementPills: React.FC<EngagementPillsProps> = ({
  openCount = 0,
  clickCount = 0,
  replyCount = 0,
  firstOpenedAt,
  firstClickedAt,
  lastRepliedAt,
  className = '',
  size = 'default'
}) => {
  const isOpened = openCount > 0 || !!firstOpenedAt;
  const isClicked = clickCount > 0 || !!firstClickedAt;
  const isReplied = replyCount > 0 || !!lastRepliedAt;

  if (!isOpened && !isClicked && !isReplied) {
    return (
      <span className={`text-muted-foreground/60 ${size === 'sm' ? 'text-[10px]' : 'text-xs'} italic`}>
        No engagement yet
      </span>
    );
  }

  const paddingClass = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {isReplied && (
        <span
          title={`Replied ${replyCount > 1 ? `(${replyCount} times)` : ''}${lastRepliedAt ? ` • Last: ${new Date(lastRepliedAt).toLocaleString()}` : ''}`}
          className={`inline-flex items-center font-medium rounded-md border bg-indigo-500/10 text-indigo-400 border-indigo-500/25 ${paddingClass}`}
        >
          <Reply className="w-3 h-3 mr-1" />
          Replied {replyCount > 1 ? `(${replyCount})` : ''}
        </span>
      )}
      {isClicked && (
        <span
          title={`Clicked ${clickCount > 1 ? `(${clickCount} times)` : ''}${firstClickedAt ? ` • First: ${new Date(firstClickedAt).toLocaleString()}` : ''}`}
          className={`inline-flex items-center font-medium rounded-md border bg-violet-500/10 text-violet-400 border-violet-500/25 ${paddingClass}`}
        >
          <MousePointerClick className="w-3 h-3 mr-1" />
          Clicked {clickCount > 1 ? `(${clickCount})` : ''}
        </span>
      )}
      {isOpened && (
        <span
          title={`Opened ${openCount > 1 ? `(${openCount} times)` : ''}${firstOpenedAt ? ` • First: ${new Date(firstOpenedAt).toLocaleString()}` : ''}`}
          className={`inline-flex items-center font-medium rounded-md border bg-sky-500/10 text-sky-400 border-sky-500/25 ${paddingClass}`}
        >
          <Eye className="w-3 h-3 mr-1" />
          Opened {openCount > 1 ? `(${openCount})` : ''}
        </span>
      )}
    </div>
  );
};

export interface DirectionBadgeProps {
  direction?: 'OUTBOUND' | 'INBOUND' | string;
  className?: string;
  size?: 'sm' | 'default';
}

export const DirectionBadge: React.FC<DirectionBadgeProps> = ({
  direction = 'OUTBOUND',
  className = '',
  size = 'default'
}) => {
  const isInbound = (direction || '').toUpperCase() === 'INBOUND';
  const paddingClass = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  if (isInbound) {
    return (
      <span
        title="Inbound reply from contact"
        className={`inline-flex items-center font-medium rounded-md border bg-cyan-500/10 text-cyan-300 border-cyan-500/25 ${paddingClass} ${className}`}
      >
        <ArrowDownLeft className="w-3 h-3 mr-1 text-cyan-400" />
        Inbound
      </span>
    );
  }

  return (
    <span
      title="Outbound email sent from LeadForge"
      className={`inline-flex items-center font-medium rounded-md border bg-primary/10 text-primary border-primary/20 ${paddingClass} ${className}`}
    >
      <ArrowUpRight className="w-3 h-3 mr-1 text-primary" />
      Outbound
    </span>
  );
};
