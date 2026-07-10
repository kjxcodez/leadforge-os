import React, { useState } from 'react';
import { SyncCompanyRepository } from '../repositories/sync';
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
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Building2, X, Globe, MapPin, Briefcase } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { CompanyStatus } from '@leadforge/schema';

/**
 * CompaniesScreen presents a list of target organizations, a details panel,
 * and handles workspace CRUD.
 */
export default function CompaniesScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);

  // Dialog controls
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // TanStack Entity Query hooks
  const companiesQuery = useEntityList(SyncCompanyRepository);
  const createMutation = useCreateEntity(SyncCompanyRepository);
  const updateMutation = useUpdateEntity(SyncCompanyRepository);
  const deleteMutation = useDeleteEntity(SyncCompanyRepository);

  const companies = companiesQuery.data || [];

  // Filter & Search logic
  const filtered = companies.filter((c: any) => {
    const nameStr = c.name || '';
    const domainStr = c.domain || '';
    const matchesSearch = nameStr.toLowerCase().includes(search.toLowerCase()) || 
                          domainStr.toLowerCase().includes(search.toLowerCase());
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

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Overview / Metadata */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Overview</h4>
              <div className="bg-sunken/20 border border-border-subtle rounded-lg p-2.5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Globe className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground truncate">{selectedCompany.domain || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground">{selectedCompany.industry || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="text-foreground">{selectedCompany.location || 'N/A'}</span>
                </div>
              </div>
            </div>

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
    </div>
  );
}
