import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import {
    Check, Tag, Calendar, CheckCircle2, AlertTriangle, GripVertical, ArrowRight,
    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen, Activity as ActivityIcon
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, TaskType } from '../../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../constants/taskTypeChecklists';

// ── Priority config — left-border accent + tighter badge ──────────────────────
const P: Record<string, { accent: string; border: string; badge: string; label: string; glow: string }> = {
    [TaskPriority.URGENT]: { accent: '#f43f5e', border: 'border-l-rose-500',   badge: 'text-rose-300 bg-rose-500/10 border-rose-500/20',   label: 'Urgent', glow: 'shadow-[0_0_10px_rgba(244,63,94,0.12)]' },
    [TaskPriority.HIGH]:   { accent: '#f59e0b', border: 'border-l-amber-500',  badge: 'text-amber-300 bg-amber-500/10 border-amber-500/20', label: 'High',   glow: 'shadow-[0_0_10px_rgba(245,158,11,0.08)]' },
    [TaskPriority.MEDIUM]: { accent: '#6366f1', border: 'border-l-brand-500',  badge: 'text-brand-300 bg-brand-500/10 border-brand-500/20', label: 'Medium', glow: '' },
    [TaskPriority.LOW]:    { accent: '#475569', border: 'border-l-slate-600',  badge: 'text-slate-400 bg-slate-500/8 border-slate-500/15',  label: 'Low',    glow: '' },
};

const AV = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
const avatarColor = (i: number) => AV[i % AV.length];

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

    return (
        <Draggable draggableId={task.id} index={index}>
            {(prov, snap) => (
                <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    style={prov.draggableProps.style}
                    className="pb-1.5"
                >
                    <div
                        onClick={(e) => {
                            if (snap.isDragging) { e.preventDefault(); e.stopPropagation(); return; }
                            onClick(task);
                        }}
                        className={[
                            // Tighter padding, left border replaces the absolute bar
                            'relative group/card rounded-lg cursor-pointer select-none overflow-hidden',
                            'bg-[#18191f] border border-white/[0.06] border-l-[3px] transition-[box-shadow,transform,background-color,border-color] duration-200 ease-out',
                            pc.border,
                            snap.isDragging
                                ? 'shadow-[0_20px_50px_rgba(0,0,0,0.6)] scale-[1.02] z-[9999] ring-2 ring-brand-500/40 !border-brand-500/40 bg-[#24263a] !transition-none'
                                : `hover:bg-[#1e2028] hover:shadow-[0_6px_16px_rgba(0,0,0,0.4)] hover:border-l-[3px] hover:-translate-y-[1px] ${pc.glow}`,
                            isSelected ? 'ring-1 ring-emerald-500/30 bg-emerald-950/10' : '',
                            isCompleted ? 'opacity-55' : '',
                        ].filter(Boolean).join(' ')}
                    >
                        {/* ── Body: tight 2.5/2 padding ─────────────────── */}
                        <div className="pl-3 pr-2.5 pt-2.5 pb-2">

                            {/* Row 1: Priority badge + drag + checkbox */}
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    {/* Checkbox — hover reveal */}
                                    <div
                                        className={`relative w-[14px] h-[14px] flex-shrink-0 transition-all duration-150 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover/card:opacity-100 group-hover/card:scale-100'}`}
                                        onClick={e => { e.stopPropagation(); if (!snap.isDragging) onToggleSelection(task.id); }}
                                    >
                                        <div className={`w-full h-full rounded-[3px] border flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-400' : 'border-slate-600 hover:border-slate-400'}`}>
                                            {isSelected && <Check size={9} className="text-black" strokeWidth={4} />}
                                        </div>
                                    </div>

                                    {/* Priority badge — compact */}
                                    <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded border tracking-wide ${pc.badge}`}>
                                        {pc.label}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-mono text-slate-700 group-hover/card:text-slate-500 transition-colors">
                                        #{task.id.substring(0, 4).toUpperCase()}
                                    </span>
                                    <div
                                        {...prov.dragHandleProps}
                                        onClick={e => e.stopPropagation()}
                                        className="p-0.5 text-slate-700 hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors rounded hover:bg-white/5"
                                    >
                                        <GripVertical size={12} />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Title */}
                            <h4 className={`text-[12.5px] font-medium leading-snug line-clamp-2 mb-1 transition-colors ${
                                isCompleted ? 'text-slate-600 line-through' :
                                isSelected  ? 'text-white' : 'text-slate-200 group-hover/card:text-white'
                            }`}>
                                {task.title}
                            </h4>

                            {/* Prompt B: Task Type Badge */}
                            {task.taskType && (
                                <div className="flex items-center gap-1.5 mb-2 px-1.5 py-0.5 w-fit rounded-full bg-white/[0.03] border border-white/[0.06] text-[9px] text-slate-400 font-bold group-hover/card:border-white/[0.12] transition-colors">
                                    {{
                                        ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
                                    }[TASK_TYPE_ICONS[task.taskType]] ? React.createElement({
                                        ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
                                    }[TASK_TYPE_ICONS[task.taskType]] as any, { size: 10, className: 'text-brand-400' }) : <ActivityIcon size={10} />}
                                    <span className="truncate max-w-[120px]">{TASK_TYPE_LABELS[task.taskType]}</span>
                                </div>
                            )}

                            {/* Row 3: Client context */}
                            {task.clientName && (
                                <div
                                    className="inline-flex items-center gap-1 mb-1.5 cursor-pointer group/client"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!snap.isDragging && onOpenClientDetail && task.clientIds?.[0]) {
                                            onOpenClientDetail(task.clientIds[0]);
                                        }
                                    }}
                                >
                                    <Tag size={8} className="text-brand-500/60 group-hover/client:text-brand-400 transition-colors" />
                                    <span className="text-[10px] text-slate-500 group-hover/client:text-slate-300 transition-colors truncate max-w-[140px]">
                                        {task.clientName}
                                    </span>
                                </div>
                            )}

                            {/* Row 4: Subtask progress bar */}
                            {pct >= 0 && (
                                <div className="mb-2">
                                    <div className="h-[2.5px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-500/60'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-0.5">
                                        <span className="text-[9px] text-slate-600 flex items-center gap-0.5">
                                            <CheckCircle2 size={8} className={pct === 100 ? 'text-emerald-400' : 'text-slate-700'} />
                                            {done}/{total}
                                        </span>
                                        <span className={`text-[9px] font-medium ${pct === 100 ? 'text-emerald-400' : 'text-slate-600'}`}>{pct}%</span>
                                    </div>
                                </div>
                            )}

                            {/* Workflow indicator */}
                            {task.nextTemplateId && (
                                <div className="flex items-center gap-1 mb-1.5 text-[9px] text-purple-400/60 font-medium">
                                    <ArrowRight size={8} />
                                    <span>Workflow linked</span>
                                </div>
                            )}

                            {/* Row 5: Footer — date + avatars */}
                            <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.04] gap-2">
                                <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-rose-400' : 'text-slate-600'}`}>
                                    {isOverdue
                                        ? <><AlertTriangle size={9} className="animate-pulse" /><span className="font-semibold">Overdue</span></>
                                        : task.dueDate
                                            ? <><Calendar size={9} />{formatDate(task.dueDate)}</>
                                            : <span className="text-slate-700">No due date</span>
                                    }
                                </div>

                                {/* Avatars */}
                                {validAssignees.length > 0 && (
                                    <div className="flex -space-x-1.5">
                                        {validAssignees.slice(0, 3).map((uid, i) => {
                                            const u = usersList.find(x => x.uid === uid);
                                            if (!u) return null;
                                            const initials = u.displayName
                                                ? u.displayName.split(' ').map((p: string) => p[0]).join('').substring(0, 2).toUpperCase()
                                                : '?';
                                            return (
                                                <div
                                                    key={uid}
                                                    title={u.displayName}
                                                    style={{ backgroundColor: avatarColor(i) }}
                                                    className="w-[18px] h-[18px] rounded-full ring-[1.5px] ring-[#18191f] flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                                                >
                                                    {initials}
                                                </div>
                                            );
                                        })}
                                        {validAssignees.length > 3 && (
                                            <div className="w-[18px] h-[18px] rounded-full bg-slate-800 ring-[1.5px] ring-[#18191f] flex items-center justify-center text-[7px] font-semibold text-slate-400">
                                                +{validAssignees.length - 3}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
