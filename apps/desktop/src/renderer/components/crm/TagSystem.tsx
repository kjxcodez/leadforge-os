import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import { Button } from '../ui/button';

interface TagSystemProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  readOnly?: boolean;
}

const PRESET_TAGS = ['High Value', 'Tier 1', 'Warm Lead', 'Tech Industry', 'Follow Up', 'Blocked'];

/**
 * TagSystem renders tag badges and allows picking/removing tags on an entity.
 */
export function TagSystem({ tags, onChange, readOnly = false }: TagSystemProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = (tag: string) => {
    if (!tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setIsOpen(false);
  };

  const handleRemove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleCustomAdd = () => {
    const custom = prompt('Enter custom tag name:');
    if (custom?.trim()) {
      handleAdd(custom.trim());
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-[26px]">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="text-[10px] py-0.5 px-2 flex items-center gap-1 bg-accent/10 text-accent border border-accent/20 font-medium"
        >
          <TagIcon className="w-2.5 h-2.5 opacity-60" />
          {tag}
          {!readOnly && (
            <button
              onClick={() => handleRemove(tag)}
              className="hover:bg-accent/20 rounded p-0.5"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </Badge>
      ))}

      {!readOnly && (
        <div className="relative">
          {isOpen ? (
            <div className="absolute left-0 top-full mt-1 bg-card border border-border-subtle rounded-md shadow-lg p-2 z-50 w-44 space-y-1.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                Preset Tags
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {PRESET_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleAdd(tag)}
                    className="w-full text-left text-xs px-1.5 py-1 rounded hover:bg-accent/10 hover:text-accent transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCustomAdd}
                className="w-full text-left text-xs px-1.5 py-1 rounded border border-dashed border-border-subtle hover:bg-surface-3 flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium"
              >
                <Plus className="w-3 h-3" />
                Add Custom...
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="h-6 text-[10px] px-2 py-0 border-dashed border-border-subtle text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-2.5 h-2.5 mr-1" />
              Add Tag
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
