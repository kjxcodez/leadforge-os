import React, { useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Link,
  ShieldAlert,
  ArrowRight,
  FileText,
  User,
  Layers,
  Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { InboundReconciliationBadge } from './EmailStatusBadge';
import { toast } from 'sonner';

export interface InboundReconciliationCardProps {
  delivery: any;
  workspaceId: string;
  onReconciled: () => void;
  onNavigateToContact?: ((contactId: string) => void) | undefined;
  onNavigateToCampaign?: ((campaignId: string) => void) | undefined;
}

export const InboundReconciliationCard: React.FC<InboundReconciliationCardProps> = ({
  delivery,
  workspaceId,
  onReconciled,
  onNavigateToContact,
  onNavigateToCampaign
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [contactId, setContactId] = useState(delivery.contactId || '');
  const [matchedDeliveryId, setMatchedDeliveryId] = useState(delivery.matchedDeliveryId || '');
  const [campaignId, setCampaignId] = useState(delivery.campaignId || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isInbound = delivery.direction === 'INBOUND';
  const processingStatus = delivery.processingStatus;

  // Only render if it's an inbound message or has reconciliation state
  if (!isInbound && !processingStatus) return null;

  const isMatched = processingStatus === 'MATCHED';
  const isPending = processingStatus === 'CORRELATION_PENDING';
  const isUnmatched = processingStatus === 'UNMATCHED';

  const handleManualReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId.trim()) {
      toast.error('Contact ID is required for manual reconciliation');
      return;
    }

    setIsSubmitting(true);
    try {
      await (window as any).ipc.invoke('email-deliveries:manual-reconcile', {
        inboundDeliveryId: delivery.id,
        contactId: contactId.trim(),
        campaignId: campaignId.trim() || undefined,
        matchedDeliveryId: matchedDeliveryId.trim() || undefined,
        notes: notes.trim() || undefined
      });

      toast.success('Inbound reply manually reconciled', {
        description: 'Contact status updated to REPLIED and outreach sequence halted.'
      });
      setIsOpen(false);
      onReconciled();
    } catch (err: any) {
      toast.error('Failed to reconcile inbound reply', {
        description: err?.message || 'Check parameters and retry.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card/40 overflow-hidden min-w-0">
      <CardHeader className="p-3.5 pb-2 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-cyan-400" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Inbound Reconciliation & Evidence
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <InboundReconciliationBadge
              processingStatus={processingStatus || 'CORRELATION_PENDING'}
              matchConfidence={delivery.matchConfidence}
              size="sm"
            />
            {!isOpen && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border-primary/30"
                onClick={() => setIsOpen(true)}
              >
                <Link className="w-3 h-3 mr-1" />
                {isMatched ? 'Re-assign Match' : 'Manually Reconcile'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 space-y-3 text-xs">
        {/* State Banner */}
        {isPending && (
          <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold text-[11px]">Awaiting Correlation</p>
              <p className="text-[10px] text-amber-300/80">
                This inbound message was detected and is currently pending correlation against active sequences, In-Reply-To headers, and prospect mailboxes.
              </p>
            </div>
          </div>
        )}

        {isUnmatched && (
          <div className="flex items-start gap-2 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p className="font-semibold text-[11px]">Unmatched Inbound Reply</p>
              <p className="text-[10px] text-rose-300/80">
                Automatic correlation could not link this message to an active sequence or contact. Use manual reconciliation below to link it and halt outreach.
              </p>
            </div>
          </div>
        )}

        {isMatched && (
          <div className="flex items-start gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="font-semibold text-[11px]">Successfully Correlated</p>
              <p className="text-[10px] text-emerald-300/80">
                Matched with confidence <span className="font-mono font-semibold">{delivery.matchConfidence || 'HIGH'}</span>. Contact marked REPLIED; follow-up sequence halted.
              </p>
            </div>
          </div>
        )}

        {/* Evidence & Diagnostics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] min-w-0">
          <div className="flex items-center justify-between p-1.5 rounded bg-muted/30 border border-border/40 min-w-0">
            <span className="text-muted-foreground font-medium shrink-0">Confidence:</span>
            <span className="font-mono text-foreground truncate min-w-0">{delivery.matchConfidence || '—'}</span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded bg-muted/30 border border-border/40 min-w-0">
            <span className="text-muted-foreground font-medium shrink-0">Attempts:</span>
            <span className="font-mono text-foreground">{delivery.reconciliationAttempts ?? 0}</span>
          </div>

          {delivery.reconciledAt && (
            <div className="flex items-center justify-between p-1.5 rounded bg-muted/30 border border-border/40 min-w-0">
              <span className="text-muted-foreground font-medium shrink-0">Reconciled At:</span>
              <span className="font-mono text-foreground text-[10px] truncate min-w-0">
                {new Date(delivery.reconciledAt).toLocaleString()}
              </span>
            </div>
          )}

          {delivery.contactId && (
            <div className="flex items-center justify-between p-1.5 rounded bg-muted/30 border border-border/40 min-w-0">
              <span className="text-muted-foreground font-medium shrink-0">Contact ID:</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-mono text-foreground text-[10px] truncate max-w-[120px]">
                  {delivery.contactId}
                </span>
                {onNavigateToContact && (
                  <button
                    type="button"
                    onClick={() => onNavigateToContact(delivery.contactId)}
                    className="text-primary hover:underline text-[10px] cursor-pointer shrink-0"
                  >
                    view
                  </button>
                )}
              </div>
            </div>
          )}

          {delivery.reconciliationNotes && (
            <div className="md:col-span-2 p-1.5 rounded bg-muted/30 border border-border/40 space-y-0.5 min-w-0 overflow-hidden">
              <span className="text-muted-foreground font-medium block">Reconciliation Notes:</span>
              <p className="font-mono text-foreground text-[10px] whitespace-pre-wrap break-all">
                {delivery.reconciliationNotes}
              </p>
            </div>
          )}
        </div>

        {/* Manual Reconciliation Form Modal / Card Drawer */}
        {isOpen && (
          <form onSubmit={handleManualReconcile} className="p-3 rounded-md border border-primary/40 bg-primary/5 space-y-3 mt-2">
            <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" />
                Manual Reply Reconciliation Form
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Target Contact ID <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 660f... or contact ID"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  required
                  className="h-7 text-xs font-mono bg-background"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Matched Outbound Delivery ID (Optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Outbound delivery ID"
                    value={matchedDeliveryId}
                    onChange={(e) => setMatchedDeliveryId(e.target.value)}
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Campaign ID (Optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Campaign ID"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Operator Notes
                </label>
                <Textarea
                  placeholder="e.g. Prospect replied from personal alias; confirmed intent to schedule meeting."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-xs font-mono bg-background"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground">
                Marks contact as REPLIED and halts outreach sequence.
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !contactId.trim()}
                className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? 'Reconciling...' : 'Confirm & Halt Sequence'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
