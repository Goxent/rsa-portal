import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { TaskTemplate, TaskPriority } from '../types';
import { TemplateService } from '../services/templates';

interface TaskTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: TaskTemplate) => void;
}

const TaskTemplateModal: React.FC<TaskTemplateModalProps> = ({ isOpen, onClose, onSelectTemplate }) => {
    const [templates, setTemplates] = useState<TaskTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
        }
    }, [isOpen]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await TemplateService.getAllTemplates();
            setTemplates(data);
        } catch (error) {
            console.error("Failed to fetch templates", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleSelect = () => {
        if (selectedId) {
            const template = templates.find(t => t.id === selectedId);
            if (template) {
                onSelectTemplate(template);
                onClose();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="glass-modal rounded-xl w-full max-w-2xl flex flex-col shadow-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center">
                        <FileText size={18} className="mr-2 text-brand-400" />
                        Select Task Template
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 className="animate-spin text-brand-500 mb-2" size={32} />
                            <p className="text-gray-400 text-sm">Loading templates...</p>
                        </div>
                    ) : templates.length > 0 ? (
                        <div className="grid gap-4">
                            {templates.map(template => (
                                <div
                                    key={template.id}
                                    onClick={() => setSelectedId(template.id)}
                                    className={`cursor-pointer group relative p-4 rounded-xl border transition-all duration-200 ${selectedId === template.id
                                        ? 'bg-brand-600/20 border-brand-500 ring-1 ring-brand-500/50'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/5">
                                                    {template.category}
                                                </span>
                                                {template.priority === TaskPriority.URGENT && (
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/20">
                                                        Urgent
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-white font-bold text-lg">{template.name}</h4>
                                            <p className="text-gray-400 text-sm mt-1">{template.description}</p>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${selectedId === template.id
                                            ? 'bg-brand-500 border-brand-500 text-white'
                                            : 'border-gray-500 text-transparent'
                                            }`}>
                                            <Check size={14} />
                                        </div>
                                    </div>

                                    {selectedId === template.id && template.subtasks && template.subtasks.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10 animate-in slide-in-from-top-2">
                                            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Included Subtasks:</p>
                                            <ul className="space-y-1">
                                                {template.subtasks.map((task, i) => (
                                                    <li key={i} className="text-sm text-gray-300 flex items-start">
                                                        <ChevronRight size={14} className="mr-2 mt-0.5 text-brand-400 shrink-0" />
                                                        {task}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 opacity-50">
                            <p className="text-gray-300">No templates found.</p>
                            <p className="text-xs text-gray-500 mt-1">Create templates in the Template Manager.</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 text-sm transition-colors">Cancel</button>
                    <button
                        onClick={handleSelect}
                        disabled={!selectedId}
                        className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center transition-all"
                    >
                        <Copy size={16} className="mr-2" />
                        Use Template
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskTemplateModal;
