import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Folder,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  Search,
  ChevronRight,
  HardDrive,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface DriveSelectedFile {
  fileId: string;
  filename: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  connectionId: string;
}

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: DriveSelectedFile) => void;
  allowedMimeTypes?: string[];
  title?: string;
}

interface FolderBreadcrumb {
  id: string;
  name: string;
}

export const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  allowedMimeTypes,
  title = 'Select Google Drive File'
}) => {
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([{ id: 'root', name: 'My Drive' }]);
  const [items, setItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Google Connections on modal open
  useEffect(() => {
    if (!isOpen) {
      setSelectedItem(null);
      setSearchQuery('');
      setBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
      return;
    }

    let isMounted = true;
    const loadConnections = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const conns = await (window as any).ipc.invoke('drive:connections:list');
        if (isMounted) {
          setConnections(conns || []);
          if (conns && conns.length > 0) {
            const authorized = conns.find((c: any) => c.driveStatus === 'authorized') || conns[0];
            setSelectedConnectionId(authorized.id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load Google connections.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadConnections();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Fetch files when connection, current folder, or search changes
  const fetchFiles = useCallback(async () => {
    if (!selectedConnectionId || !isOpen) return;

    try {
      setIsLoading(true);
      setError(null);
      setSelectedItem(null);

      const currentFolder = breadcrumbs[breadcrumbs.length - 1];
      const payload: any = {
        connectionId: selectedConnectionId
      };

      if (searchQuery.trim()) {
        payload.search = searchQuery.trim();
      } else if (currentFolder && currentFolder.id !== 'root') {
        payload.folderId = currentFolder.id;
      }

      const result = await (window as any).ipc.invoke('drive:files:list', payload);
      setItems(result?.files || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load Drive contents.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedConnectionId, breadcrumbs, searchQuery, isOpen]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  if (!isOpen) return null;

  const currentConnection = connections.find((c) => c.id === selectedConnectionId);
  const isDriveAuthorized = currentConnection?.driveStatus === 'authorized' || currentConnection?.grantedScopes?.some((s: string) => s.includes('drive'));

  const handleFolderClick = (folder: any) => {
    setSearchQuery('');
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setSearchQuery('');
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleItemSelect = (item: any) => {
    if (item.isFolder) {
      handleFolderClick(item);
    } else {
      setSelectedItem(item);
    }
  };

  const handleConfirmSelection = () => {
    if (!selectedItem || selectedItem.isFolder) return;
    onSelectFile({
      fileId: selectedItem.id,
      filename: selectedItem.name,
      mimeType: selectedItem.mimeType,
      size: selectedItem.size,
      webViewLink: selectedItem.webViewLink,
      connectionId: selectedConnectionId
    });
    onClose();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, isFolder: boolean) => {
    if (isFolder) return <Folder className="w-5 h-5 text-amber-400" />;
    if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('document')) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    if (mimeType.includes('sheet') || mimeType.includes('csv') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    }
    if (mimeType.includes('image')) {
      return <FileImage className="w-5 h-5 text-purple-400" />;
    }
    return <File className="w-5 h-5 text-zinc-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
              <p className="text-xs text-zinc-400">Browse and select documents from connected Google Drive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Account Selector + Search */}
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row gap-3 bg-zinc-950/40">
          {/* Account Selector */}
          <div className="flex-1 sm:max-w-xs">
            {connections.length > 0 ? (
              <select
                value={selectedConnectionId}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email} {c.driveStatus === 'authorized' ? '(Drive Authorized)' : '(Requires Reauth)'}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-amber-400 py-2">No Google accounts connected.</div>
            )}
          </div>

          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files in Google Drive..."
              className="pl-9 bg-zinc-900 border-zinc-700 text-sm h-9"
            />
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFiles}
            disabled={isLoading || !selectedConnectionId}
            className="h-9 px-3 border-zinc-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Breadcrumb Navigation */}
        {!searchQuery && (
          <div className="px-6 py-2.5 bg-zinc-950/20 border-b border-zinc-800/80 flex items-center gap-1.5 text-xs text-zinc-400 overflow-x-auto">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />}
                <button
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={`hover:text-blue-400 font-medium transition-colors ${
                    idx === breadcrumbs.length - 1 ? 'text-zinc-200' : 'text-zinc-400'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Body / File List */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Fetching Google Drive items...</p>
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
              <h3 className="text-base font-medium text-zinc-200">No Google Account Connected</h3>
              <p className="text-xs text-zinc-400 max-w-sm mt-1">
                Please connect a Google account in Settings to browse and attach Google Drive files.
              </p>
            </div>
          ) : !isDriveAuthorized ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
              <h3 className="text-base font-medium text-zinc-200">Google Drive Permission Required</h3>
              <p className="text-xs text-zinc-400 max-w-sm mt-1">
                The account <span className="text-zinc-200 font-mono">{currentConnection?.email}</span> has not granted Google Drive access scopes.
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
              <h3 className="text-base font-medium text-zinc-200">Failed to Load Drive Files</h3>
              <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-4">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchFiles} className="border-zinc-700">
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-zinc-400">
              <Folder className="w-12 h-12 text-zinc-700 mb-2" />
              <p className="text-sm font-medium">No files found</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {searchQuery ? `No files matching "${searchQuery}"` : 'This folder is empty'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {items.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemSelect(item)}
                    onDoubleClick={() => {
                      if (item.isFolder) handleFolderClick(item);
                      else {
                        setSelectedItem(item);
                        onSelectFile({
                          fileId: item.id,
                          filename: item.name,
                          mimeType: item.mimeType,
                          size: item.size,
                          webViewLink: item.webViewLink,
                          connectionId: selectedConnectionId
                        });
                        onClose();
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                      isSelected
                        ? 'bg-blue-600/20 border border-blue-500/40 text-blue-100'
                        : 'hover:bg-zinc-800/60 border border-transparent text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {getFileIcon(item.mimeType, item.isFolder)}
                      <span className="truncate font-medium">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-zinc-500 flex-shrink-0">
                      {!item.isFolder && <span>{formatFileSize(item.size)}</span>}
                      {item.modifiedTime && (
                        <span>{new Date(item.modifiedTime).toLocaleDateString()}</span>
                      )}
                      {item.webViewLink && (
                        <a
                          href={item.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-blue-400 text-zinc-500 p-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/40">
          <div className="text-xs text-zinc-400 truncate max-w-sm">
            {selectedItem ? (
              <span className="flex items-center gap-1.5 text-zinc-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="truncate">Selected: {selectedItem.name}</span>
              </span>
            ) : (
              'Select a file to attach'
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-zinc-700">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedItem || selectedItem.isFolder}
              onClick={handleConfirmSelection}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              Select File
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
