import React, { useState, useEffect, useMemo } from 'react';
import { Folder, FileText, Search, ExternalLink, Grid, List, BookOpen, Shield, Calculator, FileCheck, Users, Eye, X, Mail, Sparkles, Send, Bot, Plus, ChevronRight, Home, PenTool, Save, Trash2, ArrowLeft, Download, File } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AiService } from '../services/ai';
import { useAuth } from '../context/AuthContext';
import { UserRole, Resource } from '../types';
import { AuthService } from '../services/firebase';
import { StorageService } from '../services/storage';
import { FileUploader } from '../components/common/FileUploader';
import { DocumentViewer } from '../components/common/DocumentViewer';

const ResourceIcon = ({ type, size = 24, className = "" }: { type: string, size?: number, className?: string }) => {
    switch (type) {
        case 'folder': return <Folder className={`text-amber-400 ${className}`} size={size} />;
        case 'pdf': return <FileText className={`text-rose-400 ${className}`} size={size} />;
        case 'sheet': return <FileCheck className={`text-emerald-400 ${className}`} size={size} />;
        case 'doc': return <FileText className={`text-blue-400 ${className}`} size={size} />;
        case 'article': return <BookOpen className={`text-purple-400 ${className}`} size={size} />;
        case 'image': return <Eye className={`text-cyan-400 ${className}`} size={size} />;
        default: return <File className={`text-gray-400 ${className}`} size={size} />;
    }
};

const ResourcesPage: React.FC = () => {
    const { user } = useAuth();
    const [resources, setResources] = useState<Resource[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

    // AI & Editor State
    const [previewResource, setPreviewResource] = useState<Resource | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isResearching, setIsResearching] = useState(false);

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newResource, setNewResource] = useState<Partial<Resource>>({
        title: '', type: 'folder', category: 'General', link: ''
    });
    const [isUploadMode, setIsUploadMode] = useState(false);
    const [viewDoc, setViewDoc] = useState<{ url: string; type: string; title: string; downloadUrl?: string } | null>(null);

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

    // Filtering
    const filteredResources = useMemo(() => {
        if (searchQuery.trim()) {
            return resources.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return resources.filter(r => (currentFolderId ? r.parentId === currentFolderId : !r.parentId));
    }, [resources, currentFolderId, searchQuery]);

    const handleOpenResource = (res: Resource) => {
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

    const handleAddResource = async (e: React.FormEvent) => {
        e.preventDefault();
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
                updatedAt: new Date().toISOString().split('T')[0]
            };
            await AuthService.addResource(res);
            await loadResources();
            setIsAddModalOpen(false);
            setNewResource({ title: '', type: 'folder', category: 'General', link: '' });
            setIsUploadMode(false);
            toast.success('Resource created successfully!');
        } catch (error: any) {
            toast.error(error.message || "Failed to create resource.");
        }
    };

    const handleSaveArticle = async (updatedContent: string) => {
        if (!previewResource) return;
        const updated = { ...previewResource, content: updatedContent, updatedAt: new Date().toISOString().split('T')[0] };
        setPreviewResource(updated);
        setResources(resources.map(r => r.id === updated.id ? updated : r));
        await AuthService.updateResource(updated);
    };

    const handleDeleteResource = async (res: Resource) => {
        if (confirm(`Delete "${res.title}"?`)) {
            if (previewResource?.id === res.id) setPreviewResource(null);
            await AuthService.deleteResource(res.id);
            setResources(resources.filter(r => r.id !== res.id));
        }
    };

    const getColorGradient = (id: string, type: string) => {
        if (type === 'folder') return 'from-amber-600/20 to-orange-400/10';
        const colors = [
            'from-blue-600/20 to-cyan-400/10',
            'from-purple-600/20 to-pink-400/10',
            'from-emerald-600/20 to-teal-400/10',
            'from-indigo-600/20 to-violet-400/10',
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
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                {filteredResources.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredResources.map((res, index) => {
                                const bgGradient = getColorGradient(res.id, res.type);
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
                                                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteResource(res); }}
                                                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-all backdrop-blur-md"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-white text-lg mt-4 leading-tight tracking-tight line-clamp-2 min-h-[3.5rem]">
                                                {res.title}
                                            </h3>
                                        </div>
                                        <div className="p-4 bg-navy-900/40 backdrop-blur-sm flex-1 flex flex-col justify-end">
                                            <div className="flex items-center justify-between text-xs text-gray-400">
                                                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{res.category || 'General'}</span>
                                                <span>{res.updatedAt}</span>
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
                                                <span className="font-medium text-white group-hover:text-blue-300 transition-colors">{res.title}</span>
                                            </td>
                                            <td className="px-6 py-4"><span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs">{res.category || '-'}</span></td>
                                            <td className="px-6 py-4 capitalize text-gray-400 text-xs">{res.type}</td>
                                            <td className="px-6 py-4 text-gray-400 text-xs">{res.updatedAt}</td>
                                            <td className="px-6 py-4 text-right">
                                                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteResource(res); }}
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

            {/* Add Resource Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-lg border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white font-heading">Add to {currentFolderId ? 'Current Folder' : 'Library Root'}</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddResource} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Title</label>
                                <input required className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.title} onChange={e => setNewResource({ ...newResource, title: e.target.value })} placeholder="Resource Name..." />
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
                                        <FileUploader onUploadComplete={(fileData) => setNewResource({ ...newResource, title: newResource.title || fileData.name, link: fileData.url, type: fileData.type as any, fileId: fileData.id, downloadUrl: StorageService.getDownloadUrl(fileData.id) })} />
                                    ) : (
                                        <input required={!isUploadMode} className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.link} onChange={e => setNewResource({ ...newResource, link: e.target.value })} placeholder="https://..." />
                                    )}
                                </div>
                            )}
                            <button type="submit" className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-all shadow-lg mt-4">Create Resource</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Viewer/AI Modal (Preserved functionality, updated style) */}
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
                                    <button onClick={() => { if (isEditing) handleSaveArticle(previewResource.content || ''); setIsEditing(!isEditing); }} className={`px-3 py-1.5 rounded-lg text-sm border ${isEditing ? 'bg-green-600 border-green-500 text-white' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                        {isEditing ? 'Save' : 'Edit'}
                                    </button>
                                )}
                                <button onClick={() => setShowAiPanel(!showAiPanel)} className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-2 ${showAiPanel ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-purple-300'}`}>
                                    <Sparkles size={14} /> AI
                                </button>
                                <button onClick={() => setPreviewResource(null)}><X size={24} className="text-gray-400 hover:text-white" /></button>
                            </div>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                            <div className={`flex-1 bg-navy-900 relative ${showAiPanel ? 'w-2/3' : 'w-full'} overflow-y-auto custom-scrollbar`}>
                                {previewResource.type === 'article' ? (
                                    isEditing ? (
                                        <textarea className="w-full h-full bg-navy-950 p-8 text-gray-200 font-mono outline-none resize-none" value={previewResource.content || ''} onChange={(e) => setPreviewResource({ ...previewResource, content: e.target.value })} />
                                    ) : (
                                        <div className="p-8 prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap leading-relaxed">
                                            {previewResource.content || <div className="text-center opacity-50 py-20">No content.</div>}
                                        </div>
                                    )
                                ) : (
                                    <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewResource.link || '')}&embedded=true`} className="w-full h-full border-none" title="Preview" />
                                )}
                            </div>
                            {showAiPanel && (
                                <div className="w-96 border-l border-white/10 bg-navy-900 flex flex-col shadow-2xl relative z-10">
                                    <div className="p-4 bg-purple-900/10 border-b border-white/10"><h4 className="text-purple-300 font-bold flex items-center gap-2"><Bot size={16} /> Research Assistant</h4></div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {aiResponse && <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-sm text-gray-200 whitespace-pre-wrap">{aiResponse}</div>}
                                        {isResearching && <div className="text-center py-4 text-purple-400 text-xs animate-pulse">Analyzing content...</div>}
                                    </div>
                                    <div className="p-4 border-t border-white/10">
                                        <div className="relative">
                                            <input className="w-full bg-navy-800 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:border-purple-500 outline-none" placeholder="Ask AI..." value={aiQuery} onChange={e => setAiQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskAI()} />
                                            <button onClick={handleAskAI} className="absolute right-2 top-2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500"><Send size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <DocumentViewer isOpen={!!viewDoc} onClose={() => setViewDoc(null)} url={viewDoc?.url || ''} type={viewDoc?.type || 'file'} title={viewDoc?.title || ''} downloadUrl={viewDoc?.downloadUrl} />
        </div>
    );
};

export default ResourcesPage;
