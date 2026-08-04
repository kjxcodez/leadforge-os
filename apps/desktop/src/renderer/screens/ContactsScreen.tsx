import React, { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { motion } from 'framer-motion';
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
import { Users, X, Mail, Phone, Briefcase, Linkedin } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { ContactStatus } from '@leadforge/schema';
import { PageHeader } from '../components/common/PageHeader';

/**
 * ContactsScreen handles contact directory listing, side profile drawer,
 * and CRUD actions.
 *
 * Design updates:
 *   - Squared corners: all buttons, dialog contents, panels, badges, select boxes have rounded-none.
 *   - Correct Palette: uses semantic design tokens (primary, info, success, warning, danger).
 *   - Pagination: client-side pagination with controls and info readout.
 */
export default function ContactsScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourcePlatformFilter, setSourcePlatformFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  }, []);

  const handleSourcePlatformFilterChange = useCallback((val: string) => {
    setSourcePlatformFilter(val);
    setCurrentPage(1);
  }, []);

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

  // Pagination calculation
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const adjustedPage = Math.min(Math.max(1, currentPage), totalPages || 1);
  const startIndex = (adjustedPage - 1) * itemsPerPage;
  const paginatedContacts = filtered.slice(startIndex, startIndex + itemsPerPage);

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
    if (selectedIds.length === paginatedContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedContacts.map((c: any) => c.id));
    }
  };

  return (
    <div className="flex h-full gap-4 text-xs font-sans">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <PageHeader
          title="Contacts"
          description="Manage personal leads, communication history, and company bindings."
        />

        <EntityToolbar
          search={search}
          onSearchChange={handleSearchChange}
          filterStatus={statusFilter}
          onStatusChange={handleStatusFilterChange}
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
            onChange={(e) => handleSourcePlatformFilterChange(e.target.value)}
            className="bg-card border border-border-subtle rounded-none px-2.5 py-1.5 text-xs outline-none text-foreground focus:ring-1 focus:ring-ring min-w-[110px] h-9"
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
          <div className="h-[280px] flex items-center justify-center p-6 bg-card border border-border-subtle border-dashed rounded-none">
            <div className="max-w-md w-full flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-none bg-primary/10 flex items-center justify-center text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">No contacts found</h3>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Try adding a new contact or adjusting filters.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)} size="sm" className="rounded-none">
                + Add Contact
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-between">
            <div className="bg-card border border-border-subtle overflow-hidden shadow-sm rounded-none">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-3 border-b border-border-subtle text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === paginatedContacts.length && paginatedContacts.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded-none border-border-subtle text-primary focus:ring-ring"
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
                <motion.tbody
                  className="divide-y divide-border-subtle/50"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                >
                  {paginatedContacts.map((item: any) => {
                    const isSelected = selectedIds.includes(item.id);
                    const isPanelSelected = selectedContact?.id === item.id;

                    return (
                      <motion.tr
                        key={item.id}
                        variants={{
                          hidden: { opacity: 0, y: 8 },
                          visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } }
                        }}
                        onClick={() => setSelectedContact(item)}
                        className={`hover:bg-surface-3/45 cursor-pointer transition-colors ${
                          isPanelSelected ? 'bg-primary/12' : ''
                        }`}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded-none border-border-subtle text-primary focus:ring-ring"
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
                        <td className="px-4 py-3 font-mono text-primary">{item.email || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">{item.phone || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.title || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-bold rounded-none ${
                              item.status === 'REPLIED'
                                ? 'bg-success-muted text-success border-success/20'
                                : item.status === 'CONTACTED'
                                ? 'bg-info-muted text-info border-info/20'
                                : item.status === 'BOUNCED'
                                ? 'bg-danger-muted text-danger border-danger/20'
                                : 'bg-muted-muted text-muted-foreground border-border-subtle'
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
                            className="h-7 text-[10px] rounded-none hover:bg-surface-3"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="h-7 text-[10px] text-danger hover:bg-danger-muted hover:text-danger rounded-none"
                          >
                            Delete
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-4 select-none">
                <span className="text-[11px] text-muted-foreground">
                  Showing{' '}
                  <strong className="text-foreground font-mono">{startIndex + 1}</strong>{' '}
                  to{' '}
                  <strong className="text-foreground font-mono">
                    {Math.min(startIndex + itemsPerPage, totalItems)}
                  </strong>{' '}
                  of <strong className="text-foreground font-mono">{totalItems}</strong> contacts
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentPage((p) => Math.max(1, p - 1));
                    }}
                    disabled={adjustedPage === 1}
                    className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Previous
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      return p === 1 || p === totalPages || Math.abs(p - adjustedPage) <= 1;
                    })
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && p - prev > 1;

                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && (
                            <span className="px-2 text-muted-foreground font-mono text-xs select-none">
                              ...
                            </span>
                          )}
                          <Button
                            type="button"
                            variant={p === adjustedPage ? 'default' : 'secondary'}
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCurrentPage(p);
                            }}
                            className={[
                              'h-8 w-8 rounded-none text-[11px] font-semibold transition-colors cursor-pointer',
                              p === adjustedPage
                                ? 'bg-primary text-primary-foreground border-primary font-bold'
                                : 'hover:bg-surface-3'
                            ].join(' ')}
                          >
                            {p}
                          </Button>
                        </React.Fragment>
                      );
                    })}

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                    }}
                    disabled={adjustedPage === totalPages}
                    className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Slide-over Side Panel (Details) ───────────────────────────────── */}
      {selectedContact && (
        <aside className="w-80 bg-card border border-border-subtle rounded-none p-4 space-y-5 flex flex-col h-full shadow-sm animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-none bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
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
              className="h-6 w-6 p-0 rounded-none hover:bg-surface-3"
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
              <div className="bg-surface-3 border border-border-subtle rounded-none p-2.5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  {selectedContact.email ? (
                    <a
                      href={`mailto:${selectedContact.email}`}
                      className="text-primary truncate hover:underline font-mono"
                    >
                      {selectedContact.email}
                    </a>
                  ) : (
                    <span className="opacity-40 font-mono">—</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground font-mono">{selectedContact.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground truncate">
                    {companies.find((c: any) => c.id === selectedContact.companyId)?.name ||
                      'No associated company'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Linkedin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground truncate font-mono">
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
              <div className="flex flex-wrap gap-1 bg-surface-3 border border-border-subtle rounded-none p-2">
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
                      className={`px-2 py-1 rounded-none text-[10px] font-semibold border transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border-subtle hover:bg-surface-3'
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
        <DialogContent className="max-w-md rounded-none bg-background border border-border-subtle shadow-elevation-2">
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
        <DialogContent className="max-w-md rounded-none bg-background border border-border-subtle shadow-elevation-2">
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
        <DialogContent className="max-w-md rounded-none bg-background border border-border-subtle shadow-elevation-2">
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
                className="w-full h-8 px-2 bg-background border border-border-subtle rounded-none text-xs focus-visible:outline-none"
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
              <Button type="button" variant="secondary" className="rounded-none" onClick={() => setEnrollOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-none"
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
