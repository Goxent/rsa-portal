import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FolderArchive, FolderOpen, FolderPlus, ChevronRight,
    Trash2, Download, Eye, FileText, BookOpen, Shield,
    FileOutput, Wifi, Lock, RefreshCw, X, Save, Building2,
    CalendarDays, ServerCrash, Loader2, Edit2, Home,
    File, Image, FileSpreadsheet, Monitor, MoreVertical,
    CloudUpload, FolderX, FilePlus2, ArrowLeft, LayoutGrid,
    List, CheckCircle2, Info, ChevronDown
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
import { AppwriteService } from '../services/appwrite';
import {
    Client,
    UserRole,
    AUDIT_FOLDER_STRUCTURE,
    AuditFolderKey,
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
    const viewUrl = AppwriteService.getFileView(file.appwriteFileId);
    const downloadUrl = AppwriteService.getFileDownload(file.appwriteFileId);
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
                <button
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="self-center opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/20"
                    style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={11} />
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
    onEnterSubFolder: (folder: AuditDocFolder) => void;
    isGrid: boolean;
}

const FolderContent: React.FC<FolderContentProps> = ({
    folderKey, lineItem, lineItemLabel, customFolderId,
    clientId, clientName, fiscalYear, userId, userName,
    onEnterSubFolder, isGrid,
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
                AuditDocService.getFiles(clientId, fiscalYear, folderKey, lineItem),
                AuditDocService.getFolders(clientId, fiscalYear, folderKey, lineItem),
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
    }, [clientId, fiscalYear, folderKey, lineItem, customFolderId]);

    useEffect(() => { load(); }, [load]);

    const doUpload = async (selectedFiles: File[]) => {
        setUploading(true);
        let ok = 0;
        for (const file of selectedFiles) {
            try {
                await AuditDocService.uploadFile(file, {
                    clientId, clientName, fiscalYear,
                    folderKey,
                    lineItem,
                    lineItemLabel,
                    customFolderId,
                    uploadedBy: userId,
                    uploadedByName: userName,
                });
                ok++;
            } catch (e: any) {
                toast.error(`"${file.name}" failed: ${e.message}`);
            }
        }
        if (ok > 0) {
            toast.success(`${ok} file${ok > 1 ? 's' : ''} uploaded`);
            await load();
        }
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
}

const BFolderView: React.FC<BFolderViewProps> = ({ fileCounts, onEnter, isGrid }) => {
    const folder = AUDIT_FOLDER_STRUCTURE['B'];
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
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

    // Navigation stack — each step is a NavLevel
    const [navStack, setNavStack] = useState<NavLevel[]>([{ kind: 'root' }]);

    // View mode — list by default (more file-manager-like)
    const [isGrid, setIsGrid] = useState(false);

    // Aggregate counts for root view and B-folder view
    const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
    const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});

    const currentLevel = navStack[navStack.length - 1];

    // Load clients
    useEffect(() => {
        (async () => {
            try {
                const list = await AuthService.getAllClients();
                const active = list.filter(c => c.status === 'Active');
                setClients(active);
                if (active.length > 0) setSelectedClientId(active[0].id);
            } catch {
                toast.error('Failed to load clients');
            } finally {
                setLoadingClients(false);
            }
        })();
    }, []);

    // Reload aggregate counts when client/FY changes
    useEffect(() => {
        if (!selectedClientId) return;
        setNavStack([{ kind: 'root' }]);
        (async () => {
            try {
                const [allFiles, allFolders] = await Promise.all([
                    AuditDocService.getAllFiles(selectedClientId, selectedFY),
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
    }, [selectedClientId, selectedFY]);

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

    // ── Guards ─────────────────────────────────────────────────────────────────

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN)) {
        return (
            <div className="flex items-center justify-center min-h-full">
                <p style={{ color: 'var(--text-muted)' }}>Access restricted to administrators.</p>
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

    // ── Render ─────────────────────────────────────────────────────────────────

    const canGoBack = navStack.length > 1;

    return (
        <div style={{ height: 'calc(100vh - var(--header-height))', display: 'flex', flexDirection: 'column' }}>

            {/* ── Top bar ── */}
            <div className="shrink-0 px-4 py-2.5 flex flex-wrap items-center gap-3"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>

                <FolderArchive size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="text-sm font-bold hidden sm:inline"
                    style={{ color: 'var(--text-heading)' }}>Audit Docs</span>

                <div className="w-px h-5 hidden sm:block" style={{ background: 'var(--border)' }} />

                {/* Client */}
                <div className="flex items-center gap-1.5">
                    <Building2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl text-sm outline-none max-w-[200px]"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
                        disabled={loadingClients}
                    >
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Fiscal Year */}
                <div className="flex items-center gap-1.5">
                    <CalendarDays size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <select
                        value={selectedFY}
                        onChange={e => setSelectedFY(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
                    >
                        {NEPALI_FISCAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                </div>

                <div className="flex-1" />

                {/* WiFi */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80' }}>
                    <Wifi size={12} /> Office
                </div>

                {/* View toggle */}
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
                {currentLevel.kind === 'root' && (
                    <RootView
                        clientId={selectedClientId}
                        fiscalYear={selectedFY}
                        fileCounts={fileCounts}
                        folderCounts={folderCounts}
                        onEnter={enterMainFolder}
                        isGrid={isGrid}
                    />
                )}

                {currentLevel.kind === 'main-folder' && currentLevel.folderKey === 'B' && (
                    <BFolderView
                        fileCounts={fileCounts}
                        onEnter={enterLineItem}
                        isGrid={isGrid}
                    />
                )}

                {currentLevel.kind === 'main-folder' && currentLevel.folderKey !== 'B' && selectedClient && user && (
                    <FolderContent
                        key={`${selectedClientId}-${selectedFY}-${currentLevel.folderKey}`}
                        folderKey={currentLevel.folderKey}
                        clientId={selectedClientId}
                        clientName={selectedClient.name}
                        fiscalYear={selectedFY}
                        userId={user.uid}
                        userName={user.displayName}
                        onEnterSubFolder={enterSubFolder}
                        isGrid={isGrid}
                    />
                )}

                {currentLevel.kind === 'line-item' && selectedClient && user && (
                    <FolderContent
                        key={`${selectedClientId}-${selectedFY}-B-${currentLevel.lineItem}`}
                        folderKey="B"
                        lineItem={currentLevel.lineItem}
                        lineItemLabel={currentLevel.lineItemLabel}
                        clientId={selectedClientId}
                        clientName={selectedClient.name}
                        fiscalYear={selectedFY}
                        userId={user.uid}
                        userName={user.displayName}
                        onEnterSubFolder={enterSubFolder}
                        isGrid={isGrid}
                    />
                )}

                {currentLevel.kind === 'custom-folder' && selectedClient && user && (
                    <FolderContent
                        key={`${selectedClientId}-${selectedFY}-${currentLevel.folderKey}-${currentLevel.lineItem}-${currentLevel.folderId}`}
                        folderKey={currentLevel.folderKey}
                        lineItem={currentLevel.lineItem}
                        customFolderId={currentLevel.folderId}
                        clientId={selectedClientId}
                        clientName={selectedClient.name}
                        fiscalYear={selectedFY}
                        userId={user.uid}
                        userName={user.displayName}
                        onEnterSubFolder={() => {}} // no deeper nesting
                        isGrid={isGrid}
                    />
                )}
            </div>
        </div>
    );
};

export default AuditDocumentationPage;
