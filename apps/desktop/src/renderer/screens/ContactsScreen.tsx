import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { SyncContactRepository, SyncCompanyRepository } from '../repositories/sync';
import {
  useEntityList,
  useCreateEntity,
  useUpdateEntity,
  useDeleteEntity
} from '../hooks/useEntity';
import { EntityToolbar } from '../components/crm/EntityToolbar';
import { ContactForm } from '../components/crm/ContactForm';
import { TagSystem } from '../components/crm/TagSystem';
import { NotesSystem } from '../components/crm/NotesSystem';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Users, X, Mail, Phone, Briefcase, Linkedin, Sparkles } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { ContactStatus } from '@leadforge/schema';

/**
 * ContactsScreen handles contact directory listing, side profile drawer,
 * and CRUD actions.
 */
export default function ContactsScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourcePlatformFilter, setSourcePlatformFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  // Campaign enrollment states
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollCampaignId, setEnrollCampaignId] = useState('');

  // Fetch campaigns for enrollment selector
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('campaigns:list', { workspaceId });
    },
    enabled: !!workspaceId
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
      alert('Successfully enrolled selected contact(s) into campaign!');
    },
    onError: (err: any) => {
      alert(`Enrollment failed: ${err.message}`);
    }
  });

  // Dialog controls
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // TanStack Entity Query hooks
  const contactsQuery = useEntityList(SyncContactRepository);
  const companiesQuery = useEntityList(SyncCompanyRepository);

  const createMutation = useCreateEntity(SyncContactRepository);
  const updateMutation = useUpdateEntity(SyncContactRepository);
  const deleteMutation = useDeleteEntity(SyncContactRepository);

  const contacts = contactsQuery.data || [];
  const companies = companiesQuery.data || [];

  // Filter & Search logic
  const filtered = contacts.filter((c: any) => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const emailStr = (c.email || '').toLowerCase();
    const titleStr = (c.title || '').toLowerCase();
    const searchLower = search.toLowerCase();

    const matchesSearch =
      fullName.includes(searchLower) ||
      emailStr.includes(searchLower) ||
      titleStr.includes(searchLower);
    const matchesStatus = !statusFilter || c.status === statusFilter;
    const matchesPlatform = !sourcePlatformFilter || c.sourcePlatform === sourcePlatformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const handleCreate = async (data: any) => {
    await createMutation.mutateAsync(data);
    setCreateOpen(false);
  };

  const handleUpdate = async (data: any) => {
    if (selectedContact) {
      const updated = await updateMutation.mutateAsync({ id: selectedContact.id, data });
      setSelectedContact(updated);
      setEditOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      await deleteMutation.mutateAsync(id);
      if (selectedContact?.id === id) {
        setSelectedContact(null);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete the ${selectedIds.length} selected contacts?`)) {
      await Promise.all(selectedIds.map((id) => deleteMutation.mutateAsync(id)));
      setSelectedIds([]);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (
      confirm(
        `Are you sure you want to update the status of ${selectedIds.length} contacts to "${status}"?`
      )
    ) {
      await Promise.all(
        selectedIds.map((id) => updateMutation.mutateAsync({ id, data: { status } }))
      );
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
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Contacts</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Manage personal leads, communication history, and company bindings.
            </p>
          </div>
        </div>

        <EntityToolbar
          search={search}
          onSearchChange={setSearch}
          filterStatus={statusFilter}
          onStatusChange={setStatusFilter}
          statusOptions={Object.values(ContactStatus)}
          createLabel="Add Contact"
          onCreateTrigger={() => setCreateOpen(true)}
          selectedCount={selectedIds.length}
          onBulkDelete={handleBulkDelete}
          onBulkStatusChange={handleBulkStatusChange}
          bulkStatusOptions={Object.values(ContactStatus)}
          onBulkEnroll={() => setEnrollOpen(true)}
        >
          <select
            value={sourcePlatformFilter}
            onChange={(e) => setSourcePlatformFilter(e.target.value)}
            className="bg-card border border-border-subtle rounded px-2.5 py-1.5 text-xs outline-none text-foreground focus:ring-1 focus:ring-accent/20 min-w-[110px] h-9"
          >
            <option value="">All Sources</option>
            <option value="google_maps">Google Maps</option>
            <option value="linkedin">LinkedIn</option>
            <option value="crawler">Web Crawler</option>
            <option value="manual">Manual</option>
          </select>
        </EntityToolbar>

        {contactsQuery.isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Loading contacts...
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center p-6 bg-card border border-border-subtle border-dashed rounded-xl">
            <div className="max-w-md w-full flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">No contacts found</h3>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Try adding a new contact or adjusting filters.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)} size="sm">
                + Add Contact
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
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Job Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filtered.map((item: any) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isPanelSelected = selectedContact?.id === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedContact(item)}
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
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {item.firstName} {item.lastName || ''}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {companies.find((c: any) => c.id === item.companyId)?.name || (
                          <span className="opacity-40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.email || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.phone || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.title || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold ${
                            item.status === 'REPLIED'
                              ? 'bg-green-500/10 text-green-600 border-green-500/20'
                              : item.status === 'CONTACTED'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : item.status === 'BOUNCED'
                                  ? 'bg-red-500/10 text-red-600 border-red-500/20'
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
                            setSelectedContact(item);
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
      {selectedContact && (
        <aside className="w-80 bg-card border border-border-subtle rounded-xl p-4 space-y-5 flex flex-col h-full shadow-sm animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center text-accent">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-xs leading-none">
                  {selectedContact.firstName} {selectedContact.lastName || ''}
                </h3>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {selectedContact.title || 'Lead Profile'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedContact(null)}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Overview / Metadata */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Overview
              </h4>
              <div className="bg-sunken/20 border border-border-subtle rounded-lg p-2.5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground truncate">{selectedContact.email || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground">{selectedContact.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground">
                    {companies.find((c: any) => c.id === selectedContact.companyId)?.name ||
                      'No associated company'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Linkedin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground truncate">
                    {selectedContact.linkedin || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pipeline Stage */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Contact Stage
              </h4>
              <div className="flex flex-wrap gap-1 bg-sunken/20 border border-border-subtle rounded-lg p-2">
                {Object.values(ContactStatus).map((status) => {
                  const isActive = selectedContact.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={async () => {
                        const updated = await updateMutation.mutateAsync({
                          id: selectedContact.id,
                          data: { status }
                        });
                        setSelectedContact(updated);
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

            {/* Tags System */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Tags
              </h4>
              <TagSystem
                tags={selectedContact.tags || []}
                onChange={async (newTags) => {
                  const updated = await updateMutation.mutateAsync({
                    id: selectedContact.id,
                    data: { tags: newTags }
                  });
                  setSelectedContact(updated);
                }}
              />
            </div>

            {/* Notes System */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Notes
              </h4>
              <NotesSystem
                notesJson={selectedContact.notes}
                onUpdate={async (json) => {
                  const updated = await updateMutation.mutateAsync({
                    id: selectedContact.id,
                    data: { notes: json }
                  });
                  setSelectedContact(updated);
                }}
              />
            </div>
          </div>
        </aside>
      )}

      {/* ── Create / Edit Dialogs ────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            companies={companies}
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact Details</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <ContactForm
              initialValues={selectedContact}
              companies={companies}
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
            <DialogTitle>Enroll Leads in Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-[11px] text-muted-foreground">
              You are enrolling {selectedIds.length} contact(s) into an outreach campaign.
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
                  enrollMutation.mutate({ campaignId: enrollCampaignId, contactIds: selectedIds });
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
