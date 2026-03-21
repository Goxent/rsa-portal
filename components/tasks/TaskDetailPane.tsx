import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2, Check, Eye,
    Sparkles, Book
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, Client, SubTask, TaskComment, Resource, AuditPhase } from '../../types';
import { KnowledgeService } from '../../services/knowledge';
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

// ── Reusable compact field wrapper ──────────────────────────────────────────
const Field: React.FC<{
    label: string;
    icon: React.ReactNode;
    error?: boolean;
    span2?: boolean;
    extra?: React.ReactNode;
    children: React.ReactNode;
}> = ({ label, icon, error, span2, extra, children }) => (
    <div className={`flex flex-col gap-1.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3 rounded-xl border ${error ? 'border-red-500/40' : 'border-white/[0.05]'} ${span2 ? 'md:col-span-2' : ''}`}>
        <div className="flex items-center justify-between">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                {icon} {label}
            </label>
            {extra}
        </div>
        {children}
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

    const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<TaskFormValues>({
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
            assignedTo: data.assignedTo,
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

    const selectClass = "w-full bg-transparent text-[13px] font-semibold text-gray-200 focus:text-white focus:outline-none py-0.5 cursor-pointer";

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={handleCloseAttempt}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 12 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.7 }}
                        className="relative w-full max-w-2xl bg-[#0c0c0f] shadow-2xl border border-white/[0.08] flex flex-col max-h-[92vh] rounded-2xl overflow-hidden"
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

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="flex flex-col gap-4 px-5 py-4 pb-6">

                                {/* ── Title ── */}
                                <div className="group">
                                    <input
                                        autoFocus
                                        className={`w-full bg-transparent text-lg font-bold ${errors.title ? 'text-red-400' : 'text-white'} placeholder:text-gray-700 focus:outline-none border-none px-0 transition-all`}
                                        placeholder="Task Title..."
                                        {...register('title')}
                                    />
                                    <div className={`w-full h-px mt-1 ${errors.title ? 'bg-red-500/50' : 'bg-white/[0.04]'} group-focus-within:bg-amber-500/40 transition-colors`} />
                                    {errors.title && <p className="text-red-400 text-[10px] mt-1">{errors.title.message}</p>}
                                </div>

                                {/* ── Description — auto-resize ── */}
                                <textarea
                                    className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-amber-500/30 rounded-xl p-3 text-[13px] leading-relaxed resize-none text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/10 transition-all"
                                    placeholder="Describe the work... (@ to mention staff)"
                                    style={{ minHeight: '48px', maxHeight: '240px' }}
                                    {...descRegister}
                                    ref={e => {
                                        descRegister.ref(e);
                                        descRef.current = e;
                                    }}
                                    onInput={autoResize}
                                />

                                {/* ── Context: Client + Audit Phase ── */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <Field label="Client" icon={<Briefcase size={11} className="text-amber-400" />} error={!!errors.clientId}
                                        extra={watch('clientId') && onOpenClientDetail ? (
                                            <button
                                                onClick={(e) => { e.preventDefault(); onOpenClientDetail(watch('clientId')!); }}
                                                className="text-[8px] font-black text-amber-400 hover:text-amber-300 uppercase tracking-widest flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 transition-all"
                                            >
                                                <Eye size={9} /> View
                                            </button>
                                        ) : undefined}
                                    >
                                        <Controller
                                            name="clientId"
                                            control={control}
                                            render={({ field }) => (
                                                <ClientSelect clients={clientsList} value={field.value} onChange={field.onChange} />
                                            )}
                                        />
                                        {errors.clientId && <p className="text-red-400 text-[10px]">{errors.clientId.message}</p>}
                                    </Field>

                                    <Field label="Audit Phase" icon={<Sparkles size={11} className="text-amber-400" />} error={!!errors.auditPhase}>
                                        <select className={selectClass} {...register('auditPhase')}>
                                            {Object.values(AuditPhase).map(ph => (
                                                <option key={ph} value={ph} className="bg-[#1e293b]">{ph.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>

                                {/* ── Status + Priority ── */}
                                <div className="grid grid-cols-2 gap-2">
                                    <Field label="Status" icon={<Activity size={11} className="text-amber-400" />} error={!!errors.status}>
                                        <select className={selectClass} {...register('status')}>
                                            {Object.values(TaskStatus).map(s => <option key={s} value={s} className="bg-[#1e293b]">{s.replace('_', ' ')}</option>)}
                                        </select>
                                    </Field>

                                    <Field label="Priority" icon={<AlertTriangle size={11} className={watch('priority') === 'URGENT' ? 'text-rose-400' : 'text-orange-400'} />} error={!!errors.priority}>
                                        <select className={selectClass} {...register('priority')}>
                                            {Object.values(TaskPriority).map(p => <option key={p} value={p} className="bg-[#1e293b]">{p}</option>)}
                                        </select>
                                    </Field>
                                </div>

                                {/* ── Dates ── */}
                                <div className="grid grid-cols-2 gap-2">
                                    <Field label="Start Date" icon={<Calendar size={11} className="text-gray-400" />} error={!!errors.startDate}>
                                        <Controller
                                            name="startDate"
                                            control={control}
                                            render={({ field }) => dateMode === 'AD' ? (
                                                <input type="date" value={field.value || ''} onChange={field.onChange}
                                                    className="w-full bg-transparent text-[13px] font-semibold text-gray-200 focus:text-white focus:outline-none cursor-pointer" />
                                            ) : (
                                                <NepaliDatePicker value={field.value || ''} onChange={field.onChange} placeholder="Select Start Date" />
                                            )}
                                        />
                                        {errors.startDate && <p className="text-red-400 text-[10px]">{errors.startDate.message}</p>}
                                    </Field>

                                    <Field label="Due Date" icon={<Calendar size={11} className="text-emerald-400" />} error={!!errors.dueDate}
                                        extra={
                                            <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-md border border-white/[0.04]">
                                                {(['AD', 'BS'] as const).map(mode => (
                                                    <button key={mode} onClick={(e) => { e.preventDefault(); setDateMode(mode); }}
                                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black transition-all ${dateMode === mode ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:text-gray-400'}`}
                                                    >{mode}</button>
                                                ))}
                                            </div>
                                        }
                                    >
                                        <Controller
                                            name="dueDate"
                                            control={control}
                                            render={({ field }) => dateMode === 'AD' ? (
                                                <input type="date" value={field.value} onChange={field.onChange}
                                                    className="w-full bg-transparent text-[13px] font-semibold text-gray-200 focus:text-white focus:outline-none cursor-pointer" />
                                            ) : (
                                                <NepaliDatePicker value={field.value} onChange={field.onChange} placeholder="Select Due Date" />
                                            )}
                                        />
                                        {errors.dueDate && <p className="text-red-400 text-[10px]">{errors.dueDate.message}</p>}
                                    </Field>
                                </div>

                                {/* ── Team Leader + Time Logged ── */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <Field label="Team Leader" icon={<ShieldAlert size={11} className="text-amber-400" />} error={!!errors.teamLeaderId}>
                                        <select className={selectClass} {...register('teamLeaderId')}>
                                            <option value="" className="bg-[#1e293b] text-gray-400">— Select Leader —</option>
                                            {usersList
                                                .filter(u => watch('assignedTo')?.includes(u.uid))
                                                .map(u => (
                                                    <option key={u.uid} value={u.uid} className="bg-[#1e293b] text-white">{u.displayName}</option>
                                                ))}
                                        </select>
                                    </Field>

                                    <Field label="Time Logged (min)" icon={<Clock size={11} className="text-amber-400" />}>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full bg-transparent text-[13px] font-semibold text-white focus:outline-none"
                                            placeholder="0"
                                            {...register('estimatedHours', { valueAsNumber: true })}
                                        />
                                    </Field>
                                </div>

                                {/* Assignees — full width */}
                                <Field label="Assignees" icon={<UserCircle2 size={11} className="text-cyan-400" />} span2>
                                    <Controller
                                        name="assignedTo"
                                        control={control}
                                        render={({ field }) => (
                                            <StaffSelect users={usersList} value={field.value || []} onChange={field.onChange} multi={true} />
                                        )}
                                    />
                                </Field>

                                {/* Suggested SOPs / Resources */}
                                {suggestedResources.length > 0 && (
                                    <div className="space-y-2 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-0.5 h-full bg-amber-500/50" />
                                        <label className="text-[9px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                            <Sparkles size={10} /> Suggested Knowledge
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {suggestedResources.map(r => (
                                                <a key={r.id} href={r.link || '#'} target="_blank" rel="noreferrer"
                                                    className="flex items-center gap-2 p-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-colors border border-white/[0.04] group">
                                                    <div className="p-1.5 bg-amber-500/10 rounded-md text-amber-400 flex-shrink-0">
                                                        <Book size={12} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-[11px] font-bold text-gray-300 group-hover:text-amber-300 transition-colors truncate">{r.title}</h4>
                                                        <p className="text-[9px] text-gray-600 uppercase tracking-wider">{r.category || 'Documentation'}</p>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Subtasks */}
                                <div className="space-y-2 bg-white/[0.02] p-3 rounded-xl border border-white/[0.05]">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between ml-0.5">
                                        <span>Subtasks ({task.subtasks?.length || 0})</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            placeholder="Add a subtask..."
                                            className="flex-1 glass-input text-[12px] py-1.5"
                                            onKeyDown={(e) => e.key === 'Enter' && onAddSubtask()}
                                        />
                                        <button
                                            onClick={onAddSubtask}
                                            className="px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 transition-all font-bold text-[11px] flex items-center gap-1"
                                        >
                                            <Plus size={12} /> Add
                                        </button>
                                    </div>
                                    {task.subtasks?.map((st, i) => (
                                        <div key={st.id} className="flex flex-col gap-2 p-3 bg-black/20 rounded-lg border border-white/[0.04] group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-2.5 flex-1">
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const updated = [...(task.subtasks || [])];
                                                            updated[i] = { ...updated[i], isCompleted: !updated[i].isCompleted };
                                                            onChange({ subtasks: updated });
                                                        }}
                                                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all flex-shrink-0 mt-0.5
                                                            ${st.isCompleted ? 'bg-amber-500 border-amber-500' : 'border-slate-600 bg-transparent hover:border-blue-400'}`}
                                                    >
                                                        {st.isCompleted && <Check size={10} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                    <div className="flex flex-col gap-1 flex-1">
                                                        <span className={`text-[12px] font-semibold leading-tight ${st.isCompleted ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                                                            {st.title}
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            <UserCircle2 size={11} className="text-gray-600" />
                                                            <select
                                                                className="bg-transparent text-[10px] font-bold text-gray-500 focus:text-white focus:outline-none cursor-pointer hover:text-gray-300"
                                                                value={st.assignedTo || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...(task.subtasks || [])];
                                                                    updated[i].assignedTo = e.target.value;
                                                                    onChange({ subtasks: updated });
                                                                }}
                                                            >
                                                                <option value="" className="bg-transparent text-gray-900">— Unassigned —</option>
                                                                {usersList
                                                                    .filter(u => watch('assignedTo')?.includes(u.uid))
                                                                    .map((u) => (
                                                                        <option key={u.uid} value={u.uid} className="bg-transparent text-gray-900">{u.displayName}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onRemoveSubtask(st.id)}
                                                    className="text-gray-600 hover:text-rose-400 p-1.5 opacity-0 group-hover:opacity-100 transition-all bg-white/[0.03] rounded-md ml-2 shrink-0"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Comments */}
                                <div className="space-y-2 bg-white/[0.02] p-3 rounded-xl border border-white/[0.05]">
                                    <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">Activity & Comments</h4>
                                    <div className="bg-black/20 rounded-lg p-3">
                                        <TaskComments
                                            comments={task.comments || []}
                                            onAddComment={onAddComment}
                                            users={usersList}
                                        />
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
        </AnimatePresence>
    );
};

export default TaskDetailPane;
