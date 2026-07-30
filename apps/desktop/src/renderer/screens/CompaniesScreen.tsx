import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SyncCompanyRepository, SyncContactRepository } from '../repositories/sync';
import {
  useEntityList,
  useCreateEntity,
  useUpdateEntity,
  useDeleteEntity
} from '../hooks/useEntity';
import { EntityToolbar } from '../components/crm/EntityToolbar';
import { CompanyForm } from '../components/crm/CompanyForm';
import { TagSystem } from '../components/crm/TagSystem';
import { NotesSystem } from '../components/crm/NotesSystem';
import LeadIntelligenceDetails from '../components/crm/LeadIntelligenceDetails';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Building2, X, Globe, MapPin, Briefcase, Phone, Star, ExternalLink, Mail, Users2, Cpu } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { CompanyStatus, ContactStatus } from '@leadforge/schema';
import { useWorkspace } from '../hooks/useWorkspace';

/**
 * CompaniesScreen presents a list of target organizations, a details panel,
 * and handles workspace CRUD.
 */
export default function CompaniesScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'intelligence'>('overview');

  // Campaign enrollment states
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollCampaignId, setEnrollCampaignId] = useState('');

  // Fetch campaigns for enrollment selector
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('campaigns:list', { workspaceId });
    },
    enabled: !!workspaceId,
  });

  // Enrollment mutation
  const enrollMutation = useMutation({
    mutationFn: async (payload: { campaignId: string; contactIds: string[] }) => {
      return window.ipc.invoke('campaigns:enroll', payload);
    },
    onSuccess: () => {
      setEnrollOpen(false);
      setEnrollCampaignId('');
      setSelectedIds([]);
      alert('Successfully enrolled contacts from selected companies into campaign!');
    },
    onError: (err: any) => {
      alert(`Enrollment failed: ${err.message}`);
    }
  });

  // Dialog controls
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // TanStack Entity Query hooks
  const companiesQuery = useEntityList(SyncCompanyRepository);
  const contactsQuery = useEntityList(SyncContactRepository);
  const createMutation = useCreateEntity(SyncCompanyRepository);
  const updateMutation = useUpdateEntity(SyncCompanyRepository);
  const updateContactMutation = useUpdateEntity(SyncContactRepository);
  const deleteMutation = useDeleteEntity(SyncCompanyRepository);

  const companies = companiesQuery.data || [];
  const contacts = contactsQuery.data || [];

  // Filter & Search logic
  const filtered = companies.filter((c: any) => {
    const nameStr = c.name || '';
    const domainStr = c.domain || '';
    const tagsStr = Array.isArray(c.tags) ? c.tags.join(' ') : '';
    let notesStr = '';
    if (c.notes) {
      if (Array.isArray(c.notes)) {
        notesStr = c.notes.map((n: any) => n.content || '').join(' ');
      } else {
        notesStr = String(c.notes);
      }
    }
    const searchLower = search.toLowerCase();
    const matchesSearch = nameStr.toLowerCase().includes(searchLower) || 
                          domainStr.toLowerCase().includes(searchLower) ||
                          tagsStr.toLowerCase().includes(searchLower) ||
                          notesStr.toLowerCase().includes(searchLower);
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async (data: any) => {
    await createMutation.mutateAsync(data);
    setCreateOpen(false);
  };

  const handleUpdate = async (data: any) => {
    if (selectedCompany) {
      const updated = await updateMutation.mutateAsync({ id: selectedCompany.id, data });
      setSelectedCompany(updated);
      setEditOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this company?')) {
      await deleteMutation.mutateAsync(id);
      if (selectedCompany?.id === id) {
        setSelectedCompany(null);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete the ${selectedIds.length} selected companies?`)) {
      await Promise.all(selectedIds.map((id) => deleteMutation.mutateAsync(id)));
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((c: any) => c.id));
    }
  };

  return (
    <div className="flex h-full gap-4 text-xs font-sans">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="flex justify-between items-end border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Companies</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Manage accounts, details, notes, and activity pipelines.
            </p>
          </div>
        </div>

        <EntityToolbar
          search={search}
          onSearchChange={setSearch}
          filterStatus={statusFilter}
          onStatusChange={setStatusFilter}
          statusOptions={Object.values(CompanyStatus)}
          createLabel="Add Company"
          onCreateTrigger={() => setCreateOpen(true)}
          selectedCount={selectedIds.length}
          onBulkDelete={handleBulkDelete}
          onBulkEnroll={() => setEnrollOpen(true)}
        />

        {companiesQuery.isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Loading companies...
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center p-6 bg-card border border-border-subtle border-dashed rounded-xl">
            <div className="max-w-md w-full flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">No companies found</h3>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Try adding a new company or adjusting search filters.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)} size="sm">
                + Add Company
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-sunken border-b border-border-subtle text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-border-subtle text-accent focus:ring-accent"
                    />
                  </th>
                  <th className="px-4 py-3">Company Name</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filtered.map((item: any) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isPanelSelected = selectedCompany?.id === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedCompany(item)}
                      className={`hover:bg-sunken/40 cursor-pointer transition-colors ${
                        isPanelSelected ? 'bg-accent/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-border-subtle text-accent focus:ring-accent"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                      <td className="px-4 py-3 font-mono text-accent">{item.domain || 'N/A'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.industry || 'N/A'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.size || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold ${
                            item.status === 'CUSTOMER'
                              ? 'bg-green-500/10 text-green-600 border-green-500/20'
                              : item.status === 'QUALIFIED'
                              ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                              : 'bg-muted/10 text-muted-foreground border-muted/20'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCompany(item);
                            setEditOpen(true);
                          }}
                          className="h-7 text-[10px]"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="h-7 text-[10px] text-danger-text hover:bg-danger-bg hover:text-danger-text"
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Slide-over Side Panel (Details) ───────────────────────────────── */}
      {selectedCompany && (
        <aside className="w-80 bg-card border border-border-subtle rounded-xl p-4 space-y-5 flex flex-col h-full shadow-sm animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center text-accent">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-xs leading-none">{selectedCompany.name}</h3>
                <span className="text-[10px] text-muted-foreground mt-1 block">{selectedCompany.domain}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedCompany(null)}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-sunken/50 border border-border-subtle rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setDetailTab('overview')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold transition-all ${
                detailTab === 'overview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="w-3 h-3" />
              CRM
            </button>
            <button
              onClick={() => setDetailTab('intelligence')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold transition-all ${
                detailTab === 'intelligence' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Cpu className="w-3 h-3" />
              Intelligence
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Intelligence tab */}
            {detailTab === 'intelligence' && (
              <LeadIntelligenceDetails companyId={selectedCompany.id} />
            )}

            {/* CRM Overview tab */}
            {detailTab === 'overview' && (
              <>
              {/* Overview / Metadata */}
              <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Overview</h4>
              <div className="bg-sunken/20 border border-border-subtle rounded-lg p-2.5 space-y-2">
                {selectedCompany.website && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <a
                      href={selectedCompany.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent truncate hover:underline"
                    >
                      {selectedCompany.website}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Globe className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground font-mono truncate">{selectedCompany.domain || <span className="opacity-40">—</span>}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground">{selectedCompany.industry || <span className="opacity-40">—</span>}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground">{selectedCompany.location || <span className="opacity-40">—</span>}</span>
                </div>
                {selectedCompany.phone && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="text-foreground">{selectedCompany.phone}</span>
                  </div>
                )}
                {selectedCompany.rating != null && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Star className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="text-foreground">{selectedCompany.rating} / 5</span>
                  </div>
                )}
                {selectedCompany.crawlStatus && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="opacity-60">Crawl:</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">{selectedCompany.crawlStatus}</Badge>
                    {selectedCompany.contactCount != null && (
                      <span className="text-foreground">{selectedCompany.contactCount} contacts found</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Pipeline Stage */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Company Status</h4>
              <div className="flex flex-wrap gap-1 bg-sunken/20 border border-border-subtle rounded-lg p-2">
                {Object.values(CompanyStatus).map((status) => {
                  const isActive = selectedCompany.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={async () => {
                        const updated = await updateMutation.mutateAsync({
                          id: selectedCompany.id,
                          data: { status }
                        });
                        setSelectedCompany(updated);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                        isActive
                          ? 'bg-accent text-white border-accent'
                          : 'bg-card text-muted-foreground border-border-subtle hover:bg-sunken'
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linked Contacts */}
            {(() => {
              const linkedContacts = contacts.filter((c: any) => c.companyId === selectedCompany.id);
              return linkedContacts.length > 0 ? (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Users2 className="w-3 h-3" /> Contacts ({linkedContacts.length})
                  </h4>
                  <div className="space-y-1.5">
                    {linkedContacts.map((c: any) => (
                      <div key={c.id} className="bg-sunken/20 border border-border-subtle rounded-lg p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[10px] font-semibold text-foreground">
                            {c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : <span className="opacity-40">Unnamed Contact</span>}
                          </p>
                          {c.type === 'executive' && (
                            <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[8px] h-3.5 px-1 font-bold">
                              Executive
                            </Badge>
                          )}
                        </div>
                        {(c.title || c.headline) && (
                          <p className="text-[9px] text-accent font-medium leading-snug">{c.title || c.headline}</p>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Mail className="w-3 h-3 shrink-0 opacity-60" />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Phone className="w-3 h-3 shrink-0 opacity-60" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {c.linkedinUrl && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                              LinkedIn Profile
                            </a>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-border-subtle/40">
                          <span className="text-[9px] text-muted-foreground">Stage:</span>
                          <select
                            value={c.status || 'NEW'}
                            onChange={async (e) => {
                              await updateContactMutation.mutateAsync({
                                id: c.id,
                                data: { status: e.target.value }
                              });
                            }}
                            className="bg-card border border-border-subtle rounded text-[9px] font-semibold px-1 py-0.5 text-foreground focus-visible:outline-none"
                          >
                            {Object.values(ContactStatus).map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Tags System */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tags</h4>
              <TagSystem
                tags={selectedCompany.tags || []}
                onChange={async (newTags) => {
                  const updated = await updateMutation.mutateAsync({
                    id: selectedCompany.id,
                    data: { tags: newTags },
                  });
                  setSelectedCompany(updated);
                }}
              />
            </div>

            {/* Notes System */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Notes</h4>
              <NotesSystem
                notesJson={selectedCompany.notes}
                onUpdate={async (json) => {
                  const updated = await updateMutation.mutateAsync({
                    id: selectedCompany.id,
                    data: { notes: json },
                  });
                  setSelectedCompany(updated);
                }}
              />
            </div>
          </>
        )}
      </div>
    </aside>
  )}

      {/* ── Create / Edit Dialogs ────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
          </DialogHeader>
          <CompanyForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Company Details</DialogTitle>
          </DialogHeader>
          {selectedCompany && (
            <CompanyForm
              initialValues={selectedCompany}
              onSubmit={handleUpdate}
              onCancel={() => setEditOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Campaign Enrollment Dialog ────────────────────────────────────── */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Company Leads in Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-[11px] text-muted-foreground">
              You are enrolling all contacts belonging to the {selectedIds.length} selected company/companies.
            </p>
            <div className="space-y-1">
              <Label htmlFor="enrollCampSelect">Outreach Campaign</Label>
              <select
                id="enrollCampSelect"
                value={enrollCampaignId}
                onChange={(e) => setEnrollCampaignId(e.target.value)}
                className="w-full h-8 px-2 bg-background border border-input rounded text-xs focus-visible:outline-none"
              >
                <option value="">-- Select Campaign --</option>
                {(campaignsQuery.data || []).map((camp: any) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name} ({camp.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!enrollCampaignId) {
                    alert('Please select a campaign.');
                    return;
                  }
                  const companyContacts = contacts.filter((c: any) => selectedIds.includes(c.companyId));
                  const contactIds = companyContacts.map((c: any) => c.id);
                  if (contactIds.length === 0) {
                    alert('No contacts found belonging to the selected companies.');
                    return;
                  }
                  enrollMutation.mutate({ campaignId: enrollCampaignId, contactIds });
                }}
                disabled={enrollMutation.isPending}
              >
                {enrollMutation.isPending ? 'Enrolling...' : 'Confirm Enrollment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
