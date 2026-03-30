import React, { useState, useEffect, useMemo } from 'react';
import { Folder, FileText, Search, ExternalLink, Grid, List, BookOpen, Shield, Calculator, FileCheck, Users, Eye, X, Mail, Sparkles, Send, Bot, Plus, ChevronRight, Home, PenTool, Save, Trash2, ArrowLeft, Download, File, Loader2, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AiService } from '../services/ai';
import { useAuth } from '../context/AuthContext';
import { UserRole, Resource } from '../types';
import { AuthService } from '../services/firebase';
import { StorageService } from '../services/storage';
import { FileUploader } from '../components/common/FileUploader';
import { DocumentViewer } from '../components/common/DocumentViewer';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ResourceIcon = ({ type, size = 24, className = "" }: { type: string, size?: number, className?: string }) => {
    switch (type) {
        case 'folder': return <Folder className={`text-amber-400 ${className}`} size={size} />;
        case 'pdf': return <FileText className={`text-rose-400 ${className}`} size={size} />;
        case 'sheet': return <FileCheck className={`text-emerald-400 ${className}`} size={size} />;
        case 'doc': return <FileText className={`text-amber-400 ${className}`} size={size} />;
        case 'article': return <BookOpen className={`text-purple-400 ${className}`} size={size} />;
        case 'image': return <Eye className={`text-cyan-400 ${className}`} size={size} />;
        default: return <File className={`text-gray-400 ${className}`} size={size} />;
    }
};

const TYPE_BADGE_STYLES: Record<string, string> = {
    folder: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    pdf: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
    sheet: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    doc: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    article: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
    image: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
};

const formatFileSize = (bytes?: number): string | null => {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Basic markdown→HTML for article rendering */
const renderMarkdown = (text: string): string => {
    return DOMPurify.sanitize(marked.parse(text) as string);
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ResourcesPage: React.FC = () => {
    const { user } = useAuth();
    const [resources, setResources] = useState<Resource[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

    const [recentIds, setRecentIds] = useState<string[]>([]);
    useEffect(() => {
        setRecentIds(JSON.parse(localStorage.getItem('recentResources') || '[]'));
    }, []);

    // AI & Editor State
    const [previewResource, setPreviewResource] = useState<Resource | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editorMode, setEditorMode] = useState<'split' | 'edit' | 'preview'>('split');
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [isAiFloating, setIsAiFloating] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isResearching, setIsResearching] = useState(false);

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newResource, setNewResource] = useState<Partial<Resource>>({
        title: '', type: 'folder', category: 'General', link: ''
    });
    const [isUploadMode, setIsUploadMode] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [viewDoc, setViewDoc] = useState<{ url: string; type: string; title: string; downloadUrl?: string } | null>(null);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        const data = await AuthService.getAllResources();
        setResources(data);
    };

    // Breadcrumbs
    const breadcrumbs = useMemo(() => {
        const path: Resource[] = [];
        let curr = currentFolderId;
        const seen = new Set<string>();
        while (curr && !seen.has(curr)) {
            seen.add(curr);
            const folder = resources.find(r => r.id === curr);
            if (folder) {
                path.unshift(folder);
                curr = folder.parentId || null;
            } else break;
        }
        return path;
    }, [currentFolderId, resources]);

    // Sections
    const pinnedResources = useMemo(() => resources.filter(r => r.isPinned), [resources]);
    const recentlyViewed = useMemo(() => {
        return recentIds
            .map(id => resources.find(r => r.id === id))
            .filter((r): r is Resource => !!r);
    }, [recentIds, resources]);

    // Filtering
    const filteredResources = useMemo(() => {
        if (searchQuery.trim()) {
            return resources.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return resources.filter(r => (currentFolderId ? r.parentId === currentFolderId : !r.parentId));
    }, [resources, currentFolderId, searchQuery]);

    const handleOpenResource = (res: Resource) => {
        if (res.type !== 'folder') {
            const updatedRecent = [res.id, ...recentIds.filter(id => id !== res.id)].slice(0, 5);
            localStorage.setItem('recentResources', JSON.stringify(updatedRecent));
            setRecentIds(updatedRecent);
        }

        if (res.type === 'folder') {
            setCurrentFolderId(res.id);
            setSearchQuery('');
        } else if (res.type === 'article') {
            setPreviewResource(res);
            setIsEditing(false);
            setShowAiPanel(false);
            setAiResponse('');
            setAiQuery('');
        } else {
            // Route ALL non-article docs through DocumentViewer
            setViewDoc({
                url: res.link || '',
                type: res.type,
                title: res.title,
                downloadUrl: res.downloadUrl
            });
        }
    };

    const handleAskAI = async () => {
        if (!aiQuery.trim() || !previewResource) return;
        setIsResearching(true);
        const context = previewResource.content || `Link: ${previewResource.link}`;
        try {
            const response = await AiService.researchConcept(previewResource.title, aiQuery, context);
            setAiResponse(response);
        } catch (error) {
            toast.error("AI Request Failed");
        }
        setIsResearching(false);
    };

    // Fix #5: Convert form onSubmit to regular async function
    const handleAddResource = async () => {
        if (!newResource.title?.trim()) {
            toast.error('Please enter a title');
            return;
        }
        setIsCreating(true);
        try {
            const res: Resource = {
                id: '',
                title: newResource.title!,
                type: newResource.type as any,
                category: newResource.category || 'General',
                link: newResource.link || '',
                fileId: newResource.fileId,
                downloadUrl: newResource.downloadUrl,
                content: newResource.content || '',
                parentId: currentFolderId,
                updatedAt: new Date().toISOString().split('T')[0],
                fileSize: newResource.fileSize,
                createdBy: user?.uid,
                createdByName: user?.displayName,
                tags: newResource.tags || [],
                isPinned: newResource.isPinned || false,
            };
            await AuthService.addResource(res);
            await loadResources();
            setIsAddModalOpen(false);
            setNewResource({ title: '', type: 'folder', category: 'General', link: '' });
            setIsUploadMode(false);
            toast.success('Resource created successfully!');
        } catch (error: any) {
            toast.error(error.message || "Failed to create resource.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleSaveArticle = async (updatedContent: string) => {
        if (!previewResource) return;
        const updated = { ...previewResource, content: updatedContent, updatedAt: new Date().toISOString().split('T')[0] };
        setPreviewResource(updated);
        setResources(resources.map(r => r.id === updated.id ? updated : r));
        await AuthService.updateResource(updated);
    };

    // Fix #1: Delete now uses modal flow via deleteTarget
    const executeDelete = async (res: Resource) => {
        if (previewResource?.id === res.id) setPreviewResource(null);
        await AuthService.deleteResource(res.id);
        setResources(resources.filter(r => r.id !== res.id));
        toast.success(`"${res.title}" deleted`);
    };

    const togglePin = async (res: Resource, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = { ...res, isPinned: !res.isPinned };
        setResources(resources.map(r => r.id === res.id ? updated : r));
        await AuthService.updateResource(updated);
        toast.success(updated.isPinned ? 'Added to Pinned' : 'Removed from Pinned');
    };

    const getColorGradient = (id: string, type: string) => {
        if (type === 'folder') return 'from-amber-600/20 to-orange-400/10';
        const colors = [
            'from-blue-600/20 to-yellow-400/10',
            'from-purple-600/20 to-pink-400/10',
            'from-emerald-600/20 to-teal-400/10',
            'from-amber-600/20 to-yellow-400/10',
            'from-rose-600/20 to-red-400/10'
        ];
        return colors[id.charCodeAt(0) % colors.length];
    };

    // Helper for List View Gradient
    const getListGradient = (id: string, type: string) => {
        return getColorGradient(id, type).replace('from-', 'border-l-4 border-').split(' ')[0].replace('-600/20', '-500');
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading flex items-center gap-2">
                        <BookOpen className="text-purple-400" /> Knowledge Base
                    </h1>
                    <p className="text-sm text-gray-400">Centralized repository for documents, policies, and research.</p>
                </div>
                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER) && (
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 flex items-center shadow-lg shadow-brand-900/40 transition-all hover:-translate-y-0.5 border border-brand-500/30"
                    >
                        <Plus size={18} className="mr-2" /> Add Resource
                    </button>
                )}
            </div>

            {/* Controls & Breadcrumbs */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center glass-panel p-4 rounded-xl shrink-0">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 overflow-x-auto max-w-full md:max-w-md scrollbar-hide">
                    <button
                        onClick={() => setCurrentFolderId(null)}
                        className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${!currentFolderId ? 'text-white font-bold bg-white/10' : 'text-gray-400'}`}
                    >
                        <Home size={18} />
                    </button>
                    {breadcrumbs.map((crumb, idx) => (
                        <div key={crumb.id} className="flex items-center animate-in fade-in slide-in-from-left-2 duration-300">
                            <ChevronRight size={14} className="text-gray-600 mx-1" />
                            <button
                                onClick={() => setCurrentFolderId(crumb.id)}
                                className={`px-2 py-1 rounded hover:bg-white/10 whitespace-nowrap text-sm ${idx === breadcrumbs.length - 1 ? 'text-white font-bold' : 'text-gray-400'}`}
                            >
                                {crumb.title}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-lg bg-navy-800/50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-gray-100"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center bg-white/5 p-1 rounded-lg border border-white/10">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400'}`}>
                            <Grid size={16} />
                        </button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400'}`}>
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 space-y-8">
                {/* Pinned Section */}
                {!searchQuery && !currentFolderId && pinnedResources.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                             <Sparkles size={14} /> Pinned Resources
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {pinnedResources.map(res => (
                                <PinnedCard key={res.id} res={res} onOpen={() => handleOpenResource(res)} onPin={(e) => togglePin(res, e)} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Recently Viewed */}
                {!searchQuery && recentlyViewed.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                             <Clock size={14} /> Recently Viewed
                        </h2>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {recentlyViewed.map(res => (
                                <button 
                                    key={res.id}
                                    onClick={() => handleOpenResource(res)}
                                    className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-all min-w-[200px] shrink-0"
                                >
                                    <div className="p-2 rounded-lg bg-navy-800">
                                        <ResourceIcon type={res.type} size={18} />
                                    </div>
                                    <span className="text-sm font-medium text-gray-200 truncate">{res.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {!searchQuery && (
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                            {currentFolderId ? 'Folder Contents' : 'Library Contents'}
                        </h2>
                    )}
                    {filteredResources.length > 0 ? (
                        viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredResources.map((res, index) => {
                                const bgGradient = getColorGradient(res.id, res.type);
                                const sizeStr = formatFileSize(res.fileSize);
                                return (
                                    <div
                                        key={res.id}
                                        onClick={() => handleOpenResource(res)}
                                        className="glass-panel p-0 rounded-2xl overflow-hidden group border border-white/5 hover:border-white/20 transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/10 hover:-translate-y-1 cursor-pointer flex flex-col h-full"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className={`p-5 bg-gradient-to-br ${bgGradient} relative overflow-hidden`}>
                                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                                            <div className="relative z-10 flex justify-between items-start">
                                                <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg group-hover:scale-110 transition-transform duration-500">
                                                    <ResourceIcon type={res.type} size={28} className="text-white" />
                                                </div>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={(e) => togglePin(res, e)}
                                                        className={`p-2 rounded-lg transition-all backdrop-blur-md ${res.isPinned ? 'text-amber-400 bg-amber-500/20' : 'text-white/40 hover:text-white hover:bg-white/20 opacity-0 group-hover:opacity-100'}`}
                                                    >
                                                        <Sparkles size={16} fill={res.isPinned ? "currentColor" : "none"} />
                                                    </button>
                                                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(res); }}
                                                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-all backdrop-blur-md"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-white text-lg mt-4 leading-tight tracking-tight line-clamp-2 min-h-[3.5rem]">
                                                {res.title}
                                            </h3>
                                            {res.tags && res.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {res.tags.map(t => (
                                                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/60 border border-white/5 uppercase font-bold">{t}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-navy-900/40 backdrop-blur-sm flex-1 flex flex-col justify-end gap-2">
                                            {/* Type badge + size */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wide ${TYPE_BADGE_STYLES[res.type] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}>
                                                    {res.type}
                                                </span>
                                                {sizeStr && (
                                                    <span className="text-[10px] text-gray-500">{sizeStr}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-gray-400">
                                                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{res.category || 'General'}</span>
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span>{res.updatedAt}</span>
                                                    {res.createdByName && (
                                                        <span className="text-[10px] text-gray-500">by {res.createdByName}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="glass-panel rounded-xl overflow-hidden">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-navy-900/50 text-gray-400 border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4 font-heading">Name</th>
                                        <th className="px-6 py-4 font-heading">Category</th>
                                        <th className="px-6 py-4 font-heading">Type</th>
                                        <th className="px-6 py-4 font-heading">Size</th>
                                        <th className="px-6 py-4 font-heading">Updated</th>
                                        <th className="px-6 py-4 font-heading text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredResources.map(res => (
                                        <tr key={res.id} onClick={() => handleOpenResource(res)} className="hover:bg-white/5 transition-colors cursor-pointer group">
                                            <td className="px-6 py-4 flex items-center gap-3">
                                                <div className={`p-2 rounded-lg bg-white/5 ${getListGradient(res.id, res.type)}`}>
                                                    <ResourceIcon type={res.type} size={18} />
                                                </div>
                                                <div>
                                                    <span className="font-medium text-white group-hover:text-amber-300 transition-colors">{res.title}</span>
                                                    {res.createdByName && (
                                                        <div className="text-[10px] text-gray-500">by {res.createdByName}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4"><span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs">{res.category || '-'}</span></td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${TYPE_BADGE_STYLES[res.type] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}>
                                                    {res.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 text-xs">{formatFileSize(res.fileSize) || '—'}</td>
                                            <td className="px-6 py-4 text-gray-400 text-xs">{res.updatedAt}</td>
                                            <td className="px-6 py-4 text-right">
                                                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(res); }}
                                                        className="text-gray-500 hover:text-red-400 p-2 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-gray-500 animate-in fade-in zoom-in duration-500">
                        <Folder size={64} className="mb-4 opacity-10" />
                        <p className="text-lg font-medium text-gray-400">Empty Folder</p>
                        <p className="text-sm opacity-60">There are no resources here yet.</p>
                        {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER) && (
                            <button onClick={() => setIsAddModalOpen(true)} className="mt-6 px-6 py-2 bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 rounded-lg text-sm transition-colors border border-brand-500/20 font-bold">
                                Create New Resource
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>

            {/* ── Add Resource Modal (Fix #5: <div> instead of <form>) ── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-lg border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white font-heading">Add to {currentFolderId ? 'Current Folder' : 'Library Root'}</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Title</label>
                                <input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.title} onChange={e => setNewResource({ ...newResource, title: e.target.value })} placeholder="Resource Name..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Type</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.type} onChange={e => setNewResource({ ...newResource, type: e.target.value as any })}>
                                        <option value="folder">Folder</option>
                                        <option value="article">Article / Note</option>
                                        <option value="pdf">PDF Link</option>
                                        <option value="doc">Word Link</option>
                                        <option value="sheet">Excel Link</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Category</label>
                                    <input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.category} onChange={e => setNewResource({ ...newResource, category: e.target.value })} placeholder="e.g. Audit, Tax" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Tags (Comma separated)</label>
                                <input 
                                    className="w-full glass-input rounded-lg px-3 py-2 text-sm" 
                                    value={newResource.tags?.join(', ')} 
                                    onChange={e => setNewResource({ ...newResource, tags: e.target.value.split(',').map(s => s.trim()).filter(s => !!s) })} 
                                    placeholder="NFRS, VAT, TDS..." 
                                />
                            </div>
                            <div className="flex items-center gap-2 py-2">
                                <input 
                                    type="checkbox" 
                                    id="pin" 
                                    className="w-4 h-4 rounded bg-white/5 border-white/10 text-amber-500 focus:ring-amber-500"
                                    checked={newResource.isPinned}
                                    onChange={e => setNewResource({ ...newResource, isPinned: e.target.checked })}
                                />
                                <label htmlFor="pin" className="text-xs font-bold text-amber-400 uppercase cursor-pointer flex items-center gap-1">
                                    <Sparkles size={12} fill="currentColor" /> Pin to Highlights
                                </label>
                            </div>
                            {newResource.type !== 'folder' && newResource.type !== 'article' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase">Content Source</label>
                                        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                                            <button type="button" onClick={() => setIsUploadMode(false)} className={`px-3 py-1 text-xs rounded-md transition-all ${!isUploadMode ? 'bg-brand-500 text-white' : 'text-gray-400'}`}>Link</button>
                                            <button type="button" onClick={() => setIsUploadMode(true)} className={`px-3 py-1 text-xs rounded-md transition-all ${isUploadMode ? 'bg-brand-500 text-white' : 'text-gray-400'}`}>Upload</button>
                                        </div>
                                    </div>
                                    {isUploadMode ? (
                                        <FileUploader onUploadComplete={(fileData) => setNewResource({ ...newResource, title: newResource.title || fileData.name, link: fileData.url, type: fileData.type as any, fileId: fileData.id, downloadUrl: StorageService.getDownloadUrl(fileData.id), fileSize: (fileData as any).size })} />
                                    ) : (
                                        <input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.link} onChange={e => setNewResource({ ...newResource, link: e.target.value })} placeholder="https://..." />
                                    )}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={handleAddResource}
                                disabled={isCreating || !newResource.title?.trim()}
                                className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-all shadow-lg mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isCreating && <Loader2 size={16} className="animate-spin" />}
                                {isCreating ? 'Creating...' : 'Create Resource'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Article Viewer/Editor Modal (Fix #2: Markdown split view) ── */}
            {previewResource && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className={`glass-modal h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden transition-all duration-300 border border-white/10 ${showAiPanel ? 'w-[95%] max-w-7xl' : 'w-full max-w-6xl'}`}>
                        <div className="px-6 py-3 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
                            <div className="flex items-center space-x-3">
                                <ResourceIcon type={previewResource.type} className="text-white" />
                                <h3 className="text-lg font-bold text-white max-w-md truncate">{previewResource.title}</h3>
                            </div>
                            <div className="flex items-center space-x-2">
                                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && previewResource.type === 'article' && (
                                    <>
                                        <button onClick={() => { if (isEditing) handleSaveArticle(previewResource.content || ''); setIsEditing(!isEditing); }} className={`px-3 py-1.5 rounded-lg text-sm border ${isEditing ? 'bg-green-600 border-green-500 text-white' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                            {isEditing ? 'Save' : 'Edit'}
                                        </button>
                                        {isEditing && (
                                            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                                                <button onClick={() => setEditorMode('edit')} className={`px-2 py-1 text-[10px] rounded-md transition-all ${editorMode === 'edit' ? 'bg-brand-500 text-white' : 'text-gray-400'}`}>Edit</button>
                                                <button onClick={() => setEditorMode('split')} className={`px-2 py-1 text-[10px] rounded-md transition-all ${editorMode === 'split' ? 'bg-brand-500 text-white' : 'text-gray-400'}`}>Split</button>
                                                <button onClick={() => setEditorMode('preview')} className={`px-2 py-1 text-[10px] rounded-md transition-all ${editorMode === 'preview' ? 'bg-brand-500 text-white' : 'text-gray-400'}`}>Preview</button>
                                            </div>
                                        )}
                                    </>
                                )}
                                <button onClick={() => setShowAiPanel(!showAiPanel)} className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-2 ${showAiPanel ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-purple-300'}`}>
                                    <Sparkles size={14} /> AI
                                </button>
                                {showAiPanel && (
                                    <button onClick={() => setIsAiFloating(!isAiFloating)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10" title={isAiFloating ? "Dock AI Panel" : "Float AI Panel"}>
                                        <ExternalLink size={16} />
                                    </button>
                                )}
                                <button onClick={() => setPreviewResource(null)} className="p-1 text-gray-400 hover:text-white"><X size={24} /></button>
                            </div>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                            <div className={`flex-1 bg-navy-900 relative ${showAiPanel ? 'w-2/3' : 'w-full'} overflow-hidden`}>
                                {previewResource.type === 'article' ? (
                                    isEditing ? (
                                        <div className="flex h-full">
                                            {/* Editor pane */}
                                            {(editorMode === 'edit' || editorMode === 'split') && (
                                                <div className={`${editorMode === 'split' ? 'w-1/2 border-r border-white/10' : 'w-full'} flex flex-col`}>
                                                    <div className="px-4 py-2 bg-white/3 border-b border-white/10 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Markdown</div>
                                                    <textarea
                                                        className="w-full flex-1 bg-navy-950 p-6 text-gray-200 font-mono text-sm outline-none resize-none"
                                                        value={previewResource.content || ''}
                                                        onChange={(e) => setPreviewResource({ ...previewResource, content: e.target.value })}
                                                        placeholder="Write markdown here... (# Headings, **bold**, *italic*, - lists)"
                                                    />
                                                </div>
                                            )}
                                            {/* Preview pane */}
                                            {(editorMode === 'preview' || editorMode === 'split') && (
                                                <div className={`${editorMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col overflow-y-auto custom-scrollbar`}>
                                                    <div className="px-4 py-2 bg-white/3 border-b border-white/10 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Preview</div>
                                                    <div
                                                        className="p-6 prose prose-invert max-w-none leading-relaxed"
                                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(previewResource.content || '') }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-8 overflow-y-auto custom-scrollbar h-full">
                                            {previewResource.content ? (
                                                <div
                                                    className="prose prose-invert max-w-none leading-relaxed"
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(previewResource.content) }}
                                                />
                                            ) : (
                                                <div className="text-center opacity-50 py-20">No content.</div>
                                            )}
                                        </div>
                                    )
                                ) : (
                                    /* Fix #4: non-article should not be reachable here since handleOpenResource routes to DocumentViewer,
                                       but as a fallback, show download prompt */
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                                        <ResourceIcon type={previewResource.type} size={48} />
                                        <p className="text-lg font-semibold text-white">{previewResource.title}</p>
                                        <p className="text-sm text-gray-500">Cannot preview this file inline.</p>
                                        {previewResource.downloadUrl && (
                                            <a href={previewResource.downloadUrl} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all">
                                                <Download size={16} /> Download File
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            {showAiPanel && (
                                <div className={`${isAiFloating ? 'fixed bottom-8 right-8 w-80 h-[500px] rounded-2xl shadow-emerald-500/20 border-purple-500/30' : 'w-96 border-l border-white/10'} bg-navy-900 flex flex-col shadow-2xl relative z-10 transition-all duration-500 overflow-hidden`}>
                                    <div className="p-4 bg-purple-900/10 border-b border-white/10 flex justify-between items-center shrink-0">
                                        <h4 className="text-purple-300 font-bold flex items-center gap-2"><Bot size={16} /> AI Assistant</h4>
                                        {isAiFloating && (
                                            <button onClick={() => setShowAiPanel(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                        {aiResponse && <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-sm text-gray-200 whitespace-pre-wrap animate-in fade-in duration-300">{aiResponse}</div>}
                                        {isResearching && (
                                            <div className="flex flex-col items-center justify-center py-10 space-y-3 opacity-50">
                                                <Loader2 size={24} className="animate-spin text-purple-400" />
                                                <p className="text-[10px] uppercase font-black text-purple-300 tracking-wider">Analyzing Article...</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-white/10 bg-navy-950/50">
                                        <div className="relative">
                                            <input className="w-full bg-navy-800 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:border-purple-500 outline-none transition-all" placeholder="Ask AI..." value={aiQuery} onChange={e => setAiQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskAI()} />
                                            <button onClick={handleAskAI} className="absolute right-2 top-2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 scale-90 transition-transform active:scale-75"><Send size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal (Fix #1) ── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                            <h3 className="text-lg font-bold text-white">Delete resource?</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-300 text-sm mb-6">
                                Are you sure you want to delete <span className="font-bold text-white">"{deleteTarget.title}"</span>? This action cannot be undone.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => { await executeDelete(deleteTarget); setDeleteTarget(null); }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-900/30"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <DocumentViewer isOpen={!!viewDoc} onClose={() => setViewDoc(null)} url={viewDoc?.url || ''} type={viewDoc?.type || 'file'} title={viewDoc?.title || ''} downloadUrl={viewDoc?.downloadUrl} />
        </div>
    );
};

const PinnedCard = ({ res, onOpen, onPin }: { res: Resource, onOpen: () => void, onPin: (e: React.MouseEvent) => void }) => (
    <div 
        onClick={onOpen}
        className="glass-panel p-4 rounded-xl border border-amber-500/20 hover:border-amber-500/50 transition-all cursor-pointer group relative overflow-hidden"
    >
        <div className="absolute -right-4 -top-4 w-12 h-12 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
        <div className="flex items-start justify-between relative z-10">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <ResourceIcon type={res.type} size={20} />
            </div>
            <button onClick={onPin} className="text-amber-500/40 hover:text-amber-500 p-1 transition-colors">
                <Sparkles size={14} fill="currentColor" />
            </button>
        </div>
        <h4 className="mt-3 font-bold text-white text-sm line-clamp-1">{res.title}</h4>
        <p className="text-[10px] text-gray-500 uppercase mt-1">{res.category}</p>
    </div>
);

export default ResourcesPage;
