import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, List, CheckCircle2, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { TaskTemplate, TaskPriority, UserRole, AuditPhase, TaskType } from '../types';
import { TemplateService } from '../services/templates';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const TemplateManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const [templates, setTemplates] = useState<TaskTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<Partial<TaskTemplate>>({
        name: '',
        description: '',
        priority: TaskPriority.MEDIUM,
        category: 'TASK',
        subtasks: [],
        subtaskDetails: [],
        documentLink: '',
        nextTemplateId: '',
        taskType: undefined
    });
    const [newSubtask, setNewSubtask] = useState('');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await TemplateService.getAllTemplates();
            setTemplates(data);
        } catch (error) {
            toast.error("Failed to load templates");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) {
            toast.error("Only Admins can manage templates");
            return;
        }
        try {
            if (currentTemplate.id) {
                await TemplateService.updateTemplate(currentTemplate.id, currentTemplate);
                toast.success("Template updated");
            } else {
                await TemplateService.createTemplate(currentTemplate);
                toast.success("Template created");
            }
            setIsEditing(false);
            loadTemplates();
        } catch (error) {
            toast.error("Error saving template");
        }
    };

    const handleDelete = async (id: string) => {
        if (!isAdmin) {
            toast.error("Only Admins can delete templates");
            return;
        }
        if (!window.confirm("Delete this template?")) return;
        try {
            await TemplateService.deleteTemplate(id);
            toast.success("Template deleted");
            loadTemplates();
        } catch (error) {
            toast.error("Error deleting template");
        }
    };

    const [newSubtaskRequirement, setNewSubtaskRequirement] = useState('');
    const [newSubtaskRole, setNewSubtaskRole] = useState<UserRole | ''>('');
    const [newSubtaskOffset, setNewSubtaskOffset] = useState('');
    const [newSubtaskPhase, setNewSubtaskPhase] = useState<AuditPhase | ''>('');

    const addSubtask = () => {
        if (!newSubtask.trim()) return;
        const newDetail = { 
            title: newSubtask.trim(), 
            minimumRequirement: newSubtaskRequirement.trim() || undefined,
            assigneeRole: newSubtaskRole || undefined,
            daysOffset: newSubtaskOffset ? parseInt(newSubtaskOffset) : undefined,
            phase: newSubtaskPhase || undefined
        };
        setCurrentTemplate(prev => ({
            ...prev,
            subtasks: [...(prev.subtasks || []), newSubtask.trim()],
            subtaskDetails: [...(prev.subtaskDetails || []), newDetail]
        }));
        setNewSubtask('');
        setNewSubtaskRequirement('');
        setNewSubtaskRole('');
        setNewSubtaskOffset('');
        setNewSubtaskPhase('');
    };

    const removeSubtask = (index: number) => {
        setCurrentTemplate(prev => ({
            ...prev,
            subtasks: prev.subtasks?.filter((_, i) => i !== index),
            subtaskDetails: prev.subtaskDetails?.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10 text-gray-100">
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div>
                        <h3 className="text-xl font-bold font-heading flex items-center">
                            <List className="mr-2 text-brand-400" size={20} />
                            Task Template Manager
                        </h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Define standardized workflows</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Template List */}
                    <div className="w-full md:w-1/3 border-r border-white/5 overflow-y-auto custom-scrollbar p-4 bg-black/10">
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    setIsEditing(true);
                                    setCurrentTemplate({ name: '', description: '', priority: TaskPriority.MEDIUM, category: 'TASK', subtasks: [], subtaskDetails: [], autoApplyRules: {}, documentLink: '', nextTemplateId: '' });
                                }}
                                className="w-full mb-4 py-3 border-2 border-dashed border-brand-500/30 rounded-xl text-brand-400 hover:border-brand-500/60 hover:bg-brand-500/5 transition-all flex items-center justify-center font-bold text-sm"
                            >
                                <Plus size={18} className="mr-2" /> New Template
                            </button>
                        )}

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40">
                                <Loader2 className="animate-spin text-brand-500 mb-2" size={24} />
                                <span className="text-xs text-gray-500">Syncing with cloud...</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {templates.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => { setIsEditing(true); setCurrentTemplate(t); }}
                                        className={`p-3 rounded-xl cursor-pointer transition-all border ${currentTemplate.id === t.id ? 'bg-brand-600/20 border-brand-500/50 shadow-lg shadow-brand-500/10' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-sm block truncate">{t.name}</span>
                                            {isAdmin && (
                                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center mt-2 space-x-2">
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">{t.category}</span>
                                            <span className="text-[9px] text-gray-500">{t.subtasks?.length || 0} steps</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Editor */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-navy-950/20">
                        {isEditing ? (
                            <form onSubmit={handleSave} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Template Name</label>
                                        <input
                                            required
                                            className="w-full glass-input text-base font-medium"
                                            value={currentTemplate.name}
                                            onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                            placeholder="e.g. Annual Audit Baseline"
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Description</label>
                                        <textarea
                                            rows={2}
                                            className="w-full glass-input"
                                            value={currentTemplate.description}
                                            onChange={e => setCurrentTemplate({ ...currentTemplate, description: e.target.value })}
                                            placeholder="Overview of what this template covers..."
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Document Link (GDrive/PDF)</label>
                                        <input
                                            className="w-full glass-input"
                                            value={currentTemplate.documentLink || ''}
                                            onChange={e => setCurrentTemplate({ ...currentTemplate, documentLink: e.target.value })}
                                            placeholder="https://drive.google.com/..."
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Category</label>
                                        <select className="w-full glass-input" value={currentTemplate.category} onChange={e => setCurrentTemplate({ ...currentTemplate, category: e.target.value as any })} disabled={!isAdmin}>
                                            <option value="TASK">Task</option>
                                            <option value="CHECKLIST">Checklist</option>
                                            <option value="DOCUMENT">Document</option>
                                            <option value="WORKFLOW">Workflow</option>
                                            <option value="SOP">SOP</option>
                                            <option value="TEMPLATE">Template</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Default Priority</label>
                                        <select className="w-full glass-input" value={currentTemplate.priority} onChange={e => setCurrentTemplate({ ...currentTemplate, priority: e.target.value as TaskPriority })} disabled={!isAdmin}>
                                            {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Trigger Next Workflow</label>
                                        <select className="w-full glass-input" value={currentTemplate.nextTemplateId || ''} onChange={e => setCurrentTemplate({ ...currentTemplate, nextTemplateId: e.target.value })} disabled={!isAdmin}>
                                            <option value="">- None -</option>
                                            {templates.filter(t => t.id !== currentTemplate.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Linked Assignment Type</label>
                                        <select className="w-full glass-input" value={currentTemplate.taskType || ''} onChange={e => setCurrentTemplate({ ...currentTemplate, taskType: e.target.value as TaskType || undefined })} disabled={!isAdmin}>
                                            <option value="">- None (Standalone) -</option>
                                            {Object.values(TaskType).map(type => (
                                                <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center">
                                        Subtasks & Steps
                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-navy-800 text-gray-400 text-[10px]">{currentTemplate.subtaskDetails?.length || 0} TOTAL</span>
                                    </label>
                                    <div className="space-y-2 mb-4">
                                        {(currentTemplate.subtaskDetails || currentTemplate.subtasks?.map(t => ({ title: t, assigneeRole: undefined, daysOffset: undefined, minimumRequirement: undefined, phase: undefined })) || []).map((s, idx) => (
                                            <div key={idx} className="flex flex-col group bg-white/5 border border-white/5 rounded-lg p-2 hover:border-white/10 transition-colors">
                                                <div className="flex items-center">
                                                    <div className="w-6 h-6 rounded bg-navy-800 flex items-center justify-center text-[10px] text-gray-400 font-mono mr-3 border border-white/5">
                                                        {idx + 1}
                                                    </div>
                                                    <span className="flex-1 text-sm">{s.title}</span>
                                                    {s.phase && <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{s.phase.replace(/_/g, ' ')}</span>}
                                                    {s.assigneeRole && <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{s.assigneeRole}</span>}
                                                    {s.daysOffset !== undefined && <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">+{s.daysOffset} d</span>}
                                                    {isAdmin && (
                                                        <button type="button" onClick={() => removeSubtask(idx)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1"><X size={14} /></button>
                                                    )}
                                                </div>
                                                {s.minimumRequirement && (
                                                    <div className="ml-10 text-[10px] text-gray-500 italic flex items-center mt-1">
                                                        <AlertCircle size={10} className="mr-1" />
                                                        {s.minimumRequirement}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {isAdmin && (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    className="flex-1 min-w-[200px] glass-input py-2 text-sm"
                                                    value={newSubtask}
                                                    onChange={e => setNewSubtask(e.target.value)}
                                                    placeholder="Add a step (e.g. Verify Fixed Assets)"
                                                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                                />
                                                <input
                                                    className="w-1/4 min-w-[120px] glass-input py-2 text-sm"
                                                    value={newSubtaskRequirement}
                                                    onChange={e => setNewSubtaskRequirement(e.target.value)}
                                                    placeholder="Min Req (Opt)"
                                                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                                />
                                                <select
                                                    className="w-1/5 min-w-[100px] glass-input py-2 text-sm"
                                                    value={newSubtaskPhase}
                                                    onChange={e => setNewSubtaskPhase(e.target.value as AuditPhase | '')}
                                                >
                                                    <option value="">- Phase Setup -</option>
                                                    {Object.values(AuditPhase).map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                                                </select>
                                                <select
                                                    className="w-1/5 min-w-[100px] glass-input py-2 text-sm"
                                                    value={newSubtaskRole}
                                                    onChange={e => setNewSubtaskRole(e.target.value as UserRole | '')}
                                                >
                                                    <option value="">- Role Setup -</option>
                                                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-20 glass-input py-2 text-sm"
                                                    value={newSubtaskOffset}
                                                    onChange={e => setNewSubtaskOffset(e.target.value)}
                                                    placeholder="+Days"
                                                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={addSubtask}
                                                    className="px-4 py-2 bg-navy-800 hover:bg-navy-700 text-brand-400 rounded-lg transition-colors border border-brand-500/20"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {isAdmin && (
                                    <div className="pt-6 border-t border-white/5 flex justify-end space-x-3">
                                        <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                                        <button type="submit" className="btn-primary flex items-center">
                                            <Save size={18} className="mr-2" /> Save Template
                                        </button>
                                    </div>
                                )}
                            </form>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                                <div className="p-6 bg-white/5 rounded-full border border-white/10">
                                    <Plus size={48} className="text-gray-500" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-300">No Template Selected</h4>
                                    <p className="text-sm text-gray-500 max-w-xs mx-auto">Select an existing template to edit or create a new one to standardize your firm's workflow.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateManager;
