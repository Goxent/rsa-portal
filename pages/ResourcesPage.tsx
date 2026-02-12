import React, { useState, useEffect, useMemo } from 'react';
import { Folder, FileText, Search, ExternalLink, Grid, List, BookOpen, Shield, Calculator, FileCheck, Users, Eye, X, Mail, Sparkles, Send, Bot, Plus, ChevronRight, Home, PenTool, Save, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AIService } from '../services/ai';
import { useAuth } from '../context/AuthContext';
import { UserRole, Resource } from '../types';
import { AuthService } from '../services/firebase';
import { StorageService } from '../services/storage';
import { FileUploader } from '../components/common/FileUploader';
import { DocumentViewer } from '../components/common/DocumentViewer';

// Helper Icon Component
const ResourceIcon = ({ type, size = 40 }: { type: string, size?: number }) => {
    switch (type) {
        case 'folder': return <Folder className="text-yellow-400 fill-yellow-400/20" size={size} />;
        case 'pdf': return <FileText className="text-red-400" size={size} />;
        case 'sheet': return <FileText className="text-green-400" size={size} />;
        case 'doc': return <FileText className="text-blue-400" size={size} />;
        case 'article': return <BookOpen className="text-purple-400" size={size} />;
        default: return <FileText className="text-gray-400" size={size} />;
    }
};

const ResourcesPage: React.FC = () => {
    const { user } = useAuth();
    const [resources, setResources] = useState<Resource[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Navigation State
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

    // Viewer/Editor State
    const [previewResource, setPreviewResource] = useState<Resource | null>(null);
    const [isEditing, setIsEditing] = useState(false); // True if editing an article

    // AI Chat State
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isResearching, setIsResearching] = useState(false);

    // Add Resource Modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newResource, setNewResource] = useState<Partial<Resource>>({
        title: '', type: 'folder', category: 'General', link: ''
    });

    // File Upload State
    const [isUploadMode, setIsUploadMode] = useState(false);
    const [viewDoc, setViewDoc] = useState<{ url: string; type: string; title: string; downloadUrl?: string } | null>(null);

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        const data = await AuthService.getAllResources();
        setResources(data);
    };

    // Breadcrumb Logic
    const breadcrumbs = useMemo(() => {
        const path: Resource[] = [];
        let curr = currentFolderId;
        // Prevent infinite loops if cycle exists (should not happen but safety first)
        const seen = new Set<string>();

        while (curr && !seen.has(curr)) {
            seen.add(curr);
            const folder = resources.find(r => r.id === curr);
            if (folder) {
                path.unshift(folder);
                curr = folder.parentId || null;
            } else {
                break;
            }
        }
        return path;
    }, [currentFolderId, resources]);

    // Filtering
    const filteredResources = useMemo(() => {
        if (searchQuery.trim()) {
            // If searching, search EVERYTHING (ignore folder depth)
            return resources.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        // Otherwise, show only current folder contents
        return resources.filter(r => {
            if (currentFolderId) {
                return r.parentId === currentFolderId;
            } else {
                // Root: parentId is null OR undefined OR empty string
                return !r.parentId;
            }
        });
    }, [resources, currentFolderId, searchQuery]);

    const handleOpenResource = (res: Resource) => {
        if (res.type === 'folder') {
            setCurrentFolderId(res.id);
            setSearchQuery(''); // Clear search on navigation
        } else if (res.type === 'article') {
            setPreviewResource(res);
            setIsEditing(false);
            setShowAiPanel(false);
            setAiResponse('');
            setAiQuery('');
        } else {
            // Use DocumentViewer for files/links
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
        // Pass content OR link as context
        const contentContext = previewResource.content || `Link to document: ${previewResource.link}`;
        const response = await AIService.researchConcept(previewResource.title, aiQuery, contentContext);
        setAiResponse(response);
        setIsResearching(false);
    };

    const handleAddResource = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res: Resource = {
                id: '', // Generated by Firebase
                title: newResource.title!,
                type: newResource.type as any,
                category: newResource.category || 'General',
                link: newResource.link || '',
                fileId: newResource.fileId,
                downloadUrl: newResource.downloadUrl,
                content: newResource.content || '',
                parentId: currentFolderId, // Add to current folder
                updatedAt: new Date().toISOString().split('T')[0]
            };

            await AuthService.addResource(res);
            await loadResources();
            setIsAddModalOpen(false);
            setNewResource({ title: '', type: 'folder', category: 'General', link: '' });
            setIsUploadMode(false);
            toast.success('Resource created successfully!');
        } catch (error: any) {
            console.error("Failed to create resource:", error);
            toast.error(error.message || "Failed to create resource. Check your permissions.");
        }
    };

    const handleSaveArticle = async (updatedContent: string) => {
        if (!previewResource) return;

        const updated: Resource = {
            ...previewResource,
            content: updatedContent,
            updatedAt: new Date().toISOString().split('T')[0]
        };

        // Optimistic update
        setPreviewResource(updated);
        setResources(resources.map(r => r.id === updated.id ? updated : r));

        try {
            await AuthService.updateResource(updated);
        } catch (error) {
            console.error("Failed to save article", error);
            alert("Failed to save changes. Please try again.");
            // Revert optimistic update? For now assume it works.
        }
    };

    const handleDeleteResource = async (res: Resource) => {
        if (confirm(`Are you sure you want to delete "${res.title}"?`)) {
            if (previewResource?.id === res.id) setPreviewResource(null);

            try {
                await AuthService.deleteResource(res.id);
                // Optimistic delete
                setResources(resources.filter(r => r.id !== res.id));
            } catch (error) {
                console.error("Failed to delete", error);
            }
        }
    };

    return (
        <div className="flex h-full gap-6 animate-in fade-in duration-500">
            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header / Controls */}
                <div className="glass-panel p-4 rounded-2xl mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center space-x-2 overflow-x-auto max-w-full md:max-w-2xl scrollbar-hide">
                        <button
                            onClick={() => setCurrentFolderId(null)}
                            className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${!currentFolderId ? 'text-white font-bold bg-white/10' : 'text-gray-400'}`}
                            title="Home"
                        >
                            <Home size={20} />
                        </button>
                        {breadcrumbs.map((crumb, idx) => (
                            <div key={crumb.id} className="flex items-center animate-in fade-in slide-in-from-left-2 duration-300">
                                <ChevronRight size={16} className="text-gray-600 mx-1" />
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
                        <div className="relative flex-1 md:w-64 group">
                            <Search className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                            <input
                                className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm"
                                placeholder="Search in all folders..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER) && (
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center shrink-0 transition-transform hover:scale-105 active:scale-95"
                            >
                                <Plus size={16} className="mr-2" /> New
                            </button>
                        )}
                        <DocumentViewer
                            isOpen={!!viewDoc}
                            onClose={() => setViewDoc(null)}
                            url={viewDoc?.url || ''}
                            type={viewDoc?.type || 'file'}
                            title={viewDoc?.title || ''}
                            downloadUrl={viewDoc?.downloadUrl}
                        />
                        <div className="flex items-center space-x-1 bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}><Grid size={18} /></button>
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}><List size={18} /></button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredResources.length > 0 ? (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
                                {filteredResources.map(res => (
                                    <div key={res.id} onClick={() => handleOpenResource(res)}
                                        className={`glass-panel p-5 rounded-xl group hover:bg-white/10 transition-all cursor-pointer border border-white/5 hover:border-blue-500/30 flex flex-col relative animate-in fade-in zoom-in duration-300 ${res.type === 'folder' ? 'bg-white/[0.02]' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <ResourceIcon type={res.type} />
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 absolute top-4 right-4 bg-black/50 rounded-lg p-1 backdrop-blur-sm">
                                                {res.type !== 'folder' && <div className="p-1"><Eye size={14} className="text-gray-300" /></div>}
                                                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteResource(res); }}
                                                        className="p-1 hover:text-red-400 text-gray-300 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-200 mb-1 group-hover:text-blue-300 transition-colors line-clamp-2">{res.title}</h3>
                                        <div className="mt-auto flex justify-between items-center text-[10px] text-gray-500 pt-3">
                                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5 truncate max-w-[50%]">{res.category || 'General'}</span>
                                            <span>{res.updatedAt}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="glass-panel rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-300">
                                <table className="w-full text-left text-sm text-gray-300">
                                    <thead className="bg-white/5 text-gray-400 uppercase text-xs border-b border-white/10">
                                        <tr>
                                            <th className="px-6 py-4">Name</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Category</th>
                                            <th className="px-6 py-4">Updated</th>
                                            <th className="px-6 py-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredResources.map(res => (
                                            <tr key={res.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handleOpenResource(res)}>
                                                <td className="px-6 py-4 flex items-center">
                                                    <div className="mr-3 scale-75 origin-left"><ResourceIcon type={res.type} /></div>
                                                    <span className="font-medium text-white group-hover:text-blue-300 transition-colors">{res.title}</span>
                                                </td>
                                                <td className="px-6 py-4 capitalize text-gray-400">{res.type}</td>
                                                <td className="px-6 py-4"><span className="bg-white/10 px-2 py-1 rounded text-xs">{res.category || '-'}</span></td>
                                                <td className="px-6 py-4 text-gray-400 text-xs">{res.updatedAt}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        {res.type !== 'folder' && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleOpenResource(res); }} className="text-blue-400 hover:text-white p-1">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                        {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteResource(res); }}
                                                                className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500 animate-in fade-in zoom-in duration-500">
                            <Folder size={64} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium text-gray-400">Empty Folder</p>
                            <p className="text-sm opacity-60">There are no resources here yet.</p>
                            {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER) && (
                                <button onClick={() => setIsAddModalOpen(true)} className="mt-6 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-lg text-sm transition-colors border border-blue-500/20">
                                    Create New Resource
                                </button>
                            )}
                        </div>
                    )}
                </div>
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
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Category Tag</label>
                                    <div className="relative">
                                        <div className="flex gap-2">
                                            <select
                                                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                                value={newResource.category}
                                                onChange={e => {
                                                    if (e.target.value === 'NEW') {
                                                        setNewResource({ ...newResource, category: '' });
                                                    } else {
                                                        setNewResource({ ...newResource, category: e.target.value });
                                                    }
                                                }}
                                            >
                                                {Array.from(new Set(resources.map(r => r.category).filter(Boolean))).map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                                <option value="General">General</option>
                                                <option value="NEW">+ Add New Category</option>
                                            </select>
                                        </div>
                                        {(!newResource.category || !Array.from(new Set(resources.map(r => r.category))).includes(newResource.category)) && (
                                            <input
                                                className="w-full glass-input rounded-lg px-3 py-2 text-sm mt-2 animate-in fade-in slide-in-from-top-1"
                                                value={newResource.category}
                                                onChange={e => setNewResource({ ...newResource, category: e.target.value })}
                                                placeholder="Enter new category name..."
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>


                            {newResource.type !== 'folder' && newResource.type !== 'article' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase">Content Source</label>
                                        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                                            <button
                                                type="button"
                                                onClick={() => setIsUploadMode(false)}
                                                className={`px-3 py-1 text-xs rounded-md transition-all ${!isUploadMode ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                External Link
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsUploadMode(true)}
                                                className={`px-3 py-1 text-xs rounded-md transition-all ${isUploadMode ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                Upload File
                                            </button>
                                        </div>
                                    </div>

                                    {isUploadMode ? (
                                        <FileUploader
                                            onUploadComplete={(fileData) => {
                                                setNewResource({
                                                    ...newResource,
                                                    title: newResource.title || fileData.name,
                                                    link: fileData.url,
                                                    type: fileData.type as any,
                                                    fileId: fileData.id,
                                                    downloadUrl: StorageService.getDownloadUrl(fileData.id)
                                                });
                                            }}
                                            accept={newResource.type === 'pdf' ? '.pdf' : newResource.type === 'image' ? 'image/*' : '.doc,.docx,.xls,.xlsx,.ppt,.pptx'}
                                        />
                                    ) : (
                                        <input
                                            required={!isUploadMode}
                                            className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                            value={newResource.link}
                                            onChange={e => setNewResource({ ...newResource, link: e.target.value })}
                                            placeholder="https://..."
                                        />
                                    )}
                                </div>
                            )}

                            <div className="pt-2">
                                <button type="submit" className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-all shadow-lg">
                                    Create {newResource.type === 'folder' ? 'Folder' : 'Resource'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Viewer/Editor Modal */}
            {previewResource && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className={`glass-modal h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ${showAiPanel ? 'w-[95%] max-w-7xl' : 'w-full max-w-6xl'}`}>

                        {/* Modal Header */}
                        <div className="px-6 py-3 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
                            <div className="flex items-center space-x-3">
                                <ResourceIcon type={previewResource.type} size={24} />
                                <div>
                                    <h3 className="text-lg font-bold text-white max-w-md truncate">{previewResource.title}</h3>
                                    <div className="flex items-center text-xs text-gray-400 space-x-2">
                                        <span className="bg-white/10 px-1.5 py-0.5 rounded">{previewResource.category}</span>
                                        <span>•</span>
                                        <span>Updated {previewResource.updatedAt}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER) && previewResource.type === 'article' && (
                                    <button
                                        onClick={() => {
                                            if (isEditing) handleSaveArticle(previewResource.content || '');
                                            setIsEditing(!isEditing);
                                        }}
                                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${isEditing ? 'bg-green-600 border-green-500 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                                    >
                                        {isEditing ? <><Save size={16} /><span>Save & View</span></> : <><PenTool size={16} /><span>Edit</span></>}
                                    </button>
                                )}
                                <div className="h-6 w-px bg-white/10 mx-2"></div>
                                <button
                                    onClick={() => setShowAiPanel(!showAiPanel)}
                                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showAiPanel ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-purple-300 hover:bg-purple-500/10'}`}
                                >
                                    <Sparkles size={16} />
                                    <span>AI</span>
                                </button>
                                {previewResource.link && (
                                    <a href={previewResource.link} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Open External Link">
                                        <ExternalLink size={20} />
                                    </a>
                                )}
                                <button onClick={() => setPreviewResource(null)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Main Content */}
                            <div className={`flex-1 bg-white relative transition-all duration-300 ${showAiPanel ? 'w-2/3' : 'w-full'} ${previewResource.type === 'article' ? 'bg-navy-900 overflow-y-auto' : ''}`}>
                                {previewResource.type === 'article' ? (
                                    isEditing ? (
                                        <div className="h-full p-6 bg-navy-800 flex flex-col">
                                            <div className="mb-2 flex justify-between text-xs text-gray-400">
                                                <span>Markdown Editor</span>
                                                <span>Preview enabled on save</span>
                                            </div>
                                            <textarea
                                                className="flex-1 w-full bg-navy-900 border border-white/10 rounded-xl p-4 text-gray-200 font-mono text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none leading-relaxed"
                                                value={previewResource.content || ''}
                                                onChange={(e) => {
                                                    setPreviewResource({ ...previewResource, content: e.target.value });
                                                }}
                                                placeholder="# Write your article here (Markdown supported)..."
                                                spellCheck={false}
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-8 max-w-4xl mx-auto">
                                            {/* Simple formatting render - in real app use react-markdown */}
                                            <div className="prose prose-invert prose-lg max-w-none">
                                                <div className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed">
                                                    {previewResource.content || <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/10 rounded-xl text-gray-500">
                                                        <FileText size={48} className="mb-4 opacity-50" />
                                                        <p>This article has no content yet.</p>
                                                        <p className="text-sm">Click "Edit" to start writing.</p>
                                                    </div>}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <iframe
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewResource.link || '')}&embedded=true`}
                                        className="w-full h-full border-none"
                                        title="Resource Preview"
                                    />
                                )}
                            </div>

                            {/* AI Panel */}
                            {showAiPanel && (
                                <div className="w-96 border-l border-white/10 bg-navy-900 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl z-10 border-l border-white/10">
                                    <div className="p-4 border-b border-white/10 bg-purple-900/10 backdrop-blur-sm">
                                        <h4 className="text-purple-300 font-bold flex items-center text-sm">
                                            <Bot size={16} className="mr-2" /> Research Assistant
                                        </h4>
                                        <p className="text-[10px] text-gray-400 mt-1">Ask questions about this content or request summaries.</p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-navy-900/50">
                                        {aiResponse ? (
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 shadow-lg">
                                                <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                                                <div className="mt-2 text-[10px] text-gray-500 flex justify-end">Generated by AI</div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                                                <Sparkles size={32} className="mb-2" />
                                                <p className="text-xs text-center px-6">"Summarize this document" or "Explain the key points"</p>
                                            </div>
                                        )}
                                        {isResearching && (
                                            <div className="flex items-center justify-center space-x-2 text-purple-400 text-xs py-4">
                                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-75"></div>
                                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-150"></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-white/10 bg-navy-900/80 backdrop-blur-sm">
                                        <div className="relative">
                                            <input
                                                className="w-full bg-navy-800 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:ring-1 focus:ring-purple-500 outline-none transition-all focus:border-purple-500/50"
                                                placeholder="Ask something..."
                                                value={aiQuery}
                                                onChange={(e) => setAiQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                                            />
                                            <button
                                                onClick={handleAskAI}
                                                disabled={!aiQuery.trim() || isResearching}
                                                className="absolute right-2 top-2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                                            >
                                                <Send size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourcesPage;
