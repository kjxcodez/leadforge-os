import React, { useState, useEffect } from 'react';
import { X, Users, Filter, Check, UserMinus, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface PreloadedContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string;
  companyName?: string;
}

interface CreateAudienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (audience: any) => void;
  initialMode?: 'dynamic' | 'static';
  initialSelectedContacts?: PreloadedContact[];
  initialFilters?: Record<string, any>;
}

export const CreateAudienceModal: React.FC<CreateAudienceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'dynamic',
  initialSelectedContacts = [],
  initialFilters = {}
}) => {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'dynamic' | 'static'>(initialMode);
  const [selectedContacts, setSelectedContacts] = useState<PreloadedContact[]>(initialSelectedContacts);
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
  const [allowUnfiltered, setAllowUnfiltered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Distinct options for structured filter dropdowns inside modal
  const [companyOptions, setCompanyOptions] = useState<any[]>([]);
  const [industryOptions, setIndustryOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [discoveryRuns, setDiscoveryRuns] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      const defaultMode = initialSelectedContacts.length > 0 ? 'static' : initialMode;
      setMode(defaultMode);
      setSelectedContacts(initialSelectedContacts);
      setFilters(initialFilters);
      setAllowUnfiltered(false);
      setError(null);

      // Load distinct filter options if workspaceId is present and mode is dynamic
      if (workspaceId && (window as any).ipc && defaultMode === 'dynamic') {
        (window as any).ipc.invoke('companies:distinct-values', { workspaceId }).then((res: any) => {
          setIndustryOptions(res?.industries || []);
          setLocationOptions(res?.locations || []);
        }).catch((err: any) => {
          console.warn('[CreateAudienceModal] Failed to load company distinct values:', err?.message || err);
        });

        (window as any).ipc.invoke('contacts:distinct-values', { workspaceId }).then((res: any) => {
          setTitleOptions(res?.titles || []);
          setSourceOptions(res?.sources || []);
        }).catch((err: any) => {
          console.warn('[CreateAudienceModal] Failed to load contact distinct values:', err?.message || err);
        });

        (window as any).ipc.invoke('companies:query', { workspaceId }).then((res: any) => {
          setCompanyOptions(res || []);
        }).catch((err: any) => {
          console.warn('[CreateAudienceModal] Failed to load companies:', err?.message || err);
        });

        (window as any).ipc.invoke('discovery:run:list', { workspaceId }).then((res: any) => {
          setDiscoveryRuns(res || []);
        }).catch((err: any) => {
          console.warn('[CreateAudienceModal] Failed to load discovery runs:', err?.message || err);
        });
      }
    }
  }, [isOpen, initialMode, initialSelectedContacts, initialFilters, workspaceId]);

  useEffect(() => {
    if (isOpen && mode === 'dynamic' && workspaceId && (window as any).ipc && industryOptions.length === 0) {
      (window as any).ipc.invoke('companies:distinct-values', { workspaceId }).then((res: any) => {
        setIndustryOptions(res?.industries || []);
        setLocationOptions(res?.locations || []);
      }).catch((err: any) => {
        console.warn('[CreateAudienceModal] Failed to load company distinct values:', err?.message || err);
      });

      (window as any).ipc.invoke('contacts:distinct-values', { workspaceId }).then((res: any) => {
        setTitleOptions(res?.titles || []);
        setSourceOptions(res?.sources || []);
      }).catch((err: any) => {
        console.warn('[CreateAudienceModal] Failed to load contact distinct values:', err?.message || err);
      });

      (window as any).ipc.invoke('companies:query', { workspaceId }).then((res: any) => {
        setCompanyOptions(res || []);
      }).catch((err: any) => {
        console.warn('[CreateAudienceModal] Failed to load companies:', err?.message || err);
      });

      (window as any).ipc.invoke('discovery:run:list', { workspaceId }).then((res: any) => {
        setDiscoveryRuns(res || []);
      }).catch((err: any) => {
        console.warn('[CreateAudienceModal] Failed to load discovery runs:', err?.message || err);
      });
    }
  }, [isOpen, mode, workspaceId, industryOptions.length]);

  if (!isOpen) return null;

  const handleRemoveContact = (id: string) => {
    setSelectedContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value.trim()) {
        next[key] = value.trim();
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const activeFilterCount = Object.values(filters).filter((v) => !!v).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Audience name is required.');
      return;
    }
    if (!workspaceId) {
      setError('Active workspace is required.');
      return;
    }

    if (mode === 'static' && selectedContacts.length === 0) {
      setError('At least one contact must be selected for a Static Audience.');
      return;
    }

    // Section 8: Prevent accidental empty dynamic filter without explicit acknowledgement
    if (mode === 'dynamic' && activeFilterCount === 0 && !allowUnfiltered) {
      setError('A Dynamic Audience requires at least one filter rule, or check "Allow unfiltered audience (Include ALL CRM contacts)".');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const cleanFilters: Record<string, any> = {};
      if (mode === 'dynamic') {
        Object.entries(filters).forEach(([k, v]) => {
          if (v) cleanFilters[k] = v;
        });
      }

      const payload: any = {
        workspaceId,
        name: name.trim(),
        description: description.trim() || null,
        entityType: 'contacts',
        mode,
        filterDefinition: cleanFilters,
        staticMemberIds: mode === 'static' ? selectedContacts.map((c) => c.id) : []
      };

      const result = await (window as any).ipc.invoke('audiences:create', payload);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create audience');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-card border border-border-subtle rounded-none max-w-lg w-full shadow-elevation-2 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-3/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Create Audience Segment</h2>
              <span className="text-[10px] text-muted-foreground">Save recipient rules or explicit member snapshot</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-none hover:bg-surface-3 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-danger-muted border border-danger/30 text-danger rounded-none text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="audName" className="text-xs font-bold text-foreground">
              Audience Name <span className="text-danger">*</span>
            </Label>
            <Input
              id="audName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Miami HVAC Decision Makers"
              className="h-8 rounded-none bg-background border-border-subtle text-xs"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="audDesc" className="text-xs font-semibold text-foreground">
              Description <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="audDesc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Target outreach segment details..."
              className="h-8 rounded-none bg-background border-border-subtle text-xs"
            />
          </div>

          {/* Mode Switcher */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold text-foreground">Audience Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('dynamic')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-none border text-xs font-semibold transition-all ${
                  mode === 'dynamic'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-surface-3/50 border-border-subtle text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Dynamic Filter Recipe</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('static')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-none border text-xs font-semibold transition-all ${
                  mode === 'static'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-surface-3/50 border-border-subtle text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Static Selection Snapshot</span>
              </button>
            </div>
          </div>

          {mode === 'dynamic' ? (
            <div className="bg-surface-3/40 border border-border-subtle p-3.5 rounded-none space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Dynamic Filter Rules ({activeFilterCount})</span>
                </div>
              </div>

              {/* Structured Filter Controls */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Keyword Search</Label>
                  <Input
                    placeholder="e.g. HVAC, CEO"
                    value={filters.search || ''}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="h-7 text-xs rounded-none bg-card border-border-subtle"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Status</Label>
                  <Input
                    placeholder="e.g. QUALIFIED"
                    value={filters.status || ''}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="h-7 text-xs rounded-none bg-card border-border-subtle"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Industry</Label>
                  {industryOptions.length > 0 ? (
                    <select
                      value={filters.industry || ''}
                      onChange={(e) => handleFilterChange('industry', e.target.value)}
                      className="w-full h-7 bg-card border border-border-subtle rounded-none px-2 text-xs outline-none text-foreground"
                    >
                      <option value="">All Industries</option>
                      {industryOptions.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="e.g. Software"
                      value={filters.industry || ''}
                      onChange={(e) => handleFilterChange('industry', e.target.value)}
                      className="h-7 text-xs rounded-none bg-card border-border-subtle"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Location</Label>
                  {locationOptions.length > 0 ? (
                    <select
                      value={filters.location || ''}
                      onChange={(e) => handleFilterChange('location', e.target.value)}
                      className="w-full h-7 bg-card border border-border-subtle rounded-none px-2 text-xs outline-none text-foreground"
                    >
                      <option value="">All Locations</option>
                      {locationOptions.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="e.g. Miami, FL"
                      value={filters.location || ''}
                      onChange={(e) => handleFilterChange('location', e.target.value)}
                      className="h-7 text-xs rounded-none bg-card border-border-subtle"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Company</Label>
                  {companyOptions.length > 0 ? (
                    <select
                      value={filters.companyId || ''}
                      onChange={(e) => handleFilterChange('companyId', e.target.value)}
                      className="w-full h-7 bg-card border border-border-subtle rounded-none px-2 text-xs outline-none text-foreground"
                    >
                      <option value="">All Companies</option>
                      {companyOptions.map((comp) => (
                        <option key={comp.id} value={comp.id}>{comp.name}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Company ID"
                      value={filters.companyId || ''}
                      onChange={(e) => handleFilterChange('companyId', e.target.value)}
                      className="h-7 text-xs rounded-none bg-card border-border-subtle"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Discovery Run</Label>
                  {discoveryRuns.length > 0 ? (
                    <select
                      value={filters.discoveryRunId || ''}
                      onChange={(e) => handleFilterChange('discoveryRunId', e.target.value)}
                      className="w-full h-7 bg-card border border-border-subtle rounded-none px-2 text-xs outline-none text-foreground"
                    >
                      <option value="">All Runs</option>
                      {discoveryRuns.map((run) => (
                        <option key={run.id} value={run.id}>{run.name || run.query}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Run ID"
                      value={filters.discoveryRunId || ''}
                      onChange={(e) => handleFilterChange('discoveryRunId', e.target.value)}
                      className="h-7 text-xs rounded-none bg-card border-border-subtle"
                    />
                  )}
                </div>
              </div>

              {/* Section 8 Safeguard */}
              {activeFilterCount === 0 && (
                <div className="pt-2 border-t border-border-subtle/60 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allowUnfiltered"
                    checked={allowUnfiltered}
                    onChange={(e) => setAllowUnfiltered(e.target.checked)}
                    className="rounded-none border-border-subtle text-primary focus:ring-ring"
                  />
                  <Label htmlFor="allowUnfiltered" className="text-[11px] text-foreground font-medium cursor-pointer">
                    Allow unfiltered audience (Include ALL CRM records)
                  </Label>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface-3/40 border border-border-subtle p-3.5 rounded-none space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Users className="w-3.5 h-3.5" />
                  <span>Selected Contacts ({selectedContacts.length})</span>
                </div>
              </div>

              {selectedContacts.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {selectedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded-none bg-card border border-border-subtle text-foreground"
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold text-xs text-foreground">
                          {contact.firstName || contact.lastName
                            ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                            : contact.companyName || contact.email || contact.id}
                        </span>
                        {contact.email && (
                          <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">({contact.email})</span>
                        )}
                        {contact.title && (
                          <span className="text-muted-foreground block text-[10px] truncate">
                            {contact.title} {contact.companyName ? `• ${contact.companyName}` : ''}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(contact.id)}
                        className="text-muted-foreground hover:text-danger p-1 transition-colors"
                        title="Remove member"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-danger font-medium">
                  No contacts selected. Select contacts in CRM or switch to Dynamic Filter mode.
                </p>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              size="sm"
              className="h-8 rounded-none text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (mode === 'static' && selectedContacts.length === 0)}
              size="sm"
              className="h-8 gap-1.5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? 'Saving...' : 'Save Audience'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
