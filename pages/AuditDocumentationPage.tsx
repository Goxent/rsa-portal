import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FolderArchive, FolderOpen, FolderPlus, ChevronRight,
    Trash2, Download, Eye, FileText, BookOpen, Shield,
    FileOutput, Wifi, Lock, RefreshCw, X, Save, Building2,
    CalendarDays, ServerCrash, Loader2, Edit2, Home,
    File, Image, FileSpreadsheet, Monitor, MoreVertical,
    CloudUpload, FolderX, FilePlus2, ArrowLeft, LayoutGrid,
    List, CheckCircle2, Info, ChevronDown,
    ClipboardCheck, CheckCircle, Clock, AlertTriangle, ShieldCheck, Search, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import {
    AuditDocService,
    AuditDocFile,
    AuditDocFolder,
    formatBytes,
    getMimeLabel,
} from '../services/auditDocs';
import { GoogleDriveService } from '../services/googleDrive';
import {
    Client,
    UserRole,
    UserProfile,
    AUDIT_FOLDER_STRUCTURE,
    AuditFolderKey,
    Task,
} from '../types';
import { toast } from 'react-hot-toast';
import { useOfficeWifiCheck } from '../hooks/useOfficeWifiCheck';

// ─── Constants ────────────────────────────────────────────────────────────────

const NEPALI_FISCAL_YEARS = [
    '2082-83', '2081-82', '2080-81', '2079-80', '2078-79', '2077-78',
];

const FOLDER_ICONS: Record<AuditFolderKey, React.ElementType> = {
    A: FileText,
    B: BookOpen,
    C: Shield,
    D: FolderOpen,
    E: FileOutput,
};

// ─── Navigation types ─────────────────────────────────────────────────────────

type NavLevel =
    | { kind: 'root' }
    | { kind: 'main-folder'; folderKey: AuditFolderKey }
    | { kind: 'line-item'; folderKey: 'B'; lineItem: string; lineItemLabel: string }
    | { kind: 'custom-folder'; folderKey: AuditFolderKey; lineItem?: string; folderId: string; folderName: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMimeIcon(mimeType: string): React.ElementType {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType === 'application/pdf') return FileText;
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return FileSpreadsheet;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Monitor;
    return File;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface UploadQueueItem {
    id: string;
    fileName: string;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
}

const StatusPanel: React.FC<{ items: UploadQueueItem[]; onClear: () => void }> = ({ items, onClear }) => {
    if (items.length === 0) return null;
    const completedCount = items.filter(i => i.status === 'completed').length;
    const errorCount = items.filter(i => i.status === 'error').length;
    const totalCount = items.length;
    const isFinished = (completedCount + errorCount) === totalCount;

    return (
        <div className="fixed bottom-6 right-6 z-[60] w-80 rounded-2xl shadow-2xl overflow-hidden border animate-in slide-in-from-bottom-5"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', backdropFilter: 'blur(12px)' }}>
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                    {isFinished ? <CheckCircle size={16} className="text-emerald-500" /> : <Loader2 size={16} className="animate-spin text-brand-500" />}
                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-heading)' }}>
                        {isFinished ? 'Uploads Complete' : 'Uploading Session'}
                    </h4>
                </div>
                {isFinished && (
                    <button onClick={onClear} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X size={14} style={{ color: 'var(--text-muted)' }} />
                    </button>
                )}
            </div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
                        <div className="shrink-0">
                            {item.status === 'completed' && <CheckCircle2 size={14} className="text-emerald-500" />}
                            {item.status === 'error' && <AlertTriangle size={14} className="text-rose-500" />}
                            {(item.status === 'uploading' || item.status === 'pending') && <Loader2 size={14} className="animate-spin text-brand-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-heading)' }}>{item.fileName}</p>
                            {item.error && <p className="text-[9px] text-rose-500 truncate mt-0.5">{item.error}</p>}
                        </div>
                    </div>
                ))}
            </div>
            <div className="px-4 py-2 text-[10px] font-bold text-center border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {completedCount} of {totalCount} succeeded {errorCount > 0 && `· ${errorCount} failed`}
            </div>
        </div>
    );
};

// ─── WiFi Gate ────────────────────────────────────────────────────────────────

const WifiGate: React.FC<{ retry: () => void }> = ({ retry }) => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
            style={{ background: 'linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.05))', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Lock size={40} style={{ color: '#f87171' }} />
        </div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-heading)' }}>Office Network Access Only</h2>
        <p className="text-sm max-w-md leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
            Audit Documentation is restricted to the RSA office network. Connect to office WiFi or VPN and retry.
        </p>
        <p className="text-xs mb-8 font-mono px-3 py-1 rounded-full"
            style={{ color: 'var(--text-muted)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
            \\RSAFILESERVER (local NAS integration coming soon)
        </p>
        <button onClick={retry}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#659a2b,#3f6018)', color: '#fff' }}>
            <RefreshCw size={16} /> Retry Connection
        </button>
    </div>
);

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

interface BreadcrumbProps {
    stack: NavLevel[];
    onNavigate: (index: number) => void;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ stack, onNavigate }) => {
    const getLabel = (level: NavLevel): string => {
        if (level.kind === 'root') return 'Documents';
        if (level.kind === 'main-folder') return AUDIT_FOLDER_STRUCTURE[level.folderKey].label;
        if (level.kind === 'line-item') return level.lineItemLabel;
        return level.folderName;
    };

    return (
        <div className="flex items-center gap-1 flex-wrap min-w-0">
            {stack.map((level, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    <button
                        onClick={() => onNavigate(i)}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors truncate max-w-[160px] ${i === stack.length - 1
                                ? 'cursor-default'
                                : 'hover:bg-white/10'
                            }`}
                        style={{ color: i === stack.length - 1 ? 'var(--text-heading)' : 'var(--text-muted)' }}
                        disabled={i === stack.length - 1}
                    >
                        {i === 0 ? <span className="flex items-center gap-1"><Home size={11} />{getLabel(level)}</span> : getLabel(level)}
                    </button>
                </React.Fragment>
            ))}
        </div>
    );
};

// ─── Folder Card (for root + B line-item views) ───────────────────────────────

interface FolderCardProps {
    label: string;
    sublabel?: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    fileCount?: number;
    folderCount?: number;
    onClick: () => void;
}

const FolderCard: React.FC<FolderCardProps> = ({
    label, sublabel, icon: Icon, color, bgColor, borderColor,
    fileCount = 0, folderCount = 0, onClick
}) => (
    <button
        onClick={onClick}
        className="group w-full text-left rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
        style={{ background: 'var(--bg-elevated)', border: `1px solid ${borderColor}` }}
    >
        <div className="flex items-start gap-3">
            <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-200"
                style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                <Icon size={22} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-heading)' }}>{label}</p>
                {sublabel && (
                    <p className="text-[11px] mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {sublabel}
                    </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                    {fileCount > 0 && (
                        <span className="text-[10px] font-semibold" style={{ color }}>
                            {fileCount} file{fileCount !== 1 ? 's' : ''}
                        </span>
                    )}
                    {folderCount > 0 && (
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                            {folderCount} folder{folderCount !== 1 ? 's' : ''}
                        </span>
                    )}
                    {fileCount === 0 && folderCount === 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Empty</span>
                    )}
                </div>
            </div>
            <ChevronRight size={16} className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }} />
        </div>
    </button>
);

// ─── File Row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
    file: AuditDocFile;
    isGrid?: boolean;
    onDelete: () => void;
    onEditNotes: () => void;
}

const FileItem: React.FC<FileRowProps> = ({ file, isGrid, onDelete, onEditNotes }) => {
    const MimeIcon = getMimeIcon(file.mimeType);
    const viewUrl = GoogleDriveService.getFileView(file.appwriteFileId);
    const downloadUrl = GoogleDriveService.getFileDownload(file.appwriteFileId);
    const canPreview = file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf';

    if (isGrid) {
        return (
            <div className="group rounded-2xl p-4 flex flex-col gap-3 transition-all duration-150 hover:-translate-y-0.5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <MimeIcon size={24} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="text-center min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{file.fileName}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatBytes(file.fileSize)}</p>
                </div>
                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canPreview && (
                        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: 'var(--text-muted)' }}><Eye size={13} /></a>
                    )}
                    <a href={downloadUrl} download={file.fileName}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--text-muted)' }}><Download size={13} /></a>
                    <button onClick={onEditNotes}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--text-muted)' }}><Edit2 size={13} /></button>
                    <button onClick={onDelete}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                        style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl group transition-all duration-100"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <MimeIcon size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{file.fileName}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {getMimeLabel(file.mimeType)} · {formatBytes(file.fileSize)}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(file.uploadedAt)} · {file.uploadedByName}
                    </span>
                    {file.notes && (
                        <span className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>"{file.notes}"</span>
                    )}
                </div>
            </div>
            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {canPreview && (
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--text-muted)' }} title="Preview"><Eye size={14} /></a>
                )}
                <a href={downloadUrl} download={file.fileName}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }} title="Download"><Download size={14} /></a>
                <button onClick={onEditNotes} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }} title="Notes"><Edit2 size={14} /></button>
                <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                    style={{ color: 'var(--text-muted)' }} title="Delete"><Trash2 size={14} /></button>
            </div>
        </div>
    );
};

// ─── Sub-Folder Item ──────────────────────────────────────────────────────────

interface SubFolderItemProps {
    folder: AuditDocFolder;
    isGrid?: boolean;
    onClick: () => void;
    onDelete: () => void;
}

const SubFolderItem: React.FC<SubFolderItemProps> = ({ folder, isGrid, onClick, onDelete }) => {
    if (isGrid) {
        return (
            <button
                onClick={onClick}
                className="group rounded-2xl p-4 flex flex-col gap-3 text-center transition-all duration-150 hover:-translate-y-0.5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                    style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)' }}>
                    <FolderOpen size={24} style={{ color: 'var(--accent)' }} />
                </div>
                <p className="text-xs font-semibold truncate w-full" style={{ color: 'var(--text-heading)' }}>
                    {folder.name}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(folder.createdAt)}</p>
                <div className="flex-1" />
                <button
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="shrink-0 p-1.5 rounded-lg transition-all hover:bg-rose-500/20 active:scale-90"
                    style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={12} className="group-hover:text-rose-400" />
                </button>
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl group transition-all duration-100 text-left"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
            <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)' }}>
                <FolderOpen size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{folder.name}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Folder · Created {formatDate(folder.createdAt)}
                </p>
            </div>
            <div className="shrink-0 flex items-center gap-1">
                <button
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/20"
                    style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={13} />
                </button>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ color: 'var(--text-muted)' }} />
            </div>
        </button>
    );
};

// ─── Folder Content View ──────────────────────────────────────────────────────
// Shown when inside a main folder (non-B) or a line item or a custom sub-folder

interface FolderContentProps {
    folderKey: AuditFolderKey;
    lineItem?: string;
    lineItemLabel?: string;
    customFolderId?: string;
    clientId: string;
    clientName: string;
    fiscalYear: string;
    userId: string;
    userName: string;
    taskId?: string;
    onEnterSubFolder: (folder: AuditDocFolder) => void;
    isGrid: boolean;
}

const FolderContent: React.FC<FolderContentProps> = ({
    folderKey, lineItem, lineItemLabel, customFolderId,
    clientId, clientName, fiscalYear, userId, userName,
    taskId, onEnterSubFolder, isGrid,
}) => {
    const folder = AUDIT_FOLDER_STRUCTURE[folderKey];
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [files, setFiles] = useState<AuditDocFile[]>([]);
    const [subFolders, setSubFolders] = useState<AuditDocFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);

    // New folder creation
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [savingFolder, setSavingFolder] = useState(false);

    // Notes editing
    const [editNotes, setEditNotes] = useState<{ file: AuditDocFile; notes: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [fetchedFiles, fetchedFolders] = await Promise.all([
                AuditDocService.getFiles(clientId, fiscalYear, folderKey, lineItem, taskId),
                AuditDocService.getFolders(clientId, fiscalYear, folderKey, lineItem, taskId),
            ]);
            // Filter by customFolderId if inside a sub-folder
            setFiles(customFolderId
                ? fetchedFiles.filter(f => f.customFolderId === customFolderId)
                : fetchedFiles.filter(f => !f.customFolderId));
            setSubFolders(customFolderId
                ? []
                : fetchedFolders);
        } catch {
            toast.error('Failed to load folder contents');
        } finally {
            setLoading(false);
        }
    }, [clientId, fiscalYear, folderKey, lineItem, customFolderId, taskId]);

    useEffect(() => { load(); }, [load]);

    const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

    const doUpload = async (selectedFiles: File[]) => {
        const newItems: UploadQueueItem[] = selectedFiles.map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            fileName: f.name,
            status: 'pending'
        }));

        setUploadQueue(prev => [...prev, ...newItems]);
        setUploading(true);

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const queueItem = newItems[i];

            setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'uploading' } : q));

            try {
                await AuditDocService.uploadFile(file, {
                    clientId, clientName, fiscalYear,
                    folderKey,
                    lineItem,
                    lineItemLabel,
                    customFolderId,
                    uploadedBy: userId,
                    uploadedByName: userName,
                    taskId,
                });
                setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'completed' } : q));
            } catch (e: any) {
                setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'error', error: e.message } : q));
                toast.error(`"${file.name}" failed: ${e.message}`);
            }
        }

        await load();
        setUploading(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length) doUpload(droppedFiles);
    };

    const handleDelete = async (file: AuditDocFile) => {
        if (!confirm(`Delete "${file.fileName}"? This cannot be undone.`)) return;
        try {
            await AuditDocService.deleteFile(file.id, file.appwriteFileId);
            setFiles(prev => prev.filter(f => f.id !== file.id));
            toast.success('File deleted');
        } catch (e: any) {
            toast.error(`Delete failed: ${e.message}`);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        setSavingFolder(true);
        try {
            const created = await AuditDocService.createFolder({
                clientId, clientName, fiscalYear,
                folderKey, lineItem,
                name: newFolderName.trim(),
                createdBy: userId,
                createdByName: userName,
            });
            setSubFolders(prev => [...prev, created]);
            setNewFolderName('');
            setShowNewFolder(false);
            toast.success(`"${created.name}" created`);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSavingFolder(false);
        }
    };

    const handleDeleteFolder = async (f: AuditDocFolder) => {
        if (!confirm(`Delete folder "${f.name}"? Files inside are NOT removed.`)) return;
        try {
            await AuditDocService.deleteFolder(f.id);
            setSubFolders(prev => prev.filter(x => x.id !== f.id));
            toast.success('Folder deleted');
        } catch {
            toast.error('Failed to delete folder');
        }
    };

    const handleSaveNotes = async () => {
        if (!editNotes) return;
        try {
            await AuditDocService.updateFileMeta(editNotes.file.id, { notes: editNotes.notes });
            setFiles(prev => prev.map(f => f.id === editNotes.file.id ? { ...f, notes: editNotes.notes } : f));
            setEditNotes(null);
            toast.success('Notes saved');
        } catch {
            toast.error('Failed to save notes');
        }
    };

    const isEmpty = !loading && files.length === 0 && subFolders.length === 0;

    return (
        <div
            className="flex-1 min-h-0 flex flex-col h-full"
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
                outline: dragging ? `2px dashed var(--accent)` : 'none',
                outlineOffset: '-4px',
            }}
        >
            {/* Toolbar */}
            <div className="shrink-0 px-5 py-3 flex items-center gap-3 flex-wrap"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-secondary))', color: '#fff' }}
                >
                    {uploading
                        ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Uploading…</>
                        : <><CloudUpload size={15} /> Upload Files</>
                    }
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={e => { if (e.target.files?.length) doUpload(Array.from(e.target.files)); }} />

                {!customFolderId && (
                    <button
                        onClick={() => { setShowNewFolder(true); setNewFolderName(''); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-body)' }}
                    >
                        <FolderPlus size={15} /> New Folder
                    </button>
                )}

                {dragging && (
                    <span className="text-xs font-semibold animate-pulse" style={{ color: 'var(--accent)' }}>
                        Drop files anywhere to upload
                    </span>
                )}

                <div className="flex-1" />

                {/* Item count */}
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {subFolders.length > 0 && `${subFolders.length} folder${subFolders.length !== 1 ? 's' : ''}`}
                    {subFolders.length > 0 && files.length > 0 && ' · '}
                    {files.length > 0 && `${files.length} file${files.length !== 1 ? 's' : ''}`}
                </span>
            </div>

            {/* New folder inline panel */}
            {showNewFolder && (
                <div className="shrink-0 px-5 py-3"
                    style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3 max-w-sm">
                        <FolderPlus size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                            placeholder="Folder name…"
                            className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-body)' }}
                            autoFocus
                        />
                        <button onClick={handleCreateFolder} disabled={savingFolder || !newFolderName.trim()}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-50"
                            style={{ background: 'var(--accent)', color: '#fff' }}>
                            {savingFolder ? '…' : 'Create'}
                        </button>
                        <button onClick={() => setShowNewFolder(false)}
                            className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    </div>
                ) : isEmpty ? (
                    /* Empty state — drop target */
                    <div
                        className="h-64 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200"
                        style={{
                            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-mid)'}`,
                            background: dragging ? 'var(--accent-dim)' : 'transparent',
                        }}
                    >
                        <CloudUpload size={32} style={{ color: dragging ? 'var(--accent)' : 'var(--text-muted)' }} />
                        <div className="text-center">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                                {dragging ? 'Release to upload' : 'This folder is empty'}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Drag files here, or use "Upload Files" above
                            </p>
                        </div>
                    </div>
                ) : isGrid ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                        {subFolders.map(sf => (
                            <SubFolderItem
                                key={sf.id} folder={sf} isGrid
                                onClick={() => onEnterSubFolder(sf)}
                                onDelete={() => handleDeleteFolder(sf)}
                            />
                        ))}
                        {files.map(f => (
                            <FileItem
                                key={f.id} file={f} isGrid
                                onDelete={() => handleDelete(f)}
                                onEditNotes={() => setEditNotes({ file: f, notes: f.notes || '' })}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {subFolders.length > 0 && (
                            <div className="space-y-1.5 mb-4">
                                {subFolders.map(sf => (
                                    <SubFolderItem
                                        key={sf.id} folder={sf}
                                        onClick={() => onEnterSubFolder(sf)}
                                        onDelete={() => handleDeleteFolder(sf)}
                                    />
                                ))}
                            </div>
                        )}
                        {files.map(f => (
                            <FileItem
                                key={f.id} file={f}
                                onDelete={() => handleDelete(f)}
                                onEditNotes={() => setEditNotes({ file: f, notes: f.notes || '' })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Notes modal */}
            {editNotes && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                        <div className="flex items-center justify-between px-5 py-4"
                            style={{ borderBottom: '1px solid var(--border)' }}>
                            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>File Notes</h3>
                            <button onClick={() => setEditNotes(null)}
                                className="p-1 rounded-lg hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-xs truncate font-mono" style={{ color: 'var(--text-muted)' }}>
                                {editNotes.file.fileName}
                            </p>
                            <textarea rows={3}
                                value={editNotes.notes}
                                onChange={e => setEditNotes({ ...editNotes, notes: e.target.value })}
                                placeholder="Reference, voucher number, document date…"
                                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-body)' }}
                                autoFocus />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditNotes(null)}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold"
                                    style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                    Cancel
                                </button>
                                <button onClick={handleSaveNotes}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                                    style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-secondary))', color: '#fff' }}>
                                    <Save size={12} /> Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <StatusPanel items={uploadQueue} onClear={() => setUploadQueue([])} />
        </div>
    );
};

// ─── Folder E Governance Dashboard ───────────────────────────────────────────

interface FolderEGovernanceProps {
    task: Task | null;
}

const FolderEGovernance: React.FC<FolderEGovernanceProps> = ({ task }) => {
    if (!task) {
        return (
            <div className="shrink-0 mx-5 mt-4 mb-2 rounded-2xl p-5 border border-dashed"
                style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    Select an engagement above to view its Reviewer Sign-Off dashboard.
                </p>
            </div>
        );
    }

    const reviewChecklist = task.reviewChecklist || [];
    const tlItems = reviewChecklist.filter(i => i.reviewerRole === 'TL');
    const erItems = reviewChecklist.filter(i => i.reviewerRole === 'ER');
    const spItems = reviewChecklist.filter(i => i.reviewerRole === 'SP');

    const tlSignedOff  = !!task.teamLeadApprovedAt;
    const erSignedOff  = !!task.engagementReviewerApprovedAt;
    const spSignedOff  = !!task.signingPartnerApprovedAt;

    const layerInfo = [
        {
            role: 'TL',
            label: 'Team Lead Review',
            items: tlItems,
            signedOff: tlSignedOff,
            signedAt: task.teamLeadApprovedAt,
            color: '#3b82f6',
            bg: 'rgba(59,130,246,0.08)',
            border: 'rgba(59,130,246,0.25)',
        },
        {
            role: 'ER',
            label: 'Engagement Reviewer',
            items: erItems,
            signedOff: erSignedOff,
            signedAt: task.engagementReviewerApprovedAt,
            color: '#8b5cf6',
            bg: 'rgba(139,92,246,0.08)',
            border: 'rgba(139,92,246,0.25)',
        },
        {
            role: 'SP',
            label: 'Signing Partner',
            items: spItems,
            signedOff: spSignedOff,
            signedAt: task.signingPartnerApprovedAt,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.08)',
            border: 'rgba(245,158,11,0.25)',
        },
    ];

    const getStatusIcon = (status: string) => {
        if (status === 'OK') return <CheckCircle size={12} style={{ color: '#4ade80' }} />;
        if (status === 'ISSUE') return <AlertTriangle size={12} style={{ color: '#f87171' }} />;
        return <Clock size={12} style={{ color: 'var(--text-muted)' }} />;
    };

    const getPriorityBadge = (priority: string) => {
        const colors: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b' };
        return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: `${colors[priority]}22`, color: colors[priority] }}>{priority}</span>;
    };

    const overallComplete = tlSignedOff && erSignedOff && spSignedOff;

    return (
        <div className="shrink-0 mx-5 mt-4 mb-0 space-y-3">
            {/* Header Banner */}
            <div className="rounded-2xl p-4 flex items-center justify-between"
                style={{ background: overallComplete ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${overallComplete ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.25)'}` }}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: overallComplete ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.12)' }}>
                        <ShieldCheck size={18} style={{ color: overallComplete ? '#4ade80' : '#f87171' }} />
                    </div>
                    <div>
                        <p className="text-xs font-black" style={{ color: 'var(--text-heading)' }}>
                            Audit Governance: {overallComplete ? '✓ All Sign-Offs Complete' : 'Pending Sign-Offs'}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {task.title} · {task.clientName || 'Unknown Client'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {layerInfo.map(l => (
                        <div key={l.role} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black"
                            style={{ background: l.signedOff ? 'rgba(74,222,128,0.12)' : l.bg, border: `1px solid ${l.signedOff ? 'rgba(74,222,128,0.3)' : l.border}`, color: l.signedOff ? '#4ade80' : l.color }}>
                            {l.signedOff ? <CheckCircle size={10} /> : <Clock size={10} />}
                            {l.role}
                        </div>
                    ))}
                </div>
            </div>

            {/* Three-Layer Checklist Tables */}
            {layerInfo.map((layer) => (
                <div key={layer.role} className="rounded-2xl overflow-hidden"
                    style={{ border: `1px solid ${layer.border}`, background: 'var(--bg-elevated)' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between"
                        style={{ background: layer.bg, borderBottom: `1px solid ${layer.border}` }}>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black" style={{ background: layer.color, color: '#fff' }}>{layer.role}</div>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{layer.label}</p>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {layer.items.filter(i => i.status === 'OK').length}/{layer.items.length} OK
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {layer.signedOff ? (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                                    <CheckCircle size={10} /> Signed Off · {layer.signedAt && new Date(layer.signedAt).toLocaleDateString()}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                                    <Clock size={10} /> Awaiting Sign-Off
                                </div>
                            )}
                        </div>
                    </div>

                    {layer.items.length === 0 ? (
                        <div className="py-4 text-center">
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No checklist items for this layer yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead style={{ background: 'var(--bg-surface)' }}>
                                    <tr className="text-left">
                                        <th className="px-3 py-2 font-bold text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '50%' }}>Checklist Item</th>
                                        <th className="px-3 py-2 font-bold text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Priority</th>
                                        <th className="px-3 py-2 font-bold text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
                                        <th className="px-3 py-2 font-bold text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Verified By</th>
                                        <th className="px-3 py-2 font-bold text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {layer.items.map((item, idx) => (
                                        <tr key={item.id}
                                            style={{ borderTop: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                            <td className="px-3 py-2.5" style={{ color: 'var(--text-body)' }}>
                                                <p className="font-semibold">{item.title}</p>
                                                {item.minimumRequirement && <p className="text-[10px] mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>{item.minimumRequirement}</p>}
                                            </td>
                                            <td className="px-3 py-2.5">{getPriorityBadge(item.priority)}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1">
                                                    {getStatusIcon(item.status)}
                                                    <span style={{ color: item.status === 'OK' ? '#4ade80' : item.status === 'ISSUE' ? '#f87171' : 'var(--text-muted)' }}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>
                                                {item.completedByName ? (
                                                    <span>{item.completedByName}</span>
                                                ) : <span className="italic text-[10px]">Pending</span>}
                                            </td>
                                            <td className="px-3 py-2.5 max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                                                <p className="truncate">{item.comment || item.notes || '—'}</p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ─── Root View (5 folder cards) ───────────────────────────────────────────────

interface RootViewProps {
    clientId: string;
    fiscalYear: string;
    fileCounts: Record<string, number>;
    folderCounts: Record<string, number>;
    onEnter: (key: AuditFolderKey) => void;
    isGrid: boolean;
}

const RootView: React.FC<RootViewProps> = ({ fileCounts, folderCounts, onEnter, isGrid }) => (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        {isGrid ? (
            // Grid view — all 5 folders in a balanced row
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(Object.keys(AUDIT_FOLDER_STRUCTURE) as AuditFolderKey[]).map(key => {
                    const f = AUDIT_FOLDER_STRUCTURE[key];
                    const Icon = FOLDER_ICONS[key];
                    return (
                        <FolderCard
                            key={key}
                            label={f.label.replace(/^[A-E]\. /, '')}
                            sublabel={f.description}
                            icon={Icon}
                            color={f.color}
                            bgColor={f.bgColor}
                            borderColor={f.borderColor}
                            fileCount={fileCounts[key] || 0}
                            folderCount={folderCounts[key] || 0}
                            onClick={() => onEnter(key)}
                        />
                    );
                })}
            </div>
        ) : (
            // List view — horizontal rows like a file manager
            <div className="space-y-1.5 max-w-3xl">
                {(Object.keys(AUDIT_FOLDER_STRUCTURE) as AuditFolderKey[]).map(key => {
                    const f = AUDIT_FOLDER_STRUCTURE[key];
                    const Icon = FOLDER_ICONS[key];
                    const fc = fileCounts[key] || 0;
                    const foc = folderCounts[key] || 0;
                    return (
                        <button
                            key={key}
                            onClick={() => onEnter(key)}
                            className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all duration-150 hover:bg-white/4"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        >
                            <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: f.bgColor, border: `1px solid ${f.borderColor}` }}>
                                <Icon size={18} style={{ color: f.color }} />
                            </div>
                            <div className="shrink-0 w-6 text-xs font-black" style={{ color: f.color }}>{key}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{f.label}</p>
                                <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.description}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                                {fc > 0 && <span style={{ color: f.color }}>{fc} file{fc !== 1 ? 's' : ''}</span>}
                                {foc > 0 && <span>{foc} folder{foc !== 1 ? 's' : ''}</span>}
                                {fc === 0 && foc === 0 && <span>Empty</span>}
                            </div>
                            <ChevronRight size={15} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                                style={{ color: 'var(--text-muted)' }} />
                        </button>
                    );
                })}
            </div>
        )}
    </div>
);

// ─── B Folder Line-Items Grid ─────────────────────────────────────────────────

interface BFolderViewProps {
    fileCounts: Record<string, number>;
    onEnter: (lineItem: string, label: string) => void;
    isGrid: boolean;

    clientId: string;
    clientName: string;
    fiscalYear: string;
    userId: string;
    userName: string;
    taskId?: string;
    onEnterSubFolder: (folder: AuditDocFolder) => void;
}

const BFolderView: React.FC<BFolderViewProps> = ({
    fileCounts, onEnter, isGrid,
    clientId, clientName, fiscalYear, userId, userName, taskId, onEnterSubFolder
}) => {
    const folder = AUDIT_FOLDER_STRUCTURE['B'];

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Standard Line Items */}
            <div className="shrink-0 px-5 pt-5 pb-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                    Standard Audit Sections (B.1 - B.15)
                </h3>
            </div>
            <div className="shrink-0 overflow-y-auto custom-scrollbar px-5 py-2 max-h-[350px]">
                {isGrid ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {(folder.lineItems || []).map((li, idx) => {
                            const lineCode = `B.${idx + 1}`;
                            const count = fileCounts[`B-${lineCode}`] || 0;
                            return (
                                <button
                                    key={lineCode}
                                    onClick={() => onEnter(lineCode, li)}
                                    className="group text-left rounded-xl p-4 flex flex-col gap-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
                                    style={{ background: 'var(--bg-elevated)', border: `1px solid ${folder.borderColor}` }}
                                >
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ background: folder.bgColor, border: `1px solid ${folder.borderColor}` }}>
                                        <span className="text-xs font-black" style={{ color: folder.color }}>{lineCode}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-heading)' }}>
                                            {li.replace(/^B\.\d+\. /, '')}
                                        </p>
                                        <p className="text-[10px] mt-1" style={{ color: count > 0 ? folder.color : 'var(--text-muted)' }}>
                                            {count > 0 ? `${count} file${count !== 1 ? 's' : ''}` : 'Empty'}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-1 max-w-2xl">
                        {(folder.lineItems || []).map((li, idx) => {
                            const lineCode = `B.${idx + 1}`;
                            const count = fileCounts[`B-${lineCode}`] || 0;
                            return (
                                <button
                                    key={lineCode}
                                    onClick={() => onEnter(lineCode, li)}
                                    className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-100"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                                >
                                    <div className="shrink-0 w-12 text-xs font-black text-center py-1 rounded-lg"
                                        style={{ background: folder.bgColor, color: folder.color, border: `1px solid ${folder.borderColor}` }}>
                                        {lineCode}
                                    </div>
                                    <span className="flex-1 text-sm" style={{ color: 'var(--text-heading)' }}>
                                        {li.replace(/^B\.\d+\. /, '')}
                                    </span>
                                    <span className="shrink-0 text-xs" style={{ color: count > 0 ? folder.color : 'var(--text-muted)' }}>
                                        {count > 0 ? `${count} file${count !== 1 ? 's' : ''}` : 'Empty'}
                                    </span>
                                    <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                                        style={{ color: 'var(--text-muted)' }} />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="shrink-0 px-5 pt-6 pb-1">
                <div className="h-px w-full" style={{ background: 'var(--border)' }} />
            </div>

            {/* General Documents (Folder B Root) */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="shrink-0 px-5 pt-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                        General Sub-folders & Root Documents
                    </h3>
                </div>
                <FolderContent
                    folderKey="B"
                    clientId={clientId}
                    clientName={clientName}
                    fiscalYear={fiscalYear}
                    userId={userId}
                    userName={userName}
                    taskId={taskId}
                    onEnterSubFolder={onEnterSubFolder}
                    isGrid={isGrid}
                />
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AuditDocumentationPage: React.FC = () => {
    const { user } = useAuth();
    const { status: wifiStatus, retry: retryWifi } = useOfficeWifiCheck();

    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedFY, setSelectedFY] = useState(NEPALI_FISCAL_YEARS[0]);
    const [clientTasks, setClientTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string>('ALL');

    // Navigation stack — each step is a NavLevel
    const [navStack, setNavStack] = useState<NavLevel[]>([{ kind: 'root' }]);

    // View mode — list by default (more file-manager-like)
    const [isGrid, setIsGrid] = useState(false);

    // Aggregate counts for root view and B-folder view
    const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
    const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});

    const currentLevel = navStack[navStack.length - 1];

    // Staff Permissions & Search (HMR Force Refresh 1.1)
    const [filterText, setFilterText] = useState('');
    const [staffFilter, setStaffFilter] = useState('');
    const [globalClientFilter, setGlobalClientFilter] = useState('');
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [isGlobalAccessModalOpen, setIsGlobalAccessModalOpen] = useState(false);
    const [globalSelectedStaffId, setGlobalSelectedStaffId] = useState<string | null>(null);
    const [allStaff, setAllStaff] = useState<UserProfile[]>([]);
    
    const isReadOnly = user?.role === UserRole.STAFF;

    // Load clients
    useEffect(() => {
        (async () => {
            try {
                const list = await AuthService.getAllClients();
                let filtered = list.filter(c => c.status === 'Active');
                
                // If STAFF, filter by permittedStaff
                if (user?.role === UserRole.STAFF) {
                    filtered = filtered.filter(c => c.permittedStaff?.includes(user.uid));
                }
                
                setClients(filtered);
                // We no longer auto-select the first client here. 
                // The landing grid logic will handle selection via handleClientSelect.
            } catch {
                toast.error('Failed to load clients');
            } finally {
                setLoadingClients(false);
            }
        })();
    }, [user?.uid, user?.role]);

    // Reload aggregate counts when client/FY changes
    useEffect(() => {
        if (!selectedClientId) return;
        // Reset task selection on client/FY change
        setSelectedTaskId('ALL');
        setNavStack([{ kind: 'root' }]);
        
        // Fetch tasks for this client/FY for Engagement Selector
        setLoadingTasks(true);
        AuthService.getAllTasks().then(allTasks => {
            const matching = allTasks.filter(t =>
                (t.clientIds?.includes(selectedClientId) || t.clientId === selectedClientId) &&
                (!t.fiscalYear || t.fiscalYear === selectedFY)
            );
            setClientTasks(matching);
        }).catch(() => { /* silent */ }).finally(() => setLoadingTasks(false));

        (async () => {
            try {
                const [allFiles, allFolders] = await Promise.all([
                    AuditDocService.getAllFiles(selectedClientId, selectedFY, selectedTaskId !== 'ALL' ? selectedTaskId : undefined),
                    // We'll count sub-folders per main folder
                    Promise.all(
                        (['A', 'B', 'C', 'D', 'E'] as AuditFolderKey[]).map(k =>
                            AuditDocService.getFolders(selectedClientId, selectedFY, k)
                        )
                    ),
                ]);
                const fc: Record<string, number> = {};
                allFiles.forEach(f => {
                    // Count per main folder
                    fc[f.folderKey] = (fc[f.folderKey] || 0) + 1;
                    // Count per line item (for B)
                    if (f.lineItem) {
                        const k = `${f.folderKey}-${f.lineItem}`;
                        fc[k] = (fc[k] || 0) + 1;
                    }
                });
                setFileCounts(fc);

                const folderKeys: AuditFolderKey[] = ['A', 'B', 'C', 'D', 'E'];
                const foc: Record<string, number> = {};
                allFolders.forEach((folders, i) => {
                    foc[folderKeys[i]] = folders.length;
                });
                setFolderCounts(foc);
            } catch {
                // silently skip
            }
        })();
    }, [selectedClientId, selectedFY, selectedTaskId]);

    const navigate = (index: number) => {
        setNavStack(prev => prev.slice(0, index + 1));
    };

    const enterMainFolder = (key: AuditFolderKey) => {
        setNavStack(prev => [...prev, { kind: 'main-folder', folderKey: key }]);
    };

    const enterLineItem = (lineItem: string, lineItemLabel: string) => {
        setNavStack(prev => [...prev, { kind: 'line-item', folderKey: 'B', lineItem, lineItemLabel }]);
    };

    const enterSubFolder = (sf: AuditDocFolder) => {
        const parent = currentLevel as ({ kind: 'main-folder'; folderKey: AuditFolderKey } | { kind: 'line-item'; folderKey: 'B'; lineItem: string; lineItemLabel: string });
        setNavStack(prev => [...prev, {
            kind: 'custom-folder',
            folderKey: parent.folderKey,
            lineItem: 'lineItem' in parent ? parent.lineItem : undefined,
            folderId: sf.id,
            folderName: sf.name,
        }]);
    };

    const selectedClient = clients.find(c => c.id === selectedClientId);

    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);
        setFilterText('');
    };

    // ── Guards ─────────────────────────────────────────────────────────────────

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.STAFF)) {
        return (
            <div className="flex items-center justify-center min-h-full">
                <p style={{ color: 'var(--text-muted)' }}>Access restricted.</p>
            </div>
        );
    }

    if (wifiStatus === 'CHECKING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Verifying office network…</p>
            </div>
        );
    }
    if (wifiStatus === 'REMOTE' || wifiStatus === 'ERROR') return <WifiGate retry={retryWifi} />;

    // Staff with no permitted clients
    if (!loadingClients && clients.length === 0 && user?.role === UserRole.STAFF) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
                    style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05))', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <Lock size={40} style={{ color: '#f59e0b' }} />
                </div>
                <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-heading)' }}>No Client Access Assigned</h2>
                <p className="text-sm max-w-md leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
                    You don't have permission to view any client's audit documentation yet.
                </p>
                <p className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Ask your <span className="font-bold" style={{ color: 'var(--text-heading)' }}>Admin</span> to grant you access.
                </p>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    const canGoBack = navStack.length > 1;

    return (
        <div style={{ height: 'calc(100vh - var(--header-height))', display: 'flex', flexDirection: 'column' }}>

            {/* ── Top bar ── */}
            <div className="shrink-0 px-5 py-3 flex flex-wrap items-center gap-3"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>

                {/* Logo + Title */}
                <div className="flex items-center gap-2.5 mr-1">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)' }}>
                        <FolderArchive size={16} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-sm font-bold leading-none" style={{ color: 'var(--text-heading)' }}>Audit Documentation</p>
                        <p className="text-[9px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>R. Sapkota & Associates</p>
                    </div>
                </div>

                <div className="w-px h-7 hidden sm:block" style={{ background: 'var(--border)' }} />

                {/* Selected Client Name & Navigation */}
                {selectedClientId ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setSelectedClientId(''); setNavStack([{ kind: 'root' }]); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:bg-white/5"
                            style={{ border: '1px solid var(--border)' }}
                        >
                            <ArrowLeft size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Change Client</span>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-accent)' }}>
                            <Building2 size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{selectedClient?.name}</span>
                        </div>
                    </div>
                ) : null}

                {/* Permissions (Admin only) */}
                {(user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) && selectedClientId && (
                    <button
                        onClick={async () => {
                            setIsPermissionModalOpen(true);
                            if (allStaff.length === 0) {
                                try {
                                    const staff = await AuthService.getAllStaff();
                                    setAllStaff(staff);
                                } catch { /* silent */ }
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:scale-105 group"
                        title="Manage Staff Access"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                        <Users size={13} className="group-hover:text-amber-400 transition-colors" />
                        <span className="text-[11px] font-semibold hidden md:inline group-hover:text-amber-400 transition-colors">Access</span>
                        {selectedClient?.permittedStaff && selectedClient.permittedStaff.length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center"
                                style={{ boxShadow: '0 0 0 2px var(--bg-elevated)' }}>
                                {selectedClient.permittedStaff.length}
                            </span>
                        )}
                    </button>
                )}

                {/* Read-only badge for Staff */}
                {user.role === UserRole.STAFF && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                        style={{ background: 'rgba(59,130,246,0.10)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                        <Eye size={11} /> View Only
                    </div>
                )}

                {/* Fiscal Year & Tasks only shown if client selected */}
                {selectedClientId && (
                    <>
                        {/* Fiscal Year */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <CalendarDays size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <select
                                value={selectedFY}
                                onChange={e => setSelectedFY(e.target.value)}
                                className="text-sm font-semibold outline-none bg-transparent cursor-pointer"
                                style={{ color: 'var(--text-heading)' }}
                            >
                                {NEPALI_FISCAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                            </select>
                        </div>

                        {/* Engagement / Task Selector */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <ClipboardCheck size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <select
                                value={selectedTaskId}
                                onChange={e => { setSelectedTaskId(e.target.value); setNavStack([{ kind: 'root' }]); }}
                                className="text-sm font-semibold outline-none max-w-[200px] bg-transparent cursor-pointer"
                                style={{ color: 'var(--text-heading)' }}
                                disabled={loadingTasks}
                            >
                                <option value="ALL">All Engagements</option>
                                {clientTasks.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.taskType ? `[${t.taskType}] ` : ''}{t.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                <div className="flex-1" />

                {/* WiFi */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80' }}>
                    <Wifi size={12} /> Office
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-2">
                    {/* Global Access Button (Landing Page only) */}
                    {!selectedClientId && (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) && (
                        <button
                            onClick={async () => {
                                setIsGlobalAccessModalOpen(true);
                                if (allStaff.length === 0) {
                                    try {
                                        const staff = await AuthService.getAllStaff();
                                        setAllStaff(staff);
                                    } catch { /* silent */ }
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:bg-amber-500/10 border"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                            <Users size={14} className="text-amber-500" />
                            <span className="text-xs font-bold text-amber-500">Manage Access</span>
                        </button>
                    )}
                    
                    <div className="flex items-center rounded-xl overflow-hidden"
                        style={{ border: '1px solid var(--border)' }}>
                        <button onClick={() => setIsGrid(false)}
                            className="p-2 transition-colors"
                            style={{ background: !isGrid ? 'var(--accent-dim)' : 'transparent', color: !isGrid ? 'var(--accent)' : 'var(--text-muted)' }}>
                            <List size={14} />
                        </button>
                        <button onClick={() => setIsGrid(true)}
                            className="p-2 transition-colors"
                            style={{ background: isGrid ? 'var(--accent-dim)' : 'transparent', color: isGrid ? 'var(--accent)' : 'var(--text-muted)' }}>
                            <LayoutGrid size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Client Selection Grid (Shown if no client selected) ── */}
            {!selectedClientId ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="max-w-6xl mx-auto space-y-6">
                        
                        {/* Header & Search */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-heading)' }}>
                                    Select Client
                                </h1>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Choose a client to view or manage their audit documentation.
                                </p>
                            </div>
                            <div className="relative w-full md:w-80">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search clients..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                                    style={{ 
                                        background: 'var(--bg-surface)', 
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-heading)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Client Grid/List */}
                        <div className={isGrid 
                            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
                            : "space-y-3 w-full"
                        }>
                            {clients
                                .filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()))
                                .map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => handleClientSelect(client.id)}
                                    className={`group text-left rounded-2xl transition-all duration-300 active:scale-[0.99] border relative overflow-hidden ${
                                        isGrid ? "p-5 flex flex-col h-full hover:-translate-y-1 hover:shadow-xl" : "p-4 flex items-center gap-6 hover:bg-white/[0.03] hover:border-white/10"
                                    }`}
                                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                        style={{ background: isGrid ? 'radial-gradient(circle at 50% 0%, var(--accent-dim) 0%, transparent 70%)' : 'linear-gradient(to right, var(--accent-dim), transparent)' }} />
                                    
                                    <div className={`relative z-10 flex gap-4 ${isGrid ? "flex-col h-full" : "items-center flex-1"}`}>
                                        <div className={`${isGrid ? "w-12 h-12" : "w-14 h-14"} rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-105 group-hover:rotate-3`}
                                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                            <Building2 size={isGrid ? 24 : 28} style={{ color: 'var(--accent)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <h3 className={`${isGrid ? "text-base" : "text-lg"} font-bold line-clamp-2 leading-snug`} style={{ color: 'var(--text-heading)' }}>
                                                    {client.name}
                                                </h3>
                                                {!isGrid && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ACTIVE</span>}
                                            </div>
                                            {!isGrid && (
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                        <FolderOpen size={12} className="text-amber-500" />
                                                        <span>Documentation Repository</span>
                                                    </div>
                                                    {!isReadOnly && (
                                                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                            <Shield size={12} className="text-brand-500" />
                                                            <span>{client.permittedStaff?.length || 0} Staff with access</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {isGrid ? (
                                            <div className="mt-auto pt-4 flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                                                <span>View Documents</span>
                                                <ArrowLeft size={14} className="rotate-180 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" style={{ color: 'var(--accent)' }} />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4">
                                                <div className="hidden md:flex flex-col items-end mr-4">
                                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter">Engagement Vault</p>
                                                    <p className="text-xs font-bold text-white/60">OPEN REPOSITORY</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                                                    <ChevronRight size={18} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {clients.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase())).length === 0 && (
                                <div className="col-span-full py-12 text-center">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No clients found matching "{filterText}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Address bar / Breadcrumb ── */}
                    <div className="shrink-0 px-4 py-2 flex items-center gap-2"
                        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                        {canGoBack && (
                            <button
                                onClick={() => setNavStack(prev => prev.slice(0, -1))}
                                className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10"
                                style={{ color: 'var(--text-muted)' }}>
                                <ArrowLeft size={15} />
                            </button>
                        )}
                        <Breadcrumb stack={navStack} onNavigate={navigate} />

                        {/* NAS note */}
                        {currentLevel.kind === 'root' && (
                            <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono"
                                style={{ color: 'var(--text-muted)' }}>
                                <ServerCrash size={11} />
                                Appwrite Cloud · NAS sync coming soon
                            </div>
                        )}
                    </div>

                    {/* ── Content ── */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        {currentLevel.kind === 'root' && selectedClient && (
                            <RootView
                                clientId={selectedClientId}
                                fiscalYear={selectedFY}
                                fileCounts={fileCounts}
                                folderCounts={folderCounts}
                                onEnter={enterMainFolder}
                                isGrid={isGrid}
                            />
                        )}

                        {currentLevel.kind === 'main-folder' && currentLevel.folderKey === 'B' && selectedClient && user && (
                            <BFolderView
                                fileCounts={fileCounts}
                                onEnter={enterLineItem}
                                isGrid={isGrid}
                                clientId={selectedClientId}
                                clientName={selectedClient.name}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={enterSubFolder}
                            />
                        )}

                        {currentLevel.kind === 'main-folder' && currentLevel.folderKey !== 'B' && selectedClient && user && (
                            <>
                                {currentLevel.folderKey === 'E' && (
                                    <FolderEGovernance
                                        task={selectedTaskId !== 'ALL' ? (clientTasks.find(t => t.id === selectedTaskId) || null) : null}
                                    />
                                )}
                                <FolderContent
                                    key={`${selectedClientId}-${selectedFY}-${currentLevel.folderKey}-${selectedTaskId}`}
                                    folderKey={currentLevel.folderKey}
                                    clientId={selectedClientId}
                                    clientName={selectedClient.name}
                                    fiscalYear={selectedFY}
                                    userId={user.uid}
                                    userName={user.displayName}
                                    taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                    onEnterSubFolder={enterSubFolder}
                                    isGrid={isGrid}
                                    isReadOnly={isReadOnly}
                                />
                            </>
                        )}

                        {currentLevel.kind === 'line-item' && selectedClient && user && (
                            <FolderContent
                                key={`${selectedClientId}-${selectedFY}-B-${currentLevel.lineItem}-${selectedTaskId}`}
                                folderKey="B"
                                lineItem={currentLevel.lineItem}
                                lineItemLabel={currentLevel.lineItemLabel}
                                clientId={selectedClientId}
                                clientName={selectedClient.name}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={enterSubFolder}
                                isGrid={isGrid}
                                isReadOnly={isReadOnly}
                            />
                        )}

                        {currentLevel.kind === 'custom-folder' && selectedClient && user && (
                            <FolderContent
                                key={`${selectedClientId}-${selectedFY}-${currentLevel.folderKey}-${currentLevel.lineItem}-${currentLevel.folderId}-${selectedTaskId}`}
                                folderKey={currentLevel.folderKey}
                                lineItem={currentLevel.lineItem}
                                customFolderId={currentLevel.folderId}
                                clientId={selectedClientId}
                                clientName={selectedClient.name}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={() => {}} // no deeper nesting
                                isGrid={isGrid}
                                isReadOnly={isReadOnly}
                            />
                        )}
                    </div>
                </>
            )}

            {/* ── Client Permission Modal ── */}
            {isPermissionModalOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsPermissionModalOpen(false)}
                    />
                    <div 
                        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', maxHeight: '85vh' }}
                    >
                        <div className="shrink-0 p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--accent-dim)' }}>
                                    <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                                        Client Access
                                    </h2>
                                    <p className="text-[11px] font-semibold mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                                        {selectedClient.name}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsPermissionModalOpen(false)}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <FolderX size={16} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {allStaff.length === 0 ? (
                                <div className="p-10 flex flex-col items-center justify-center text-center">
                                    <Loader2 size={24} className="animate-spin mb-4" style={{ color: 'var(--accent)' }} />
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Loading staff...</p>
                                </div>
                            ) : (
                                <div className="space-y-1 p-2">
                                    {allStaff.map(staff => {
                                        const isPermitted = selectedClient.permittedStaff?.includes(staff.uid) || false;
                                        return (
                                            <div key={staff.uid} 
                                                className="flex items-center justify-between p-3 rounded-xl transition-all"
                                                style={{ background: isPermitted ? 'var(--bg-surface)' : 'transparent' }}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{staff.displayName || 'Unknown Staff'}</span>
                                                    <span className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>{staff.email}</span>
                                                </div>
                                                
                                                <button
                                                    onClick={async () => {
                                                        const current = selectedClient.permittedStaff || [];
                                                        const newPermitted = isPermitted 
                                                            ? current.filter(id => id !== staff.uid)
                                                            : [...current, staff.uid];
                                                            
                                                        try {
                                                            await AuthService.updateClientPermissions(selectedClient.id, newPermitted);
                                                            // update local state
                                                            setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, permittedStaff: newPermitted } : c));
                                                        } catch (error) {
                                                            toast.error('Failed to update permissions');
                                                        }
                                                    }}
                                                    className="shrink-0 w-12 h-6 rounded-full relative transition-colors duration-300"
                                                    style={{ background: isPermitted ? 'var(--accent)' : 'var(--bg-surface)', border: isPermitted ? 'none' : '1px solid var(--border)' }}
                                                >
                                                    <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-300 shadow-sm"
                                                        style={{ left: isPermitted ? 'calc(100% - 20px)' : '4px' }}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Global Staff-wise Access Modal ── */}
            {isGlobalAccessModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-5xl h-full max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10"
                        style={{ background: 'var(--bg-elevated)' }}>
                        
                        {/* Header */}
                        <div className="px-6 py-5 flex items-center justify-between border-b border-white/5 bg-white/2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                                    <ShieldCheck size={20} className="text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Global Staff Access Manager</h2>
                                    <p className="text-[11px] text-white/50 uppercase tracking-widest font-bold">Manage client permissions staff-wise</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setIsGlobalAccessModalOpen(false); setGlobalSelectedStaffId(null); }}
                                className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Layout */}
                        <div className="flex-1 flex min-h-0">
                            
                            {/* Staff List Sidebar */}
                            <div className="w-72 border-r border-white/5 flex flex-col bg-black/10">
                                <div className="p-4 border-b border-white/5">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                        <input 
                                            type="text"
                                            placeholder="Find staff..."
                                            value={staffFilter}
                                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                                            onChange={(e) => setStaffFilter(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {allStaff
                                        .filter(s => s.displayName?.toLowerCase().includes(staffFilter.toLowerCase()) || s.email?.toLowerCase().includes(staffFilter.toLowerCase()))
                                        .map(s => (
                                        <button
                                            key={s.uid}
                                            onClick={() => setGlobalSelectedStaffId(s.uid)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group ${
                                                globalSelectedStaffId === s.uid 
                                                    ? 'bg-amber-500 text-white shadow-lg' 
                                                    : 'hover:bg-white/5 text-white/60 hover:text-white'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border transition-colors ${
                                                globalSelectedStaffId === s.uid ? 'bg-white/20 border-white/30' : 'bg-white/5 border-white/10'
                                            }`}>
                                                {(s.displayName || 'U').charAt(0)}
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-xs font-bold truncate">{s.displayName}</p>
                                                <p className={`text-[9px] ${globalSelectedStaffId === s.uid ? 'text-white/70' : 'text-white/30'}`}>
                                                    {s.role || 'Staff'}
                                                </p>
                                            </div>
                                            {globalSelectedStaffId === s.uid && <ChevronRight size={14} className="animate-in slide-in-from-left-2" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Client Access Content */}
                            <div className="flex-1 flex flex-col min-w-0 bg-black/5">
                                {globalSelectedStaffId ? (
                                    <>
                                        {/* Staff Header */}
                                        <div className="px-8 py-5 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-bold text-white">
                                                    Permissions for <span className="text-amber-500">{allStaff.find(s => s.uid === globalSelectedStaffId)?.displayName}</span>
                                                </h3>
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        Allowed: {clients.filter(c => c.permittedStaff?.includes(globalSelectedStaffId)).length}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                                        Total: {clients.length}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Client Search within Permission List */}
                                            <div className="relative w-64">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                                <input 
                                                    type="text"
                                                    placeholder="Search clients..."
                                                    value={globalClientFilter}
                                                    onChange={(e) => setGlobalClientFilter(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                                                />
                                            </div>
                                        </div>

                                        {/* Client List */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {clients
                                                    .filter(c => c.name.toLowerCase().includes(globalClientFilter.toLowerCase()))
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(client => {
                                                        const isPermitted = client.permittedStaff?.includes(globalSelectedStaffId);
                                                        const handleToggle = async () => {
                                                            try {
                                                                const updatedIds = isPermitted
                                                                    ? (client.permittedStaff || []).filter(id => id !== globalSelectedStaffId)
                                                                    : [...(client.permittedStaff || []), globalSelectedStaffId];
                                                                
                                                                await AuthService.updateClientPermissions(client.id, updatedIds);
                                                                
                                                                // Local state update
                                                                setClients(prev => prev.map(c => 
                                                                    c.id === client.id ? { ...c, permittedStaff: updatedIds } : c
                                                                ));
                                                                toast.success(`${isPermitted ? 'Removed' : 'Granted'} access to ${client.name}`, {
                                                                    icon: isPermitted ? '🔒' : '🔓',
                                                                    style: { background: '#1e293b', color: '#fff', fontSize: '12px' }
                                                                });
                                                            } catch {
                                                                toast.error('Failed to update permission');
                                                            }
                                                        };

                                                        return (
                                                            <button
                                                                key={client.id}
                                                                onClick={handleToggle}
                                                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group ${
                                                                    isPermitted 
                                                                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                                                                        : 'bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/10'
                                                                }`}
                                                            >
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                                                    isPermitted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'
                                                                }`}>
                                                                    <Building2 size={20} />
                                                                </div>
                                                                <div className="flex-1 text-left min-w-0">
                                                                    <p className={`text-xs font-bold truncate ${isPermitted ? 'text-white' : 'text-white/40'}`}>
                                                                        {client.name}
                                                                    </p>
                                                                    <p className={`text-[9px] font-bold ${isPermitted ? 'text-emerald-500' : 'text-white/20'}`}>
                                                                        {isPermitted ? 'GRANTED' : 'NO ACCESS'}
                                                                    </p>
                                                                </div>
                                                                <div 
                                                                    className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${isPermitted ? 'bg-emerald-500' : 'bg-white/10'}`}
                                                                >
                                                                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all duration-300 shadow-sm ${isPermitted ? 'right-0.75' : 'left-0.75'}`} 
                                                                        style={{ top: '3px' }}
                                                                    />
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-40">
                                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-6">
                                            <Users size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Select a Staff Member</h3>
                                        <p className="text-xs max-w-xs leading-relaxed">Choose a staff member from the left sidebar to manage their client permissions.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditDocumentationPage;
