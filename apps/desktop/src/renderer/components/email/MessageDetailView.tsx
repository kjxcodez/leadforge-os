import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  User,
  Calendar,
  Layers,
  Paperclip,
  ExternalLink,
  RefreshCw,
  Hash,
  Send,
  MessageSquareQuote,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { EmailStatusBadge, EngagementPills, DirectionBadge } from './EmailStatusBadge';
import { SafeEmailPreview } from './SafeEmailPreview';
import { FailureDiagnosticsCard } from './FailureDiagnosticsCard';
import { ConversationTimeline } from './ConversationTimeline';

interface CopyableIdentifierProps {
  label: string;
  value?: string;
  title?: string;
}

const CopyableIdentifier: React.FC<CopyableIdentifierProps> = ({ label, value, title }) => {
  const [copied, setCopied] = React.useState(false);

  if (!value) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="flex items-center justify-between gap-1.5 bg-muted/30 hover:bg-muted/50 transition-colors rounded px-2 py-1 border border-border/50 text-[11px] font-mono text-muted-foreground min-w-0"
      title={title || `${label}: ${value}`}
    >
      <span className="text-muted-foreground/70 shrink-0 select-none font-sans font-medium">{label}:</span>
      <span className="truncate select-all text-foreground/90 font-mono">{value}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-0.5 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
        title={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
};

export interface MessageDetailViewProps {
  deliveryId: string;
  onClose?: () => void;
  onNavigateToContact?: (contactId: string) => void;
  onNavigateToCampaign?: (campaignId: string) => void;
  className?: string;
}

export const MessageDetailView: React.FC<MessageDetailViewProps> = ({
  deliveryId,
  onClose,
  onNavigateToContact,
  onNavigateToCampaign,
  className = ''
}) => {
  const queryClient = useQueryClient();

  const deliveryQuery = useQuery({
    queryKey: ['email_delivery', deliveryId],
    queryFn: async () => {
      return (window as any).ipc.invoke('email-deliveries:get', { id: deliveryId });
    },
    enabled: !!deliveryId
  });

  const eventsQuery = useQuery({
    queryKey: ['email_delivery_events', deliveryId],
    queryFn: async () => {
      return (window as any).ipc.invoke('email-deliveries:events', { id: deliveryId });
    },
    enabled: !!deliveryId
  });

  const delivery = deliveryQuery.data;
  const events = eventsQuery.data || [];

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['email_delivery', deliveryId] });
    queryClient.invalidateQueries({ queryKey: ['email_delivery_events', deliveryId] });
  };

  if (deliveryQuery.isLoading) {
    return (
      <div className={`p-6 space-y-4 ${className}`}>
        <Skeleton className="h-7 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (deliveryQuery.isError || !delivery) {
    return (
      <div className={`p-8 text-center text-muted-foreground ${className}`}>
        <p className="text-sm font-medium text-rose-400">Failed to load message details.</p>
        <p className="text-xs text-muted-foreground mt-1">Delivery ID: {deliveryId}</p>
        <Button variant="outline" size="sm" onClick={handleRefetch} className="mt-3">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full overflow-y-auto space-y-5 p-5 ${className}`}>
      {/* Subject & Top Badges Header */}
      <div className="space-y-2 border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground tracking-tight select-text">
            {delivery.subject || '(No Subject)'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleRefetch}
            title="Refresh message details"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DirectionBadge direction={delivery.direction || 'OUTBOUND'} />
          <EmailStatusBadge status={delivery.status} />
          <EngagementPills
            openCount={delivery.openCount}
            clickCount={delivery.clickCount}
            replyCount={delivery.replyCount}
            firstOpenedAt={delivery.firstOpenedAt}
            firstClickedAt={delivery.firstClickedAt}
            lastRepliedAt={delivery.lastRepliedAt}
          />
        </div>
      </div>

      {/* Structured Metadata Box */}
      <Card className="bg-card/40 border-border/60">
        <CardContent className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Sender / Recipient */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium w-16">From:</span>
              <span className="font-mono text-foreground select-text truncate">
                {delivery.senderEmail || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium w-16">To:</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-foreground select-text truncate">
                  {delivery.recipientEmail || '—'}
                </span>
                {delivery.contactId && onNavigateToContact && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-primary hover:text-primary"
                    onClick={() => onNavigateToContact(delivery.contactId)}
                  >
                    <User className="w-2.5 h-2.5 mr-0.5" />
                    Contact
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Campaign / Sequence */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium w-20">Campaign:</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-foreground truncate font-medium">
                  {delivery.campaignName || delivery.campaignId || 'Direct / Ad-hoc'}
                </span>
                {delivery.campaignId && onNavigateToCampaign && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-primary hover:text-primary"
                    onClick={() => onNavigateToCampaign(delivery.campaignId)}
                  >
                    <Layers className="w-2.5 h-2.5 mr-0.5" />
                    View
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium w-20">Step / Time:</span>
              <span className="text-muted-foreground">
                Step {(delivery.stepIndex ?? 0) + 1} •{' '}
                {delivery.sentAt ? new Date(delivery.sentAt).toLocaleString() : delivery.createdAt ? new Date(delivery.createdAt).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subordinate Technical Identifiers */}
      <div className="space-y-1.5 pt-0.5">
        <div className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
          <Hash className="w-3 h-3" />
          Technical Identifiers
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          <CopyableIdentifier label="Delivery ID" value={delivery.id} />
          {delivery.executionId && <CopyableIdentifier label="Execution ID" value={delivery.executionId} />}
          {delivery.providerMessageId && <CopyableIdentifier label="Provider Msg ID" value={delivery.providerMessageId} />}
          {delivery.providerThreadId && <CopyableIdentifier label="Provider Thread ID" value={delivery.providerThreadId} />}
          {delivery.idempotencyKey && <CopyableIdentifier label="Idempotency Key" value={delivery.idempotencyKey} />}
        </div>
      </div>

      {/* Failure & Ambiguous Diagnostics */}
      <FailureDiagnosticsCard
        deliveryId={delivery.id}
        status={delivery.status}
        safeHumanMessage={delivery.safeHumanMessage}
        technicalMessage={delivery.technicalMessage}
        failureCode={delivery.failureCode}
        failureCategory={delivery.failureCategory}
        failureClassification={delivery.failureClassification}
        error={delivery.error}
        retryable={delivery.retryable}
        retryCount={delivery.retryCount || delivery.attempt}
        nextRetryAt={delivery.nextRetryAt}
        ambiguous={delivery.ambiguous}
        onReconciled={handleRefetch}
      />

      {/* Safe Email Content Preview */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Message Body
        </h3>
        <SafeEmailPreview
          htmlBody={delivery.htmlBody}
          textBody={delivery.textBody}
          subject={delivery.subject}
        />
      </div>

      {/* Attachments (if any) */}
      {Array.isArray(delivery.attachments) && delivery.attachments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" />
            Attachments ({delivery.attachments.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {delivery.attachments.map((att: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/70 bg-card/60 text-xs"
              >
                <Paperclip className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium text-foreground">{att.filename}</span>
                <span className="text-[11px] text-muted-foreground">
                  ({Math.round((att.size || 0) / 1024)} KB)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Timeline */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Lifecycle & Activity Timeline
        </h3>
        <ConversationTimeline delivery={delivery} events={events} />
      </div>
    </div>
  );
};
