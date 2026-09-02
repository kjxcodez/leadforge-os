import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import {
  Mail,
  Clock,
  GitBranch,
  Tag,
  Layers,
  Bell,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Paperclip,
  ExternalLink,
  X
} from 'lucide-react';
import { MediaPickerDialog } from '../media/MediaPickerDialog';

export interface SequenceStepItem {
  id: string;
  type: 'SEND_EMAIL' | 'WAIT' | 'IF' | 'ADD_TAG' | 'UPDATE_STAGE' | 'SEND_NOTIFICATION';
  config: Record<string, any>;
  yesBranch?: SequenceStepItem[];
  noBranch?: SequenceStepItem[];
}

interface ProgressiveSequenceEditorProps {
  steps: SequenceStepItem[];
  onChange: (steps: SequenceStepItem[]) => void;
  templates?: any[];
}

export function ProgressiveSequenceEditor({
  steps,
  onChange,
  templates = []
}: ProgressiveSequenceEditorProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [mediaPickerStepIdx, setMediaPickerStepIdx] = useState<number | null>(null);

  const addStep = (type: SequenceStepItem['type']) => {
    const newStep: SequenceStepItem = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      config: defaultConfigForType(type)
    };
    if (type === 'IF') {
      newStep.yesBranch = [
        {
          id: `step_${Date.now()}_yes`,
          type: 'SEND_EMAIL',
          config: { subject: 'Follow up on response', body: 'Hi {{firstName}}, thanks for replying!' }
        }
      ];
      newStep.noBranch = [
        {
          id: `step_${Date.now()}_no`,
          type: 'ADD_TAG',
          config: { tag: 'No-Response-Followup' }
        }
      ];
    }
    onChange([...steps, newStep]);
    setShowAddMenu(false);
  };

  const removeStep = (index: number) => {
    const updated = [...steps];
    updated.splice(index, 1);
    onChange(updated);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === steps.length - 1) return;
    const updated = [...steps];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const currentItem = updated[index];
    const targetItem = updated[targetIdx];
    if (currentItem && targetItem) {
      updated[index] = targetItem;
      updated[targetIdx] = currentItem;
      onChange(updated);
    }
  };

  const updateStepConfig = (index: number, newConfig: Record<string, any>) => {
    const updated = [...steps];
    const currentItem = updated[index];
    if (!currentItem) return;
    updated[index] = { ...currentItem, config: { ...(currentItem.config || {}), ...newConfig } };
    onChange(updated);
  };

  const updateBranchStep = (
    parentIndex: number,
    branch: 'yesBranch' | 'noBranch',
    childIndex: number,
    newConfig: Record<string, any>
  ) => {
    const updated = [...steps];
    const parentItem = updated[parentIndex];
    if (!parentItem) return;
    const targetBranch = [...(parentItem[branch] || [])];
    const childItem = targetBranch[childIndex];
    if (!childItem) return;
    targetBranch[childIndex] = {
      ...childItem,
      config: { ...(childItem.config || {}), ...newConfig }
    };
    updated[parentIndex] = { ...parentItem, [branch]: targetBranch };
    onChange(updated);
  };

  return (
    <div className="space-y-3 font-sans">
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.id || idx}
            className="bg-card border border-border-subtle rounded-none p-3 relative space-y-2 group shadow-sm hover:border-primary/40 transition-colors"
          >
            {/* Step Card Header */}
            <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-none bg-surface-3 border border-border-subtle text-[10px] font-mono font-bold flex items-center justify-center text-primary">
                  {idx + 1}
                </span>
                <StepBadge type={step.type} />
              </div>

              <div className="flex items-center gap-1">
                {idx > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveStep(idx, 'up')}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                )}
                {idx < steps.length - 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveStep(idx, 'down')}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                )}
                {steps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(idx)}
                    className="h-6 w-6 p-0 text-danger hover:bg-danger-muted"
                    title="Remove step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Step Content Form */}
            {step.type === 'SEND_EMAIL' && (
              <div className="space-y-2 pt-1">
                {templates.length > 0 && (
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                      Template Preset
                    </Label>
                    <select
                      onChange={(e) => {
                        const selectedTpl = templates.find((t) => t.id === e.target.value);
                        if (selectedTpl) {
                          let tplAttachments = selectedTpl.attachments || [];
                          if (typeof tplAttachments === 'string') {
                            try {
                              tplAttachments = JSON.parse(tplAttachments);
                            } catch {
                              tplAttachments = [];
                            }
                          }
                          updateStepConfig(idx, {
                            templateId: selectedTpl.id,
                            subject: selectedTpl.subject,
                            body: selectedTpl.body,
                            attachments: Array.isArray(tplAttachments) ? tplAttachments : []
                          });
                        }
                      }}
                      className="bg-surface-3 border border-border-subtle rounded-none px-2 py-0.5 text-[10px] text-foreground outline-none font-sans"
                    >
                      <option value="">-- Apply Template --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-foreground">Subject Line</Label>
                  <Input
                    placeholder="Subject line..."
                    value={step.config.subject || ''}
                    onChange={(e) => updateStepConfig(idx, { subject: e.target.value })}
                    className="rounded-none bg-surface-3 border-border-subtle text-xs font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-foreground">Message Body</Label>
                  <Textarea
                    rows={3}
                    placeholder="Hi {{firstName}}, I wanted to follow up..."
                    value={step.config.body || ''}
                    onChange={(e) => updateStepConfig(idx, { body: e.target.value })}
                    className="rounded-none bg-surface-3 border-border-subtle text-xs font-sans"
                  />
                </div>

                {/* Attachments Section */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-semibold text-foreground flex items-center gap-1">
                      <Paperclip className="w-3 h-3 text-muted-foreground" />
                      Attachments ({(step.config.attachments || []).length})
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMediaPickerStepIdx(idx)}
                      className="h-5 px-1.5 text-[10px] font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-2.5 h-2.5" /> Attach from Media / Drive
                    </Button>
                  </div>
                  {(step.config.attachments || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(step.config.attachments || []).map((att: any, attIdx: number) => (
                        <div
                          key={att.id || att.fileId || attIdx}
                          className="inline-flex items-center gap-1.5 bg-surface-3 border border-border-subtle px-2 py-0.5 text-[10px] text-foreground"
                        >
                          <Paperclip className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[140px]" title={att.filename}>
                            {att.filename}
                          </span>
                          {att.size && (
                            <span className="text-muted-foreground text-[9px]">
                              ({Math.round((att.size || 0) / 1024)} KB)
                            </span>
                          )}
                          {att.driveUrl && (
                            <a
                              href={att.driveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-primary ml-0.5"
                              title="Open in Google Drive"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (step.config.attachments || []).filter(
                                (_: any, i: number) => i !== attIdx
                              );
                              updateStepConfig(idx, { attachments: updated });
                            }}
                            className="text-muted-foreground hover:text-danger ml-0.5"
                            title="Remove attachment"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {mediaPickerStepIdx === idx && (
                    <MediaPickerDialog
                      open={mediaPickerStepIdx === idx}
                      onOpenChange={(open) => !open && setMediaPickerStepIdx(null)}
                      initialSelected={step.config.attachments || []}
                      onSelect={(selected) => {
                        updateStepConfig(idx, { attachments: selected });
                        setMediaPickerStepIdx(null);
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {step.type === 'WAIT' && (
              <div className="flex items-center gap-3 pt-1">
                <Label className="text-[10px] font-semibold text-foreground whitespace-nowrap">
                  Wait Duration:
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={Math.max(1, Math.round((step.config.delaySeconds || 259200) / 86400))}
                    onChange={(e) =>
                      updateStepConfig(idx, {
                        delaySeconds: (parseInt(e.target.value) || 1) * 86400
                      })
                    }
                    className="w-20 h-8 rounded-none bg-surface-3 border-border-subtle font-mono text-xs"
                  />
                  <span className="text-xs text-muted-foreground font-mono">days before next step</span>
                </div>
              </div>
            )}

            {step.type === 'IF' && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-foreground">Condition Rule</Label>
                  <select
                    value={step.config.condition || "contact.status == 'REPLIED'"}
                    onChange={(e) => updateStepConfig(idx, { condition: e.target.value })}
                    className="w-full h-8 px-2 bg-surface-3 border border-border-subtle rounded-none text-xs text-foreground outline-none font-mono"
                  >
                    <option value="contact.status == 'REPLIED'">Has Replied (contact.status == 'REPLIED')</option>
                    <option value="contact.status == 'QUALIFIED'">Is Qualified Lead (contact.status == 'QUALIFIED')</option>
                    <option value="contact.status == 'BOUNCED'">Email Bounced (contact.status == 'BOUNCED')</option>
                    <option value="contact.status != 'UNSUBSCRIBED'">Not Unsubscribed (contact.status != 'UNSUBSCRIBED')</option>
                  </select>
                </div>

                {/* Branching UI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                  {/* YES Branch */}
                  <div className="border border-success/30 bg-success/5 p-2.5 space-y-2">
                    <span className="text-[10px] font-bold text-success uppercase tracking-wider font-mono flex items-center gap-1">
                      ✓ YES (Condition Met)
                    </span>
                    {(step.yesBranch || []).map((child, cIdx) => (
                      <div key={child.id || cIdx} className="bg-card border border-border-subtle p-2 space-y-1 text-xs">
                        <StepBadge type={child.type} />
                        {child.type === 'SEND_EMAIL' && (
                          <Input
                            placeholder="Subject..."
                            value={child.config.subject || ''}
                            onChange={(e) =>
                              updateBranchStep(idx, 'yesBranch', cIdx, { subject: e.target.value })
                            }
                            className="h-7 text-xs rounded-none bg-surface-3 border-border-subtle font-sans"
                          />
                        )}
                        {child.type === 'ADD_TAG' && (
                          <Input
                            placeholder="Tag name..."
                            value={child.config.tag || ''}
                            onChange={(e) =>
                              updateBranchStep(idx, 'yesBranch', cIdx, { tag: e.target.value })
                            }
                            className="h-7 text-xs rounded-none bg-surface-3 border-border-subtle font-mono"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* NO Branch */}
                  <div className="border border-muted/40 bg-surface-3/30 p-2.5 space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1">
                      ✗ NO (Condition Not Met)
                    </span>
                    {(step.noBranch || []).map((child, cIdx) => (
                      <div key={child.id || cIdx} className="bg-card border border-border-subtle p-2 space-y-1 text-xs">
                        <StepBadge type={child.type} />
                        {child.type === 'ADD_TAG' && (
                          <Input
                            placeholder="Tag name..."
                            value={child.config.tag || ''}
                            onChange={(e) =>
                              updateBranchStep(idx, 'noBranch', cIdx, { tag: e.target.value })
                            }
                            className="h-7 text-xs rounded-none bg-surface-3 border-border-subtle font-mono"
                          />
                        )}
                        {child.type === 'SEND_EMAIL' && (
                          <Input
                            placeholder="Subject..."
                            value={child.config.subject || ''}
                            onChange={(e) =>
                              updateBranchStep(idx, 'noBranch', cIdx, { subject: e.target.value })
                            }
                            className="h-7 text-xs rounded-none bg-surface-3 border-border-subtle font-sans"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step.type === 'ADD_TAG' && (
              <div className="space-y-1 pt-1">
                <Label className="text-[10px] font-semibold text-foreground">CRM Tag to Apply</Label>
                <Input
                  placeholder="e.g. Outreached-Q4"
                  value={step.config.tag || ''}
                  onChange={(e) => updateStepConfig(idx, { tag: e.target.value })}
                  className="rounded-none bg-surface-3 border-border-subtle font-mono text-xs"
                />
              </div>
            )}

            {step.type === 'UPDATE_STAGE' && (
              <div className="space-y-1 pt-1">
                <Label className="text-[10px] font-semibold text-foreground">Move Lead to Stage</Label>
                <select
                  value={step.config.stage || 'CONTACTED'}
                  onChange={(e) => updateStepConfig(idx, { stage: e.target.value })}
                  className="w-full h-8 px-2 bg-surface-3 border border-border-subtle rounded-none text-xs text-foreground outline-none font-mono"
                >
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="REPLIED">REPLIED</option>
                  <option value="BOUNCED">BOUNCED</option>
                  <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                </select>
              </div>
            )}

            {step.type === 'SEND_NOTIFICATION' && (
              <div className="space-y-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-foreground">Alert Message</Label>
                  <Input
                    placeholder="Alert: Lead responded to cold email!"
                    value={step.config.message || ''}
                    onChange={(e) => updateStepConfig(idx, { message: e.target.value })}
                    className="rounded-none bg-surface-3 border-border-subtle text-xs font-sans"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-semibold text-muted-foreground">Type:</Label>
                  <select
                    value={step.config.type || 'info'}
                    onChange={(e) => updateStepConfig(idx, { type: e.target.value })}
                    className="bg-surface-3 border border-border-subtle rounded-none px-2 py-0.5 text-xs text-foreground outline-none font-sans"
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warn">Warning</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Step Button Bar */}
      <div className="relative pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="w-full border-dashed border-border-subtle hover:border-primary hover:text-primary rounded-none text-xs py-2 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Step to Sequence
        </Button>

        {showAddMenu && (
          <div className="absolute left-0 right-0 bottom-full mb-2 bg-card border border-border-subtle shadow-elevation-2 rounded-none p-2 grid grid-cols-2 gap-1 z-20">
            <button
              type="button"
              onClick={() => addStep('SEND_EMAIL')}
              className="flex items-center gap-2 p-2 hover:bg-surface-3 text-left transition-colors"
            >
              <Mail className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-semibold text-foreground">Email</div>
                <div className="text-[10px] text-muted-foreground">Send outbound email</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => addStep('WAIT')}
              className="flex items-center gap-2 p-2 hover:bg-surface-3 text-left transition-colors"
            >
              <Clock className="w-4 h-4 text-info" />
              <div>
                <div className="text-xs font-semibold text-foreground">Wait</div>
                <div className="text-[10px] text-muted-foreground font-mono">Delay before next step</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => addStep('IF')}
              className="flex items-center gap-2 p-2 hover:bg-surface-3 text-left transition-colors"
            >
              <GitBranch className="w-4 h-4 text-warning" />
              <div>
                <div className="text-xs font-semibold text-foreground">Condition</div>
                <div className="text-[10px] text-muted-foreground font-mono">Branch on lead state</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => addStep('ADD_TAG')}
              className="flex items-center gap-2 p-2 hover:bg-surface-3 text-left transition-colors"
            >
              <Tag className="w-4 h-4 text-success" />
              <div>
                <div className="text-xs font-semibold text-foreground">Tag</div>
                <div className="text-[10px] text-muted-foreground font-mono">Apply CRM tag</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => addStep('UPDATE_STAGE')}
              className="flex items-center gap-2 p-2 hover:bg-surface-3 text-left transition-colors"
            >
              <Layers className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-semibold text-foreground">Pipeline Stage</div>
                <div className="text-[10px] text-muted-foreground font-mono">Move lead status</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => addStep('SEND_NOTIFICATION')}
              className="flex items-center gap-2 p-2 hover:bg-surface-3 text-left transition-colors"
            >
              <Bell className="w-4 h-4 text-info" />
              <div>
                <div className="text-xs font-semibold text-foreground">Notification</div>
                <div className="text-[10px] text-muted-foreground">In-app/desktop alert</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({ type }: { type: SequenceStepItem['type'] }) {
  switch (type) {
    case 'SEND_EMAIL':
      return (
        <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] rounded-none flex items-center gap-1 font-mono">
          <Mail className="w-3 h-3" /> Email Step
        </Badge>
      );
    case 'WAIT':
      return (
        <Badge className="bg-info-muted text-info border border-info/20 text-[10px] rounded-none flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3" /> Wait Step
        </Badge>
      );
    case 'IF':
      return (
        <Badge className="bg-warning-muted text-warning border border-warning/20 text-[10px] rounded-none flex items-center gap-1 font-mono">
          <GitBranch className="w-3 h-3" /> Condition Branch
        </Badge>
      );
    case 'ADD_TAG':
      return (
        <Badge className="bg-success-muted text-success border border-success/20 text-[10px] rounded-none flex items-center gap-1 font-mono">
          <Tag className="w-3 h-3" /> CRM Tag
        </Badge>
      );
    case 'UPDATE_STAGE':
      return (
        <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] rounded-none flex items-center gap-1 font-mono">
          <Layers className="w-3 h-3" /> Pipeline Stage
        </Badge>
      );
    case 'SEND_NOTIFICATION':
      return (
        <Badge className="bg-info-muted text-info border border-info/20 text-[10px] rounded-none flex items-center gap-1 font-mono">
          <Bell className="w-3 h-3" /> Notification
        </Badge>
      );
    default:
      return <Badge className="rounded-none font-mono">{type}</Badge>;
  }
}

function defaultConfigForType(type: SequenceStepItem['type']): Record<string, any> {
  switch (type) {
    case 'SEND_EMAIL':
      return { subject: '', body: '' };
    case 'WAIT':
      return { delaySeconds: 259200 }; // 3 days default
    case 'IF':
      return { condition: "contact.status == 'REPLIED'" };
    case 'ADD_TAG':
      return { tag: '' };
    case 'UPDATE_STAGE':
      return { stage: 'CONTACTED' };
    case 'SEND_NOTIFICATION':
      return { message: 'Lead responded to campaign', type: 'info' };
    default:
      return {};
  }
}
