import React, { useState, useEffect } from 'react';
import {
    FileText, Search, Plus, Star, Copy, Trash2, Upload,
    File, FileSpreadsheet, FileCode, CheckSquare, Sparkles,
    MoreVertical, Download, ExternalLink, Bot, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Template, UserRole } from '../types'; // Updated types
import { TemplateService } from '../services/templates';
import { StorageService } from '../services/storage';
import { FileUploader } from '../components/common/FileUploader';
import ResearchAssistant from '../components/ResearchAssistant';
import toast from 'react-hot-toast';

const TemplatesPage: React.FC = () => {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isResearchOpen, setIsResearchOpen] = useState(false);
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null); // New Preview State
    const [uploading, setUploading] = useState(false);

    // New Template State
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        description: '',
        category: 'TASK',
        type: '',
        content: '',
        tags: [] as string[],
        attachments: [] as any[]
    });

    useEffect(() => {
        loadTemplates();
    }, [categoryFilter]);

    const loadTemplates = async () => {
        try {
            const data = await TemplateService.getAllTemplates(
                categoryFilter === 'ALL' ? undefined : categoryFilter
            );
            setTemplates(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load templates');
        }
    };

    const handleCreateTemplate = async () => {
        if (!user || !newTemplate.name) return;

        try {
            await TemplateService.createTemplate({
                ...newTemplate,
                // @ts-ignore
                createdBy: user.uid,
            });

            setNewTemplate({
                name: '',
                description: '',
                category: 'TASK',
                type: '',
                content: '',
                tags: [],
                attachments: []
            });
            setIsModalOpen(false);
            toast.success('Template created successfully');
            await loadTemplates();
        } catch (error) {
            toast.error('Failed to create template');
        }
    };

    const handleUseTemplate = async (template: Template) => {
        try {
            await TemplateService.useTemplate(template.id);
            toast.success(`Template "${template.name}" ready to use!`);
            await loadTemplates();
        } catch (error) {
            toast.error('Error using template');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this template?')) {
            try {
                await TemplateService.deleteTemplate(id);
                toast.success('Template deleted');
                loadTemplates();
            } catch (error) {
                toast.error('Delete failed');
            }
        }
    };

    const filteredTemplates = templates.filter((t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getIconForType = (type: string) => {
        if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet size={20} className="text-emerald-400" />;
        if (type.includes('pdf')) return <FileText size={20} className="text-red-400" />;
        return <File size={20} className="text-blue-400" />;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileCode className="text-blue-400" />
                        Template Library
                    </h1>
                    <p className="text-sm text-gray-400">Standardized resources for the entire team</p>
                </div>
                <div className="flex gap-3">
                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                        <>
                            <button
                                onClick={() => setIsResearchOpen(true)}
                                className="bg-purple-600/20 text-purple-300 border border-purple-500/30 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-600/30 shadow-lg flex items-center transition-all"
                            >
                                <Sparkles size={16} className="mr-2" /> Research Assistant
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-lg flex items-center transition-all hover:-translate-y-0.5"
                            >
                                <Plus size={16} className="mr-2" /> New Template
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Search and Filters */}
            <div className="glass-panel p-2 rounded-xl flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        className="w-full bg-transparent border-none text-white focus:ring-0 pl-10 pr-4 py-2.5"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-1 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 px-2 no-scrollbar">
                    {['ALL', 'TASK', 'CHECKLIST', 'DOCUMENT', 'WORKFLOW'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${categoryFilter === cat
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template, index) => (
                    <div
                        key={template.id}
                        className="glass-panel p-6 rounded-2xl hover:border-blue-500/30 transition-all group relative overflow-hidden flex flex-col h-full"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-xl border border-blue-500/20 group-hover:scale-110 transition-transform">
                                {template.category === 'CHECKLIST' ? <CheckSquare className="text-blue-400" size={24} /> : <FileText className="text-cyan-400" size={24} />}
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${template.category === 'TASK' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                    template.category === 'CHECKLIST' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    }`}>
                                    {template.category}
                                </span>
                                {user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN ? (
                                    <button onClick={() => handleDelete(template.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <h3 className="font-bold text-white text-lg mb-2 leading-tight">{template.name}</h3>
                        <p className="text-sm text-gray-400 mb-4 line-clamp-3 flex-1">{template.description}</p>

                        {/* Attachments Preview */}
                        {template.attachments && template.attachments.length > 0 && (
                            <div className="mb-4 space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Attached Files</p>
                                <div className="space-y-1">
                                    {template.attachments.slice(0, 2).map((att, i) => (
                                        <a
                                            key={i}
                                            href={att.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group/file"
                                        >
                                            <div className="mr-2">{getIconForType(att.name)}</div>
                                            <span className="text-xs text-gray-300 truncate flex-1">{att.name}</span>
                                            <ExternalLink size={12} className="text-gray-500 opacity-0 group-hover/file:opacity-100 transition-opacity" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-white/5 mt-auto flex items-center justify-between">
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <Star size={12} className="text-amber-400" />
                                <span>{template.usageCount || 0} Uses</span>
                            </div>
                            <button
                                onClick={() => setPreviewTemplate(template)}
                                className="text-sm font-bold text-blue-400 hover:text-blue-300 flex items-center transition-colors group-hover:underline"
                            >
                                <ExternalLink size={14} className="mr-1.5" /> View & Use
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="glass-modal rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <Plus size={18} className="mr-2 text-blue-400" /> Create New Template
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={18} /></button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Template Name</label>
                                    <input
                                        type="text"
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={newTemplate.name}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                        placeholder="e.g. Audit Checklist 2024"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Category</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={newTemplate.category}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value as any })}
                                    >
                                        <option value="TASK">Task</option>
                                        <option value="CHECKLIST">Checklist</option>
                                        <option value="DOCUMENT">Document</option>
                                        <option value="WORKFLOW">Workflow</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Type / Tag</label>
                                    <input
                                        type="text"
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={newTemplate.type}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value })}
                                        placeholder="e.g. Tax"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Description</label>
                                    <textarea
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        rows={3}
                                        value={newTemplate.description}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                        placeholder="Briefly describe what this template is for..."
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Attachments</label>
                                    <div className="border-2 border-dashed border-white/20 rounded-xl p-4 hover:bg-white/5 transition-colors relative">
                                        <FileUploader
                                            maxSizeMB={20}
                                            onUploadComplete={(fileData) => {
                                                // @ts-ignore
                                                setNewTemplate(prev => ({
                                                    ...prev,
                                                    attachments: [...prev.attachments, {
                                                        id: fileData.id,
                                                        name: fileData.name,
                                                        url: fileData.url,
                                                        type: 'FILE'
                                                    }]
                                                }));
                                                toast.success('File attached successfully');
                                            }}
                                            accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,.csv"
                                        />
                                    </div>

                                    {/* Attachment List */}
                                    {newTemplate.attachments.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {newTemplate.attachments.map((att, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white/5 p-2 rounded-lg text-sm">
                                                    <div className="flex items-center truncate">
                                                        {getIconForType(att.name)}
                                                        <span className="ml-2 text-gray-300 truncate">{att.name}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setNewTemplate(prev => ({
                                                            ...prev,
                                                            attachments: prev.attachments.filter((_, idx) => idx !== i)
                                                        }))}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase">Content / Instructions</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsResearchOpen(true)}
                                            className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center"
                                        >
                                            <Sparkles size={10} className="mr-1" /> Draft with AI
                                        </button>
                                    </div>
                                    <textarea
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm font-mono"
                                        rows={6}
                                        value={newTemplate.content}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                                        placeholder="Enter default content, JSON structure, or markdown guidelines..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end space-x-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTemplate}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 shadow-lg transition-all"
                            >
                                Create Template
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Research Assistant Sidebar */}
            <ResearchAssistant
                isOpen={isResearchOpen}
                onClose={() => setIsResearchOpen(false)}
                context={`Current Template Draft: ${JSON.stringify(newTemplate)}`}
            />
            {/* Preview Modal - View Only for Staff */}
            {previewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="glass-modal rounded-2xl w-full max-w-3xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center">
                                <FileText className="mr-2 text-blue-400" /> {previewTemplate.name}
                            </h3>
                            <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            <div className="flex gap-2 mb-4">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    {previewTemplate.category}
                                </span>
                                {previewTemplate.type && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        {previewTemplate.type}
                                    </span>
                                )}
                            </div>

                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Description</h4>
                                <p className="text-gray-300 leading-relaxed">{previewTemplate.description}</p>
                            </div>

                            {previewTemplate.content && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Content Preview</h4>
                                    <div className="bg-black/30 p-4 rounded-xl border border-white/10 font-mono text-sm text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                                        {previewTemplate.content}
                                    </div>
                                </div>
                            )}

                            {previewTemplate.attachments && previewTemplate.attachments.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Attachments</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {previewTemplate.attachments.map((att: any, i: number) => (
                                            <a
                                                key={i}
                                                href={att.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group"
                                            >
                                                <div className="mr-3 p-2 bg-white/5 rounded-lg text-blue-400">
                                                    {getIconForType(att.name)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-200 truncate group-hover:text-blue-300 transition-colors">{att.name}</p>
                                                    <p className="text-xs text-gray-500">Click to view</p>
                                                </div>
                                                <ExternalLink size={14} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    handleUseTemplate(previewTemplate);
                                    setPreviewTemplate(null);
                                }}
                                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-500 shadow-lg flex items-center transition-all hover:-translate-y-0.5"
                            >
                                <Copy size={16} className="mr-2" /> Use Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplatesPage;
