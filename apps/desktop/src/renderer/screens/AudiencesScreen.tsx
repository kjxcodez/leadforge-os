import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Trash2,
  Send,
  Users,
  Building2,
  Calendar,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 }
  }
};

export default function AudiencesScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState<any | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');

  const audiencesQuery = useQuery({
    queryKey: ['audiences', 'list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return window.ipc.invoke('audiences:list', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 3000
  });

  const createAudienceMutation = useMutation({
    mutationFn: async (payload: any) => {
      return window.ipc.invoke('audiences:create', { ...payload, workspaceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiences', 'list', workspaceId] });
      setCreateOpen(false);
      setName('');
      setDescription('');
      setSearchTerm('');
      setStatusFilter('');
      setIndustryFilter('');
    }
  });

  const deleteAudienceMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('audiences:delete', { workspaceId, id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiences', 'list', workspaceId] });
      if (selectedAudience) setSelectedAudience(null);
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter an Audience Name.');
      return;
    }

    const filterDefinition: any = {};
    if (searchTerm.trim()) filterDefinition.search = searchTerm.trim();
    if (statusFilter.trim()) filterDefinition.status = statusFilter.trim();
    if (industryFilter.trim()) filterDefinition.industry = industryFilter.trim();

    createAudienceMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      entityType: 'contacts',
      filterDefinition
    });
  };

  const handleCreateOutreach = (audience: any) => {
    if (audience.contactCount === 0) {
      toast.warning(`Audience "${audience.name}" currently has 0 contacts. Setup outreach now or discover more leads.`);
    } else {
      toast.info(`Preparing outreach campaign for audience "${audience.name}" (${audience.contactCount} contacts).`);
    }
    navigate(`/campaigns?audienceId=${audience.id}`);
  };

  const audiences = (audiencesQuery.data || []) as any[];

  return (
    <div className="flex flex-col gap-5 text-xs font-sans h-full overflow-y-auto pr-1 select-none">
      <PageHeader
        title="Audiences"
        description="Reusable, dynamic segment definitions over your CRM records."
        actions={
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="h-8 font-semibold gap-1.5 shrink-0 rounded-none"
          >
            <Plus className="w-3.5 h-3.5" />
            New Audience
          </Button>
        }
      />

      {/* Stats Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        <motion.div
          variants={cardVariants}
          className="bg-card border border-border-subtle rounded-none p-3 flex items-start gap-2.5 shadow-sm"
        >
          <div className="mt-0.5 text-primary">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground leading-tight font-mono">
              {audiences.length}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium">Saved Audiences</div>
          </div>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="bg-card border border-border-subtle rounded-none p-3 flex items-start gap-2.5 shadow-sm"
        >
          <div className="mt-0.5 text-info">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground leading-tight font-mono">
              {audiences.reduce((acc, a) => acc + (a.contactCount || 0), 0)}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium">Total Audience Members</div>
          </div>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="bg-card border border-border-subtle rounded-none p-3 flex items-start gap-2.5 shadow-sm"
        >
          <div className="mt-0.5 text-success">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground leading-tight font-mono">Dynamic</div>
            <div className="text-[10px] text-muted-foreground font-medium">Auto-Resolving Recipes</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Audiences List */}
      <div className="bg-card border border-border-subtle rounded-none shadow-sm flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-xs flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Saved Segment Recipes ({audiences.length})
          </h3>
        </div>

        {audiencesQuery.isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-xs">Loading audiences...</div>
        ) : audiences.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Layers className="w-8 h-8 stroke-1 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No audiences saved yet</p>
            <p className="text-[11px] max-w-sm">
              Create audiences by filtering companies or contacts in CRM, or click "New Audience" to build one manually.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="mt-2 rounded-none gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Build First Audience
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {audiences.map((audience) => {
              let filterDef = audience.filterDefinition;
              if (typeof filterDef === 'string') {
                try { filterDef = JSON.parse(filterDef); } catch { filterDef = {}; }
              }

              return (
                <div
                  key={audience.id}
                  className="bg-background border border-border-subtle rounded-none p-3.5 flex flex-col justify-between gap-3 hover:border-primary/50 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-foreground text-sm leading-snug">{audience.name}</h4>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono rounded-none border-primary/30 text-primary">
                        {audience.contactCount || 0} Contacts
                      </Badge>
                    </div>

                    {audience.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{audience.description}</p>
                    )}

                    <div className="pt-2 flex flex-wrap gap-1">
                      {filterDef.search && (
                        <span className="bg-surface-3 border border-border-subtle text-[10px] px-1.5 py-0.5 rounded-none font-mono">
                          Search: "{filterDef.search}"
                        </span>
                      )}
                      {filterDef.status && (
                        <span className="bg-surface-3 border border-border-subtle text-[10px] px-1.5 py-0.5 rounded-none font-mono">
                          Status: {filterDef.status}
                        </span>
                      )}
                      {filterDef.industry && (
                        <span className="bg-surface-3 border border-border-subtle text-[10px] px-1.5 py-0.5 rounded-none font-mono">
                          Industry: {filterDef.industry}
                        </span>
                      )}
                      {filterDef.discoveryRunId && (
                        <span className="bg-primary/10 border border-primary/30 text-primary text-[10px] px-1.5 py-0.5 rounded-none font-mono">
                          Linked Discovery Run
                        </span>
                      )}
                      {Object.keys(filterDef).length === 0 && (
                        <span className="text-[10px] text-muted-foreground italic">All CRM Records</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                    <button
                      onClick={() => deleteAudienceMutation.mutate(audience.id)}
                      className="text-muted-foreground hover:text-danger p-1 transition-colors"
                      title="Delete audience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCreateOutreach(audience)}
                      className="h-7 text-[11px] font-semibold gap-1.5 rounded-none"
                    >
                      <Send className="w-3 h-3" />
                      Create Outreach
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-none bg-background border border-border-subtle shadow-elevation-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <Layers className="w-4 h-4 text-primary" />
              Create Audience Segment Recipe
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs font-semibold">
                Audience Name <span className="text-danger">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Miami HVAC Leads"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-none bg-card border-border-subtle text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="desc" className="text-xs font-semibold">
                Description <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                id="desc"
                placeholder="High priority qualified leads in Florida"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-none bg-card border-border-subtle text-xs"
              />
            </div>

            <div className="space-y-2 border-t border-border-subtle pt-3">
              <Label className="text-xs font-bold text-foreground">Filter Recipe Conditions</Label>
              
              <div className="space-y-1">
                <Label htmlFor="search" className="text-[11px]">Keyword Search</Label>
                <Input
                  id="search"
                  placeholder="e.g. HVAC, Plumbing"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-none bg-card border-border-subtle text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="status" className="text-[11px]">Status</Label>
                  <Input
                    id="status"
                    placeholder="e.g. LEAD, QUALIFIED"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-none bg-card border-border-subtle text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="industry" className="text-[11px]">Industry</Label>
                  <Input
                    id="industry"
                    placeholder="e.g. Construction"
                    value={industryFilter}
                    onChange={(e) => setIndustryFilter(e.target.value)}
                    className="rounded-none bg-card border-border-subtle text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-3 border border-border-subtle p-2.5 text-[10px] text-muted-foreground rounded-none">
              Audiences save the <strong>filter rules</strong>, not static record snapshots. As new matching companies/contacts arrive via Discovery, they automatically qualify.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
                size="sm"
                className="rounded-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createAudienceMutation.isPending}
                size="sm"
                className="gap-1.5 rounded-none"
              >
                <Layers className="w-3.5 h-3.5" />
                {createAudienceMutation.isPending ? 'Saving...' : 'Save Audience'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
