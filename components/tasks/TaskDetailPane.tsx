import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2, Check, Eye,
    Sparkles, Book
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, Client, SubTask, TaskComment, Resource, AuditPhase, Template, TemplateFolder } from '../../types';
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
    onAddSubtask: () => void;
    onRemoveSubtask: (id: string) => void;
    onAddComment: (comment: TaskComment) => void;
    onOpenClientDetail?: (clientId: string) => void;
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
    onRemoveSubtask,
    onAddComment,
    onOpenClientDetail
}) => {
    const initialTaskRef = useRef<Partial<Task> | null>(null);
    const [showDiscardBanner, setShowDiscardBanner] = useState(false);
    const [suggestedResources, setSuggestedResources] = useState<Resource[]>([]);
    
    // Subtask & Template Import State
    const [templates, setTemplates] = useState<Template[]>([]);
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
            
            TemplateService.getAllTemplates('CHECKLIST').then(setTemplates).catch(() => {});
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

    const handleAddPhaseSubtask = (phase: AuditPhase | 'UNCATEGORIZED') => {
        const title = localSubtaskTitles[phase]?.trim();
        if (!title) return;
        
        const newSubtask: SubTask = {
            id: Math.random().toString(36).substring(2, 9),
            title,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            createdBy: 'unknown',
            phase: phase !== 'UNCATEGORIZED' ? phase : undefined
        };
        
        onChange({ subtasks: [...(task.subtasks || []), newSubtask] });
        setLocalSubtaskTitles(prev => ({ ...prev, [phase]: '' }));
    };

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
            phase: importPhase
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
                                    {/* ── Title ── */}
                                    <div className="group">
                                        <input
                                            autoFocus
                                            className={`w-full bg-transparent text-xl font-bold ${errors.title ? 'text-red-400' : 'text-white'} placeholder:text-gray-700 focus:outline-none border-none px-0 transition-all`}
                                            placeholder="Task Title..."
                                            {...register('title')}
                                        />
                                        <div className={`w-full h-px mt-1 ${errors.title ? 'bg-red-500/50' : 'bg-transparent'} group-focus-within:bg-emerald-500/40 transition-colors`} />
                                        {errors.title && <p className="text-red-400 text-[10px] mt-1">{errors.title.message}</p>}
                                    </div>

                                    {/* ── Description ── */}
                                    <textarea
                                        className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 rounded-xl p-4 text-[13px] leading-relaxed resize-none text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all hover:border-white/20"
                                        placeholder="Add a detailed description..."
                                        style={{ minHeight: '100px', maxHeight: '300px' }}
                                        {...descRegister}
                                        ref={e => {
                                            descRegister.ref(e);
                                            descRef.current = e;
                                        }}
                                        onInput={autoResize}
                                    />

                                    {/* ── Properties Grid ── */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 py-6 border-y border-white/[0.06]">
                                        <Field label="Client" icon={<Briefcase size={11} className="text-gray-400" />} error={!!errors.clientId}
                                            extra={watch('clientId') && onOpenClientDetail ? (
                                                <button onClick={(e) => { e.preventDefault(); onOpenClientDetail(watch('clientId')!); }} className="text-[9px] font-bold text-emerald-400 hover:underline">
                                                    View
                                                </button>
                                            ) : undefined}
                                        >
                                            <Controller name="clientId" control={control} render={({ field }) => (
                                                <ClientSelect clients={clientsList} value={field.value} onChange={field.onChange} />
                                            )} />
                                        </Field>

                                        <Field label="Audit Phase" icon={<Sparkles size={11} className="text-gray-400" />} error={!!errors.auditPhase}>
                                            <div className="relative">
                                                <select className={`${selectClass} appearance-none pl-9`} {...register('auditPhase')}>
                                                    <option value={AuditPhase.ONBOARDING} className="bg-[#1e293b]">🌱 Onboarding</option>
                                                    <option value={AuditPhase.PLANNING_AND_EXECUTION} className="bg-[#1e293b]">⚙️ Planning & Execution</option>
                                                    <option value={AuditPhase.REVIEW_AND_CONCLUSION} className="bg-[#1e293b]">✅ Review & Conclusion</option>
                                                </select>
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                    {watch('auditPhase') === AuditPhase.ONBOARDING && <Sparkles size={14} className="text-emerald-400" />}
                                                    {watch('auditPhase') === AuditPhase.PLANNING_AND_EXECUTION && <Activity size={14} className="text-amber-400" />}
                                                    {watch('auditPhase') === AuditPhase.REVIEW_AND_CONCLUSION && <CheckCircle2 size={14} className="text-brand-400" />}
                                                    {!watch('auditPhase') && <Sparkles size={14} />}
                                                </div>
                                            </div>
                                        </Field>

                                        <Field label="Status" icon={<Activity size={12} className="text-gray-400" />} error={!!errors.status}>
                                            <select className={selectClass} {...register('status')}>
                                                {Object.values(TaskStatus).map(s => <option key={s} value={s} className="bg-[#1e293b]">{s.replace('_', ' ')}</option>)}
                                            </select>
                                        </Field>

                                        <Field label="Priority" icon={<AlertTriangle size={11} className="text-gray-400" />} error={!!errors.priority}>
                                            <select className={selectClass} {...register('priority')}>
                                                {Object.values(TaskPriority).map(p => <option key={p} value={p} className="bg-[#1e293b]">{p}</option>)}
                                            </select>
                                        </Field>

                                        <Field label="Assignees" icon={<UserCircle2 size={11} className="text-gray-400" />}>
                                            <Controller name="assignedTo" control={control} render={({ field }) => (
                                                <StaffSelect users={usersList} value={field.value || []} onChange={field.onChange} multi={true} />
                                            )} />
                                        </Field>

                                        <Field label="Team Leader" icon={<ShieldAlert size={11} className="text-gray-400" />} error={!!errors.teamLeaderId}>
                                            <select className={selectClass} {...register('teamLeaderId')}>
                                                <option value="" className="bg-[#1e293b] text-gray-500">— Unassigned —</option>
                                                {usersList.filter(u => currentAssignees.includes(u.uid)).map(u => <option key={u.uid} value={u.uid} className="bg-[#1e293b] text-white">{u.displayName}</option>)}
                                            </select>
                                        </Field>

                                        <Field label="Dates" icon={<Calendar size={12} className="text-gray-400" />} span2
                                            extra={
                                                <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-md border border-white/10">
                                                    {(['AD', 'BS'] as const).map(mode => (
                                                        <button key={mode} onClick={(e) => { e.preventDefault(); setDateMode(mode); }} className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${dateMode === mode ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>{mode}</button>
                                                    ))}
                                                </div>
                                            }>
                                            <div className="flex items-center gap-4 w-full">
                                                <div className="flex-1 relative">
                                                    <span className="absolute -top-2 left-3 bg-[#0c0c0f] px-1 text-[9px] font-bold text-gray-500 z-10">START</span>
                                                    <Controller name="startDate" control={control} render={({ field }) => dateMode === 'AD' ? (
                                                        <input type="date" value={field.value || ''} onChange={field.onChange} className={`${selectClass} text-gray-300 [&::-webkit-calendar-picker-indicator]:invert-[0.6] [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100`} />
                                                    ) : ( <div className="w-full relative z-20"><NepaliDatePicker value={field.value || ''} onChange={field.onChange} placeholder="Start date" /></div> )} />
                                                </div>
                                                <div className="w-px h-6 bg-white/[0.06]" />
                                                <div className="flex-1 relative">
                                                    <span className="absolute -top-2 left-3 bg-[#0c0c0f] px-1 text-[9px] font-bold text-gray-500 z-10">DUE</span>
                                                    <Controller name="dueDate" control={control} render={({ field }) => dateMode === 'AD' ? (
                                                        <input type="date" value={field.value || ''} onChange={field.onChange} className={`${selectClass} text-gray-300 [&::-webkit-calendar-picker-indicator]:invert-[0.6] [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100`} />
                                                    ) : ( <div className="w-full relative z-20"><NepaliDatePicker value={field.value || ''} onChange={field.onChange} placeholder="Due date" /></div> )} />
                                                </div>
                                            </div>
                                        </Field>
                                    </div>

                                    {/* ── Subtasks (Phase-Wise) ── */}
                                    <div className="space-y-6">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                                            <span>Subtasks ({task.subtasks?.length || 0})</span>
                                        </label>

                                        {(['UNCATEGORIZED', AuditPhase.ONBOARDING, AuditPhase.PLANNING_AND_EXECUTION, AuditPhase.REVIEW_AND_CONCLUSION] as const).map(phase => {
                                            const isUncategorized = phase === 'UNCATEGORIZED';
                                            const phaseSubtasks = task.subtasks?.filter(s => isUncategorized ? !s.phase : s.phase === phase) || [];
                                            
                                            if (isUncategorized && phaseSubtasks.length === 0) return null;

                                            return (
                                                <div key={phase} className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                                                    {/* Phase Header */}
                                                    <div className="bg-black/20 px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {phase === AuditPhase.ONBOARDING && <Sparkles size={13} className="text-emerald-400" />}
                                                            {phase === AuditPhase.PLANNING_AND_EXECUTION && <Activity size={13} className="text-amber-400" />}
                                                            {phase === AuditPhase.REVIEW_AND_CONCLUSION && <CheckCircle2 size={13} className="text-brand-400" />}
                                                            {isUncategorized && <AlertTriangle size={13} className="text-gray-400" />}
                                                            <h4 className={`text-xs font-bold ${isUncategorized ? 'text-gray-400' : 'text-white'}`}>
                                                                {isUncategorized ? 'General' : phase.replace(/_/g, ' ')}
                                                            </h4>
                                                            <span className="text-[10px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-full font-mono">
                                                                {phaseSubtasks.length}
                                                            </span>
                                                        </div>
                                                        
                                                        {!isUncategorized && (
                                                            <button 
                                                                onClick={(e) => { e.preventDefault(); setImportPhase(phase); }}
                                                                className="text-[10px] font-bold tracking-wider uppercase text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 px-2 py-1 flex items-center gap-1.5 rounded transition-colors"
                                                            >
                                                                <Book size={10} /> Import Template
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Subtasks List */}
                                                    <div className="p-2 space-y-1">
                                                        {phaseSubtasks.map((st) => (
                                                            <div key={st.id} className="flex items-center justify-between p-2 hover:bg-white/[0.03] rounded-lg group transition-colors">
                                                                <div className="flex items-start gap-3 flex-1">
                                                                    <div
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const updated = [...(task.subtasks || [])];
                                                                            const idx = updated.findIndex(u => u.id === st.id);
                                                                            if (idx > -1) {
                                                                                updated[idx] = { ...updated[idx], isCompleted: !updated[idx].isCompleted };
                                                                                onChange({ subtasks: updated });
                                                                            }
                                                                        }}
                                                                        className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer transition-all flex-shrink-0 mt-0.5
                                                                            ${st.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-transparent hover:border-emerald-400'}`}
                                                                    >
                                                                        {st.isCompleted && <Check size={10} className="text-white" strokeWidth={3} />}
                                                                    </div>
                                                                    <span className={`text-[12px] pt-0.5 ${st.isCompleted ? 'line-through text-gray-600' : 'text-gray-300'} transition-all`}>
                                                                        {st.title}
                                                                    </span>
                                                                </div>
                                                                <div className={`flex items-center gap-2 transition-opacity ${st.assignedTo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
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
                                                                    <button onClick={() => onRemoveSubtask(st.id)} className="text-gray-500 hover:text-rose-400 focus:opacity-100">
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {/* Quick Add Input for this Phase */}
                                                        <div className="flex gap-2 items-center group/add px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors mt-1">
                                                            <Plus size={14} className="text-gray-500 group-hover/add:text-gray-400 ml-1" />
                                                            <input
                                                                type="text"
                                                                value={localSubtaskTitles[phase]}
                                                                onChange={(e) => setLocalSubtaskTitles(prev => ({ ...prev, [phase]: e.target.value }))}
                                                                placeholder={`Add a subtask to ${isUncategorized ? 'General' : phase.replace(/_/g, ' ')}...`}
                                                                className="flex-1 bg-transparent text-[12px] text-gray-400 focus:text-gray-200 placeholder:text-gray-600 outline-none"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleAddPhaseSubtask(phase);
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
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

                            {/* Right Column (Sidebar Activity) TEMPORARILY DISABLED to give main grid more horizontal space */}
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
