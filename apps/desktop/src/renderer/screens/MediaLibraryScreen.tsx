import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive,
  Upload,
  Search,
  Grid,
  List,
  Trash2,
  ExternalLink,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File as FileIcon,
  RefreshCw,
  Plus,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FolderOpen,
  Settings,
  Link2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import { toast } from 'sonner';

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(dateStr);
  }
}

function getFileIcon(mimeType?: string | null, filename?: string) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  if (mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'].includes(ext || '')) {
    return <ImageIcon className="w-5 h-5 text-sky-400" />;
  }
  if (
    mimeType?.includes('sheet') ||
    mimeType?.includes('excel') ||
    mimeType === 'text/csv' ||
    ['xlsx', 'xls', 'csv'].includes(ext || '')
  ) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
  }
  if (
    mimeType === 'application/pdf' ||
    mimeType?.includes('word') ||
    mimeType === 'text/plain' ||
    ['pdf', 'doc', 'docx', 'txt'].includes(ext || '')
  ) {
    return <FileText className="w-5 h-5 text-orange-400" />;
  }
  return <FileIcon className="w-5 h-5 text-muted-foreground" />;
}

export default function MediaLibraryScreen() {
  const navigate = useNavigate();
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [quota, setQuota] = useState<{ limit?: number; usage?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounterRef = React.useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Preview / Details Modal State
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Upload state machine
  const [uploadProgress, setUploadProgress] = useState<
    Array<{
      name: string;
      size: number;
      status: 'queued' | 'validating' | 'uploading' | 'done' | 'error';
      error?: string;
    }>
  >([]);

  const driveConnections = useMemo(() => {
    return connections.filter(
      (c: any) =>
        c.status === 'active' &&
        (c.driveStatus === 'authorized' ||
          (Array.isArray(c.scopes) && c.scopes.some((s: string) => typeof s === 'string' && s.includes('drive'))))
    );
  }, [connections]);

  const isDriveConnected = driveConnections.length > 0;

  const fetchConnections = async () => {
    try {
      if ((window as any).ipc) {
        const list = await (window as any).ipc.invoke('drive:connections:list', undefined);
        const conns = Array.isArray(list) ? list : [];
        setConnections(conns);
        const activeDrive = conns.find(
          (c: any) =>
            c.status === 'active' &&
            (c.driveStatus === 'authorized' ||
              (Array.isArray(c.scopes) && c.scopes.some((s: string) => typeof s === 'string' && s.includes('drive'))))
        );
        if (activeDrive) {
          setSelectedConnectionId(activeDrive.id || activeDrive._id);
        } else {
          setSelectedConnectionId('');
        }
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const pollTransaction = (transactionId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await (window as any).ipc.invoke('drive:status', { transactionId });
        if (status.status === 'completed') {
          clearInterval(interval);
          setConnectingDrive(false);
          toast.success('Google Drive successfully connected!');
          await fetchConnections();
        } else if (status.status === 'failed') {
          clearInterval(interval);
          setConnectingDrive(false);
          toast.error(`Google Drive connection failed: ${status.error || 'Authorization rejected'}`);
        }
      } catch {
        // continue polling
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(interval);
      setConnectingDrive(false);
    }, 180000);
  };

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    try {
      if ((window as any).ipc) {
        const res = await (window as any).ipc.invoke('drive:connect', undefined);
        if (res.transactionId) {
          toast.info('Google authorization opened in Chrome. Please approve Drive permissions...');
          pollTransaction(res.transactionId);
        }
      }
    } catch (err: any) {
      toast.error(`Could not start Google Drive connection: ${err.message || err}`);
      setConnectingDrive(false);
    }
  };

  const fetchQuota = async (connectionId: string) => {
    if (!connectionId || !(window as any).ipc) {
      setQuota(null);
      return;
    }
    try {
      const res = await (window as any).ipc.invoke('drive:about', { connectionId });
      if (res?.storageQuota && (res.storageQuota.limit || res.storageQuota.usage)) {
        setQuota({
          limit: res.storageQuota.limit,
          usage: res.storageQuota.usage
        });
      } else {
        setQuota(null);
      }
    } catch {
      setQuota(null);
    }
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      if ((window as any).ipc) {
        const res = await (window as any).ipc.invoke('media:list', {
          search: search.trim() || undefined,
          category: category !== 'all' ? category : undefined,
          connectionId: selectedConnectionId || undefined
        });
        setMediaList(Array.isArray(res) ? res : []);
      }
    } catch (err) {
      console.error('Failed to fetch media:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (selectedConnectionId) {
      fetchQuota(selectedConnectionId);
    } else {
      setQuota(null);
    }
    fetchMedia();
  }, [selectedConnectionId, search, category]);

  /**
   * Single unified upload handler used by both file picker and drag-and-drop.
   */
  const uploadMedia = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    if (!isDriveConnected) {
      toast.error('Google Drive is not connected. Please connect Google Drive in Settings first.');
      return;
    }

    const initialStatus = fileList.map((f) => ({
      name: f.name,
      size: f.size,
      status: 'validating' as const
    }));
    setUploadProgress(initialStatus);

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (!f) continue;

      if (f.size > 25 * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds the 25 MB Google Drive limit.`);
        setUploadProgress((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: 'error', error: 'Exceeds 25 MB limit' } : u))
        );
        continue;
      }

      setUploadProgress((prev) =>
        prev.map((u, idx) => (idx === i ? { ...u, status: 'uploading' } : u))
      );

      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const res = (reader.result as string).split(',')[1] || '';
            resolve(res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        const base64 = await base64Promise;

        await (window as any).ipc.invoke('media:upload', {
          filename: f.name,
          mimeType: f.type || 'application/octet-stream',
          contentBase64: base64,
          googleConnectionId: selectedConnectionId || undefined
        });

        setUploadProgress((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: 'done' } : u))
        );
        toast.success(`Uploaded "${f.name}" to Google Drive`);
      } catch (err: any) {
        console.error('Upload failed:', err);
        const errorMsg = err.message || 'Google Drive upload failed';
        setUploadProgress((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: 'error', error: errorMsg } : u))
        );
        toast.error(`Failed to upload "${f.name}": ${errorMsg}`);
      }
    }

    fetchMedia();
    if (selectedConnectionId) fetchQuota(selectedConnectionId);
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    setDeleting(true);
    try {
      if ((window as any).ipc) {
        await (window as any).ipc.invoke('media:delete', { id: deleteCandidate.id });
        toast.success(`Deleted "${deleteCandidate.filename}"`);
        setMediaList((prev) => prev.filter((m) => m.id !== deleteCandidate.id));
        if (selectedFile?.id === deleteCandidate.id) {
          setSelectedFile(null);
        }
        setDeleteCandidate(null);
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success('Drive URL copied to clipboard');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadMedia(e.dataTransfer.files);
    }
  };

  // Sorted and filtered media
  const sortedMedia = useMemo(() => {
    const list = [...mediaList];
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
    } else if (sortBy === 'size') {
      list.sort((a, b) => (b.size || 0) - (a.size || 0));
    }
    return list;
  }, [mediaList, sortBy]);

  return (
    <div
      className="relative flex-1 flex flex-col h-full bg-background overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input for Native File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            uploadMedia(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-background/85 backdrop-blur-sm border-2 border-dashed border-primary flex flex-col items-center justify-center pointer-events-none p-6 text-center animate-in fade-in duration-150">
          <div className="p-4 bg-primary/10 text-primary rounded-full mb-3 shadow-lg">
            <Upload className="w-10 h-10 animate-bounce" />
          </div>
          <h3 className="text-base font-bold text-foreground">Drop files here to upload to Google Drive</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Files up to 25 MB will be uploaded directly to your Google Drive and saved to your Media Library.
          </p>
        </div>
      )}

      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-border-subtle bg-surface-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 text-primary border border-primary/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">
                Media & Google Drive Explorer
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage cloud assets, browse uploaded files, and attach media directly to outreach campaigns.
              </p>
            </div>
          </div>
        </div>

        {/* Right side controls: Connection switcher, Quota, Upload button */}
        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-end">
          {isDriveConnected && driveConnections.length > 0 ? (
            <>
              <div className="flex items-center gap-2 bg-surface-3 border border-border-subtle px-2.5 py-1 text-xs">
                <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <select
                  value={selectedConnectionId}
                  onChange={(e) => setSelectedConnectionId(e.target.value)}
                  className="bg-transparent border-none text-xs text-foreground outline-none font-mono cursor-pointer"
                >
                  {driveConnections.map((c: any) => (
                    <option key={c.id || c._id} value={c.id || c._id} className="bg-surface-3">
                      {c.email || c.googleAccountId || 'Google Drive'}
                    </option>
                  ))}
                </select>
                {quota?.limit ? (
                  <span className="text-[10px] text-muted-foreground font-mono pl-1 border-l border-border-subtle">
                    {formatBytes(quota.usage || 0)} / {formatBytes(quota.limit)}
                  </span>
                ) : null}
              </div>

              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-none text-xs font-semibold gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Media</span>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleConnectDrive}
                disabled={connectingDrive}
                className="gap-1.5 rounded-none h-8 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {connectingDrive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                <span>{connectingDrive ? 'Connecting...' : 'Connect Google Drive'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings')}
                className="rounded-none h-8 text-[11px] font-semibold gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Sub-header: Filters & Search ──────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-3/30 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Tabs */}
          <div className="flex items-center bg-surface-3 p-0.5 border border-border-subtle">
            {['all', 'document', 'image', 'spreadsheet'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`text-xs px-2.5 py-1 font-medium capitalize transition-colors ${
                  category === cat
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat === 'all' ? 'All Files' : `${cat}s`}
              </button>
            ))}
          </div>

          <div className="relative w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-surface-3 border-border-subtle rounded-none font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-surface-3 border border-border-subtle px-2 py-1 text-xs text-foreground outline-none font-mono"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="size">Size (Largest)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border-subtle bg-surface-3 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1 ${viewMode === 'grid' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1 ${viewMode === 'list' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchMedia}
            disabled={loading}
            className="h-8 px-2 rounded-none"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Main Content Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Upload Progress Banner */}
        {uploadProgress.length > 0 && (
          <div className="border border-border-subtle bg-surface-2 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                Google Drive Upload Progress
              </span>
              <button
                type="button"
                onClick={() => setUploadProgress([])}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {uploadProgress.map((u, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-surface-3 border border-border-subtle text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    {getFileIcon(undefined, u.name)}
                    <span className="truncate max-w-[220px] font-mono">{u.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">{formatBytes(u.size)}</span>
                    {u.status === 'validating' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    {u.status === 'uploading' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />}
                    {u.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {u.status === 'error' && (
                      <span className="text-[10px] text-danger flex items-center gap-1" title={u.error}>
                        <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />
                        <span className="truncate max-w-[120px]">{u.error || 'Failed'}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Not Connected State */}
        {!loading && !isDriveConnected && (
          <div className="border border-border-subtle bg-card p-10 text-center flex flex-col items-center justify-center max-w-xl mx-auto my-8 shadow-sm">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
              <Cloud className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Google Drive Integration Required</h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
              To upload media assets, browse cloud files, and attach PDFs or decks to outreach campaigns, please connect your Google Drive account.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button
                size="sm"
                onClick={handleConnectDrive}
                disabled={connectingDrive}
                className="rounded-none text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {connectingDrive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                <span>{connectingDrive ? 'Connecting...' : 'Connect Google Drive'}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings')}
                className="rounded-none text-xs font-semibold gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Integration Settings</span>
              </Button>
            </div>
          </div>
        )}

        {/* Empty State (Connected but 0 files) */}
        {!loading && isDriveConnected && sortedMedia.length === 0 && (
          <div className="border-2 border-dashed border-border-subtle p-12 text-center flex flex-col items-center justify-center bg-surface-3/20">
            <HardDrive className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No media files in workspace</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Upload files to Google Drive or drag and drop files anywhere on this page to make them available for campaign outreach.
            </p>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-none text-xs font-semibold gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload First File</span>
            </Button>
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && sortedMedia.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sortedMedia.map((item) => (
              <div
                key={item.id}
                className="group relative bg-card border border-border-subtle hover:border-foreground/30 transition-all flex flex-col justify-between p-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2 bg-surface-3 border border-border-subtle shrink-0">
                      {getFileIcon(item.mimeType, item.filename)}
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-none text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedFile(item)}
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {item.driveUrl && (
                        <a
                          href={item.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                          title="Open in Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-none text-muted-foreground hover:text-danger"
                        onClick={() => setDeleteCandidate(item)}
                        title="Delete File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p
                      className="text-xs font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                      title={item.filename}
                      onClick={() => setSelectedFile(item)}
                    >
                      {item.filename}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mt-1">
                      <span>{formatBytes(item.size)}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-border-subtle text-emerald-400">
                        Google Drive
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                  <span>{formatDate(item.createdAt)}</span>
                  {item.driveUrl && (
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(item.driveUrl)}
                      className="hover:text-primary flex items-center gap-0.5"
                      title="Copy Drive URL"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy Link</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && sortedMedia.length > 0 && (
          <div className="border border-border-subtle bg-card overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-3/50 text-[11px] font-mono text-muted-foreground">
                  <th className="p-2.5 font-semibold">File Name</th>
                  <th className="p-2.5 font-semibold">Type</th>
                  <th className="p-2.5 font-semibold">Size</th>
                  <th className="p-2.5 font-semibold">Created Date</th>
                  <th className="p-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedMedia.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-3/40 transition-colors">
                    <td className="p-2.5 font-medium text-foreground flex items-center gap-2">
                      <span className="p-1 bg-surface-3 border border-border-subtle shrink-0">
                        {getFileIcon(item.mimeType, item.filename)}
                      </span>
                      <span
                        className="truncate max-w-[280px] cursor-pointer hover:text-primary"
                        title={item.filename}
                        onClick={() => setSelectedFile(item)}
                      >
                        {item.filename}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-muted-foreground text-[11px]">
                      {item.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
                    </td>
                    <td className="p-2.5 font-mono text-muted-foreground text-[11px]">
                      {formatBytes(item.size)}
                    </td>
                    <td className="p-2.5 font-mono text-muted-foreground text-[11px]">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="p-2.5 text-right space-x-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-none text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedFile(item)}
                        title="Preview & Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {item.driveUrl && (
                        <a
                          href={item.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-primary transition-colors"
                          title="Open in Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-none text-muted-foreground hover:text-danger"
                        onClick={() => setDeleteCandidate(item)}
                        title="Delete File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Details & Preview Modal ───────────────────────────────────────────── */}
      {selectedFile && (
        <Dialog open={Boolean(selectedFile)} onOpenChange={(open) => !open && setSelectedFile(null)}>
          <DialogContent className="sm:max-w-[540px] bg-background border-border-subtle rounded-none p-0 overflow-hidden">
            <DialogHeader className="p-4 border-b border-border-subtle bg-surface-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 text-primary border border-primary/20">
                  {getFileIcon(selectedFile.mimeType, selectedFile.filename)}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-sm font-bold text-foreground truncate" title={selectedFile.filename}>
                    {selectedFile.filename}
                  </DialogTitle>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {formatBytes(selectedFile.size)} • {selectedFile.mimeType}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 space-y-3">
              {/* Metadata list */}
              <div className="border border-border-subtle divide-y divide-border-subtle bg-surface-3/30 text-xs font-mono">
                <div className="flex justify-between p-2">
                  <span className="text-muted-foreground">Drive File ID</span>
                  <span className="text-foreground truncate max-w-[280px] select-all">
                    {selectedFile.fileId || selectedFile.id}
                  </span>
                </div>
                <div className="flex justify-between p-2">
                  <span className="text-muted-foreground">Storage Provider</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                    Google Drive v3
                  </Badge>
                </div>
                <div className="flex justify-between p-2">
                  <span className="text-muted-foreground">Uploaded At</span>
                  <span className="text-foreground">{formatDate(selectedFile.createdAt)}</span>
                </div>
                {selectedFile.driveUrl && (
                  <div className="flex justify-between items-center p-2">
                    <span className="text-muted-foreground">Google Drive Link</span>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(selectedFile.driveUrl)}
                      className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="p-3 bg-surface-3 border-t border-border-subtle flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="rounded-none text-xs"
              >
                Close
              </Button>
              <div className="flex items-center gap-2">
                {selectedFile.driveUrl && (
                  <a
                    href={selectedFile.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Google Drive</span>
                  </a>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirmation Dialog ────────────────────────────────────────── */}
      {deleteCandidate && (
        <Dialog open={Boolean(deleteCandidate)} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
          <DialogContent className="sm:max-w-[420px] bg-background border-border-subtle rounded-none p-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">
                Delete Media File
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-2">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteCandidate.filename}"</span>? This will remove the file from your Media Library and Google Drive storage.
            </p>
            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteCandidate(null)}
                disabled={deleting}
                className="rounded-none text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-none text-xs font-semibold gap-1"
              >
                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete File</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
