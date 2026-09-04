import React from 'react';
import {
  Send,
  Eye,
  MousePointerClick,
  Reply,
  AlertTriangle,
  XCircle,
  Clock,
  Ban,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Badge } from '../ui/badge';

export interface TimelineEventItem {
  id: string;
  type: 'QUEUED' | 'SENT' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'FAILED' | 'AMBIGUOUS' | 'SEQUENCE_STOPPED';
  timestamp: Date | string;
  title: string;
  description?: string;
  details?: Record<string, any>;
}

export interface ConversationTimelineProps {
  delivery?: any;
  events?: any[];
  className?: string;
}

export const ConversationTimeline: React.FC<ConversationTimelineProps> = ({
  delivery,
  events = [],
  className = ''
}) => {
  // Synthesize events into a unified chronological timeline
  const timelineItems: TimelineEventItem[] = [];

  if (delivery) {
    // 1. Queued / Created
    if (delivery.createdAt) {
      timelineItems.push({
        id: `created-${delivery.id}`,
        type: 'QUEUED',
        timestamp: delivery.createdAt,
        title: 'Message Queued',
        description: `Scheduled via Step ${((delivery.stepIndex ?? 0) + 1)}`
      });
    }

    // 2. Sent
    if (delivery.sentAt && (delivery.status === 'SENT' || delivery.sentAt)) {
      timelineItems.push({
        id: `sent-${delivery.id}`,
        type: 'SENT',
        timestamp: delivery.sentAt,
        title: 'Message Transmitted',
        description: `Delivered via Gmail API (Message ID: ${delivery.providerMessageId ? delivery.providerMessageId.slice(0, 16) + '...' : 'Recorded'})`
      });
    }

    // 3. Ambiguous / Failed
    if (delivery.status === 'AMBIGUOUS') {
      timelineItems.push({
        id: `ambiguous-${delivery.id}`,
        type: 'AMBIGUOUS',
        timestamp: delivery.updatedAt || delivery.createdAt,
        title: 'Ambiguous State Logged',
        description: delivery.safeHumanMessage || 'Provider response was inconclusive. Pending reconciliation.'
      });
    } else if (delivery.status === 'FAILED') {
      timelineItems.push({
        id: `failed-${delivery.id}`,
        type: 'FAILED',
        timestamp: delivery.updatedAt || delivery.createdAt,
        title: 'Delivery Failed',
        description: delivery.safeHumanMessage || delivery.error || 'Outbound send attempt encountered an error.'
      });
    }
  }

  // 4. Ingest raw events
  if (Array.isArray(events)) {
    for (const ev of events) {
      const type = (ev.type || '').toUpperCase();
      const ts = ev.timestamp || ev.createdAt;

      if (type === 'OPEN' || type === 'OPENED') {
        timelineItems.push({
          id: `ev-open-${ev.id || Math.random()}`,
          type: 'OPENED',
          timestamp: ts,
          title: 'Email Opened',
          description: 'Observed open tracking pixel request (does not guarantee full read)',
          details: {
            ipAddress: ev.ipAddress,
            userAgent: ev.userAgent
          }
        });
      } else if (type === 'CLICK' || type === 'CLICKED') {
        timelineItems.push({
          id: `ev-click-${ev.id || Math.random()}`,
          type: 'CLICKED',
          timestamp: ts,
          title: 'Link Clicked',
          description: ev.targetUrl ? `Clicked link: ${ev.targetUrl}` : 'Tracked link clicked by recipient',
          details: {
            targetUrl: ev.targetUrl,
            ipAddress: ev.ipAddress
          }
        });
      } else if (type === 'REPLY' || type === 'REPLIED') {
        timelineItems.push({
          id: `ev-reply-${ev.id || Math.random()}`,
          type: 'REPLIED',
          timestamp: ts,
          title: 'Inbound Reply Correlated',
          description: ev.subject ? `Subject: ${ev.subject}` : 'Contact replied to sequence message'
        });
      }
    }
  }

  // 5. If delivery has hasReply and no event already captured
  if (delivery?.hasReply && !timelineItems.some((i) => i.type === 'REPLIED')) {
    timelineItems.push({
      id: `reply-${delivery.id}`,
      type: 'REPLIED',
      timestamp: delivery.lastRepliedAt || delivery.updatedAt,
      title: 'Inbound Reply Received',
      description: `Reply detected (${delivery.replyCount || 1} reply received)`
    });
    // And sequence stopped
    timelineItems.push({
      id: `stopped-${delivery.id}`,
      type: 'SEQUENCE_STOPPED',
      timestamp: delivery.lastRepliedAt || delivery.updatedAt,
      title: 'Campaign Sequence Halted',
      description: 'Sequence automatically stopped for contact upon receiving reply.'
    });
  }

  // Sort ascending by timestamp
  timelineItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (timelineItems.length === 0) {
    return (
      <div className={`p-4 text-xs text-muted-foreground text-center italic ${className}`}>
        No timeline events recorded yet.
      </div>
    );
  }

  const getEventIcon = (type: TimelineEventItem['type']) => {
    switch (type) {
      case 'QUEUED':
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
      case 'SENT':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'OPENED':
        return <Eye className="w-3.5 h-3.5 text-sky-400" />;
      case 'CLICKED':
        return <MousePointerClick className="w-3.5 h-3.5 text-violet-400" />;
      case 'REPLIED':
        return <Reply className="w-3.5 h-3.5 text-indigo-400" />;
      case 'AMBIGUOUS':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'FAILED':
        return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'SEQUENCE_STOPPED':
        return <Ban className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getEventBorderClass = (type: TimelineEventItem['type']) => {
    switch (type) {
      case 'SENT':
        return 'border-emerald-500/30 bg-emerald-500/10';
      case 'OPENED':
        return 'border-sky-500/30 bg-sky-500/10';
      case 'CLICKED':
        return 'border-violet-500/30 bg-violet-500/10';
      case 'REPLIED':
        return 'border-indigo-500/30 bg-indigo-500/10';
      case 'AMBIGUOUS':
        return 'border-amber-500/30 bg-amber-500/10';
      case 'FAILED':
        return 'border-rose-500/30 bg-rose-500/10';
      case 'SEQUENCE_STOPPED':
        return 'border-amber-500/30 bg-amber-500/10';
      default:
        return 'border-border bg-muted/40';
    }
  };

  return (
    <div className={`relative pl-6 space-y-4 ${className}`}>
      {/* Vertical Track Line */}
      <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-border/60" />

      {timelineItems.map((item, idx) => (
        <div key={item.id || idx} className="relative flex items-start group">
          {/* Node Icon */}
          <div
            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center shadow-sm z-10 ${getEventBorderClass(
              item.type
            )}`}
          >
            {getEventIcon(item.type)}
          </div>

          {/* Node Content */}
          <div className="flex-1 bg-card/60 border border-border/60 rounded-md p-2.5 hover:border-border transition-colors">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                {item.title}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {new Date(item.timestamp).toLocaleString()}
              </span>
            </div>

            {item.description && (
              <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                {item.description}
              </p>
            )}

            {(() => {
              const details = item.details;
              if (!details || Object.keys(details).length === 0) return null;
              return (
                <div className="mt-1.5 pt-1 border-t border-border/40 text-[11px] text-muted-foreground/90 font-mono space-y-0.5">
                  {details.targetUrl && (
                    <div className="flex items-center gap-1 truncate">
                      <span>Target URL:</span>
                      <a
                        href={details.targetUrl}
                        onClick={(e) => {
                          e.preventDefault();
                          if (typeof (window as any).ipc?.invoke === 'function') {
                            (window as any).ipc.invoke('electron:openUrl', details.targetUrl);
                          }
                        }}
                        className="text-primary hover:underline truncate inline-flex items-center gap-0.5"
                      >
                        {details.targetUrl}
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                  )}
                  {details.ipAddress && (
                    <div>IP: {details.ipAddress}</div>
                  )}
                  {details.userAgent && (
                    <div className="truncate text-[10px] text-muted-foreground/60" title={details.userAgent}>
                      Client: {details.userAgent}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      ))}
    </div>
  );
};
