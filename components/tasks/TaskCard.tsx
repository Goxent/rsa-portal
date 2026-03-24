import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Check, Tag, Calendar, CheckCircle2, AlertTriangle, GripVertical, ArrowRight } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile } from '../../types';

// ── Priority config ─────────────────────────────────────────────────────────
const P: Record<string, { accent: string; badge: string; label: string; glow: string }> = {
    [TaskPriority.URGENT]: { accent: '#ef4444', badge: 'text-red-300 bg-red-500/15 border-red-500/25', label: 'Urgent', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.15)]' },
    [TaskPriority.HIGH]: { accent: '#f59e0b', badge: 'text-amber-300 bg-amber-500/15 border-amber-500/25', label: 'High', glow: 'shadow-[0_0_12px_rgba(245,158,11,0.1)]' },
    [TaskPriority.MEDIUM]: { accent: '#3b82f6', badge: 'text-blue-300 bg-blue-500/15 border-blue-500/25', label: 'Medium', glow: '' },
    [TaskPriority.LOW]: { accent: '#64748b', badge: 'text-slate-400 bg-slate-500/10 border-slate-500/20', label: 'Low', glow: '' },
};

// ── Avatar colours — deterministic per index ────────────────────────────────
const AV = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
const avatarColor = (i: number) => AV[i % AV.length];

function formatDate(d?: string) {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return d; }
}

// ────────────────────────────────────────────────────────────────────────────
// TaskCard
// ────────────────────────────────────────────────────────────────────────────
export interface TaskCardProps {
    task: Task;
    index: number;
    usersList: UserProfile[];
    selectedTaskIds: string[];
    onToggleSelection: (id: string) => void;
    onClick: (task: Task) => void;
    onOpenClientDetail?: (clientId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, index, usersList, selectedTaskIds, onToggleSelection, onClick, onOpenClientDetail }) => {
    const isSelected = selectedTaskIds.includes(task.id);
    const done = task.subtasks?.filter(s => s.isCompleted).length ?? 0;
    const total = task.subtasks?.length ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : -1;
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() &&
        task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.ARCHIVED;
    const pc = P[task.priority] ?? P[TaskPriority.LOW];
    const isCompleted = task.status === TaskStatus.COMPLETED;

    return (
        <Draggable draggableId={task.id} index={index}>
            {(prov, snap) => (
                <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    style={prov.draggableProps.style}
                    onClick={() => onClick(task)}
                    className={[
                        'relative group/card rounded-xl cursor-pointer select-none overflow-hidden',
                        'bg-[#101216]/60 backdrop-blur-md',
                        'border border-white/[0.04]',
                        'transition-all duration-300 ease-out',
                        snap.isDragging
                            ? 'shadow-2xl shadow-black/60 scale-[1.02] z-50 ring-1 ring-emerald-500/40 border-emerald-500/30'
                            : 'hover:shadow-md hover:shadow-black/40 hover:border-white/[0.08] hover:-translate-y-[1px]',
                        isSelected ? 'ring-1 ring-emerald-500/30 border-emerald-500/40 bg-emerald-950/10' : '',
                        isOverdue ? 'border-red-500/20' : '',
                        isCompleted ? 'opacity-60' : '',
                        pc.glow
                    ].filter(Boolean).join(' ')}
                >
                    {/* Priority accent — left edge bar */}
                    <div
                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-opacity"
                        style={{ backgroundColor: pc.accent, opacity: isCompleted ? 0.3 : 0.7 }}
                    />

                    <div className="pl-3.5 pr-3 py-3">
                        {/* Top row: Priority badge + ID + drag handle */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                                {/* Checkbox */}
                                <div
                                    className={`relative w-[15px] h-[15px] flex-shrink-0 transition-all duration-150 cursor-pointer ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover/card:opacity-100 group-hover/card:scale-100'}`}
                                    onClick={e => { e.stopPropagation(); onToggleSelection(task.id); }}
                                >
                                    <div className={`w-full h-full rounded-[4px] border flex items-center justify-center transition-all ${isSelected ? 'bg-amber-500 border-amber-400' : 'border-slate-600 bg-transparent hover:border-slate-400'}`}>
                                        {isSelected && <Check size={9} className="text-black" strokeWidth={4} />}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.05] pl-1 pr-1.5 py-[2px] rounded shadow-sm">
                                    <div className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: pc.accent, boxShadow: `0 0 6px ${pc.accent}80` }} />
                                    <span className="text-[9.5px] font-medium text-slate-300 tracking-wide">
                                        {pc.label}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <span className="text-[9px] font-mono text-slate-600 group-hover/card:text-slate-400 transition-colors">
                                    #{task.id.substring(0, 4).toUpperCase()}
                                </span>
                                <div {...prov.dragHandleProps} onClick={e => e.stopPropagation()} className="p-0.5 text-slate-700 hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors rounded hover:bg-white/5">
                                    <GripVertical size={13} />
                                </div>
                            </div>
                        </div>

                        {/* Title */}
                        <h4 className={`text-[13px] font-medium leading-snug line-clamp-2 mb-1.5 transition-colors ${isCompleted ? 'text-slate-500 line-through' : isSelected ? 'text-amber-50' : 'text-slate-200 group-hover/card:text-white'}`}>
                            {task.title}
                        </h4>

                        {/* Client context */}
                        {task.clientName && (
                            <div
                                className="inline-flex items-center gap-1 mb-2 cursor-pointer group/client"
                                onClick={(e) => {
                                    if (onOpenClientDetail && task.clientIds?.[0]) {
                                        e.stopPropagation();
                                        onOpenClientDetail(task.clientIds[0]);
                                    }
                                }}
                            >
                                <Tag size={9} className="text-blue-500/60 group-hover/client:text-blue-400 transition-colors" />
                                <span className="text-[10px] text-slate-500 group-hover/client:text-slate-300 transition-colors truncate max-w-[140px]">
                                    {task.clientName}
                                </span>
                            </div>
                        )}

                        {/* Subtask progress */}
                        {pct >= 0 && (
                            <div className="mb-2.5">
                                <div className="flex justify-between items-center text-[9px] font-medium mb-1">
                                    <span className="text-slate-500 flex items-center gap-1">
                                        <CheckCircle2 size={9} className={pct === 100 ? 'text-emerald-400' : 'text-slate-600'} />
                                        {done}/{total} subtasks
                                    </span>
                                    <span className={pct === 100 ? 'text-emerald-400' : pct > 0 ? 'text-emerald-400/80' : 'text-slate-600'}>{pct}%</span>
                                </div>
                                <div className="h-[3px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ease-out ${pct === 100 ? 'bg-emerald-500 glow-emerald' : 'bg-emerald-500/70'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Workflow indicator */}
                        {task.nextTemplateId && (
                            <div className="flex items-center gap-1 mb-2 text-[9px] text-purple-400/70 font-medium">
                                <ArrowRight size={9} />
                                <span>Workflow linked</span>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] gap-2">
                            <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-red-400' : 'text-slate-600'}`}>
                                {isOverdue
                                    ? <><AlertTriangle size={10} className="animate-pulse" /> <span className="font-semibold">Overdue</span></>
                                    : <><Calendar size={10} /> {formatDate(task.dueDate)}</>
                                }
                            </div>

                            <div className="flex -space-x-1.5 hover:space-x-0 transition-all duration-200">
                                {task.assignedTo.slice(0, 3).map((uid, i) => {
                                    const u = usersList.find(x => x.uid === uid);
                                    const initials = u?.displayName
                                        ? u.displayName.split(' ').map((p: string) => p[0]).join('').substring(0, 2).toUpperCase()
                                        : '?';
                                    return (
                                        <div
                                            key={uid}
                                            title={u?.displayName}
                                            style={{ backgroundColor: avatarColor(i) }}
                                            className="w-[20px] h-[20px] rounded-full ring-[1.5px] ring-[#0d1117] flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 transition-transform hover:scale-110 hover:z-10"
                                        >
                                            {initials}
                                        </div>
                                    );
                                })}
                                {task.assignedTo.length > 3 && (
                                    <div className="w-[20px] h-[20px] rounded-full bg-slate-800 ring-[1.5px] ring-[#0d1117] flex items-center justify-center text-[8px] font-semibold text-slate-400">
                                        +{task.assignedTo.length - 3}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
};

export default TaskCard;
