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
    <div className={`group flex flex-row items-center justify-between py-2 border-b border-white/[0.03] last:border-0 transition-colors ${error ? 'bg-red-500/5 px-2 rounded-t-none' : ''} ${span2 ? 'md:col-span-2 !flex-col !items-start gap-2 border-b-0 pt-3' : ''}`}>
        <div className="flex items-center justify-between w-[110px] flex-shrink-0">
            <label className="text-[10.5px] font-medium text-gray-500 flex items-center gap-2.5">
                {icon} {label}
            </label>
            {extra && <div className="md:hidden">{extra}</div>}
        </div>
        <div className={`flex-1 flex items-center justify-end min-w-0 ${span2 ? 'w-full justify-start' : ''}`}>
            {children}
        </div>
        {extra && <div className="hidden md:block ml-3">{extra}</div>}
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

    const selectClass = "w-full bg-transparent text-[12px] font-medium text-gray-300 hover:text-white focus:outline-none cursor-pointer appearance-none text-right";

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

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                        className="absolute right-0 top-0 bottom-0 w-full max-w-[850px] bg-[#0c0c0f] shadow-2xl border-l border-white/[0.08] flex flex-col overflow-hidden z-50"
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
                                        className="w-full bg-transparent border border-white/[0.05] focus:border-emerald-500/30 rounded-xl p-3 text-[13px] leading-relaxed resize-none text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all hover:bg-white/[0.02]"
                                        placeholder="Add description..."
                                        style={{ minHeight: '80px', maxHeight: '300px' }}
                                        {...descRegister}
                                        ref={e => {
                                            descRegister.ref(e);
                                            descRef.current = e;
                                        }}
                                        onInput={autoResize}
                                    />

                                    {/* ── Properties Grid ── */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1 py-4 border-y border-white/[0.04]">
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
                                                {usersList.map(u => <option key={u.uid} value={u.uid} className="bg-[#1e293b] text-white">{u.displayName}</option>)}
                                            </select>
                                        </Field>

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
                                            <select className={selectClass} {...register('auditPhase')}>
                                                {Object.values(AuditPhase).map(ph => <option key={ph} value={ph} className="bg-[#1e293b]">{ph.replace(/_/g, ' ')}</option>)}
                                            </select>
                                        </Field>

                                        <Field label="Dates" icon={<Calendar size={12} className="text-gray-400" />} span2
                                            extra={
                                                <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-md border border-white/[0.04]">
                                                    {(['AD', 'BS'] as const).map(mode => (
                                                        <button key={mode} onClick={(e) => { e.preventDefault(); setDateMode(mode); }} className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${dateMode === mode ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-400'}`}>{mode}</button>
                                                    ))}
                                                </div>
                                            }>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full justify-end mt-1">
                                                <div className="flex items-center gap-2 text-[12px] group/date flex-1 sm:flex-none justify-end">
                                                    <span className="text-gray-600/60 text-[9px] uppercase font-bold group-hover/date:text-gray-500 transition-colors">Start</span>
                                                    <Controller name="startDate" control={control} render={({ field }) => dateMode === 'AD' ? (
                                                        <input type="date" value={field.value || ''} onChange={field.onChange} className="bg-transparent text-gray-300 hover:text-white focus:outline-none w-[115px] sm:w-[130px] text-right cursor-pointer" />
                                                    ) : ( <div className="w-[115px] sm:w-[130px]"><NepaliDatePicker value={field.value || ''} onChange={field.onChange} placeholder="Start date" /></div> )} />
                                                </div>
                                                <div className="hidden sm:block w-px h-4 bg-white/[0.06]" />
                                                <div className="flex items-center gap-2 text-[12px] group/date flex-1 sm:flex-none justify-end">
                                                    <span className="text-gray-600/60 text-[9px] uppercase font-bold group-hover/date:text-gray-500 transition-colors">Due</span>
                                                    <Controller name="dueDate" control={control} render={({ field }) => dateMode === 'AD' ? (
                                                        <input type="date" value={field.value || ''} onChange={field.onChange} className="bg-transparent text-gray-300 hover:text-white focus:outline-none w-[115px] sm:w-[130px] text-right cursor-pointer" />
                                                    ) : ( <div className="w-[115px] sm:w-[130px]"><NepaliDatePicker value={field.value || ''} onChange={field.onChange} placeholder="Due date" /></div> )} />
                                                </div>
                                            </div>
                                        </Field>
                                    </div>

                                    {/* ── Subtasks ── */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                                            <span>Subtasks ({task.subtasks?.length || 0})</span>
                                        </label>
                                        <div className="flex gap-2 items-center mb-1 group/add px-3 py-2 -ml-2 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05] transition-all">
                                            <Plus size={14} className="text-gray-500 group-hover/add:text-gray-300 transition-colors" />
                                            <input
                                                type="text"
                                                value={newSubtaskTitle}
                                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                placeholder="Add a subtask... (Press Enter to save)"
                                                className="flex-1 bg-transparent text-[12.5px] text-gray-300 placeholder:text-gray-600 outline-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        onAddSubtask();
                                                    }
                                                }}
                                            />
                                        </div>
                                        {task.subtasks?.map((st, i) => (
                                            <div key={st.id} className="flex flex-col gap-2 p-2 hover:bg-white/[0.02] rounded-lg group transition-colors -mx-2 px-2">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const updated = [...(task.subtasks || [])];
                                                                updated[i] = { ...updated[i], isCompleted: !updated[i].isCompleted };
                                                                onChange({ subtasks: updated });
                                                            }}
                                                            className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer transition-all flex-shrink-0 mt-0.5
                                                                ${st.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-transparent hover:border-emerald-400'}`}
                                                        >
                                                            {st.isCompleted && <Check size={10} className="text-white" strokeWidth={3} />}
                                                        </div>
                                                        <div className="flex flex-col justify-center flex-1">
                                                            <span className={`text-[12px] ${st.isCompleted ? 'line-through text-gray-600' : 'text-gray-300'} transition-all`}>
                                                                {st.title}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <select
                                                            className="bg-white/[0.05] rounded pl-1 pr-4 py-0.5 text-[9px] text-gray-400 focus:outline-none cursor-pointer max-w-[80px] truncate"
                                                            value={st.assignedTo || ''}
                                                            onChange={(e) => {
                                                                const updated = [...(task.subtasks || [])];
                                                                updated[i].assignedTo = e.target.value;
                                                                onChange({ subtasks: updated });
                                                            }}
                                                        >
                                                            <option value="" className="bg-[#1e293b]">Unassigned</option>
                                                            {usersList.map((u) => <option key={u.uid} value={u.uid} className="bg-[#1e293b]">{u.displayName}</option>)}
                                                        </select>
                                                        <button onClick={() => onRemoveSubtask(st.id)} className="text-gray-500 hover:text-rose-400">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column (Sidebar Activity) */}
                            <div className="w-full md:w-[320px] lg:w-[360px] overflow-y-auto custom-scrollbar px-6 py-6 flex-shrink-0 bg-[#040608]">
                                <div className="flex flex-col h-full">
                                    {/* Comments */}
                                    <div className="flex-1 space-y-3">
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={12} /> Comments & Activity
                                        </h4>
                                        <div className="-mx-2 border-t border-white/[0.04] pt-4 px-2">
                                            <TaskComments comments={task.comments || []} onAddComment={onAddComment} users={usersList} />
                                        </div>
                                    </div>

                                    {suggestedResources.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-white/[0.04]">
                                            <h5 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Book size={10} /> Suggested Knowledge</h5>
                                            <div className="flex flex-col gap-2">
                                                {suggestedResources.map(r => (
                                                    <a key={r.id} href={r.link || '#'} target="_blank" rel="noreferrer" className="text-[11px] text-emerald-400 hover:text-emerald-300 truncate bg-emerald-500/5 hover:bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/10 transition-colors">
                                                        {r.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
