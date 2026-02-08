import React, { useState, useEffect } from 'react';
import {
    Book,
    FileText,
    Search,
    Plus,
    MoreVertical,
    Download,
    ExternalLink,
    Trash2,
    Edit,
    FolderOpen,
    FileJson,
    FileType,
    Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Resource } from '../types';
import { KnowledgeService } from '../services/knowledge';

const CATEGORIES = [
    { id: 'ALL', label: 'All Resources', icon: FolderOpen },
    { id: 'SOP', label: 'SOPs', icon: Book },
    { id: 'TAX', label: 'Tax Acts & Bylaws', icon: FileText },
    { id: 'TEMPLATE', label: 'Audit Templates', icon: FileJson },
    { id: 'TRAINING', label: 'Training Materials', icon: FileType },
];

const KnowledgeBasePage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentResource, setCurrentResource] = useState<Partial<Resource>>({
        type: 'pdf',
        category: 'SOP'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        setLoading(true);
        try {
            const data = await KnowledgeService.getAllResources();
            setResources(data);
        } catch (error) {
            console.error("Failed to load knowledge base:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this resource?')) return;
        try {
            await KnowledgeService.deleteResource(id);
            setResources(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            alert("Failed to delete resource");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentResource.title || !currentResource.link) {
            alert("Title and Link are required");
            return;
        }

        setIsSubmitting(true);
        try {
            if (currentResource.id) {
                await KnowledgeService.updateResource(currentResource.id, currentResource);
                setResources(prev => prev.map(r => r.id === currentResource.id ? { ...r, ...currentResource } as Resource : r));
            } else {
                const id = await KnowledgeService.addResource(currentResource as any);
                setResources(prev => [{ ...currentResource, id, updatedAt: new Date().toISOString() } as Resource, ...prev]);
            }
            setIsModalOpen(false);
            setCurrentResource({ type: 'pdf', category: 'SOP' });
        } catch (error) {
            console.error(error);
            alert("Failed to save resource");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (resource: Resource) => {
        setCurrentResource(resource);
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setCurrentResource({ type: 'pdf', category: activeCategory === 'ALL' ? 'SOP' : activeCategory });
        setIsModalOpen(true);
    };

    // Filter Logic
    const filteredResources = resources.filter(r => {
        const matchesCategory = activeCategory === 'ALL' || r.category === activeCategory;
        const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'pdf': return <FileText size={24} className="text-red-400" />;
            case 'sheet': return <FileJson size={24} className="text-green-400" />;
            case 'doc': return <FileType size={24} className="text-blue-400" />;
            default: return <FileText size={24} className="text-gray-400" />;
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading">Knowledge Base</h1>
                    <p className="text-sm text-gray-400">Central repository for SOPs, Tax Acts, and Templates</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            className="w-full glass-input rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {isAdmin && (
                        <button
                            onClick={openCreateModal}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center transition-all hover:-translate-y-0.5"
                        >
                            <Plus size={18} className="mr-2" /> Add Resource
                        </button>
                    )}
                </div>
            </div>

            {/* Categories & Content */}
            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                {/* Sidebar Categories */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-2 overflow-x-auto lg:overflow-visible flex lg:flex-col pb-2">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat.id
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <cat.icon size={18} className="mr-3" />
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Grid Content */}
                <div className="flex-1 overflow-y-auto pr-2 pb-20 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 size={40} className="animate-spin text-brand-500" />
                        </div>
                    ) : filteredResources.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <FolderOpen size={64} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">No resources found</p>
                            <p className="text-sm">Try adjusting search or category</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredResources.map(resource => (
                                <div key={resource.id} className="glass-panel p-4 rounded-xl hover:bg-white/5 transition-all group relative border border-white/5 hover:border-brand-500/30">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-3 bg-white/5 rounded-lg">
                                            {getIcon(resource.type)}
                                        </div>
                                        {isAdmin && (
                                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEditModal(resource)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"><Edit size={14} /></button>
                                                <button onClick={() => handleDelete(resource.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-white font-bold mb-1 line-clamp-2 min-h-[3rem]">{resource.title}</h3>
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                                        <span className="text-xs text-gray-500">{new Date(resource.updatedAt).toLocaleDateString()}</span>
                                        <a
                                            href={resource.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-xs font-bold text-brand-300 hover:text-brand-200"
                                        >
                                            OPEN <ExternalLink size={12} className="ml-1" />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-lg flex flex-col shadow-2xl border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">{currentResource.id ? 'Edit Resource' : 'Add New Resource'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><React.Fragment><span className="sr-only">Close</span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></React.Fragment></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Title <span className="text-red-400">*</span></label>
                                <input
                                    required
                                    className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={currentResource.title || ''}
                                    onChange={e => setCurrentResource({ ...currentResource, title: e.target.value })}
                                    placeholder="e.g. Audit Standard 2024"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={currentResource.category}
                                        onChange={e => setCurrentResource({ ...currentResource, category: e.target.value })}
                                    >
                                        {CATEGORIES.filter(c => c.id !== 'ALL').map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={currentResource.type}
                                        onChange={e => setCurrentResource({ ...currentResource, type: e.target.value as any })}
                                    >
                                        <option value="pdf">PDF Document</option>
                                        <option value="sheet">Excel Sheet</option>
                                        <option value="doc">Word Doc</option>
                                        <option value="article">Link / Article</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Link URL <span className="text-red-400">*</span></label>
                                <div className="relative">
                                    <input
                                        required
                                        className="w-full glass-input rounded-lg pl-9 pr-3 py-2 text-sm"
                                        value={currentResource.link || ''}
                                        onChange={e => setCurrentResource({ ...currentResource, link: e.target.value })}
                                        placeholder="https://drive.google.com/..."
                                    />
                                    <ExternalLink size={14} className="absolute left-3 top-2.5 text-gray-500" />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Paste Google Drive or external link here.</p>
                            </div>

                            <div className="pt-4 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center">
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                                    {currentResource.id ? 'Update Resource' : 'Add Resource'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBasePage;
