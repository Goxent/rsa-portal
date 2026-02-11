import React, { useState, useEffect } from 'react';
import { FileText, Search, Plus, Star, Copy, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Template } from '../types/advanced';
import { TemplateService } from '../services/advanced';

const TemplatesPage: React.FC = () => {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        description: '',
        category: 'TASK' as const,
        type: '',
        content: '',
        tags: [] as string[],
        driveLink: ''
    });

    useEffect(() => {
        loadTemplates();
    }, [categoryFilter]);

    const loadTemplates = async () => {
        const data = await TemplateService.getTemplates(
            categoryFilter === 'ALL' ? undefined : categoryFilter
        );
        setTemplates(data);
    };

    const handleCreateTemplate = async () => {
        if (!user || !newTemplate.name) return;

        await TemplateService.createTemplate({
            ...newTemplate,
            public: true,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
            usageCount: 0,
        });

        setNewTemplate({
            name: '',
            description: '',
            category: 'TASK',
            type: '',
            content: '',
            content: '',
            tags: [],
            driveLink: ''
        });
        setIsModalOpen(false);
        await loadTemplates();
    };

    const handleUseTemplate = async (template: Template) => {
        await TemplateService.useTemplate(template.id);
        alert(`Template "${template.name}" applied! Check your ${template.category.toLowerCase()}s.`);
        await loadTemplates();
    };

    const filteredTemplates = templates.filter((t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white">Template Library</h1>
                    <p className="text-sm text-gray-400">Reusable templates for tasks, checklists, and documents</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-lg flex items-center"
                >
                    <Plus size={16} className="mr-2" /> New Template
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {['ALL', 'TASK', 'CHECKLIST', 'DOCUMENT', 'WORKFLOW'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${categoryFilter === cat
                                ? 'bg-blue-600 text-white'
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
                {filteredTemplates.map((template) => (
                    <div
                        key={template.id}
                        className="glass-panel p-6 rounded-xl hover:bg-white/5 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <FileText className="text-blue-400" size={24} />
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <Star size={12} />
                                <span>{template.usageCount}</span>
                            </div>
                        </div>

                        <h3 className="font-bold text-white mb-2">{template.name}</h3>
                        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{template.description}</p>

                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400">
                                {template.category}
                            </span>
                            {template.tags.slice(0, 2).map((tag, i) => (
                                <span key={i} className="px-2 py-1 rounded text-xs bg-white/10 text-gray-400">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {template.driveLink && (
                            <a
                                href={template.driveLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full mb-3 bg-white/5 hover:bg-white/10 text-blue-300 border border-blue-500/30 py-2 rounded-lg text-sm font-medium text-center transition-all"
                            >
                                Open Google Drive File
                            </a>
                        )}

                        <button
                            onClick={() => handleUseTemplate(template)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-all flex items-center justify-center"
                        >
                            <Copy size={16} className="mr-2" /> Use Template
                        </button>
                    </div>
                ))}
                {filteredTemplates.length === 0 && (
                    <div className="col-span-full glass-panel p-12 rounded-xl text-center text-gray-500">
                        <FileText size={48} className="mx-auto mb-3 opacity-30" />
                        <p>No templates found</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between sticky top-0">
                            <h3 className="text-lg font-bold text-white">New Template</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg px-3 py-2"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                                <textarea
                                    className="w-full rounded-lg px-3 py-2"
                                    rows={2}
                                    value={newTemplate.description}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Google Drive Link (Optional)</label>
                                <input
                                    type="url"
                                    placeholder="https://docs.google.com/..."
                                    className="w-full rounded-lg px-3 py-2 text-blue-400"
                                    value={newTemplate.driveLink}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, driveLink: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                                    <select
                                        className="w-full rounded-lg px-3 py-2"
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
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Type</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Audit, Tax Return"
                                        className="w-full rounded-lg px-3 py-2"
                                        value={newTemplate.type}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Content</label>
                                <textarea
                                    className="w-full rounded-lg px-3 py-2 font-mono text-sm"
                                    rows={6}
                                    placeholder="Template content (JSON, Markdown, or text)"
                                    value={newTemplate.content}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                                />
                            </div>
                            <button
                                onClick={handleCreateTemplate}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold"
                            >
                                Create Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplatesPage;
