import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FolderArchive, FolderOpen, FolderPlus, ChevronRight,
    Trash2, Download, Eye, FileText, BookOpen, Shield,
    FileOutput, Wifi, Lock, RefreshCw, X, Save, Building2,
    CalendarDays, ServerCrash, Loader2, Edit2, Home,
    File, Image, FileSpreadsheet, Monitor, MoreVertical,
    CloudUpload, FolderX, FilePlus2, ArrowLeft, LayoutGrid,
    List, CheckCircle2, Info, ChevronDown,
    ClipboardCheck, CheckCircle, Clock, AlertTriangle, ShieldCheck, Search, Users,
    FileImage, FileVideo, FilePdf, Star, Grid3x3, Rows3, FolderClosed,
    UploadCloud, SortAsc, Filter, MoreHorizontal, HardDrive
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/firebase';
import {
    AuditDocService,
    AuditDocFile,
    AuditDocFolder,
    formatBytes,
    getMimeLabel,
} from '../../services/auditDocs';
import { StorageService } from '../../services/storage';
import {
    Client,
    UserRole,
    UserProfile,
    AUDIT_FOLDER_STRUCTURE,
    AuditFolderKey,
    Task,
} from '../../types';
import { toast } from 'react-hot-toast';
import { useOfficeWifiCheck } from '../../hooks/useOfficeWifiCheck';

// ─── Constants ────────────────────────────────────────────────────────────────

export const NEPALI_FISCAL_YEARS = [
    '2082-83', '2081-82', '2080-81', '2079-80', '2078-79', '2077-78',
];

const FOLDER_META: Record<AuditFolderKey, { icon: React.ElementType; color: string; bg: string; border: string; emoji: string }> = {
    A: { icon: FileText,   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)',  emoji: '📋' },
    B: { icon: BookOpen,   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', emoji: '📚' },
    C: { icon: Shield,     color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', emoji: '🛡️' },
    D: { icon: FolderOpen, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', emoji: '📁' },
    E: { icon: FileOutput, color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  emoji: '📤' },
};

// ─── Navigation types ─────────────────────────────────────────────────────────

export type NavLevel =
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

function getMimeColor(mimeType: string): string {
    if (mimeType === 'application/pdf') return '#ef4444';
    if (mimeType.startsWith('image/')) return '#10b981';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '#22c55e';
    if (mimeType.includes('word') || mimeType.includes('document')) return '#3b82f6';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '#f59e0b';
    return '#94a3b8';
}

function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface UploadQueueItem {
    id: string;
    fileName: string;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
}

// ─── WiFi Gate ────────────────────────────────────────────────────────────────

export const WifiGate: React.FC<{ retry: () => void }> = ({ retry }) => (
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

// ─── Upload Status Panel ───────────────────────────────────────────────────────

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
                        {isFinished ? 'Uploads Complete' : 'Uploading...'}
                    </h4>
                </div>
                {isFinished && (
                    <button onClick={onClear} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X size={14} style={{ color: 'var(--text-muted)' }} />
                    </button>
                )}
            </div>
            <div className="max-h-48 overflow-y-auto p-3 space-y-1.5">
                {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
                        <div className="shrink-0 w-6 flex justify-center">
                            {item.status === 'completed' && <CheckCircle2 size={14} className="text-emerald-500" />}
                            {item.status === 'error' && <AlertTriangle size={14} className="text-rose-500" />}
                            {(item.status === 'uploading' || item.status === 'pending') && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-heading)' }}>{item.fileName}</p>
                            {item.error && <p className="text-[9px] text-rose-500 truncate mt-0.5">{item.error}</p>}
                        </div>
                    </div>
                ))}
            </div>
            <div className="px-4 py-2 text-[10px] font-bold text-center border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {completedCount}/{totalCount} uploaded {errorCount > 0 && `· ${errorCount} failed`}
            </div>
        </div>
    );
};

// ─── File Row (Google Drive Style) ────────────────────────────────────────────

interface FileRowProps {
    file: AuditDocFile;
    isGrid?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    onDelete: () => void;
    onEditNotes: () => void;
}

const FileRow: React.FC<FileRowProps> = ({ file, isGrid, isSelected, onSelect, onDelete, onEditNotes }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const MimeIcon = getMimeIcon(file.mimeType);
    const mimeColor = getMimeColor(file.mimeType);
    const viewUrl = StorageService.getViewUrl(file.appwriteFileId);
    const downloadUrl = StorageService.getDownloadUrl(file.appwriteFileId);
    const canPreview = file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf';

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        if (menuOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);

    if (isGrid) {
        return (
            <div
                className={`group relative rounded-xl p-4 flex flex-col gap-3 transition-all duration-150 cursor-pointer select-none`}
                style={{
                    background: isSelected ? 'rgba(var(--accent-rgb, 101,154,43), 0.12)' : 'var(--bg-elevated)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                }}
                onClick={onSelect}
                onDoubleClick={() => canPreview && window.open(viewUrl, '_blank')}
            >
                {/* File icon */}
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto relative"
                    style={{ background: `${mimeColor}18`, border: `1px solid ${mimeColor}30` }}>
                    <MimeIcon size={28} style={{ color: mimeColor }} />
                    <span className="absolute -bottom-1.5 -right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-md text-white uppercase"
                        style={{ background: mimeColor }}>
                        {getMimeLabel(file.mimeType).split(' ')[0].substring(0, 4)}
                    </span>
                </div>
                <div className="text-center min-w-0">
                    <p className="text-xs font-semibold truncate leading-snug" style={{ color: 'var(--text-heading)' }} title={file.fileName}>
                        {file.fileName}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{formatBytes(file.fileSize)}</p>
                </div>
                {/* Hover actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
                    <button
                        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors"
                        style={{ color: 'var(--text-muted)' }}>
                        <MoreVertical size={14} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-8 w-44 rounded-xl shadow-2xl overflow-hidden z-50 border"
                            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>
                            {canPreview && (
                                <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-white/8 transition-colors"
                                    style={{ color: 'var(--text-body)' }}>
                                    <Eye size={13} /> Preview
                                </a>
                            )}
                            <a href={downloadUrl} download={file.fileName}
                                className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-white/8 transition-colors"
                                style={{ color: 'var(--text-body)' }}>
                                <Download size={13} /> Download
                            </a>
                            <button onClick={() => { setMenuOpen(false); onEditNotes(); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-white/8 transition-colors text-left"
                                style={{ color: 'var(--text-body)' }}>
                                <Edit2 size={13} /> Add Notes
                            </button>
                            <div className="h-px mx-3 my-1" style={{ background: 'var(--border)' }} />
                            <button onClick={() => { setMenuOpen(false); onDelete(); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-red-500/10 transition-colors text-left text-red-500">
                                <Trash2 size={13} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // LIST VIEW — Google Drive style row
    return (
        <div
            className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-100 cursor-pointer select-none`}
            style={{
                background: isSelected ? 'rgba(var(--accent-rgb, 101,154,43), 0.10)' : 'transparent',
                outline: isSelected ? '1px solid var(--accent)' : 'none',
                outlineOffset: '-1px'
            }}
            onClick={onSelect}
            onDoubleClick={() => canPreview && window.open(viewUrl, '_blank')}
        >
            {/* Icon */}
            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${mimeColor}15` }}>
                <MimeIcon size={16} style={{ color: mimeColor }} />
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }} title={file.fileName}>
                    {file.fileName}
                </p>
                {file.notes && (
                    <p className="text-[10px] truncate italic mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {file.notes}
                    </p>
                )}
            </div>

            {/* Uploader — hidden on small */}
            <div className="hidden lg:block w-36 shrink-0">
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{file.uploadedByName}</p>
            </div>

            {/* Modified */}
            <div className="hidden md:block w-28 shrink-0">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(file.uploadedAt)}</p>
            </div>

            {/* Size */}
            <div className="w-20 shrink-0 text-right">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatBytes(file.fileSize)}</p>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1" ref={menuRef}>
                {canPreview && (
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--text-muted)' }} title="Preview">
                        <Eye size={13} />
                    </a>
                )}
                <a href={downloadUrl} download={file.fileName}
                    onClick={e => e.stopPropagation()}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }} title="Download">
                    <Download size={13} />
                </a>
                <div className="relative">
                    <button
                        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--text-muted)' }} title="More options">
                        <MoreVertical size={13} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-8 w-44 rounded-xl shadow-2xl overflow-hidden z-50 border"
                            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>
                            <button onClick={() => { setMenuOpen(false); onEditNotes(); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-white/8 transition-colors text-left"
                                style={{ color: 'var(--text-body)' }}>
                                <Edit2 size={13} /> Add Notes
                            </button>
                            <div className="h-px mx-3 my-1" style={{ background: 'var(--border)' }} />
                            <button onClick={() => { setMenuOpen(false); onDelete(); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-red-500/10 transition-colors text-left text-red-500">
                                <Trash2 size={13} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Subfolder Row ─────────────────────────────────────────────────────────────

interface SubFolderRowProps {
    folder: AuditDocFolder;
    isGrid?: boolean;
    onClick: () => void;
    onDelete: () => void;
}

const SubFolderRow: React.FC<SubFolderRowProps> = ({ folder, isGrid, onClick, onDelete }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        if (menuOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);

    if (isGrid) {
        return (
            <div
                className="group relative rounded-xl p-4 flex flex-col gap-3 transition-all duration-150 cursor-pointer hover:bg-white/5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                onClick={onClick}
                onDoubleClick={onClick}
            >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <FolderOpen size={28} style={{ color: '#f59e0b' }} />
                </div>
                <div className="text-center min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{folder.name}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{formatDate(folder.createdAt)}</p>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors"
                        style={{ color: 'var(--text-muted)' }}>
                        <MoreVertical size={14} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-8 w-40 rounded-xl shadow-2xl overflow-hidden z-50 border"
                            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>
                            <button onClick={() => { setMenuOpen(false); onDelete(); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-red-500/10 transition-colors text-left text-red-500">
                                <Trash2 size={13} /> Delete Folder
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className="group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-100 cursor-pointer hover:bg-white/5"
            onClick={onClick}
            onDoubleClick={onClick}
        >
            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.12)' }}>
                <FolderOpen size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{folder.name}</p>
            </div>
            <div className="hidden lg:block w-36 shrink-0">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{folder.createdByName}</p>
            </div>
            <div className="hidden md:block w-28 shrink-0">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(folder.createdAt)}</p>
            </div>
            <div className="w-20 shrink-0 text-right">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Folder</p>
            </div>
            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1" ref={menuRef}>
                <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }}>
                    <MoreVertical size={13} />
                </button>
                {menuOpen && (
                    <div className="absolute right-12 w-40 rounded-xl shadow-2xl overflow-hidden z-50 border"
                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>
                        <button onClick={() => { setMenuOpen(false); onDelete(); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-red-500/10 transition-colors text-left text-red-500">
                            <Trash2 size={13} /> Delete Folder
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Folder Content (Drive-style file list) ───────────────────────────────────

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
    isReadOnly?: boolean;
}

const FolderContent: React.FC<FolderContentProps> = ({
    folderKey, lineItem, lineItemLabel, customFolderId,
    clientId, clientName, fiscalYear, userId, userName,
    taskId, onEnterSubFolder, isGrid, isReadOnly,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    const [files, setFiles] = useState<AuditDocFile[]>([]);
    const [subFolders, setSubFolders] = useState<AuditDocFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [savingFolder, setSavingFolder] = useState(false);
    const [editNotes, setEditNotes] = useState<{ file: AuditDocFile; notes: string } | null>(null);
    const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [fetchedFiles, fetchedFolders] = await Promise.all([
                AuditDocService.getFiles(clientId, fiscalYear, folderKey, lineItem, taskId),
                AuditDocService.getFolders(clientId, fiscalYear, folderKey, lineItem, taskId),
            ]);
            setFiles(customFolderId
                ? fetchedFiles.filter(f => f.customFolderId === customFolderId)
                : fetchedFiles.filter(f => !f.customFolderId));
            setSubFolders(customFolderId ? [] : fetchedFolders);
        } catch {
            toast.error('Failed to load folder contents');
        } finally {
            setLoading(false);
        }
    }, [clientId, fiscalYear, folderKey, lineItem, customFolderId, taskId]);

    useEffect(() => { load(); }, [load]);

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
                    clientId, clientName, fiscalYear, folderKey, lineItem, lineItemLabel,
                    customFolderId, uploadedBy: userId, uploadedByName: userName, taskId,
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
                clientId, clientName, fiscalYear, folderKey, lineItem,
                name: newFolderName.trim(), createdBy: userId, createdByName: userName,
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
    const totalItems = subFolders.length + files.length;

    return (
        <div
            className="flex-1 min-h-0 flex flex-col h-full relative"
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={e => { if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setDragging(false); }}
            onDrop={handleDrop}
            ref={dropZoneRef}
        >
            {/* Drag overlay */}
            {dragging && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-xl pointer-events-none"
                    style={{ background: 'rgba(101,154,43,0.08)', border: '2px dashed var(--accent)' }}>
                    <UploadCloud size={48} style={{ color: 'var(--accent)' }} className="mb-3 animate-bounce" />
                    <p className="text-base font-bold" style={{ color: 'var(--accent)' }}>Drop files to upload</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>They'll be added to this folder</p>
                </div>
            )}

            {/* Toolbar */}
            {!isReadOnly && (
                <div className="shrink-0 px-4 py-2.5 flex items-center gap-2 flex-wrap"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-sm"
                        style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-secondary))', color: '#fff' }}>
                        {uploading
                            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Uploading…</>
                            : <><UploadCloud size={15} /> Upload Files</>}
                    </button>
                    <input ref={fileInputRef} type="file" multiple className="hidden"
                        onChange={e => { if (e.target.files?.length) doUpload(Array.from(e.target.files)); }} />

                    {!customFolderId && (
                        <button
                            onClick={() => { setShowNewFolder(true); setNewFolderName(''); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-white/8 active:scale-95"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-body)' }}>
                            <FolderPlus size={15} /> New Folder
                        </button>
                    )}

                    <div className="flex-1" />
                    {totalItems > 0 && (
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                            {totalItems} item{totalItems !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            )}

            {/* New Folder Input */}
            {showNewFolder && (
                <div className="shrink-0 px-4 py-3 flex items-center gap-3 border-b"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <FolderPlus size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <input
                        type="text"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                        placeholder="New folder name…"
                        className="flex-1 max-w-xs px-3 py-1.5 rounded-lg text-sm outline-none"
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
            )}

            {/* Column headers (list view only) */}
            {!isGrid && !isEmpty && !loading && (
                <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b text-[10px] font-bold uppercase tracking-wider"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <div className="w-8 shrink-0" />
                    <div className="flex-1">Name</div>
                    <div className="hidden lg:block w-36 shrink-0">Owner</div>
                    <div className="hidden md:block w-28 shrink-0">Modified</div>
                    <div className="w-20 shrink-0 text-right">Size</div>
                    <div className="w-20 shrink-0" />
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" onClick={() => setSelectedId(null)}>
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading files…</p>
                    </div>
                ) : isEmpty ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 px-8">
                        <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed var(--border-mid)' }}>
                            <CloudUpload size={36} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
                                {isReadOnly ? 'No files here yet' : 'Drop files here'}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                {isReadOnly
                                    ? 'This folder is empty.'
                                    : 'Or click "Upload Files" to add documents to this folder.'}
                            </p>
                        </div>
                    </div>
                ) : isGrid ? (
                    <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                        {subFolders.map(sf => (
                            <SubFolderRow key={sf.id} folder={sf} isGrid
                                onClick={() => onEnterSubFolder(sf)}
                                onDelete={() => handleDeleteFolder(sf)} />
                        ))}
                        {files.map(f => (
                            <FileRow key={f.id} file={f} isGrid
                                isSelected={selectedId === f.id}
                                onSelect={() => setSelectedId(prev => prev === f.id ? null : f.id)}
                                onDelete={() => handleDelete(f)}
                                onEditNotes={() => setEditNotes({ file: f, notes: f.notes || '' })} />
                        ))}
                    </div>
                ) : (
                    <div className="px-2 py-1">
                        {subFolders.length > 0 && (
                            <div className="mb-1">
                                {subFolders.map(sf => (
                                    <SubFolderRow key={sf.id} folder={sf}
                                        onClick={() => onEnterSubFolder(sf)}
                                        onDelete={() => handleDeleteFolder(sf)} />
                                ))}
                            </div>
                        )}
                        {subFolders.length > 0 && files.length > 0 && (
                            <div className="mx-3 my-1.5 h-px" style={{ background: 'var(--border)' }} />
                        )}
                        {files.map(f => (
                            <FileRow key={f.id} file={f}
                                isSelected={selectedId === f.id}
                                onSelect={() => setSelectedId(prev => prev === f.id ? null : f.id)}
                                onDelete={() => handleDelete(f)}
                                onEditNotes={() => setEditNotes({ file: f, notes: f.notes || '' })} />
                        ))}
                    </div>
                )}
            </div>

            {/* Notes modal */}
            {editNotes && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                        <div className="flex items-center justify-between px-5 py-4"
                            style={{ borderBottom: '1px solid var(--border)' }}>
                            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>File Notes</h3>
                            <button onClick={() => setEditNotes(null)} className="p-1 rounded-lg hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-xs truncate font-mono" style={{ color: 'var(--text-muted)' }}>{editNotes.file.fileName}</p>
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

const FolderEGovernance: React.FC<{ task: Task | null }> = ({ task }) => {
    if (!task) return (
        <div className="shrink-0 mx-4 mt-4 mb-2 rounded-xl p-4 border border-dashed text-center"
            style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Select an engagement above to view its Reviewer Sign-Off dashboard.
            </p>
        </div>
    );

    const reviewChecklist = task.reviewChecklist || [];
    const tlItems = reviewChecklist.filter(i => i.reviewerRole === 'TL');
    const erItems = reviewChecklist.filter(i => i.reviewerRole === 'ER');
    const spItems = reviewChecklist.filter(i => i.reviewerRole === 'SP');
    const tlSignedOff = !!task.teamLeadApprovedAt;
    const erSignedOff = !!task.engagementReviewerApprovedAt;
    const spSignedOff = !!task.signingPartnerApprovedAt;
    const overallComplete = tlSignedOff && erSignedOff && spSignedOff;

    const layerInfo = [
        { role: 'TL', label: 'Team Lead Review', items: tlItems, signedOff: tlSignedOff, signedAt: task.teamLeadApprovedAt, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
        { role: 'ER', label: 'Engagement Reviewer', items: erItems, signedOff: erSignedOff, signedAt: task.engagementReviewerApprovedAt, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' },
        { role: 'SP', label: 'Signing Partner', items: spItems, signedOff: spSignedOff, signedAt: task.signingPartnerApprovedAt, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
    ];

    return (
        <div className="shrink-0 mx-4 mt-4 mb-0 space-y-3">
            <div className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: overallComplete ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${overallComplete ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.25)'}` }}>
                <div className="flex items-center gap-3">
                    <ShieldCheck size={18} style={{ color: overallComplete ? '#4ade80' : '#f87171' }} />
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
                            {l.signedOff ? <CheckCircle size={10} /> : <Clock size={10} />} {l.role}
                        </div>
                    ))}
                </div>
            </div>
            {layerInfo.map(layer => (
                <div key={layer.role} className="rounded-xl overflow-hidden"
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {layer.items.map((item, idx) => (
                                        <tr key={item.id} style={{ borderTop: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                            <td className="px-3 py-2.5" style={{ color: 'var(--text-body)' }}>
                                                <p className="font-semibold">{item.title}</p>
                                                {item.minimumRequirement && <p className="text-[10px] mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>{item.minimumRequirement}</p>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{
                                                    background: `${({ CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b' } as any)[item.priority] || '#64748b'}22`,
                                                    color: ({ CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b' } as any)[item.priority] || '#64748b'
                                                }}>{item.priority}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span style={{ color: item.status === 'OK' ? '#4ade80' : item.status === 'ISSUE' ? '#f87171' : 'var(--text-muted)' }}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>
                                                {item.completedByName || <span className="italic text-[10px]">Pending</span>}
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

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

interface SidebarProps {
    navStack: NavLevel[];
    fileCounts: Record<string, number>;
    folderCounts: Record<string, number>;
    onNavigateRoot: () => void;
    onEnterFolder: (key: AuditFolderKey) => void;
    activeKey: AuditFolderKey | null;
}

const Sidebar: React.FC<SidebarProps> = ({ navStack, fileCounts, folderCounts, onNavigateRoot, onEnterFolder, activeKey }) => {
    return (
        <div className="w-56 shrink-0 flex flex-col border-r custom-scrollbar overflow-y-auto"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            {/* My Drive header */}
            <button
                onClick={onNavigateRoot}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/5 ${navStack.length === 1 ? 'text-white' : ''}`}
                style={{ color: navStack.length === 1 ? 'var(--accent)' : 'var(--text-muted)' }}>
                <HardDrive size={16} style={{ color: navStack.length === 1 ? 'var(--accent)' : 'var(--text-muted)' }} />
                Documents
            </button>

            <div className="h-px mx-3 mb-2" style={{ background: 'var(--border)' }} />

            {/* Folder list A–E */}
            {(Object.keys(AUDIT_FOLDER_STRUCTURE) as AuditFolderKey[]).map(key => {
                const f = AUDIT_FOLDER_STRUCTURE[key];
                const meta = FOLDER_META[key];
                const Icon = meta.icon;
                const isActive = activeKey === key;
                const fc = fileCounts[key] || 0;

                return (
                    <button
                        key={key}
                        onClick={() => onEnterFolder(key)}
                        className={`group relative flex items-center gap-2.5 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-150 text-left`}
                        style={{
                            background: isActive ? `${meta.color}18` : 'transparent',
                            color: isActive ? meta.color : 'var(--text-muted)',
                            border: isActive ? `1px solid ${meta.border}` : '1px solid transparent',
                        }}>
                        <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: isActive ? meta.bg : 'transparent' }}>
                            <Icon size={15} style={{ color: isActive ? meta.color : 'var(--text-muted)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: isActive ? meta.color : 'var(--text-body)' }}>
                                {f.label}
                            </p>
                        </div>
                        {fc > 0 && (
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: isActive ? meta.bg : 'var(--bg-elevated)', color: isActive ? meta.color : 'var(--text-muted)' }}>
                                {fc}
                            </span>
                        )}
                    </button>
                );
            })}

            <div className="flex-1" />

            {/* Storage indicator */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold"
                    style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <Wifi size={11} /> Office LAN Connected
                </div>
            </div>
        </div>
    );
};

// ─── B Folder Line-Items ──────────────────────────────────────────────────────

interface BLineItemsProps {
    fileCounts: Record<string, number>;
    onEnter: (lineItem: string, label: string) => void;
    clientId: string; clientName: string; fiscalYear: string;
    userId: string; userName: string; taskId?: string;
    onEnterSubFolder: (folder: AuditDocFolder) => void;
    isGrid: boolean;
    isReadOnly?: boolean;
}

const BFolderView: React.FC<BLineItemsProps> = ({
    fileCounts, onEnter, clientId, clientName, fiscalYear, userId, userName, taskId, onEnterSubFolder, isGrid, isReadOnly
}) => {
    const folder = AUDIT_FOLDER_STRUCTURE['B'];
    const meta = FOLDER_META['B'];

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Line items section */}
            <div className="shrink-0 px-4 pt-4 pb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>
                    Standard Audit Sections (B.1 – B.15)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {(folder.lineItems || []).map((li, idx) => {
                        const lineCode = `B.${idx + 1}`;
                        const count = fileCounts[`B-${lineCode}`] || 0;
                        return (
                            <button
                                key={lineCode}
                                onClick={() => onEnter(lineCode, li)}
                                className="group text-left rounded-xl p-3 flex flex-col gap-2 transition-all duration-150 hover:scale-[1.02] hover:shadow-lg"
                                style={{ background: 'var(--bg-elevated)', border: `1px solid ${count > 0 ? meta.border : 'var(--border)'}` }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                                    <span className="text-[10px] font-black" style={{ color: meta.color }}>{lineCode}</span>
                                </div>
                                <p className="text-[11px] font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text-heading)' }}>
                                    {li.replace(/^B\.\d+\. /, '')}
                                </p>
                                <p className="text-[10px] mt-auto" style={{ color: count > 0 ? meta.color : 'var(--text-muted)' }}>
                                    {count > 0 ? `${count} file${count !== 1 ? 's' : ''}` : 'Empty'}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="shrink-0 mx-4 mb-3 h-px" style={{ background: 'var(--border)' }} />

            {/* Root docs */}
            <div className="shrink-0 px-4 mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>General Documents</p>
            </div>
            <div className="flex-1 min-h-0">
                <FolderContent
                    folderKey="B"
                    clientId={clientId} clientName={clientName} fiscalYear={fiscalYear}
                    userId={userId} userName={userName} taskId={taskId}
                    onEnterSubFolder={onEnterSubFolder} isGrid={isGrid} isReadOnly={isReadOnly}
                />
            </div>
        </div>
    );
};

// ─── Main AuditWorkspace ──────────────────────────────────────────────────────

interface AuditWorkspaceProps {
    clientId: string;
    clientName: string;
    isReadOnly?: boolean;
}

export const AuditWorkspace: React.FC<AuditWorkspaceProps> = ({ clientId, clientName, isReadOnly }) => {
    const { user } = useAuth();
    const { status: wifiStatus, retry: retryWifi } = useOfficeWifiCheck();

    const [selectedFY, setSelectedFY] = useState(NEPALI_FISCAL_YEARS[0]);
    const [clientTasks, setClientTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string>('ALL');
    const [navStack, setNavStack] = useState<NavLevel[]>([{ kind: 'root' }]);
    const [isGrid, setIsGrid] = useState(false);
    const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
    const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState('');

    const currentLevel = navStack[navStack.length - 1];
    const activeKey = currentLevel.kind === 'root' ? null :
        (currentLevel as any).folderKey as AuditFolderKey;

    useEffect(() => {
        if (!clientId) return;
        setLoadingTasks(true);
        AuthService.getAllTasks().then(allTasks => {
            const matching = allTasks.filter(t =>
                (t.clientIds?.includes(clientId) || t.clientId === clientId) &&
                (!t.fiscalYear || t.fiscalYear === selectedFY)
            );
            setClientTasks(matching);
        }).catch(() => { }).finally(() => setLoadingTasks(false));

        (async () => {
            try {
                const [allFiles, allFolders] = await Promise.all([
                    AuditDocService.getAllFiles(clientId, selectedFY, selectedTaskId !== 'ALL' ? selectedTaskId : undefined),
                    Promise.all((['A', 'B', 'C', 'D', 'E'] as AuditFolderKey[]).map(k =>
                        AuditDocService.getFolders(clientId, selectedFY, k)
                    )),
                ]);
                const fc: Record<string, number> = {};
                allFiles.forEach(f => {
                    fc[f.folderKey] = (fc[f.folderKey] || 0) + 1;
                    if (f.lineItem) { const k = `${f.folderKey}-${f.lineItem}`; fc[k] = (fc[k] || 0) + 1; }
                });
                setFileCounts(fc);
                const folderKeys: AuditFolderKey[] = ['A', 'B', 'C', 'D', 'E'];
                const foc: Record<string, number> = {};
                allFolders.forEach((folders, i) => { foc[folderKeys[i]] = folders.length; });
                setFolderCounts(foc);
            } catch { }
        })();
    }, [clientId, selectedFY, selectedTaskId]);

    const navigate = (index: number) => setNavStack(prev => prev.slice(0, index + 1));
    const enterMainFolder = (key: AuditFolderKey) => setNavStack(prev => [...prev, { kind: 'main-folder', folderKey: key }]);
    const enterLineItem = (lineItem: string, lineItemLabel: string) => setNavStack(prev => [...prev, { kind: 'line-item', folderKey: 'B', lineItem, lineItemLabel }]);
    const enterSubFolder = (sf: AuditDocFolder) => {
        const parent = currentLevel as any;
        setNavStack(prev => [...prev, {
            kind: 'custom-folder',
            folderKey: parent.folderKey,
            lineItem: parent.lineItem,
            folderId: sf.id,
            folderName: sf.name,
        }]);
    };

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.STAFF)) {
        return <div className="flex items-center justify-center p-10"><p style={{ color: 'var(--text-muted)' }}>Access restricted.</p></div>;
    }
    if (wifiStatus === 'CHECKING') {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Verifying office network…</p>
            </div>
        );
    }
    if (wifiStatus === 'REMOTE' || wifiStatus === 'ERROR') return <WifiGate retry={retryWifi} />;

    const getNavLabel = (level: NavLevel): string => {
        if (level.kind === 'root') return 'Documents';
        if (level.kind === 'main-folder') return AUDIT_FOLDER_STRUCTURE[level.folderKey].label;
        if (level.kind === 'line-item') return level.lineItemLabel;
        return level.folderName;
    };

    return (
        <div className="flex flex-col rounded-2xl overflow-hidden shadow-lg relative"
            style={{ height: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>

            {/* ── Top toolbar ── */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b flex-wrap"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search files…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition-all"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-body)' }}
                    />
                </div>

                <div className="flex-1" />

                {/* FY Picker */}
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <CalendarDays size={13} style={{ color: 'var(--accent)' }} />
                    <select
                        value={selectedFY}
                        onChange={e => { setSelectedFY(e.target.value); setNavStack([{ kind: 'root' }]); }}
                        className="text-xs font-semibold outline-none bg-transparent cursor-pointer"
                        style={{ color: 'var(--text-heading)' }}>
                        {NEPALI_FISCAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                </div>

                {/* Engagement Picker */}
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <ClipboardCheck size={13} style={{ color: 'var(--accent)' }} />
                    <select
                        value={selectedTaskId}
                        onChange={e => { setSelectedTaskId(e.target.value); setNavStack([{ kind: 'root' }]); }}
                        className="text-xs font-semibold outline-none max-w-[180px] bg-transparent cursor-pointer"
                        style={{ color: 'var(--text-heading)' }}
                        disabled={loadingTasks}>
                        <option value="ALL">All Engagements</option>
                        {clientTasks.map(t => (
                            <option key={t.id} value={t.id}>{t.taskType ? `[${t.taskType}] ` : ''}{t.title}</option>
                        ))}
                    </select>
                </div>

                {/* View toggle */}
                <div className="flex items-center rounded-xl overflow-hidden border"
                    style={{ borderColor: 'var(--border)' }}>
                    <button
                        onClick={() => setIsGrid(false)}
                        className={`p-2 transition-colors ${!isGrid ? 'text-white' : 'hover:bg-white/5'}`}
                        style={{ background: !isGrid ? 'var(--accent)' : 'transparent', color: !isGrid ? '#fff' : 'var(--text-muted)' }}
                        title="List view">
                        <List size={14} />
                    </button>
                    <button
                        onClick={() => setIsGrid(true)}
                        className={`p-2 transition-colors ${isGrid ? 'text-white' : 'hover:bg-white/5'}`}
                        style={{ background: isGrid ? 'var(--accent)' : 'transparent', color: isGrid ? '#fff' : 'var(--text-muted)' }}
                        title="Grid view">
                        <LayoutGrid size={14} />
                    </button>
                </div>
            </div>

            {/* ── Body: sidebar + main ── */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

                {/* Left sidebar */}
                <Sidebar
                    navStack={navStack}
                    fileCounts={fileCounts}
                    folderCounts={folderCounts}
                    onNavigateRoot={() => setNavStack([{ kind: 'root' }])}
                    onEnterFolder={enterMainFolder}
                    activeKey={activeKey}
                />

                {/* Main content area */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

                    {/* Breadcrumb bar */}
                    <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 border-b"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                        {navStack.length > 1 && (
                            <button
                                onClick={() => setNavStack(prev => prev.slice(0, -1))}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors mr-0.5"
                                style={{ color: 'var(--text-muted)' }}>
                                <ArrowLeft size={14} />
                            </button>
                        )}
                        {navStack.map((level, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                <button
                                    onClick={() => navigate(i)}
                                    disabled={i === navStack.length - 1}
                                    className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors truncate max-w-[180px] ${i === navStack.length - 1 ? 'cursor-default' : 'hover:bg-white/8'}`}
                                    style={{ color: i === navStack.length - 1 ? 'var(--text-heading)' : 'var(--text-muted)' }}>
                                    {i === 0 ? (
                                        <span className="flex items-center gap-1"><Home size={11} />{getNavLabel(level)}</span>
                                    ) : getNavLabel(level)}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        {currentLevel.kind === 'root' && (
                            // Root: show 5 audit folders as big drive-style rows
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {/* Column headers */}
                                <div className="flex items-center gap-3 px-3 py-2 border-b text-[10px] font-bold uppercase tracking-wider"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                    <div className="w-8 shrink-0" />
                                    <div className="flex-1">Name</div>
                                    <div className="hidden md:block w-28 shrink-0">Files</div>
                                    <div className="w-28 shrink-0 text-right">Folders</div>
                                </div>
                                <div className="px-2 py-1">
                                    {(Object.keys(AUDIT_FOLDER_STRUCTURE) as AuditFolderKey[]).map(key => {
                                        const f = AUDIT_FOLDER_STRUCTURE[key];
                                        const meta = FOLDER_META[key];
                                        const Icon = meta.icon;
                                        const fc = fileCounts[key] || 0;
                                        const foc = folderCounts[key] || 0;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => enterMainFolder(key)}
                                                onDoubleClick={() => enterMainFolder(key)}
                                                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 hover:bg-white/5">
                                                <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                                                    style={{ background: meta.bg }}>
                                                    <Icon size={16} style={{ color: meta.color }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{f.label}</p>
                                                    <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.description}</p>
                                                </div>
                                                <div className="hidden md:block w-28 shrink-0">
                                                    <p className="text-xs" style={{ color: fc > 0 ? meta.color : 'var(--text-muted)' }}>
                                                        {fc > 0 ? `${fc} file${fc !== 1 ? 's' : ''}` : '—'}
                                                    </p>
                                                </div>
                                                <div className="w-28 shrink-0 text-right">
                                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        {foc > 0 ? `${foc} folder${foc !== 1 ? 's' : ''}` : '—'}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {currentLevel.kind === 'main-folder' && currentLevel.folderKey === 'B' && user && (
                            <BFolderView
                                fileCounts={fileCounts}
                                onEnter={enterLineItem}
                                clientId={clientId} clientName={clientName} fiscalYear={selectedFY}
                                userId={user.uid} userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={enterSubFolder}
                                isGrid={isGrid} isReadOnly={isReadOnly}
                            />
                        )}

                        {currentLevel.kind === 'main-folder' && currentLevel.folderKey !== 'B' && user && (
                            <>
                                {currentLevel.folderKey === 'E' && (
                                    <FolderEGovernance
                                        task={selectedTaskId !== 'ALL' ? (clientTasks.find(t => t.id === selectedTaskId) || null) : null}
                                    />
                                )}
                                <FolderContent
                                    key={`${clientId}-${selectedFY}-${currentLevel.folderKey}-${selectedTaskId}`}
                                    folderKey={currentLevel.folderKey}
                                    clientId={clientId} clientName={clientName} fiscalYear={selectedFY}
                                    userId={user.uid} userName={user.displayName}
                                    taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                    onEnterSubFolder={enterSubFolder}
                                    isGrid={isGrid} isReadOnly={isReadOnly}
                                />
                            </>
                        )}

                        {currentLevel.kind === 'line-item' && user && (
                            <FolderContent
                                key={`${clientId}-${selectedFY}-B-${currentLevel.lineItem}-${selectedTaskId}`}
                                folderKey="B"
                                lineItem={currentLevel.lineItem}
                                lineItemLabel={currentLevel.lineItemLabel}
                                clientId={clientId} clientName={clientName} fiscalYear={selectedFY}
                                userId={user.uid} userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={enterSubFolder}
                                isGrid={isGrid} isReadOnly={isReadOnly}
                            />
                        )}

                        {currentLevel.kind === 'custom-folder' && user && (
                            <FolderContent
                                key={`${clientId}-${selectedFY}-${currentLevel.folderKey}-${currentLevel.lineItem}-${currentLevel.folderId}-${selectedTaskId}`}
                                folderKey={currentLevel.folderKey}
                                lineItem={currentLevel.lineItem}
                                customFolderId={currentLevel.folderId}
                                clientId={clientId} clientName={clientName} fiscalYear={selectedFY}
                                userId={user.uid} userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={() => {}}
                                isGrid={isGrid} isReadOnly={isReadOnly}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
