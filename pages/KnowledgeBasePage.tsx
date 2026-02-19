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
    Loader2,
    Palette,
    Check,
    X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Resource, Category } from '../types';
import { KnowledgeService } from '../services/knowledge';
import { StorageService } from '../services/storage';
import { FileUploader } from '../components/common/FileUploader';
import { DocumentViewer } from '../components/common/DocumentViewer';
import { toast } from 'react-hot-toast';
import { useModal } from '../context/ModalContext';

const DEFAULT_COLORS = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
];

const KnowledgeBasePage: React.FC = () => {
    const { user } = useAuth();
    const { openModal } = useModal();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const [resources, setResources] = useState<Resource[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Resource Modal State
    const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
    const [currentResource, setCurrentResource] = useState<Partial<Resource>>({
        type: 'pdf',
        category: '',
        link: '',
        title: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadMode, setIsUploadMode] = useState(false);

    // Category Modal State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<Partial<Category>>({
        label: '',
        icon: 'FolderOpen',
        color: '#3B82F6'
    });

    // Viewer State
    const [viewDoc, setViewDoc] = useState<{ url: string; type: string; title: string; downloadUrl?: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [resourcesData, categoriesData] = await Promise.all([
                KnowledgeService.getAllResources(),
                KnowledgeService.getAllCategories()
            ]);
            setResources(resourcesData);
            setCategories(categoriesData);
        } catch (error) {
            console.error("Failed to load knowledge base:", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    // --- RESOURCE HANDLERS ---

    const handleDeleteResource = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        openModal('CONFIRMATION', {
            title: 'Delete Resource',
            message: 'Are you sure you want to delete this resource? This action cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await KnowledgeService.deleteResource(id);
                    setResources(prev => prev.filter(r => r.id !== id));
                    toast.success("Resource deleted");
                } catch (error) {
                    toast.error("Failed to delete resource");
                }
            }
        });
    };

    const handleEditResource = (resource: Resource, e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentResource(resource);
        setIsUploadMode(!!resource.fileId);
        setIsResourceModalOpen(true);
    };

    const handleResourceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentResource.title || (!currentResource.link && !currentResource.fileId)) {
            toast.error("Title and Link/File are required");
            return;
        }

        setIsSubmitting(true);
        try {
            const resourceData = {
                ...currentResource,
                category: currentResource.category || (categories[0]?.id || 'GENERAL')
            };

            if (currentResource.id) {
                await KnowledgeService.updateResource(currentResource.id, resourceData);
                setResources(prev => prev.map(r => r.id === currentResource.id ? { ...r, ...resourceData } as Resource : r));
                toast.success("Resource updated");
            } else {
                const id = await KnowledgeService.addResource(resourceData as any);
                setResources(prev => [{ ...resourceData, id, updatedAt: new Date().toISOString() } as Resource, ...prev]);
                toast.success("Resource added");
            }
            setIsResourceModalOpen(false);
            setCurrentResource({ type: 'pdf', category: '', link: '', title: '' });
        } catch (error) {
            console.error(error);
            toast.error("Failed to save resource");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- CATEGORY HANDLERS ---

    const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        openModal('CONFIRMATION', {
            title: 'Delete Category',
            message: 'Are you sure you want to delete this category? Resources in this category will not be deleted but will need to be re-categorized.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await KnowledgeService.deleteCategory(id);
                    setCategories(prev => prev.filter(c => c.id !== id));
                    if (activeCategory === id) setActiveCategory('ALL');
                    toast.success("Category deleted");
                } catch (error) {
                    toast.error("Failed to delete category");
                }
            }
        });
    };

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCategory.label) return;

        setIsSubmitting(true);
        try {
            const id = await KnowledgeService.addCategory({
                label: currentCategory.label!,
                icon: currentCategory.icon || 'FolderOpen',
                color: currentCategory.color || '#3B82F6'
            });
            setCategories(prev => [...prev, { ...currentCategory, id, createdAt: new Date().toISOString() } as Category]);
            toast.success("Category created");
            setIsCategoryModalOpen(false);
            setCurrentCategory({ label: '', icon: 'FolderOpen', color: '#3B82F6' });
        } catch (error) {
            toast.error("Failed to create category");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSeed = async () => {
        try {
            await KnowledgeService.seedDefaultCategories();
            toast.success("Default folders created");
            loadData();
        } catch (error) {
            toast.error("Failed to create folders");
        }
    };

    const handleOpenResource = (res: Resource) => {
        if (res.type === 'article' || res.link?.includes('docs.google.com') || res.type === 'folder') {
            if (res.link) window.open(res.link, '_blank');
        } else {
            setViewDoc({
                url: res.link || '',
                type: res.type,
                title: res.title,
                downloadUrl: res.downloadUrl
            });
        }
    };

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
            case 'image': return <FileType size={24} className="text-purple-400" />;
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
                        <>
                            <button
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center transition-all"
                            >
                                <Plus size={18} className="mr-2" /> Folder
                            </button>
                            <button
                                onClick={() => {
                                    setCurrentResource({ type: 'pdf', category: activeCategory === 'ALL' && categories.length > 0 ? categories[0].id : activeCategory, link: '', title: '' });
                                    setIsUploadMode(false);
                                    setIsResourceModalOpen(true);
                                }}
                                className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center transition-all hover:-translate-y-0.5"
                            >
                                <Plus size={18} className="mr-2" /> Resource
                            </button>
                        </>
                    )}
                    <DocumentViewer
                        isOpen={!!viewDoc}
                        onClose={() => setViewDoc(null)}
                        url={viewDoc?.url || ''}
                        type={viewDoc?.type || 'file'}
                        title={viewDoc?.title || ''}
                        downloadUrl={viewDoc?.downloadUrl}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                {/* Sidebar Categories */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-2 overflow-x-auto lg:overflow-visible flex lg:flex-col pb-2">
                    <button
                        onClick={() => setActiveCategory('ALL')}
                        className={`flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeCategory === 'ALL'
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <FolderOpen size={18} className="mr-3" />
                        All Resources
                    </button>
                    {categories.map(cat => (
                        <div key={cat.id} className="relative group">
                            <button
                                onClick={() => setActiveCategory(cat.id)}
                                className={`flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat.id
                                    ? 'bg-white/10 text-white border border-white/10'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                style={{
                                    borderLeft: activeCategory === cat.id ? `4px solid ${cat.color || '#3B82F6'}` : 'none'
                                }}
                            >
                                <FolderOpen size={18} className="mr-3" style={{ color: cat.color || '#6B7280' }} />
                                {cat.label}
                            </button>
                            {/* Delete Category Button (Admin only) */}
                            {isAdmin && (
                                <button
                                    onClick={(e) => handleDeleteCategory(cat.id, e)}
                                    className="absolute right-2 top-3 p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete Category"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                    {categories.length === 0 && !loading && (
                        <div className="p-4 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
                            No folders yet.
                            {isAdmin && (
                                <button onClick={handleSeed} className="text-brand-400 hover:text-brand-300 underline block mx-auto mt-2">
                                    Initialize Defaults
                                </button>
                            )}
                        </div>
                    )}
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
                            <p className="text-sm">Try adding a new resource or folder</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredResources.map(resource => (
                                <div
                                    key={resource.id}
                                    onClick={() => handleOpenResource(resource)}
                                    className="glass-panel p-4 rounded-xl hover:bg-white/5 transition-all group relative border border-white/5 hover:border-brand-500/30 cursor-pointer flex flex-col h-full"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-3 bg-white/5 rounded-lg group-hover:bg-brand-500/10 transition-colors">
                                            {getIcon(resource.type)}
                                        </div>
                                        {isAdmin && (
                                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => handleEditResource(resource, e)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"><Edit size={14} /></button>
                                                <button onClick={(e) => handleDeleteResource(resource.id, e)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-white font-bold mb-1 line-clamp-2 min-h-[2.5rem] group-hover:text-brand-300 transition-colors">{resource.title}</h3>
                                    <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{new Date(resource.updatedAt).toLocaleDateString()}</span>
                                        <ExternalLink size={14} className="text-gray-600 group-hover:text-brand-400 transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Resource Modal */}
            {isResourceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-lg flex flex-col shadow-2xl border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">{currentResource.id ? 'Edit Resource' : 'Add New Resource'}</h3>
                            <button onClick={() => setIsResourceModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleResourceSubmit} className="p-6 space-y-4">
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
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Folder</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={currentResource.category}
                                        onChange={e => setCurrentResource({ ...currentResource, category: e.target.value })}
                                    >
                                        <option value="" disabled>Select Folder</option>
                                        {categories.map(c => (
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
                                        <option value="image">Image</option>
                                        <option value="article">Link / Article</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Content Source</label>
                                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 mb-3 w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setIsUploadMode(false)}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${!isUploadMode ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        External Link
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsUploadMode(true)}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${isUploadMode ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Upload File
                                    </button>
                                </div>

                                {isUploadMode ? (
                                    <div className="border-2 border-dashed border-white/10 rounded-xl p-4 hover:border-brand-500/50 transition-colors">
                                        <FileUploader
                                            maxSizeMB={20}
                                            onUploadComplete={(fileData) => {
                                                setCurrentResource({
                                                    ...currentResource,
                                                    title: currentResource.title || fileData.name,
                                                    link: fileData.url,
                                                    type: fileData.type as any,
                                                    fileId: fileData.id,
                                                    downloadUrl: StorageService.getDownloadUrl(fileData.id)
                                                });
                                            }}
                                            accept={
                                                currentResource.type === 'pdf'
                                                    ? '.pdf,application/pdf'
                                                    : currentResource.type === 'image'
                                                        ? 'image/*'
                                                        : '.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'
                                            }
                                        />
                                        {currentResource.fileId && (
                                            <div className="mt-2 text-xs text-green-400 flex items-center">
                                                <FileText size={12} className="mr-1" /> File uploaded successfully
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div className="relative">
                                            <input
                                                required={!isUploadMode}
                                                className="w-full glass-input rounded-lg pl-9 pr-3 py-2 text-sm"
                                                value={currentResource.link || ''}
                                                onChange={e => setCurrentResource({ ...currentResource, link: e.target.value })}
                                                placeholder="https://drive.google.com/..."
                                            />
                                            <ExternalLink size={14} className="absolute left-3 top-2.5 text-gray-500" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsResourceModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center">
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                                    {currentResource.id ? 'Update Resource' : 'Add Resource'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-md flex flex-col shadow-2xl border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">New Folder</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Folder Name <span className="text-red-400">*</span></label>
                                <input
                                    required
                                    className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={currentCategory.label || ''}
                                    onChange={e => setCurrentCategory({ ...currentCategory, label: e.target.value })}
                                    placeholder="e.g. Audit Reports"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Folder Color</label>
                                <div className="flex flex-wrap gap-3">
                                    {DEFAULT_COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setCurrentCategory({ ...currentCategory, color })}
                                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${currentCategory.color === color ? 'border-white ring-2 ring-white/20' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        >
                                            {currentCategory.color === color && <Check size={14} className="text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center">
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                                    Create Folder
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
