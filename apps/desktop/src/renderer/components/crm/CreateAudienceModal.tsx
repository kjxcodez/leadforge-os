import React, { useState, useEffect } from 'react';
import { X, Users, Filter, Check, UserMinus } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'dynamic' | 'static'>(initialMode);
  const [selectedContacts, setSelectedContacts] = useState<PreloadedContact[]>(initialSelectedContacts);
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setMode(initialSelectedContacts.length > 0 ? 'static' : initialMode);
      setSelectedContacts(initialSelectedContacts);
      setFilters(initialFilters);
      setError(null);
    }
  }, [isOpen, initialMode, initialSelectedContacts, initialFilters]);

  if (!isOpen) return null;

  const handleRemoveContact = (id: string) => {
    setSelectedContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Audience name is required');
      return;
    }
    if (!activeWorkspace?.id) {
      setError('Active workspace is required');
      return;
    }

    if (mode === 'static' && selectedContacts.length === 0) {
      setError('At least one contact must be selected for a Static Audience');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        workspaceId: activeWorkspace.id,
        name: name.trim(),
        description: description.trim() || null,
        entityType: 'contacts',
        mode,
        filterDefinition: mode === 'dynamic' ? filters : {},
        staticMemberIds: mode === 'static' ? selectedContacts.map((c) => c.id) : []
      };

      const result = await (window as any).electronAPI.invoke('audiences:create', payload);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create audience');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Create Audience</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Audience Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Healthcare Prospects"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Description <span className="text-slate-500">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Target recipient segment rationale..."
              rows={2}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Audience Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('dynamic')}
                className={`flex items-center justify-center space-x-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  mode === 'dynamic'
                    ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Dynamic Filter</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('static')}
                className={`flex items-center justify-center space-x-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  mode === 'static'
                    ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Static Selection</span>
              </button>
            </div>
          </div>

          {mode === 'dynamic' ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Filter className="w-3.5 h-3.5" />
                <span>Saved Dynamic Filter Recipe</span>
              </div>
              <p className="text-xs text-slate-400">
                Membership evaluates dynamically against CRM data. Matching new contacts automatically qualify.
              </p>
              {Object.keys(filters).length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(filters).map(([k, v]) =>
                    v ? (
                      <span
                        key={k}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        <span className="capitalize text-slate-500 mr-1">{k}:</span> {String(v)}
                      </span>
                    ) : null
                  )}
                </div>
              ) : (
                <p className="text-xs italic text-slate-500">All current CRM contacts qualify (no active filters).</p>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Selected Contact Members ({selectedContacts.length})</span>
                </div>
              </div>

              {selectedContacts.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {selectedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/80 text-slate-200"
                    >
                      <div className="truncate pr-2">
                        <span className="font-medium text-slate-100">
                          {contact.firstName || contact.lastName
                            ? `${contact.firstName || ''} ${contact.lastName || ''}`
                            : contact.email || contact.id}
                        </span>
                        {contact.email && (
                          <span className="text-slate-400 ml-1.5">({contact.email})</span>
                        )}
                        {contact.title && (
                          <span className="text-slate-500 block text-[11px] truncate">
                            {contact.title} {contact.companyName ? `• ${contact.companyName}` : ''}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(contact.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
                        title="Remove member"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-rose-400">
                  No contacts selected. Select contacts in CRM or switch to Dynamic Audience.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (mode === 'static' && selectedContacts.length === 0)}
              className="flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Audience</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
