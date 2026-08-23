import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Paperclip, X, Send, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface SendTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: {
    id: string;
    email: string;
    signature?: string | null;
    testRecipients?: Array<{
      email: string;
      firstUsedAt?: string | Date;
      lastUsedAt?: string | Date;
    }>;
  };
}

export const SendTestModal = ({ isOpen, onClose, account }: SendTestModalProps) => {
  const [recipient, setRecipient] = useState('');
  const [useSignature, setUseSignature] = useState(true);
  const [attachments, setAttachments] = useState<Array<{ name: string; path?: string; size: number }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const testRecipients = account.testRecipients || [];
  const uniqueCount = testRecipients.length;

  const isKnownRecipient = testRecipients.some(
    (r) => r.email.trim().toLowerCase() === recipient.trim().toLowerCase()
  );

  const handleSelectPrevious = (email: string) => {
    setRecipient(email);
    setErrorMessage(null);
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    const newAttachments = [...attachments];
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`File "${f.name}" exceeds the 25 MB LeadForge size limit.`);
        continue;
      }
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (['exe', 'bat', 'cmd', 'scr', 'vbs', 'sh', 'ps1'].includes(ext || '')) {
        toast.error(`File type .${ext} is not allowed for email attachments.`);
        continue;
      }
      newAttachments.push({
        name: f.name,
        path: (f as any).path,
        size: f.size
      });
    }
    setAttachments(newAttachments);
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    setErrorMessage(null);
    const targetEmail = recipient.trim().toLowerCase();

    if (!targetEmail) {
      setErrorMessage('Please enter a recipient email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      setErrorMessage('Please enter a valid recipient email address.');
      return;
    }

    if (!isKnownRecipient && uniqueCount >= 3) {
      setErrorMessage(
        'Limit reached: You can test this sender with up to 3 different recipient addresses. You can reuse one of your previous test addresses.'
      );
      return;
    }

    setIsSending(true);
    try {
      const result = await window.ipc.invoke('email-accounts:send-test', {
        id: account.id,
        to: targetEmail,
        useSignature,
        attachments: attachments.map((a) => ({
          filename: a.name,
          path: a.path,
          size: a.size
        }))
      });

      if (result.sent) {
        toast.success(`Test email sent successfully to ${result.sentTo || targetEmail}!`);
        onClose();
      } else {
        setErrorMessage(result.error || 'Failed to send test email.');
      }
    } catch (err: any) {
      console.error('[SendTestModal] Send failed:', err);
      const msg = err.message || 'Failed to send test email.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Send className="w-4 h-4 text-primary" />
            Send Test Email
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Test your Gmail sender configuration and verify real email delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sender */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Sender Account</Label>
            <div className="px-3 py-1.5 rounded-md bg-surface-2 border border-border-subtle text-xs font-mono text-foreground">
              {account.email}
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="test-recipient" className="text-xs font-medium">
                Recipient Email
              </Label>

              <span className="text-[10px] text-muted-foreground font-mono">
                {uniqueCount}/3 unique test recipients
              </span>
            </div>

            <Input
              id="test-recipient"
              type="email"
              placeholder="recipient@example.com"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setErrorMessage(null);
              }}
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Previously used test recipients */}
          {testRecipients.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Previously Tested Recipients:</Label>
              <div className="flex flex-wrap gap-1.5">
                {testRecipients.map((r) => (
                  <button
                    key={r.email}
                    type="button"
                    onClick={() => handleSelectPrevious(r.email)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                      recipient.trim().toLowerCase() === r.email.toLowerCase()
                        ? 'bg-primary/20 border-primary/50 text-primary font-medium'
                        : 'bg-surface-2 border-border-subtle text-muted-foreground hover:text-foreground hover:bg-surface-3'
                    }`}
                  >
                    {r.email}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-2.5 rounded border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Signature Option */}
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="use-signature"
              checked={useSignature}
              onCheckedChange={(c) => setUseSignature(!!c)}
            />
            <Label htmlFor="use-signature" className="text-xs cursor-pointer select-none">
              Include Gmail signature
            </Label>
          </div>

          {/* Attachments */}
          <div className="space-y-2 pt-1 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Attachments (Optional)</Label>
              <label className="cursor-pointer">
                <Input
                  type="file"
                  multiple
                  onChange={handleFileAdd}
                  className="hidden"
                />
                <span className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Paperclip className="w-3 h-3" /> Add file
                </span>
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2.5 py-1 rounded bg-surface-2 border border-border-subtle text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="truncate font-mono">{att.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({(att.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSend} disabled={isSending} className="gap-1.5">
            {isSending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Send Test
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
