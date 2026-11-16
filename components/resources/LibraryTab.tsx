import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
    Folder, FileText, Search, ExternalLink, Grid, List,
    BookOpen, FileCheck, Eye, X, Sparkles, Send, Bot,
    Plus, ChevronRight, Home, Save, Trash2, ArrowLeft,
    Download, File, Loader2, PenTool, RotateCcw, AlertTriangle, Flame
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AiService } from '../../services/ai';
import { useAuth } from '../../context/AuthContext';
import { UserRole, Resource } from '../../types';
import { AuthService } from '../../services/firebase';
import { StorageService } from '../../services/storage';
import { FileUploader } from '../common/FileUploader';
import { DocumentViewer } from '../common/DocumentViewer';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ResourceIcon = ({ type, size = 24, className = '' }: { type: string; size?: number; className?: string }) => {
    switch (type) {
        case 'folder': return <Folder className={`text-amber-400 ${className}`} size={size} />;
        case 'pdf':    return <FileText className={`text-rose-400 ${className}`} size={size} />;
        case 'sheet':  return <FileCheck className={`text-brand-400 ${className}`} size={size} />;
        case 'doc':    return <FileText className={`text-amber-400 ${className}`} size={size} />;
        case 'article':return <BookOpen className={`text-purple-400 ${className}`} size={size} />;
        case 'image':  return <Eye className={`text-cyan-400 ${className}`} size={size} />;
        default:       return <File className={`text-gray-400 ${className}`} size={size} />;
    }
};

const TYPE_BADGE: Record<string, string> = {
    folder:  'bg-amber-500/15 text-amber-300 border-amber-500/25',
    pdf:     'bg-rose-500/15 text-rose-300 border-rose-500/25',
    sheet:   'bg-brand-500/15 text-brand-300 border-brand-500/25',
    doc:     'bg-amber-500/15 text-amber-300 border-amber-500/25',
    article: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
    image:   'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
};

const fmtSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const renderMd = (text: string) => {
    const rawHtml = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-[var(--text-heading)] mt-4 mb-2">$1</h3>')
        .replace(/^## (.+)$/gm,  '<h2 class="text-lg font-semibold text-[var(--text-heading)] mt-5 mb-2">$1</h2>')
        .replace(/^# (.+)$/gm,   '<h1 class="text-xl font-semibold text-[var(--text-heading)] mt-6 mb-3">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--text-heading)] font-semibold">$1</strong>')
        .replace(/\*(.+?)\*/g,   '<em>$1</em>')
        .replace(/^- (.+)$/gm,   '<li class="ml-4 list-disc text-[var(--text-muted)]">$1</li>')
        .replace(/\n\n/g, '</p><p class="mb-3 text-[var(--text-muted)]">')
        .replace(/\n/g, '<br/>');
    const formatted = `<p class="mb-3 text-[var(--text-muted)]">${rawHtml}</p>`;
    return DOMPurify.sanitize(formatted);
};

const colorFor = (id: string, type: string) => {
    if (type === 'folder') return 'from-amber-600/20 to-orange-400/10';
    const cols = [
        'from-blue-600/20 to-yellow-400/10',
        'from-purple-600/20 to-pink-400/10',
        'from-brand-600/20 to-teal-400/10',
        'from-amber-600/20 to-yellow-400/10',
        'from-rose-600/20 to-red-400/10',
    ];
    return cols[id.charCodeAt(0) % cols.length];
};

// ── Component ─────────────────────────────────────────────────────────────────

interface LibraryTabProps {
    categoryFilter?: string;
}

const LibraryTab: React.FC<LibraryTabProps> = ({ categoryFilter }) => {
    const { user } = useAuth();
    const isAdmin   = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
    const canDelete  = user?.role === UserRole.MASTER_ADMIN;
    const canAdd     = isAdmin || user?.role === UserRole.MANAGER;

    const [showTrash,      setShowTrash]      = useState(false);

    const [resources,      setResources]      = useState<Resource[]>([]);
    const [loading,        setLoading]        = useState(true);
    const [searchQuery,    setSearchQuery]    = useState('');
    const [viewMode,       setViewMode]       = useState<'grid' | 'list'>('grid');
    const [currentFolder,  setCurrentFolder]  = useState<string | null>(null);

    // Article viewer + AI
    const [previewRes,    setPreviewRes]    = useState<Resource | null>(null);
    const [isEditing,     setIsEditing]     = useState(false);
    const [editorMode,    setEditorMode]    = useState<'split' | 'edit' | 'preview'>('split');
    const [showAi,        setShowAi]        = useState(false);
    const [aiQuery,       setAiQuery]       = useState('');
    const [aiResp,        setAiResp]        = useState('');
    const [aiLoading,     setAiLoading]     = useState(false);

    // Add modal
    const [addOpen,       setAddOpen]       = useState(false);
    const [newRes,        setNewRes]        = useState<Partial<Resource>>({ title: '', type: 'folder', category: categoryFilter || 'General', link: '' });
    const [uploadMode,    setUploadMode]    = useState(false);
    const [creating,      setCreating]      = useState(false);
    const [deleteTarget,  setDeleteTarget]  = useState<Resource | null>(null);
    const [viewDoc,       setViewDoc]       = useState<{ url: string; type: string; title: string; downloadUrl?: string } | null>(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            // Auto-purge expired trash (30+ days) silently on every load
            await AuthService.purgeExpiredTrashResources().catch(() => {});
            const data = await AuthService.getAllResources();
            setResources(data);
        } catch { toast.error('Failed to load library'); }
        finally { setLoading(false); }
    };

    const breadcrumbs = useMemo(() => {
        const path: Resource[] = [];
        let curr = currentFolder;
        const seen = new Set<string>();
        while (curr && !seen.has(curr)) {
            seen.add(curr);
            const f = resources.find(r => r.id === curr && !r.isDeleted);
            if (f) { path.unshift(f); curr = f.parentId || null; } else break;
        }
        return path;
    }, [currentFolder, resources]);

    // Active (non-deleted) resources
    const visible = useMemo(() => {
        let items = resources.filter(r => !r.isDeleted);
        if (categoryFilter) {
            items = items.filter(r => r.category === categoryFilter);
        }
        if (searchQuery.trim())
            return items.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));
        return items.filter(r => currentFolder ? r.parentId === currentFolder : !r.parentId);
    }, [resources, currentFolder, searchQuery, categoryFilter]);

    // Trashed resources
    const trashedItems = useMemo(() =>
        resources.filter(r => r.isDeleted),
        [resources]
    );

    // Days remaining before auto-purge
    const daysLeft = (deletedAt?: string): number => {
        if (!deletedAt) return 30;
        const diff = Date.now() - new Date(deletedAt).getTime();
        const daysElapsed = Math.floor(diff / (1000 * 60 * 60 * 24));
        return Math.max(0, 30 - daysElapsed);
    };

    const openRes = (res: Resource) => {
        if (res.type === 'folder') { setCurrentFolder(res.id); setSearchQuery(''); }
        else if (res.type === 'article') { setPreviewRes(res); setIsEditing(false); setShowAi(false); setAiResp(''); setAiQuery(''); }
        else setViewDoc({ url: res.link || '', type: res.type, title: res.title, downloadUrl: res.downloadUrl });
    };

    const askAI = async () => {
        if (!aiQuery.trim() || !previewRes) return;
        setAiLoading(true);
        try {
            const ctx = previewRes.content || `Link: ${previewRes.link}`;
            const resp = await AiService.researchConcept(previewRes.title, aiQuery, ctx);
            setAiResp(resp);
        } catch { toast.error('AI request failed'); }
        finally { setAiLoading(false); }
    };

    const createRes = async () => {
        if (!newRes.title?.trim()) { toast.error('Please enter a title'); return; }
        setCreating(true);
        try {
            const item: Resource = {
                id: '', title: newRes.title!, type: newRes.type as Resource['type'],
                category: newRes.category || 'General', link: newRes.link || '',
                fileId: newRes.fileId, downloadUrl: newRes.downloadUrl,
                content: newRes.content || '', parentId: currentFolder,
                updatedAt: new Date().toISOString().split('T')[0],
                fileSize: newRes.fileSize, createdBy: user?.uid, createdByName: user?.displayName,
            };
            await AuthService.addResource(item);
            await load();
            setAddOpen(false);
            setNewRes({ title: '', type: 'folder', category: 'General', link: '' });
            setUploadMode(false);
            toast.success('Resource created!');
        } catch (e: unknown) { 
            const error = e as Error;
            toast.error(error.message || 'Failed to create'); 
        }
        finally { setCreating(false); }
    };

    const saveArticle = async (content: string) => {
        if (!previewRes) return;
        const updated = { ...previewRes, content, updatedAt: new Date().toISOString().split('T')[0] };
        setPreviewRes(updated);
        setResources(prev => prev.map(r => r.id === updated.id ? updated : r));
        await AuthService.updateResource(updated);
        toast.success('Article saved');
    };

    const deleteRes = async (res: Resource) => {
        if (previewRes?.id === res.id) setPreviewRes(null);
        await AuthService.deleteResource(res.id);
        setResources(prev => prev.map(r => r.id === res.id
            ? { ...r, isDeleted: true, deletedAt: new Date().toISOString() }
            : r
        ));
        toast.success(`"${res.title}" moved to Trash`);
    };

    const restoreRes = async (res: Resource) => {
        await AuthService.restoreResource(res.id);
        setResources(prev => prev.map(r => r.id === res.id
            ? { ...r, isDeleted: false, deletedAt: undefined }
            : r
        ));
        toast.success(`"${res.title}" restored`);
    };

    const purgeRes = async (res: Resource) => {
        await AuthService.purgeResource(res.id);
        setResources(prev => prev.filter(r => r.id !== res.id));
        toast.success(`"${res.title}" permanently deleted`);
    };

    const emptyTrash = async () => {
        await Promise.all(trashedItems.map(r => AuthService.purgeResource(r.id)));
        setResources(prev => prev.filter(r => !r.isDeleted));
        toast.success('Trash emptied');
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-[var(--bg-surface)] border border-[var(--border)] p-3 rounded-xl">
                {/* Breadcrumbs / Trash title */}
                {showTrash ? (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowTrash(false)} className="p-1.5 rounded-lg hover:bg-[var(--accent-dim)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-heading)]"><ArrowLeft size={16} /></button>
                        <Trash2 size={16} className="text-[var(--color-danger)]" />
                        <span className="text-sm font-semibold text-[var(--color-danger)]">Recycle bin</span>
                        <span className="text-xs text-[var(--text-muted)] ml-1 tabular-nums">({trashedItems.length} {trashedItems.length !== 1 ? 'items' : 'item'})</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 overflow-x-auto max-w-full md:max-w-sm no-scrollbar">
                        <button
                            onClick={() => setCurrentFolder(null)}
                            className={`p-1.5 rounded-lg transition-colors ${!currentFolder ? 'text-[var(--text-heading)] bg-[var(--accent-dim)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'}`}
                        ><Home size={16} /></button>
                        {breadcrumbs.map((crumb, idx) => (
                            <div key={crumb.id} className="flex items-center">
                                <ChevronRight size={12} className="text-[var(--text-subtle)] mx-0.5" />
                                <button
                                    onClick={() => setCurrentFolder(crumb.id)}
                                    className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${idx === breadcrumbs.length - 1 ? 'text-[var(--text-heading)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'}`}
                                >{crumb.title}</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2 w-full md:w-auto">
                    {!showTrash && (
                        <div className="relative flex-1 md:w-56">
                            <Search className="absolute left-3 top-2.5 text-[var(--text-subtle)]" size={14} />
                            <input
                                type="text" value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search library..."
                                className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-heading)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--border-accent)]"
                            />
                        </div>
                    )}
                    {!showTrash && (
                        <div className="flex items-center bg-[var(--bg-main)] p-1 rounded-lg border border-[var(--border)]">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}><Grid size={14} /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}><List size={14} /></button>
                        </div>
                    )}
                    {canAdd && !showTrash && (
                        <button
                            onClick={() => setAddOpen(true)}
                            className="bg-[var(--accent)] hover:opacity-90 text-[var(--on-accent)] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-opacity"
                        ><Plus size={14} /> Add</button>
                    )}
                    {canDelete && !showTrash && (
                        <button
                            onClick={() => setShowTrash(true)}
                            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--color-danger)] transition-colors"
                        >
                            <Trash2 size={14} />
                            {trashedItems.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--color-danger)] text-white text-[9px] rounded-full flex items-center justify-center font-bold tabular-nums">{trashedItems.length}</span>
                            )}
                        </button>
                    )}
                    {canDelete && showTrash && trashedItems.length > 0 && (
                        <button
                            onClick={emptyTrash}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[rgba(224,112,122,0.1)] border border-[rgba(224,112,122,0.25)] text-[var(--color-danger)] hover:bg-[rgba(224,112,122,0.2)] transition-colors font-medium"
                        >
                            <Flame size={14} /> Empty trash
                        </button>
                    )}
                </div>
            </div>

            {/* ── TRASH VIEW (Master Admin only) ── */}
            {showTrash ? (
                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
                    <div className="px-5 py-3 bg-[rgba(224,112,122,0.06)] border-b border-[rgba(224,112,122,0.2)] flex items-center gap-2">
                        <AlertTriangle size={14} className="text-[var(--color-danger)]" />
                        <p className="text-xs text-[var(--color-danger)] font-medium">Items in the recycle bin are automatically permanently deleted after <strong>30 days</strong>.</p>
                    </div>
                    {trashedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                            <Trash2 size={40} className="mb-2 opacity-20" />
                            <p className="font-medium text-sm text-[var(--text-heading)]">Recycle bin is empty</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm text-[var(--text-heading)]">
                            <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] border-b border-[var(--border)] text-xs">
                                <tr>
                                    <th className="px-5 py-3 font-medium">Name</th>
                                    <th className="px-5 py-3 font-medium">Type</th>
                                    <th className="px-5 py-3 font-medium">Deleted</th>
                                    <th className="px-5 py-3 font-medium text-center">Auto-delete in</th>
                                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)] text-xs">
                                {trashedItems.map(res => {
                                    const days = daysLeft(res.deletedAt);
                                    return (
                                        <tr key={res.id} className="hover:bg-[var(--accent-dim)] transition-colors group">
                                            <td className="px-5 py-3 flex items-center gap-3">
                                                <div className="p-1.5 rounded-lg bg-[var(--bg-elevated)] opacity-60"><ResourceIcon type={res.type} size={15} /></div>
                                                <span className="font-medium text-[var(--text-muted)] line-through group-hover:no-underline">{res.title}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${TYPE_BADGE[res.type] || ''}`}>{res.type}</span>
                                            </td>
                                            <td className="px-5 py-3 text-[var(--text-muted)] tabular-nums">
                                                {res.deletedAt ? new Date(res.deletedAt).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-md tabular-nums ${
                                                    days <= 3 ? 'bg-[rgba(224,112,122,0.1)] text-[var(--color-danger)]' :
                                                    days <= 10 ? 'bg-[rgba(217,164,65,0.1)] text-[var(--color-warning)]' :
                                                    'bg-[var(--bg-main)] text-[var(--text-muted)]'
                                                }`}>{days}d</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => restoreRes(res)}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-[var(--accent-dim)] border border-[var(--border-accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors font-medium"
                                                    ><RotateCcw size={12} /> Restore</button>
                                                    <button
                                                        onClick={() => { setDeleteTarget(res); }}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-[rgba(224,112,122,0.1)] border border-[rgba(224,112,122,0.25)] text-[var(--color-danger)] hover:bg-[rgba(224,112,122,0.2)] transition-colors font-medium"
                                                    ><Trash2 size={12} /> Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                loading ? (
                    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
                ) : visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl bg-[var(--bg-surface)]">
                    <Folder size={44} className="mb-2 opacity-20" />
                    <p className="font-medium text-sm text-[var(--text-heading)]">Empty folder</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">No resources here yet.</p>
                    {canAdd && (
                        <button onClick={() => setAddOpen(true)} className="mt-4 px-4 py-1.5 bg-[var(--accent-dim)] border border-[var(--border-accent)] text-[var(--accent)] rounded-lg text-xs font-medium hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors">
                            Add first resource
                        </button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {visible.map((res) => (
                        <div
                            key={res.id} onClick={() => openRes(res)}
                            className="bg-[var(--bg-surface)] rounded-xl overflow-hidden group border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors cursor-pointer flex flex-col"
                        >
                            <div className="p-4 bg-[var(--bg-main)] border-b border-[var(--border)] relative">
                                <div className="flex justify-between items-start">
                                    <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                                        <ResourceIcon type={res.type} size={22} />
                                    </div>
                                    {canDelete && (
                                        <button
                                            onClick={e => { e.stopPropagation(); setDeleteTarget(res); }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[var(--accent-dim)] rounded-md text-[var(--text-muted)] hover:text-[var(--color-danger)] transition-colors"
                                        ><Trash2 size={14} /></button>
                                    )}
                                </div>
                                <h3 className="font-medium text-[var(--text-heading)] text-sm mt-3 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-[var(--accent)] transition-colors">{res.title}</h3>
                            </div>
                            <div className="p-3 bg-[var(--bg-surface)] flex-1 flex flex-col gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${TYPE_BADGE[res.type] || 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)]'}`}>{res.type}</span>
                                    {fmtSize(res.fileSize) && <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{fmtSize(res.fileSize)}</span>}
                                </div>
                                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                                    <span>{res.category || 'General'}</span>
                                    <span className="tabular-nums">{res.updatedAt}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
                    <table className="w-full text-left text-sm text-[var(--text-heading)]">
                        <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] border-b border-[var(--border)] text-xs">
                            <tr>
                                <th className="px-5 py-3 font-medium">Name</th>
                                <th className="px-5 py-3 font-medium">Category</th>
                                <th className="px-5 py-3 font-medium">Type</th>
                                <th className="px-5 py-3 font-medium">Size</th>
                                <th className="px-5 py-3 font-medium">Updated</th>
                                {canDelete && <th className="px-5 py-3 font-medium text-right">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-xs">
                            {visible.map(res => (
                                <tr key={res.id} onClick={() => openRes(res)} className="hover:bg-[var(--accent-dim)] transition-colors cursor-pointer group">
                                    <td className="px-5 py-3 flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-[var(--bg-elevated)]"><ResourceIcon type={res.type} size={15} /></div>
                                        <span className="font-medium text-[var(--text-heading)] group-hover:text-[var(--accent)] transition-colors">{res.title}</span>
                                    </td>
                                    <td className="px-5 py-3"><span className="bg-[var(--bg-main)] border border-[var(--border)] px-2 py-0.5 rounded text-xs text-[var(--text-muted)]">{res.category || '—'}</span></td>
                                    <td className="px-5 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${TYPE_BADGE[res.type] || ''}`}>{res.type}</span></td>
                                    <td className="px-5 py-3 text-[var(--text-muted)] tabular-nums">{fmtSize(res.fileSize) || '—'}</td>
                                    <td className="px-5 py-3 text-[var(--text-muted)] tabular-nums">{res.updatedAt}</td>
                                    {canDelete && (
                                        <td className="px-5 py-3 text-right">
                                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(res); }} className="text-[var(--text-muted)] hover:text-[var(--color-danger)] p-1.5 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
            )}

            {/* ── Add Modal ── */}
            {addOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
                    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-main)]">
                            <h3 className="text-base font-semibold text-[var(--text-heading)]">Add to {currentFolder ? 'folder' : 'library'}</h3>
                            <button onClick={() => setAddOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-heading)]"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Title</label>
                                <input className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-heading)] focus:border-[var(--border-accent)] outline-none" value={newRes.title} onChange={e => setNewRes({ ...newRes, title: e.target.value })} placeholder="Resource name..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Type</label>
                                    <select className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-heading)] focus:border-[var(--border-accent)] outline-none" value={newRes.type} onChange={e => setNewRes({ ...newRes, type: e.target.value as any })}>
                                        <option value="folder">Folder</option>
                                        <option value="article">Article / Note</option>
                                        <option value="pdf">PDF</option>
                                        <option value="doc">Word Doc</option>
                                        <option value="sheet">Excel Sheet</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Category</label>
                                    <input className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-heading)] focus:border-[var(--border-accent)] outline-none" value={newRes.category} onChange={e => setNewRes({ ...newRes, category: e.target.value })} placeholder="e.g. Audit, Tax" />
                                </div>
                            </div>
                            {newRes.type !== 'folder' && newRes.type !== 'article' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-medium text-[var(--text-muted)]">Source</label>
                                        <div className="flex bg-[var(--bg-main)] rounded-lg p-0.5 border border-[var(--border)]">
                                            <button type="button" onClick={() => setUploadMode(false)} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${!uploadMode ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)]'}`}>Link</button>
                                            <button type="button" onClick={() => setUploadMode(true)}  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${uploadMode  ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)]'}`}>Upload</button>
                                        </div>
                                    </div>
                                    {uploadMode ? (
                                        <FileUploader onUploadComplete={fd => setNewRes({ ...newRes, title: newRes.title || fd.name, link: fd.url, type: fd.type as any, fileId: fd.id, downloadUrl: StorageService.getDownloadUrl(fd.id), fileSize: (fd as any).size })} />
                                    ) : (
                                        <input className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-heading)] focus:border-[var(--border-accent)] outline-none" value={newRes.link} onChange={e => setNewRes({ ...newRes, link: e.target.value })} placeholder="https://..." />
                                    )}
                                </div>
                            )}
                            <button type="button" onClick={createRes} disabled={creating || !newRes.title?.trim()}
                                className="w-full bg-[var(--accent)] text-[var(--on-accent)] py-2 rounded-lg font-medium text-xs transition-opacity mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                                {creating && <Loader2 size={14} className="animate-spin" />}
                                {creating ? 'Creating...' : 'Create resource'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Modal ── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
                    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-main)]">
                            <h3 className="text-base font-semibold text-[var(--text-heading)]">Delete resource?</h3>
                        </div>
                        <div className="p-5">
                            <p className="text-[var(--text-muted)] text-sm mb-5">Are you sure you want to delete <span className="font-semibold text-[var(--text-heading)]">"{deleteTarget.title}"</span>? This cannot be undone.</p>
                            <div className="flex justify-end gap-2.5">
                                <button onClick={() => setDeleteTarget(null)} className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--accent-dim)] transition-colors">Cancel</button>
                                <button onClick={async () => { await deleteRes(deleteTarget); setDeleteTarget(null); }}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-danger)] text-white hover:opacity-90 transition-opacity">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Article Viewer/Editor ── */}
            {previewRes && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
                    <div className={`bg-[var(--bg-surface)] h-[88vh] rounded-xl flex flex-col shadow-2xl overflow-hidden border border-[var(--border)] transition-all duration-300 ${showAi ? 'w-[95%] max-w-7xl' : 'w-full max-w-5xl'}`}>
                        <div className="px-5 py-3 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-main)] shrink-0">
                            <div className="flex items-center gap-3">
                                <ResourceIcon type={previewRes.type} />
                                <h3 className="text-sm font-semibold text-[var(--text-heading)] max-w-md truncate">{previewRes.title}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {isAdmin && previewRes.type === 'article' && (
                                    <>
                                        <button onClick={() => { if (isEditing) saveArticle(previewRes.content || ''); setIsEditing(!isEditing); }}
                                            className={`px-3 py-1.5 rounded-lg text-xs border font-medium flex items-center gap-1.5 transition-colors ${isEditing ? 'bg-[var(--accent)] border-[var(--border-accent)] text-[var(--on-accent)]' : 'bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-heading)]'}`}>
                                            {isEditing ? <><Save size={13} /> Save</> : <><PenTool size={13} /> Edit</>}
                                        </button>
                                        {isEditing && (
                                            <div className="flex bg-[var(--bg-main)] rounded-lg p-0.5 border border-[var(--border)]">
                                                {(['edit', 'split', 'preview'] as const).map(m => (
                                                    <button key={m} onClick={() => setEditorMode(m)} className={`px-2 py-0.5 text-[11px] rounded transition-colors capitalize ${editorMode === m ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)]'}`}>{m}</button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                                <button onClick={() => setShowAi(!showAi)} className={`px-3 py-1.5 rounded-lg text-xs border font-medium flex items-center gap-1.5 transition-colors ${showAi ? 'bg-[var(--accent)] border-[var(--border-accent)] text-[var(--on-accent)]' : 'bg-[var(--bg-main)] border-[var(--border)] text-[var(--accent)]'}`}>
                                    <Sparkles size={13} /> AI
                                </button>
                                <button onClick={() => setPreviewRes(null)}><X size={18} className="text-[var(--text-muted)] hover:text-[var(--text-heading)]" /></button>
                            </div>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                            <div className={`flex-1 bg-[var(--bg-surface)] relative overflow-hidden ${showAi ? 'w-2/3' : 'w-full'}`}>
                                {previewRes.type === 'article' ? (
                                    isEditing ? (
                                        <div className="flex h-full">
                                            {(editorMode === 'edit' || editorMode === 'split') && (
                                                <div className={`${editorMode === 'split' ? 'w-1/2 border-r border-[var(--border)]' : 'w-full'} flex flex-col`}>
                                                    <div className="px-4 py-2 border-b border-[var(--border)] text-xs font-medium text-[var(--text-muted)]">Markdown</div>
                                                    <textarea
                                                        className="w-full flex-1 bg-[var(--bg-main)] p-4 text-[var(--text-heading)] font-mono text-xs outline-none resize-none"
                                                        value={previewRes.content || ''}
                                                        onChange={e => setPreviewRes({ ...previewRes, content: e.target.value })}
                                                        placeholder="Write markdown here..."
                                                    />
                                                </div>
                                            )}
                                            {(editorMode === 'preview' || editorMode === 'split') && (
                                                <div className={`${editorMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col overflow-y-auto custom-scrollbar`}>
                                                    <div className="px-4 py-2 border-b border-[var(--border)] text-xs font-medium text-[var(--text-muted)]">Preview</div>
                                                    <div className="p-5 prose max-w-none leading-relaxed text-sm text-[var(--text-heading)]" dangerouslySetInnerHTML={{ __html: renderMd(previewRes.content || '') }} />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-6 overflow-y-auto custom-scrollbar h-full">
                                            {previewRes.content
                                                ? <div className="prose max-w-none leading-relaxed text-sm text-[var(--text-heading)]" dangerouslySetInnerHTML={{ __html: renderMd(previewRes.content) }} />
                                                : <div className="text-center opacity-40 py-20 text-[var(--text-muted)]">No content yet.</div>
                                            }
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-3">
                                        <ResourceIcon type={previewRes.type} size={40} />
                                        <p className="text-base font-medium text-[var(--text-heading)]">{previewRes.title}</p>
                                        {previewRes.downloadUrl && (
                                            <a href={previewRes.downloadUrl} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
                                                <Download size={14} /> Download
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            {showAi && (
                                <div className="w-80 border-l border-[var(--border)] bg-[var(--bg-main)] flex flex-col">
                                    <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-surface)]"><h4 className="text-[var(--accent)] text-xs font-medium flex items-center gap-2"><Bot size={14} /> Research assistant</h4></div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                                        {aiResp && <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border)] text-xs text-[var(--text-heading)] whitespace-pre-wrap">{aiResp}</div>}
                                        {aiLoading && <div className="text-center py-4 text-[var(--accent)] text-xs animate-pulse">Analyzing...</div>}
                                    </div>
                                    <div className="p-3 border-t border-[var(--border)]">
                                        <div className="relative">
                                            <input className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-3 pr-9 py-1.5 text-xs text-[var(--text-heading)] focus:border-[var(--border-accent)] outline-none"
                                                placeholder="Ask AI..." value={aiQuery}
                                                onChange={e => setAiQuery(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && askAI()} />
                                            <button onClick={askAI} className="absolute right-1.5 top-1 p-1 bg-[var(--accent)] text-[var(--on-accent)] rounded-md hover:opacity-90"><Send size={12} /></button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <DocumentViewer isOpen={!!viewDoc} onClose={() => setViewDoc(null)}
                url={viewDoc?.url || ''} type={viewDoc?.type || 'file'}
                title={viewDoc?.title || ''} downloadUrl={viewDoc?.downloadUrl} />
        </div>
    );
};

export default LibraryTab;
