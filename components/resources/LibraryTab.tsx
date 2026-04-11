import React, { useState, useEffect, useMemo } from 'react';
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
    const html = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-white mt-4 mb-2">$1</h3>')
        .replace(/^## (.+)$/gm,  '<h2 class="text-xl font-bold text-white mt-5 mb-2">$1</h2>')
        .replace(/^# (.+)$/gm,   '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
        .replace(/\*(.+?)\*/g,   '<em>$1</em>')
        .replace(/^- (.+)$/gm,   '<li class="ml-4 list-disc text-gray-300">$1</li>')
        .replace(/\n\n/g, '</p><p class="mb-3 text-gray-300">')
        .replace(/\n/g, '<br/>');
    return `<p class="mb-3 text-gray-300">${html}</p>`;
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
            <div className="flex flex-col md:flex-row gap-3 justify-between items-center glass-panel p-3 rounded-xl">
                {/* Breadcrumbs / Trash title */}
                {showTrash ? (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowTrash(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400"><ArrowLeft size={16} /></button>
                        <Trash2 size={16} className="text-red-400" />
                        <span className="text-sm font-bold text-red-300">Recycle Bin</span>
                        <span className="text-xs text-gray-500 ml-1">({trashedItems.length} item{trashedItems.length !== 1 ? 's' : ''})</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 overflow-x-auto max-w-full md:max-w-sm no-scrollbar">
                        <button
                            onClick={() => setCurrentFolder(null)}
                            className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${!currentFolder ? 'text-white bg-white/10' : 'text-gray-400'}`}
                        ><Home size={16} /></button>
                        {breadcrumbs.map((crumb, idx) => (
                            <div key={crumb.id} className="flex items-center">
                                <ChevronRight size={12} className="text-gray-600 mx-0.5" />
                                <button
                                    onClick={() => setCurrentFolder(crumb.id)}
                                    className={`px-2 py-1 rounded text-xs hover:bg-white/10 whitespace-nowrap transition-colors ${idx === breadcrumbs.length - 1 ? 'text-white font-bold' : 'text-gray-400'}`}
                                >{crumb.title}</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2 w-full md:w-auto">
                    {!showTrash && (
                        <div className="relative flex-1 md:w-56">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                            <input
                                type="text" value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search library..."
                                className="w-full pl-9 pr-3 py-2 bg-transparent border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                        </div>
                    )}
                    {!showTrash && (
                        <div className="flex items-center bg-white/5 p-1 rounded-lg border border-white/10">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400'}`}><Grid size={15} /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400'}`}><List size={15} /></button>
                        </div>
                    )}
                    {canAdd && !showTrash && (
                        <button
                            onClick={() => setAddOpen(true)}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all"
                        ><Plus size={14} /> Add</button>
                    )}
                    {canDelete && !showTrash && (
                        <button
                            onClick={() => setShowTrash(true)}
                            className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-white/10 bg-white/5 text-gray-400 hover:text-red-300 hover:border-red-500/30 transition-all"
                        >
                            <Trash2 size={14} />
                            {trashedItems.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{trashedItems.length}</span>
                            )}
                        </button>
                    )}
                    {canDelete && showTrash && trashedItems.length > 0 && (
                        <button
                            onClick={emptyTrash}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/40 transition-all font-bold"
                        >
                            <Flame size={14} /> Empty Trash
                        </button>
                    )}
                </div>
            </div>

            {/* ── TRASH VIEW (Master Admin only) ── */}
            {showTrash ? (
                <div className="glass-panel rounded-xl overflow-hidden animate-in fade-in duration-200">
                    <div className="px-5 py-3 bg-red-900/10 border-b border-red-500/20 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-400" />
                        <p className="text-xs text-red-300 font-medium">Items in the Recycle Bin are automatically permanently deleted after <strong>30 days</strong>.</p>
                    </div>
                    {trashedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                            <Trash2 size={48} className="mb-3 opacity-10" />
                            <p className="font-medium text-gray-400">Recycle Bin is empty</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm text-gray-300">
                            <thead className="bg-red-900/10 text-gray-400 border-b border-white/10">
                                <tr>
                                    <th className="px-5 py-3 font-semibold">Name</th>
                                    <th className="px-5 py-3 font-semibold">Type</th>
                                    <th className="px-5 py-3 font-semibold">Deleted</th>
                                    <th className="px-5 py-3 font-semibold text-center">Auto-delete in</th>
                                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {trashedItems.map(res => {
                                    const days = daysLeft(res.deletedAt);
                                    return (
                                        <tr key={res.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-5 py-3 flex items-center gap-3">
                                                <div className="p-1.5 rounded-lg bg-white/5 opacity-50"><ResourceIcon type={res.type} size={16} /></div>
                                                <span className="font-medium text-gray-400 line-through group-hover:no-underline">{res.title}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${TYPE_BADGE[res.type] || ''}`}>{res.type}</span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-500 text-xs">
                                                {res.deletedAt ? new Date(res.deletedAt).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                    days <= 3 ? 'bg-red-500/20 text-red-300' :
                                                    days <= 10 ? 'bg-amber-500/20 text-amber-300' :
                                                    'bg-white/10 text-gray-400'
                                                }`}>{days}d</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => restoreRes(res)}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-brand-500/20 border border-brand-500/30 text-brand-300 hover:bg-brand-500/40 transition-all font-bold"
                                                    ><RotateCcw size={12} /> Restore</button>
                                                    <button
                                                        onClick={() => { setDeleteTarget(res); }}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/40 transition-all font-bold"
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
                    <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-purple-400" /></div>
                ) : visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Folder size={52} className="mb-3 opacity-10" />
                    <p className="font-medium text-gray-400">Empty folder</p>
                    <p className="text-sm opacity-60">No resources here yet.</p>
                    {canAdd && (
                        <button onClick={() => setAddOpen(true)} className="mt-4 px-5 py-2 bg-purple-600/20 border border-purple-500/20 text-purple-300 rounded-lg text-sm font-bold hover:bg-purple-600/30 transition-colors">
                            Add First Resource
                        </button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {visible.map((res, i) => (
                        <div
                            key={res.id} onClick={() => openRes(res)}
                            className="glass-panel p-0 rounded-2xl overflow-hidden group border border-white/5 hover:border-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 cursor-pointer flex flex-col"
                            style={{ animationDelay: `${i * 40}ms` }}
                        >
                            <div className={`p-5 bg-gradient-to-br ${colorFor(res.id, res.type)} relative overflow-hidden`}>
                                <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="p-3 rounded-xl bg-white/10 border border-white/20 group-hover:scale-110 transition-transform duration-300">
                                        <ResourceIcon type={res.type} size={26} />
                                    </div>
                                    {canDelete && (
                                        <button
                                            onClick={e => { e.stopPropagation(); setDeleteTarget(res); }}
                                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-all"
                                        ><Trash2 size={15} /></button>
                                    )}
                                </div>
                                <h3 className="font-bold text-white text-base mt-3 leading-tight line-clamp-2 min-h-[2.8rem]">{res.title}</h3>
                            </div>
                            <div className="p-3 bg-navy-900/40 backdrop-blur-sm flex-1 flex flex-col gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wide ${TYPE_BADGE[res.type] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}>{res.type}</span>
                                    {fmtSize(res.fileSize) && <span className="text-[10px] text-gray-500">{fmtSize(res.fileSize)}</span>}
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-gray-500">
                                    <span>{res.category || 'General'}</span>
                                    <span>{res.updatedAt}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-panel rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-navy-900/50 text-gray-400 border-b border-white/10">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Name</th>
                                <th className="px-5 py-3 font-semibold">Category</th>
                                <th className="px-5 py-3 font-semibold">Type</th>
                                <th className="px-5 py-3 font-semibold">Size</th>
                                <th className="px-5 py-3 font-semibold">Updated</th>
                                {canDelete && <th className="px-5 py-3 font-semibold text-right">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {visible.map(res => (
                                <tr key={res.id} onClick={() => openRes(res)} className="hover:bg-white/5 transition-colors cursor-pointer group">
                                    <td className="px-5 py-3 flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-white/5"><ResourceIcon type={res.type} size={16} /></div>
                                        <span className="font-medium text-white group-hover:text-purple-300 transition-colors">{res.title}</span>
                                    </td>
                                    <td className="px-5 py-3"><span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-xs">{res.category || '—'}</span></td>
                                    <td className="px-5 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${TYPE_BADGE[res.type] || ''}`}>{res.type}</span></td>
                                    <td className="px-5 py-3 text-gray-400 text-xs">{fmtSize(res.fileSize) || '—'}</td>
                                    <td className="px-5 py-3 text-gray-400 text-xs">{res.updatedAt}</td>
                                    {canDelete && (
                                        <td className="px-5 py-3 text-right">
                                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(res); }} className="text-gray-500 hover:text-red-400 p-1.5 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={15} /></button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-lg border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">Add to {currentFolder ? 'Folder' : 'Library'}</h3>
                            <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Title</label>
                                <input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newRes.title} onChange={e => setNewRes({ ...newRes, title: e.target.value })} placeholder="Resource Name..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Type</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newRes.type} onChange={e => setNewRes({ ...newRes, type: e.target.value as any })}>
                                        <option value="folder">Folder</option>
                                        <option value="article">Article / Note</option>
                                        <option value="pdf">PDF</option>
                                        <option value="doc">Word Doc</option>
                                        <option value="sheet">Excel Sheet</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Category</label>
                                    <input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newRes.category} onChange={e => setNewRes({ ...newRes, category: e.target.value })} placeholder="e.g. Audit, Tax" />
                                </div>
                            </div>
                            {newRes.type !== 'folder' && newRes.type !== 'article' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase">Source</label>
                                        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                                            <button type="button" onClick={() => setUploadMode(false)} className={`px-3 py-1 text-xs rounded-md transition-all ${!uploadMode ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Link</button>
                                            <button type="button" onClick={() => setUploadMode(true)}  className={`px-3 py-1 text-xs rounded-md transition-all ${uploadMode  ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Upload</button>
                                        </div>
                                    </div>
                                    {uploadMode ? (
                                        <FileUploader onUploadComplete={fd => setNewRes({ ...newRes, title: newRes.title || fd.name, link: fd.url, type: fd.type as any, fileId: fd.id, downloadUrl: StorageService.getDownloadUrl(fd.id), fileSize: (fd as any).size })} />
                                    ) : (
                                        <input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newRes.link} onChange={e => setNewRes({ ...newRes, link: e.target.value })} placeholder="https://..." />
                                    )}
                                </div>
                            )}
                            <button type="button" onClick={createRes} disabled={creating || !newRes.title?.trim()}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-lg font-bold transition-all mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                                {creating && <Loader2 size={15} className="animate-spin" />}
                                {creating ? 'Creating...' : 'Create Resource'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Modal ── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                            <h3 className="text-lg font-bold text-white">Delete resource?</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-300 text-sm mb-6">Are you sure you want to delete <span className="font-bold text-white">"{deleteTarget.title}"</span>? This cannot be undone.</p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all">Cancel</button>
                                <button onClick={async () => { await deleteRes(deleteTarget); setDeleteTarget(null); }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-900/30">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Article Viewer/Editor ── */}
            {previewRes && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className={`glass-modal h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-white/10 transition-all duration-300 ${showAi ? 'w-[95%] max-w-7xl' : 'w-full max-w-6xl'}`}>
                        <div className="px-6 py-3 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
                            <div className="flex items-center gap-3">
                                <ResourceIcon type={previewRes.type} />
                                <h3 className="text-lg font-bold text-white max-w-md truncate">{previewRes.title}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {isAdmin && previewRes.type === 'article' && (
                                    <>
                                        <button onClick={() => { if (isEditing) saveArticle(previewRes.content || ''); setIsEditing(!isEditing); }}
                                            className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1.5 ${isEditing ? 'bg-green-600 border-green-500 text-white' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                            {isEditing ? <><Save size={13} /> Save</> : <><PenTool size={13} /> Edit</>}
                                        </button>
                                        {isEditing && (
                                            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                                                {(['edit', 'split', 'preview'] as const).map(m => (
                                                    <button key={m} onClick={() => setEditorMode(m)} className={`px-2 py-1 text-[10px] rounded-md transition-all capitalize ${editorMode === m ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>{m}</button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                                <button onClick={() => setShowAi(!showAi)} className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1.5 ${showAi ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-purple-300'}`}>
                                    <Sparkles size={13} /> AI
                                </button>
                                <button onClick={() => setPreviewRes(null)}><X size={22} className="text-gray-400 hover:text-white" /></button>
                            </div>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                            <div className={`flex-1 bg-navy-900 relative overflow-hidden ${showAi ? 'w-2/3' : 'w-full'}`}>
                                {previewRes.type === 'article' ? (
                                    isEditing ? (
                                        <div className="flex h-full">
                                            {(editorMode === 'edit' || editorMode === 'split') && (
                                                <div className={`${editorMode === 'split' ? 'w-1/2 border-r border-white/10' : 'w-full'} flex flex-col`}>
                                                    <div className="px-4 py-2 border-b border-white/10 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Markdown</div>
                                                    <textarea
                                                        className="w-full flex-1 bg-navy-950 p-6 text-gray-200 font-mono text-sm outline-none resize-none"
                                                        value={previewRes.content || ''}
                                                        onChange={e => setPreviewRes({ ...previewRes, content: e.target.value })}
                                                        placeholder="Write markdown here..."
                                                    />
                                                </div>
                                            )}
                                            {(editorMode === 'preview' || editorMode === 'split') && (
                                                <div className={`${editorMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col overflow-y-auto custom-scrollbar`}>
                                                    <div className="px-4 py-2 border-b border-white/10 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Preview</div>
                                                    <div className="p-6 prose prose-invert max-w-none leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMd(previewRes.content || '') }} />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-8 overflow-y-auto custom-scrollbar h-full">
                                            {previewRes.content
                                                ? <div className="prose prose-invert max-w-none leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMd(previewRes.content) }} />
                                                : <div className="text-center opacity-40 py-20">No content yet.</div>
                                            }
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                                        <ResourceIcon type={previewRes.type} size={48} />
                                        <p className="text-lg font-semibold text-white">{previewRes.title}</p>
                                        {previewRes.downloadUrl && (
                                            <a href={previewRes.downloadUrl} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all">
                                                <Download size={16} /> Download
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            {showAi && (
                                <div className="w-80 border-l border-white/10 bg-navy-900 flex flex-col">
                                    <div className="p-4 bg-purple-900/10 border-b border-white/10"><h4 className="text-purple-300 font-bold flex items-center gap-2"><Bot size={15} /> Research Assistant</h4></div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {aiResp && <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-sm text-gray-200 whitespace-pre-wrap">{aiResp}</div>}
                                        {aiLoading && <div className="text-center py-4 text-purple-400 text-xs animate-pulse">Analyzing...</div>}
                                    </div>
                                    <div className="p-4 border-t border-white/10">
                                        <div className="relative">
                                            <input className="w-full bg-navy-800 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                                                placeholder="Ask AI..." value={aiQuery}
                                                onChange={e => setAiQuery(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && askAI()} />
                                            <button onClick={askAI} className="absolute right-2 top-1.5 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500"><Send size={13} /></button>
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
