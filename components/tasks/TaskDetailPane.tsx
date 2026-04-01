import React, { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2, Check, Eye,
    Sparkles, Book, ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, Client, SubTask, TaskComment, Resource, AuditPhase, Template, TemplateFolder, TaskType, TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../types';
import { TASK_TYPE_CHECKLISTS } from '../../constants/taskTypeChecklists';
import { KnowledgeService } from '../../services/knowledge';
import { TemplateService } from '../../services/templates';
import StaffSelect from '../StaffSelect';
import ClientSelect from '../ClientSelect';
import TaskComments from '../TaskComments';
import NepaliDatePicker from '../NepaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema, TaskFormValues } from '../../utils/validationSchemas';

interface TaskDetailPaneProps {
    task: Partial<Task>;
    isOpen: boolean;
    onClose: () => void;
    onSave: (taskData: any) => void;
    onDelete: (id: string) => void;
    onChange: (updates: Partial<Task>) => void;
    usersList: UserProfile[];
    clientsList: Client[];
    isSaving: boolean;
    isEditMode: boolean;
    canManageTask: boolean;
    dateMode: 'AD' | 'BS';
    setDateMode: (mode: 'AD' | 'BS') => void;
    newSubtaskTitle: string;
    setNewSubtaskTitle: (title: string) => void;
    onAddSubtask: (phase: AuditPhase | 'UNCATEGORIZED') => void;
    onAddComment: (comment: TaskComment) => void;
    onOpenClientDetail?: (clientId: string) => void;
    onInjectPhaseSubtasks?: (task: Task, newPhase: AuditPhase, templates: Template[]) => SubTask[] | null;
    onInjectStatusSubtasks?: (task: Task, newStatus: TaskStatus, templates: Template[]) => SubTask[] | null;
    onSwapPhaseChecklist?: (task: Task, newPhase: AuditPhase) => SubTask[];
    templates: Template[];
}

// ── Reusable boxed field wrapper ──────────────────────────────────────────
const Field: React.FC<{
    label: string;
    icon: React.ReactNode;
    error?: boolean;
    span2?: boolean;
    extra?: React.ReactNode;
    children: React.ReactNode;
}> = ({ label, icon, error, span2, extra, children }) => (
    <div className={`group flex flex-col items-start gap-2 py-2 ${span2 ? 'md:col-span-2' : ''}`}>
        <div className="flex items-center justify-between w-full">
            <label className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 ${error ? 'text-rose-400' : 'text-gray-500'}`}>
                {icon} {label}
            </label>
            {extra && <div>{extra}</div>}
        </div>
        <div className="w-full">
            {children}
        </div>
    </div>
);

const TaskDetailPane: React.FC<TaskDetailPaneProps> = ({
    task,
    isOpen,
    onClose,
    onSave,
    onDelete,
    onChange,
    usersList,
    clientsList,
    isSaving,
    isEditMode,
    canManageTask,
    dateMode,
    setDateMode,
    newSubtaskTitle,
    setNewSubtaskTitle,
    onAddSubtask,
    onAddComment,
    onOpenClientDetail,
    onInjectPhaseSubtasks,
    onInjectStatusSubtasks,
    onSwapPhaseChecklist,
    templates
}) => {
    const { user } = useAuth();
    const initialTaskRef = useRef<Partial<Task> | null>(null);
    const [showDiscardBanner, setShowDiscardBanner] = useState(false);
    const [suggestedResources, setSuggestedResources] = useState<Resource[]>([]);
    
    // Subtask & Template Import State
    const [templateFolders, setTemplateFolders] = useState<TemplateFolder[]>([]);
    const [importPhase, setImportPhase] = useState<AuditPhase | null>(null);
    const [localSubtaskTitles, setLocalSubtaskTitles] = useState<Record<AuditPhase | 'UNCATEGORIZED', string>>({
        [AuditPhase.ONBOARDING]: '',
        [AuditPhase.PLANNING_AND_EXECUTION]: '',
        [AuditPhase.REVIEW_AND_CONCLUSION]: '',
        UNCATEGORIZED: ''
    });

    const descRef = useRef<HTMLTextAreaElement | null>(null);

    // Auto-resize description textarea
    const autoResize = useCallback(() => {
        const el = descRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = Math.max(48, Math.min(el.scrollHeight, 240)) + 'px';
        }
    }, []);

    useEffect(() => {
        if (isOpen && task.title) {
            KnowledgeService.getAllResources().then(resources => {
                const keywords = task.title!.toLowerCase().split(' ').filter(w => w.length > 3);
                const matches = resources.filter(r =>
                    keywords.some(kw => r.title.toLowerCase().includes(kw) || r.category?.toLowerCase().includes(kw))
                ).slice(0, 3);
                setSuggestedResources(matches);
            });
            
            TemplateService.getFolders().then(setTemplateFolders).catch(() => {});
        }
    }, [isOpen, task.title]);

    // Snapshot task state whenever the pane opens
    useEffect(() => {
        if (isOpen) {
            initialTaskRef.current = JSON.parse(JSON.stringify(task));
            setShowDiscardBanner(false);
            reset({
                title: task.title || '',
                clientId: task.clientIds?.[0] || '',
                startDate: task.startDate || '',
                dueDate: task.dueDate || '',
                priority: task.priority || TaskPriority.MEDIUM,
                status: task.status || TaskStatus.NOT_STARTED,
                estimatedHours: task.totalTimeSpent || 0,
                assignedTo: task.assignedTo || [],
                teamLeaderId: task.teamLeaderId || '',
                description: task.description || '',
                auditPhase: task.auditPhase || AuditPhase.ONBOARDING,
            });
            // Auto-resize after reset
            requestAnimationFrame(() => autoResize());
        }
    }, [isOpen, task.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: task.title || '',
            clientId: task.clientIds?.[0] || '',
            startDate: task.startDate || '',
            dueDate: task.dueDate || '',
            priority: task.priority || TaskPriority.MEDIUM,
            status: task.status || TaskStatus.NOT_STARTED,
            estimatedHours: task.totalTimeSpent || 0,
            assignedTo: task.assignedTo || [],
            teamLeaderId: task.teamLeaderId || '',
            description: task.description || '',
            auditPhase: task.auditPhase || AuditPhase.ONBOARDING,
        }
    });

    // Wire up description register with ref for auto-resize
    const descRegister = register('description');

    const currentAssignees = watch('assignedTo') || [];
    const currentTeamLeader = watch('teamLeaderId');

    useEffect(() => {
        if (currentTeamLeader && !currentAssignees.includes(currentTeamLeader)) {
            setValue('teamLeaderId', '');
        }
    }, [currentAssignees, currentTeamLeader, setValue]);

    const hasUnsavedChanges = isOpen
        ? JSON.stringify(task) !== JSON.stringify(initialTaskRef.current)
        : false;

    const handleCloseAttempt = () => {
        if (hasUnsavedChanges) {
            setShowDiscardBanner(true);
        } else {
            onClose();
        }
    };

    const handleSave = (data: TaskFormValues) => {
        const fullSaveData = {
            ...task,
            title: data.title,
            description: data.description,
            priority: data.priority,
            status: data.status,
            startDate: data.startDate,
            dueDate: data.dueDate,
            assignedTo: data.assignedTo?.filter(id => id && id.trim() !== '') || [],
            teamLeaderId: data.teamLeaderId,
            totalTimeSpent: data.estimatedHours,
            clientIds: data.clientId ? [data.clientId] : [],
            clientName: clientsList.find(c => c.id === data.clientId)?.name || undefined,
            auditPhase: data.auditPhase,
        };
        onSave(fullSaveData);
        initialTaskRef.current = JSON.parse(JSON.stringify(fullSaveData));
        setShowDiscardBanner(false);
    };

    const toggleSubtask = (id: string) => {
        const updated = [...(task.subtasks || [])];
        const idx = updated.findIndex(u => u.id === id);
        if (idx > -1) {
            updated[idx] = { ...updated[idx], isCompleted: !updated[idx].isCompleted };
            onChange({ subtasks: updated });
        }
    };

    const onRemoveSubtaskLocal = (id: string) => {
        const updated = (task.subtasks || []).filter(st => st.id !== id);
        onChange({ subtasks: updated });
    };

    const handleQuickAddSubtask = () => {
        const title = localSubtaskTitles.UNCATEGORIZED?.trim();
        if (!title) return;
        
        const newSubtask: SubTask = {
            id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            createdBy: user?.displayName || 'unknown',
            phase: (watch('auditPhase') as AuditPhase) || undefined,
            isNew: true,
            isAutoGenerated: false
        };
        
        onChange({ subtasks: [...(task.subtasks || []), newSubtask] });
        setLocalSubtaskTitles(prev => ({ ...prev, UNCATEGORIZED: '' }));
    };

    const renderSubtask = (st: SubTask) => (
        <div key={st.id} className={`flex items-start gap-2.5 p-2 rounded-lg transition-all duration-300 group/st ${st.isNew ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-white/[0.04]'}`}>
            <div className="flex items-center gap-1.5 mt-0.5">
                {st.isAutoGenerated && (
                    <Sparkles size={10} className="text-indigo-400/60" />
                )}
                <button
                    onClick={() => toggleSubtask(st.id)}
                    className={`w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center transition-all ${st.isCompleted ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-slate-600 hover:border-slate-400'}`}
                >
                    {st.isCompleted && <Check size={10} strokeWidth={4} />}
                </button>
            </div>
            <div className="flex-1">
                <span className={`text-[13px] ${st.isCompleted ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                    {st.title}
                </span>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover/st:opacity-100 transition-opacity">
                <select
                    className="bg-white/[0.05] rounded pl-1 pr-4 py-0.5 text-[9px] text-gray-400 focus:outline-none cursor-pointer max-w-[80px] truncate"
                    value={st.assignedTo || ''}
                    onChange={(e) => {
                        const updated = [...(task.subtasks || [])];
                        const idx = updated.findIndex(u => u.id === st.id);
                        if (idx > -1) {
                            updated[idx].assignedTo = e.target.value;
                            onChange({ subtasks: updated });
                        }
                    }}
                >
                    <option value="" className="bg-[#1e293b]">Unassigned</option>
                    {usersList.map((u) => <option key={u.uid} value={u.uid} className="bg-[#1e293b]">{u.displayName}</option>)}
                </select>
                <button onClick={() => onRemoveSubtaskLocal(st.id)} className="text-gray-500 hover:text-rose-400">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );

    const handleImportTemplate = (template: Template) => {
        if (!importPhase) return;
        
        // Parse the template content (assuming it's a newline-separated list or JSON array of strings)
        let items: string[] = [];
        try {
            if (template.content.trim().startsWith('[')) {
                items = JSON.parse(template.content);
            } else {
                items = template.content.split('\n').map((line: string) => line.trim().replace(/^[-*]\s*/, '')).filter(Boolean);
            }
        } catch {
            items = [template.content];
        }

        const newSubtasks: SubTask[] = items.map(item => ({
            id: Math.random().toString(36).substring(2, 9),
            title: item,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            createdBy: 'unknown',
            phase: importPhase,
            isNew: true
        }));

        onChange({ subtasks: [...(task.subtasks || []), ...newSubtasks] });
        setImportPhase(null);
    };

    const selectClass = "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 transition-all text-sm text-left text-gray-200 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none cursor-pointer";

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
                        onClick={handleCloseAttempt}
                    />

                    {/* Centered Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="relative w-full max-w-[850px] max-h-[90vh] bg-[#0c0c0f] shadow-2xl border border-white/[0.08] rounded-2xl flex flex-col overflow-hidden z-50"
                    >
                        {/* Status color bar */}
                        <div className={`h-0.5 w-full ${
                            task.status === TaskStatus.COMPLETED ? 'bg-emerald-500' :
                            task.status === TaskStatus.HALTED ? 'bg-rose-500' :
                            task.status === TaskStatus.IN_PROGRESS ? 'bg-amber-500' :
                            task.status === TaskStatus.UNDER_REVIEW ? 'bg-amber-500' : 'bg-gray-600'
                        }`} />

                        {/* Header — slim */}
                        <div className="shrink-0 px-5 py-3 border-b border-white/[0.06] flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                                    {isEditMode ? <Edit2 size={12} className="text-amber-400" /> : <Plus size={12} className="text-amber-400" />}
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wide">
                                    {isEditMode ? 'Edit Task' : 'New Task'}
                                </h3>
                                {isEditMode && task.id && (
                                    <span className="text-[9px] text-gray-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">#{task.id.substring(0, 6).toUpperCase()}</span>
                                )}
                            </div>
                            <button
                                onClick={handleCloseAttempt}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content Split Layout */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#080a0c]">
                            
                            {/* Left Column (Main Properties & Details) */}
                            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 border-r border-white/[0.06] flex flex-col gap-6">
                                <div className="max-w-3xl w-full mx-auto flex flex-col gap-6">
                                    {/* ── PHASE PROGRESS TRACKER (Prompt 8) ── */}
                                    <div className="w-full py-4 px-2 mb-2">
                                        <div className="flex items-center justify-between relative">
                                            {/* Connecting Line */}
                                            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/5 -translate-y-1/2 z-0" />
                                            <div 
                                                className="absolute top-1/2 left-0 h-[2px] bg-gradient-to-r from-emerald-500 via-amber-500 to-brand-500 -translate-y-1/2 z-0 transition-all duration-1000" 
                                                style={{ 
                                                    width: watch('auditPhase') === AuditPhase.ONBOARDING ? '25%' : 
                                                           watch('auditPhase') === AuditPhase.PLANNING_AND_EXECUTION ? '65%' : '100%' 
                                                }} 
                                            />

                                            {[
                                                { id: AuditPhase.ONBOARDING, label: 'Onboarding', icon: <Sparkles size={14} />, color: 'emerald' },
                                                { id: AuditPhase.PLANNING_AND_EXECUTION, label: 'Execution', icon: <Activity size={14} />, color: 'amber' },
                                                { id: AuditPhase.REVIEW_AND_CONCLUSION, label: 'Conclusion', icon: <CheckCircle2 size={14} />, color: 'brand' }
                                            ].map((p, idx) => {
                                                const isActive = watch('auditPhase') === p.id;
                                                const isCompleted = (watch('auditPhase') === AuditPhase.PLANNING_AND_EXECUTION && p.id === AuditPhase.ONBOARDING) || 
                                                                    (watch('auditPhase') === AuditPhase.REVIEW_AND_CONCLUSION && (p.id === AuditPhase.ONBOARDING || p.id === AuditPhase.PLANNING_AND_EXECUTION));
                                                
                                                return (
                                                    <div key={p.id} className="relative z-10 flex flex-col items-center group">
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                                                            isActive ? `bg-navy-900 border-${p.color}-500 shadow-lg shadow-${p.color}-500/20 scale-110` :
                                                            isCompleted ? `bg-${p.color}-500 border-${p.color}-500 text-black` : 'bg-navy-950 border-white/10 text-gray-600'
                                                        }`}>
                                                            {isCompleted ? <Check size={18} strokeWidth={4} /> : p.icon}
                                                        </div>
                                                        <span className={`absolute -bottom-6 text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors duration-300 ${isActive ? `text-${p.color}-400` : 'text-gray-600'}`}>
                                                            {p.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ── Title ── */}
                                    <div className="group mt-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Assignment Name</label>
                                        </div>
                                        <input
                                            autoFocus
                                            className={`w-full bg-transparent text-3xl font-black ${errors.title ? 'text-rose-400' : 'text-white'} placeholder:text-navy-800 focus:outline-none border-none px-0 transition-all tracking-tight`}
                                            placeholder="Audit engagement title..."
                                            {...register('title')}
                                        />
                                        <div className={`w-full h-px mt-2 ${errors.title ? 'bg-rose-500/50' : 'bg-white/5'} group-focus-within:bg-brand-500/40 transition-colors`} />
                                        {errors.title && <p className="text-rose-400 text-[10px] font-bold mt-1 uppercase tracking-widest">{errors.title.message}</p>}
                                    </div>

                                    {/* ── Description ── */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Scope & Objectives</label>
                                        <textarea
                                            className="w-full bg-white/5 border border-white/10 focus:border-brand-500/50 rounded-2xl p-5 text-[14px] leading-relaxed resize-none text-gray-300 placeholder:text-gray-700 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all hover:border-white/20 glass-panel"
                                            placeholder="Define the engagement scope, limitations and key objectives..."
                                            style={{ minHeight: '120px' }}
                                            {...descRegister}
                                            ref={e => {
                                                descRegister.ref(e);
                                                descRef.current = e;
                                            }}
                                            onInput={autoResize}
                                        />
                                    </div>

                                    {/* ── Properties Grid ── */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 py-8 border-y border-white/[0.06] bg-white/[0.01] rounded-3xl px-6">
                                        <Field label="Client" icon={<Briefcase size={12} className="text-brand-400" />} error={!!errors.clientId}
                                            extra={watch('clientId') && onOpenClientDetail ? (
                                                <button onClick={(e) => { e.preventDefault(); onOpenClientDetail(watch('clientId')!); }} className="text-[10px] font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest transition-colors">
                                                    Profile
                                                </button>
                                            ) : undefined}
                                        >
                                            <Controller name="clientId" control={control} render={({ field }) => (
                                                <ClientSelect clients={clientsList} value={field.value} onChange={field.onChange} />
                                            )} />
                                        </Field>

                                        {/* Task Type / Engagement (Prominent) */}
                                        <div className="col-span-1 lg:col-span-2 py-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Activity size={12} className="text-brand-400" />
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Engagement Framework</label>
                                                </div>
                                                {watch('taskType') && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setValue('taskType', undefined);
                                                            onChange({ taskType: undefined, subtasks: [] });
                                                        }}
                                                        className="text-[10px] font-black text-rose-500 hover:text-rose-400 transition-colors uppercase tracking-widest"
                                                    >
                                                        Reset Framework
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {Object.values(TaskType).map((type) => {
                                                    const isSelected = watch('taskType') === type;
                                                    const IconComponent = {
                                                        ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
                                                    }[TASK_TYPE_ICONS[type]] || Activity;

                                                    return (
                                                        <button
                                                            key={type}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const prevType = watch('taskType');
                                                                if (prevType === type) return;

                                                                setValue('taskType', type);
                                                                const phase = watch('auditPhase') || AuditPhase.ONBOARDING;
                                                                const items = TASK_TYPE_CHECKLISTS[type]?.[phase] || [];
                                                                
                                                                const newAutoSubtasks: SubTask[] = items.map(item => ({
                                                                    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                                                    title: item.title,
                                                                    isCompleted: false,
                                                                    minimumRequirement: item.minimumRequirement,
                                                                    createdAt: new Date().toISOString(),
                                                                    createdBy: 'system',
                                                                    phase: phase as AuditPhase,
                                                                    isAutoGenerated: true,
                                                                    isNew: true
                                                                }));

                                                                const manualSubtasks = (task.subtasks || []).filter(s => !s.isAutoGenerated);
                                                                const updatedSubtasks = [...manualSubtasks, ...newAutoSubtasks];
                                                                
                                                                onChange({ taskType: type, subtasks: updatedSubtasks });
                                                                toast.success(`Framework Loaded: ${TASK_TYPE_LABELS[type]}`);
                                                            }}
                                                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-300 relative group overflow-hidden ${
                                                                isSelected 
                                                                ? 'bg-brand-500 border-brand-400 text-white shadow-2xl shadow-brand-500/30 scale-[1.03]' 
                                                                : 'bg-navy-950 border-white/5 text-gray-500 hover:border-white/20'
                                                            }`}
                                                        >
                                                            <div className={`mb-3 p-2.5 rounded-xl transition-all duration-300 ${isSelected ? 'bg-white/20 scale-110' : 'bg-white/5 group-hover:bg-white/10 group-hover:text-white'}`}>
                                                                <IconComponent size={20} />
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase tracking-tighter leading-tight px-1">
                                                                {TASK_TYPE_LABELS[type]}
                                                            </span>
                                                            {isSelected && (
                                                                <motion.div layoutId="selection-check" className="absolute top-2 right-2 bg-white rounded-full p-0.5">
                                                                    <Check size={8} className="text-brand-600" strokeWidth={5} />
                                                                </motion.div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <Field label="Assignment Status" icon={<Activity size={12} className="text-brand-400" />} error={!!errors.status}>
                                            <select 
                                                className={selectClass} 
                                                {...register('status')}
                                                onChange={(e) => {
                                                    const newStatus = e.target.value as TaskStatus;
                                                    register('status').onChange(e);
                                                    if (onInjectStatusSubtasks) {
                                                        const injected = onInjectStatusSubtasks(task as Task, newStatus, templates);
                                                        if (injected) {
                                                            onChange({ status: newStatus, subtasks: [...(task.subtasks || []), ...injected] });
                                                        } else {
                                                            onChange({ status: newStatus });
                                                        }
                                                    } else {
                                                        onChange({ status: newStatus });
                                                    }
                                                }}
                                            >
                                                {Object.values(TaskStatus).map(s => (
                                                    <option key={s} value={s} className="bg-navy-950 text-white font-bold">{s.replace('_', ' ').toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </Field>

                                        <Field label="Priority Level" icon={<AlertTriangle size={12} className="text-brand-400" />} error={!!errors.priority}>
                                            <select className={selectClass} {...register('priority')}>
                                                {Object.values(TaskPriority).map(p => (
                                                    <option key={p} value={p} className="bg-navy-950 text-white font-bold">{p.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </Field>

                                        <Field label="Team Deployment" icon={<UserCircle2 size={12} className="text-brand-400" />}>
                                            <Controller name="assignedTo" control={control} render={({ field }) => (
                                                <StaffSelect users={usersList} value={field.value || []} onChange={field.onChange} multi={true} />
                                            )} />
                                        </Field>

                                        <Field label="Engagement Lead" icon={<ShieldAlert size={12} className="text-brand-400" />} error={!!errors.teamLeaderId}>
                                            <select className={selectClass} {...register('teamLeaderId')}>
                                                <option value="" className="bg-navy-950 text-gray-500">— Unassigned —</option>
                                                {usersList.filter(u => currentAssignees.includes(u.uid)).map(u => (
                                                    <option key={u.uid} value={u.uid} className="bg-navy-950 text-white font-medium">{u.displayName}</option>
                                                ))}
                                            </select>
                                        </Field>

                                        {/* Date Management Section */}
                                        <div className="col-span-1 lg:col-span-2 pt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={12} className="text-brand-400" />
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Timeline Schedules</label>
                                                </div>
                                                <div className="flex bg-navy-950 p-1 rounded-xl border border-white/5">
                                                    {(['AD', 'BS'] as const).map(mode => (
                                                        <button 
                                                            key={mode} 
                                                            onClick={(e) => { e.preventDefault(); setDateMode(mode); }} 
                                                            className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${dateMode === mode ? 'bg-brand-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                                        >
                                                            {mode}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6 pb-2">
                                                <div className="space-y-2">
                                                    <span className="text-[9px] font-black text-navy-800 uppercase tracking-[0.1em] ml-1">Commencement</span>
                                                    <Controller name="startDate" control={control} render={({ field }) => dateMode === 'AD' ? (
                                                        <input type="date" value={field.value || ''} onChange={field.onChange} className={`${selectClass} font-mono`} />
                                                    ) : ( <div className="w-full"><NepaliDatePicker value={field.value || ''} onChange={field.onChange} placeholder="Launch Date" /></div> )} />
                                                </div>
                                                <div className="space-y-2">
                                                    <span className="text-[9px] font-black text-navy-800 uppercase tracking-[0.1em] ml-1">Final Submission</span>
                                                    <Controller name="dueDate" control={control} render={({ field }) => dateMode === 'AD' ? (
                                                        <input type="date" value={field.value || ''} onChange={field.onChange} className={`${selectClass} font-mono`} />
                                                    ) : ( <div className="w-full"><NepaliDatePicker value={field.value || ''} onChange={field.onChange} placeholder="Deadline" /></div> )} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── SEGMENTED PHASE PICKER (Prompt 8) ── */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Workflows & Subtasks</label>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.preventDefault(); setImportPhase((watch('auditPhase') as AuditPhase) || AuditPhase.ONBOARDING); }}
                                                className="text-[10px] font-black tracking-widest uppercase text-brand-400 hover:text-brand-300 hover:bg-brand-400/10 px-3 py-1.5 flex items-center gap-2 rounded-xl transition-all border border-brand-500/20"
                                            >
                                                <Book size={12} /> Load Procedures
                                            </button>
                                        </div>

                                        {/* Picker Tabs */}
                                        <div className="flex p-1 bg-navy-950/50 rounded-2xl border border-white/5 backdrop-blur-md">
                                            {[
                                                { id: AuditPhase.ONBOARDING, label: 'Onboarding', icon: <Sparkles size={12} /> },
                                                { id: AuditPhase.PLANNING_AND_EXECUTION, label: 'Execution', icon: <Activity size={12} /> },
                                                { id: AuditPhase.REVIEW_AND_CONCLUSION, label: 'Conclusion', icon: <CheckCircle2 size={12} /> }
                                            ].map((phase) => {
                                                const isActive = (watch('auditPhase') === phase.id);
                                                return (
                                                    <button
                                                        key={phase.id}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setValue('auditPhase', phase.id);
                                                            // Logic for phase change already exists in the select handler, 
                                                            // but we might need to trigger it manually here if we removed the select.
                                                        }}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                            isActive 
                                                            ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                                        }`}
                                                    >
                                                        {phase.icon}
                                                        <span className="hidden sm:inline">{phase.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Subtask Content Filtered by Phase */}
                                        <div className="space-y-4 pt-2">
                                            {/* Requirements notice for the active phase */}
                                            {watch('taskType') && (
                                                <div className="bg-brand-500/5 border border-brand-500/10 rounded-2xl p-4 flex items-start gap-3">
                                                    <ShieldCheck size={16} className="text-brand-400 mt-0.5 shrink-0" />
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] text-white font-bold uppercase tracking-widest">Phase Compliance Requirements</p>
                                                        <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                                                            Completing all {watch('taskType')?.toLowerCase()} checklist items in this phase is mandatory for audit trail integrity.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Auto-generated checklist items */}
                                            {task.subtasks?.some(s => s.isAutoGenerated && s.phase === watch('auditPhase')) && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="h-px flex-1 bg-white/[0.06]" />
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 px-2 py-1 bg-white/[0.02] border border-white/[0.04] rounded-md backdrop-blur-sm">
                                                            <Sparkles size={10} className="text-brand-400" />
                                                            Protocol Requirements
                                                        </span>
                                                        <div className="h-px flex-1 bg-white/[0.06]" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        {task.subtasks.filter(s => s.isAutoGenerated && s.phase === watch('auditPhase')).map(st => renderSubtask(st))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Manually added items for this phase */}
                                            <div className="space-y-2">
                                                {task.subtasks?.some(s => !s.isAutoGenerated && s.phase === watch('auditPhase')) && (
                                                    <div className="flex items-center gap-2 mt-6 mb-3">
                                                        <div className="h-px flex-1 bg-white/[0.06]" />
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 px-2 py-1 bg-white/[0.02] border border-white/[0.04] rounded-md backdrop-blur-sm">
                                                            <UserCircle2 size={10} className="text-emerald-400" />
                                                            Local Adjustments
                                                        </span>
                                                        <div className="h-px flex-1 bg-white/[0.06]" />
                                                    </div>
                                                )}
                                                
                                                <div className="space-y-1">
                                                    {task.subtasks?.filter(s => !s.isAutoGenerated && s.phase === watch('auditPhase')).map(st => renderSubtask(st))}
                                                </div>

                                                {/* Quick Add Subtask for THE ACTIVE PHASE */}
                                                <div className="flex gap-2 items-center group/add px-3 py-2.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all mt-4 glass-panel">
                                                    <Plus size={16} className="text-gray-600 group-hover/add:text-brand-400 transition-colors" />
                                                    <input
                                                        type="text"
                                                        value={localSubtaskTitles[watch('auditPhase') as AuditPhase || AuditPhase.ONBOARDING] || ''}
                                                        onChange={(e) => setLocalSubtaskTitles(prev => ({ 
                                                            ...prev, 
                                                            [watch('auditPhase') as AuditPhase || AuditPhase.ONBOARDING]: e.target.value 
                                                        }))}
                                                        placeholder={`Define new ${(watch('auditPhase') || 'onboarding').toLowerCase()} task...`}
                                                        className="flex-1 bg-transparent text-[13px] text-gray-400 focus:text-white placeholder:text-navy-800 outline-none font-medium"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const phase = watch('auditPhase') as AuditPhase || AuditPhase.ONBOARDING;
                                                                const title = localSubtaskTitles[phase]?.trim();
                                                                if (!title) return;
                                                                
                                                                const newSubtask: SubTask = {
                                                                    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                                                    title,
                                                                    isCompleted: false,
                                                                    createdAt: new Date().toISOString(),
                                                                    createdBy: user?.displayName || 'unknown',
                                                                    phase,
                                                                    isNew: true,
                                                                    isAutoGenerated: false
                                                                };
                                                                
                                                                onChange({ subtasks: [...(task.subtasks || []), newSubtask] });
                                                                setLocalSubtaskTitles(prev => ({ ...prev, [phase]: '' }));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {(!task.subtasks || task.subtasks.filter(s => s.phase === watch('auditPhase')).length === 0) && (
                                                <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-navy-950/20 group/empty">
                                                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4 group-hover/empty:scale-110 transition-transform">
                                                        <ClipboardCheck size={28} className="text-navy-800" />
                                                    </div>
                                                    <p className="text-[12px] text-gray-500 font-bold uppercase tracking-widest mb-1">Pristine Protocol</p>
                                                    <p className="text-[11px] text-gray-700 italic">No tasks specified for this workflow stage.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* ── Attachments Drag and Drop ── */}
                                    <div className="space-y-3 mt-6 border-t border-white/[0.06] pt-6">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <Tag size={12} /> Attachments
                                        </label>
                                        <div className="w-full border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-white/[0.02] hover:border-brand-500/30 transition-all cursor-pointer group">
                                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:bg-brand-500/20 transition-all">
                                                <Plus size={18} className="text-gray-400 group-hover:text-brand-400 transition-colors" />
                                            </div>
                                            <h4 className="text-sm font-bold text-gray-300 mb-1">Upload Files</h4>
                                            <p className="text-[11px] text-gray-500 max-w-[200px]">Drag and drop files here, or click to browse (Max 5MB)</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    {/* Footer Actions — slim */}
                    <div className="px-5 py-3 border-t border-white/[0.06] flex justify-between items-center bg-black/20">
                        {isEditMode && canManageTask ? (
                            <button
                                onClick={() => onDelete(task.id!)}
                                className="px-3 py-1.5 text-red-400 hover:text-red-300 text-[11px] font-bold flex items-center gap-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-all border border-red-500/20"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        ) : <div />}
                        <div className="flex gap-2">
                            <button
                                onClick={handleCloseAttempt}
                                className="px-4 py-2 text-gray-400 hover:text-white text-[11px] font-bold bg-white/[0.03] rounded-lg transition-all border border-white/[0.05] hover:bg-white/[0.08]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit(handleSave)}
                                disabled={isSaving}
                                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold transition-all shadow-lg shadow-amber-600/20 flex items-center gap-1.5"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {isEditMode ? 'Update Task' : 'Create Task'}
                            </button>
                        </div>
                    </div>

                    {/* Unsaved changes discard banner */}
                    <AnimatePresence>
                        {showDiscardBanner && (
                            <motion.div
                                key="discard-banner"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 8 }}
                                transition={{ duration: 0.15 }}
                                className="px-5 py-3 bg-amber-500/10 border-t border-amber-500/20 flex items-center justify-between gap-3"
                            >
                                <div className="flex items-center gap-2 text-amber-400">
                                    <AlertTriangle size={13} className="flex-shrink-0" />
                                    <span className="text-[11px] font-semibold">Unsaved changes. Discard?</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button
                                        onClick={() => setShowDiscardBanner(false)}
                                        className="px-3 py-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-md border border-amber-500/20 transition-all"
                                    >
                                        Keep Editing
                                    </button>
                                    <button
                                        onClick={() => { setShowDiscardBanner(false); onClose(); }}
                                        className="px-3 py-1 text-[10px] font-bold text-white bg-rose-600/80 hover:bg-rose-600 rounded-md transition-all"
                                    >
                                        Discard
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        )}
            
            {/* ── Subtask Template Import Modal ── */}
            {importPhase && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <Book size={16} className="mr-2 text-purple-400" />
                                Import into {importPhase.replace(/_/g, ' ')}
                            </h3>
                            <button onClick={() => setImportPhase(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-[#080a0c]">
                            {templateFolders.length > 0 ? (
                                <div className="space-y-6">
                                    {templateFolders.map(folder => {
                                        const folderTemplates = templates.filter(t => t.folderId === folder.id);
                                        if (folderTemplates.length === 0) return null;
                                        return (
                                            <div key={folder.id} className="space-y-2">
                                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">{folder.name}</h4>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {folderTemplates.map(template => (
                                                        <button 
                                                            key={template.id} 
                                                            onClick={(() => handleImportTemplate(template))}
                                                            className="flex items-center gap-3 w-full text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-purple-500/10 hover:border-purple-500/30 transition-all group"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/20 transition-colors">
                                                                <CheckCircle2 size={14} className="text-gray-400 group-hover:text-purple-400" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-semibold text-gray-200 group-hover:text-white">{template.name}</p>
                                                                {template.description && <p className="text-[11px] text-gray-500 line-clamp-1">{template.description}</p>}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity bg-purple-500/10 px-2 py-1 rounded">
                                                                INSERT
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Uncategorized Templates */}
                                    {templates.filter(t => !t.folderId).length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Other Templates</h4>
                                            <div className="grid grid-cols-1 gap-2">
                                                {templates.filter(t => !t.folderId).map(template => (
                                                    <button 
                                                        key={template.id} 
                                                        onClick={(() => handleImportTemplate(template))}
                                                        className="flex items-center gap-3 w-full text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-purple-500/10 hover:border-purple-500/30 transition-all group"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center flex-shrink-0">
                                                            <CheckCircle2 size={14} className="text-gray-400" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-semibold text-gray-200">{template.name}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <Book size={32} className="mx-auto mb-3 opacity-20" />
                                    <p className="font-medium">No templates found</p>
                                    <p className="text-xs mt-1">Create checklist templates in the Resources hub.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default TaskDetailPane;
