import React from 'react';
import ReactDOM from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import {
    Check, Tag, Calendar, CheckCircle2, AlertTriangle, GripVertical, ArrowRight,
    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen, Activity as ActivityIcon,
    Zap, Flame, Clock
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, TaskType, AuditPhase } from '../../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../constants/taskTypeChecklists';
import { getClientVisuals } from '../../utils/colorUtils';

// ── Priority config ────────────────────────────────────────
const P: Record<string, {
    accent: string; border: string; badge: string; label: string;
    glow: string; bgGradient: string; dotColor: string; icon: React.ReactNode;
}> = {
    [TaskPriority.URGENT]: {
        accent: '#f43f5e', border: 'border-l-rose-500',
        badge: 'text-rose-300 bg-rose-500/15 border-rose-500/25',
        label: 'Urgent', glow: 'shadow-[0_8px_24px_rgba(244,63,94,0.15)]',
        bgGradient: 'from-rose-500/[0.06]',
        dotColor: '#f43f5e',
        icon: <Flame size={8} className="text-rose-400" />,
    },
    [TaskPriority.HIGH]: {
        accent: '#f59e0b', border: 'border-l-amber-500',
        badge: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
        label: 'High', glow: 'shadow-[0_8px_24px_rgba(245,158,11,0.12)]',
        bgGradient: 'from-amber-500/[0.04]',
        dotColor: '#f59e0b',
        icon: <Zap size={8} className="text-amber-400" />,
    },
    [TaskPriority.MEDIUM]: {
        accent: '#6366f1', border: 'border-l-indigo-500',
        badge: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25',
        label: 'Medium', glow: '',
        bgGradient: 'from-indigo-500/[0.03]',
        dotColor: '#6366f1',
        icon: <Clock size={8} className="text-indigo-400" />,
    },
    [TaskPriority.LOW]: {
        accent: '#475569', border: 'border-l-slate-600',
        badge: 'text-slate-400 bg-slate-500/10 border-slate-500/15',
        label: 'Low', glow: '',
        bgGradient: 'from-transparent',
        dotColor: '#475569',
        icon: null,
    },
};

const AV = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
const avatarColor = (i: number) => AV[i % AV.length];

const ICON_MAP: Record<string, React.ComponentType<any>> = {
    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
};

function formatDate(d?: string) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
}

export interface TaskCardProps {
    task: Task;
    index: number;
    usersList: UserProfile[];
    selectedTaskIds: string[];
    onToggleSelection: (id: string) => void;
    onClick: (task: Task) => void;
    onOpenClientDetail?: (clientId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = React.memo(({ task, index, usersList, selectedTaskIds, onToggleSelection, onClick, onOpenClientDetail }) => {
    const isSelected  = selectedTaskIds.includes(task.id);
    const done        = task.subtasks?.filter(s => s.isCompleted).length ?? 0;
    const total       = task.subtasks?.length ?? 0;
    const pct         = total > 0 ? Math.round((done / total) * 100) : -1;
    const isOverdue   = task.dueDate && new Date(task.dueDate) < new Date() &&
                        task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.ARCHIVED;
    const pc          = P[task.priority] ?? P[TaskPriority.LOW];
    const isCompleted = task.status === TaskStatus.COMPLETED;
    const validAssignees = task.assignedTo.filter(uid => uid && typeof uid === 'string' && uid.trim() !== '');
    const IconComp = task.taskType ? ICON_MAP[TASK_TYPE_ICONS[task.taskType]] : null;

    return (
        <Draggable draggableId={task.id} index={index}>
            {(prov, snap) => {
                const child = (
                    <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        style={prov.draggableProps.style}
                        className="pb-2"
                    >
                    <div
                        {...prov.dragHandleProps}
                        onClick={(e) => {
                            if (snap.isDragging) { e.preventDefault(); e.stopPropagation(); return; }
                            onClick(task);
                        }}
                        className={[
                            'relative group/card rounded-xl cursor-grab active:cursor-grabbing select-none overflow-hidden',
                            'border border-l-[3px] transition-all duration-200 ease-out',
                            `bg-white dark:bg-[#13141a]`,
                            'border-slate-300 dark:border-white/[0.07]',
                            pc.border,
                            snap.isDragging
                                ? 'shadow-[0_24px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] scale-[1.03] z-[9999] ring-2 ring-indigo-500/40 border-indigo-500/50 bg-white dark:bg-[#1e2038] !transition-none rotate-[0.8deg]'
                                : `shadow-sm hover:border-slate-400 dark:hover:border-white/[0.14] hover:-translate-y-[2px] hover:shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.5)] ${pc.glow}`,
                            isSelected ? 'ring-1 ring-emerald-500/40 bg-emerald-500/[0.03] dark:bg-emerald-950/10 border-emerald-500/30' : '',
                            isCompleted ? 'opacity-50' : '',
                        ].filter(Boolean).join(' ')}
                    >
                        {/* Dynamic Client Gradient Header - matching Directory Aesthetic */}
                        <div
                            className={`absolute top-0 left-0 right-0 h-[38px] opacity-20 dark:opacity-[0.12] bg-gradient-to-br ${getClientVisuals(task.clientName).from} ${getClientVisuals(task.clientName).to} transition-all duration-500`}
                        />
                        {/* Subtle top glare */}
                        <div
                            className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
                        />

                        <div className="px-3 pt-3 pb-2.5">

                            {/* Row 1: Priority + ID + Drag */}
                            <div className="flex items-center justify-between gap-1 mb-2">
                                <div className="flex items-center gap-1.5">
                                    {/* Checkbox */}
                                    <div
                                        className={`relative w-[13px] h-[13px] flex-shrink-0 transition-all duration-150 rounded-[3px] ${
                                            isSelected
                                                ? 'opacity-100'
                                                : 'opacity-0 group-hover/card:opacity-60'
                                        }`}
                                        onClick={e => { e.stopPropagation(); if (!snap.isDragging) onToggleSelection(task.id); }}
                                    >
                                        <div className={`w-full h-full rounded-[3px] border flex items-center justify-center transition-all ${
                                            isSelected ? 'bg-emerald-500 border-emerald-400' : 'border-slate-600 hover:border-slate-400'
                                        }`}>
                                            {isSelected && <Check size={8} className="text-black" strokeWidth={4} />}
                                        </div>
                                    </div>

                                    {/* Priority indicator */}
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-[2px] rounded-md border uppercase tracking-[0.08em] shadow-sm ${pc.badge}`}>
                                        {pc.icon}
                                        {pc.label}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {/* Task type icon */}
                                    {IconComp && (
                                        <div className="opacity-40 group-hover/card:opacity-60 transition-opacity">
                                            <IconComp size={11} className="text-slate-400" />
                                        </div>
                                    )}
                                    <div
                                        className="p-0.5 text-slate-700 hover:text-slate-400 transition-colors rounded hover:bg-white/5 opacity-50 group-hover/card:opacity-100"
                                    >
                                        <GripVertical size={11} />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Title */}
                            <h4 className={`text-[13px] font-semibold leading-snug line-clamp-2 mb-2 transition-colors ${
                                (isCompleted && task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION) ? 'text-slate-400 dark:text-slate-600 line-through' :
                                isSelected ? 'text-emerald-900 dark:text-white' : 'text-slate-800 dark:text-slate-200 group-hover/card:text-indigo-600 dark:group-hover/card:text-white'
                            }`}>
                                {task.title}
                            </h4>

                            {/* Row 3: Client & Task Type */}
                            <div className="flex items-center flex-wrap gap-1.5 mb-2.5">
                                {task.taskType && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] text-[9px] text-slate-500 dark:text-slate-400 font-semibold transition-colors group-hover/card:border-slate-300 dark:group-hover/card:border-white/[0.12]">
                                        {IconComp && <IconComp size={9} className="text-indigo-500 dark:text-indigo-400" />}
                                        <span className="truncate max-w-[90px]">{TASK_TYPE_LABELS[task.taskType]}</span>
                                    </div>
                                )}
                                {task.clientName && (
                                    <div
                                        className="flex items-center gap-1.5 cursor-pointer group/client px-2 py-0.5 rounded-md bg-white/5 dark:bg-black/20 border border-white/[0.05] hover:border-cyan-500/30 transition-all duration-300"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!snap.isDragging && onOpenClientDetail && task.clientIds?.[0]) {
                                                onOpenClientDetail(task.clientIds[0]);
                                            }
                                        }}
                                    >
                                        <Tag size={10} className={`${getClientVisuals(task.clientName).accent} opacity-70 group-hover/client:scale-110 transition-transform`} />
                                        <span className={`text-[10px] font-bold ${getClientVisuals(task.clientName).accent} tracking-tight truncate max-w-[140px]`}>
                                            {task.clientName}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Row 4: Subtask progress */}
                            {pct >= 0 && (
                                <div className="mb-2.5">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] text-slate-600 flex items-center gap-1">
                                            <CheckCircle2 size={9} className={pct === 100 ? 'text-emerald-400' : 'text-slate-700'} />
                                            <span className={pct === 100 ? 'text-emerald-400' : 'text-slate-600'}>{done}/{total} steps</span>
                                        </span>
                                        <span className={`text-[9px] font-bold ${pct === 100 ? 'text-emerald-400' : 'text-slate-600'}`}>{pct}%</span>
                                    </div>
                                    <div className="h-[3px] w-full bg-slate-100 dark:bg-white/[0.05] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${
                                                pct === 100 ? 'bg-emerald-500' :
                                                pct >= 60 ? 'bg-indigo-500' :
                                                pct >= 30 ? 'bg-amber-500' : 'bg-slate-600'
                                            }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Workflow indicator */}
                            {task.nextTemplateId && (
                                <div className="flex items-center gap-1 mb-2 text-[9px] text-purple-400/50 font-medium">
                                    <ArrowRight size={8} />
                                    <span>Workflow linked</span>
                                </div>
                            )}

                            {/* Row 5: Footer — date + avatars */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.05] gap-2">
                                <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-rose-400' : 'text-slate-600'}`}>
                                    {isOverdue
                                        ? <><AlertTriangle size={10} className="animate-pulse" /><span className="font-semibold">Overdue</span></>
                                        : task.dueDate
                                            ? <><Calendar size={10} className="opacity-70" />{formatDate(task.dueDate)}</>
                                            : <span className="text-slate-700 text-[9px]">No due date</span>
                                    }
                                </div>

                                {/* Avatars */}
                                {validAssignees.length > 0 ? (
                                    <div className="flex -space-x-1.5">
                                        {validAssignees.slice(0, 3).map((uid, i) => {
                                            const u = usersList.find(x => x.uid === uid);
                                            if (!u) return null;
                                            const initials = u.displayName
                                                ? u.displayName.split(' ').map((p: string) => p[0]).join('').substring(0, 2).toUpperCase()
                                                : '?';
                                            return (
                                                <div
                                                    key={uid || i}
                                                    title={u.displayName}
                                                    style={{ backgroundColor: avatarColor(i) }}
                                                    className="w-[20px] h-[20px] rounded-full ring-[2px] ring-white dark:ring-[#13141a] flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0 shadow-sm"
                                                >
                                                    {initials}
                                                </div>
                                            );
                                        })}
                                        {validAssignees.length > 3 && (
                                            <div className="w-[20px] h-[20px] rounded-full bg-slate-800 ring-[2px] ring-[#13141a] flex items-center justify-center text-[7px] font-semibold text-slate-400">
                                                +{validAssignees.length - 3}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-[9px] text-slate-700 border border-dashed border-slate-800 rounded-full px-1.5 py-0.5">Unassigned</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                );

                if (snap.isDragging) {
                    return ReactDOM.createPortal(child, document.body);
                }
                return child;
            }}
        </Draggable>
    );
}, (prev, next) => (
    prev.task.id === next.task.id &&
    prev.task.status === next.task.status &&
    prev.task.auditPhase === next.task.auditPhase &&
    prev.task.title === next.task.title &&
    prev.task.dueDate === next.task.dueDate &&
    prev.task.priority === next.task.priority &&
    prev.task.assignedTo.length === next.task.assignedTo.length &&
    prev.task.clientName === next.task.clientName &&
    prev.task.subtasks?.length === next.task.subtasks?.length &&
    (prev.task.subtasks?.filter(s => s.isCompleted).length === next.task.subtasks?.filter(s => s.isCompleted).length) &&
    prev.index === next.index &&
    prev.selectedTaskIds.includes(prev.task.id) === next.selectedTaskIds.includes(next.task.id)
));

export default TaskCard;
