import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, Filter, Plus, Trash2, Tag, Archive } from 'lucide-react';

interface EntityToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  filterStatus?: string;
  onStatusChange?: (val: string) => void;
  statusOptions?: string[];
  createLabel: string;
  onCreateTrigger: () => void;
  selectedCount?: number;
  onBulkDelete?: () => void;
  onBulkArchive?: () => void;
  onBulkAddTag?: () => void;
  onBulkStatusChange?: (status: string) => void;
  bulkStatusOptions?: string[];
  onBulkEnroll?: () => void;
}

/**
 * EntityToolbar renders a unified debounced search, filtering, and bulk actions toolbar.
 */
export function EntityToolbar({
  search,
  onSearchChange,
  filterStatus,
  onStatusChange,
  statusOptions = [],
  createLabel,
  onCreateTrigger,
  selectedCount = 0,
  onBulkDelete,
  onBulkArchive,
  onBulkAddTag,
  onBulkStatusChange,
  bulkStatusOptions = [],
  onBulkEnroll,
  onBulkSaveAudience,
  children
}: EntityToolbarProps & { onBulkSaveAudience?: () => void; children?: React.ReactNode }) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => clearTimeout(handler);
  }, [localSearch, onSearchChange]);

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-lg">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-60" />
            <Input
              placeholder="Search by keyword..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-8 text-xs h-9 bg-card border-border-subtle"
            />
          </div>

          {onStatusChange && statusOptions.length > 0 && (
            <select
              value={filterStatus || ''}
              onChange={(e) => onStatusChange(e.target.value)}
              className="bg-card border border-border-subtle rounded px-2.5 py-1.5 text-xs outline-none text-foreground focus:ring-1 focus:ring-accent/20 min-w-[110px] h-9"
            >
              <option value="">All Statuses</option>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {children}
        </div>

        <Button onClick={onCreateTrigger} size="sm" className="h-9 text-xs font-semibold gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          {createLabel}
        </Button>
      </div>

      {/* Bulk actions banner */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-2 bg-accent/5 border border-accent/15 rounded-lg text-xs animate-in slide-in-from-top-1 duration-150">
          <span className="font-semibold text-foreground">{selectedCount} items selected</span>

          <div className="flex items-center gap-2">
            {onBulkStatusChange && bulkStatusOptions.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkStatusChange(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-card border border-border-subtle rounded px-2 py-1 text-[10px] outline-none text-foreground focus:ring-1 focus:ring-accent/20 h-7"
              >
                <option value="">Update Status...</option>
                {bulkStatusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {onBulkSaveAudience && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkSaveAudience}
                className="h-7 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Plus className="w-3 h-3" />
                Save as Audience
              </Button>
            )}

            {onBulkEnroll && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkEnroll}
                className="h-7 text-[10px] gap-1 border-border-subtle text-foreground hover:bg-accent/10"
              >
                <Plus className="w-3 h-3" />
                Enroll in Campaign
              </Button>
            )}

            {onBulkAddTag && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkAddTag}
                className="h-7 text-[10px] gap-1 border-border-subtle text-foreground hover:bg-accent/10"
              >
                <Tag className="w-3 h-3 text-accent" />
                Add Tag
              </Button>
            )}

            {onBulkArchive && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkArchive}
                className="h-7 text-[10px] gap-1 border-border-subtle text-foreground hover:bg-warning-bg hover:text-warning-text"
              >
                <Archive className="w-3 h-3 text-warning-text" />
                Archive
              </Button>
            )}

            {onBulkDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkDelete}
                className="h-7 text-[10px] gap-1 border-border-subtle text-danger-text hover:bg-danger-bg hover:text-danger-text"
              >
                <Trash2 className="w-3 h-3 text-danger-text" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
