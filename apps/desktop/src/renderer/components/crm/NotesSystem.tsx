import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FileText, Trash2, Calendar, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export interface NoteItem {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
}

interface NotesSystemProps {
  notesJson: string | null | undefined;
  onUpdate: (notesJson: string) => void;
  readOnly?: boolean;
}

/**
 * NotesSystem handles displaying and modifying structured markdown notes attached to CRM entities.
 */
export function NotesSystem({ notesJson, onUpdate, readOnly = false }: NotesSystemProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');

  // Decode JSON notes array or fallback to empty array
  let notes: NoteItem[] = [];
  try {
    if (notesJson) {
      const parsed = JSON.parse(notesJson);
      if (Array.isArray(parsed)) {
        notes = parsed;
      }
    }
  } catch {
    // If it was raw string text from old migrations, construct a single note
    if (notesJson) {
      notes = [
        {
          id: 'legacy',
          content: notesJson,
          authorName: 'System',
          createdAt: new Date().toISOString()
        }
      ];
    }
  }

  const handleAddNote = () => {
    if (!content.trim()) return;

    const newNote: NoteItem = {
      id: crypto.randomUUID(),
      content: content.trim(),
      authorName: user?.displayName || user?.name || user?.email || 'User',
      createdAt: new Date().toISOString()
    };

    const updated = [newNote, ...notes];
    onUpdate(JSON.stringify(updated));
    setContent('');
  };

  const handleRemoveNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    onUpdate(JSON.stringify(updated));
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            placeholder="Type a new note..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            className="text-xs h-8"
          />
          <Button onClick={handleAddNote} size="sm" className="h-8 text-xs font-semibold">
            Add
          </Button>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-surface-3/10 border border-dashed border-border-subtle rounded-md">
          <FileText className="w-6 h-6 text-muted-foreground opacity-60 mb-2" />
          <p className="text-[10px] text-muted-foreground">No notes added yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-3 bg-card border border-border-subtle rounded-lg space-y-1.5 relative group hover:shadow-sm transition-shadow"
            >
              <p className="text-xs text-foreground leading-normal whitespace-pre-wrap">
                {note.content}
              </p>

              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-2.5 h-2.5" />
                  {note.authorName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />
                  {new Date(note.createdAt).toLocaleString()}
                </span>
              </div>

              {!readOnly && (
                <button
                  onClick={() => handleRemoveNote(note.id)}
                  className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-danger-text rounded hover:bg-danger-bg opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete note"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
