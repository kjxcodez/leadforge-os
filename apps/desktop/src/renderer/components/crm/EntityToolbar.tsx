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
  onBulkCreateAudience?: () => void;
  activeFilters?: Array<{ label: string; value: string; onRemove: () => void }>;
  onClearAllFilters?: () => void;
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
  onBulkCreateAudience,
  activeFilters = [],
  onClearAllFilters,
  children
}: EntityToolbarProps & { onBulkSaveAudience?: () => void; children?: React.ReactNode }) {
  const [localSearch, setLocalSearch] = useState(search);

  // Synchronize local search if external search changes
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => clearTimeout(handler);
  }, [localSearch, onSearchChange]);

  const handleCreateAudience = onBulkCreateAudience || onBulkSaveAudience;

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
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

        <Button onClick={onCreateTrigger} size="sm" className="h-9 text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white">
          <Plus className="w-3.5 h-3.5" />
          {createLabel}
        </Button>
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Active Filters:
          </span>
          {activeFilters.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
            >
              <span>{chip.label}:</span>
              <span className="font-semibold text-indigo-200">{chip.value}</span>
              <button
                onClick={chip.onRemove}
                className="ml-1 hover:text-rose-400 text-indigo-400/80 transition-colors"
                title="Remove filter"
              >
                ×
              </button>
            </span>
          ))}
          {onClearAllFilters && (
            <button
              onClick={onClearAllFilters}
              className="text-xs text-slate-400 hover:text-slate-200 underline ml-2 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Bulk actions banner */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-2.5 bg-indigo-950/40 border border-indigo-500/20 rounded-lg text-xs animate-in slide-in-from-top-1 duration-150">
          <span className="font-semibold text-indigo-200">{selectedCount} items selected</span>

          <div className="flex items-center gap-2">
            {onBulkStatusChange && bulkStatusOptions.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkStatusChange(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] outline-none text-slate-200 focus:ring-1 focus:ring-indigo-500 h-7"
              >
                <option value="">Update Status...</option>
                {bulkStatusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {handleCreateAudience && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateAudience}
                className="h-7 text-[11px] gap-1 bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                Create Audience
              </Button>
            )}

            {onBulkEnroll && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkEnroll}
                className="h-7 text-[11px] gap-1 border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Enroll in Campaign
              </Button>
            )}

            {onBulkAddTag && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkAddTag}
                className="h-7 text-[11px] gap-1 border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                Add Tag
              </Button>
            )}

            {onBulkArchive && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkArchive}
                className="h-7 text-[11px] gap-1 border-slate-700 text-amber-400 hover:bg-amber-950/30"
              >
                <Archive className="w-3.5 h-3.5 text-amber-400" />
                Archive
              </Button>
            )}

            {onBulkDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkDelete}
                className="h-7 text-[11px] gap-1 border-slate-700 text-rose-400 hover:bg-rose-950/30"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
