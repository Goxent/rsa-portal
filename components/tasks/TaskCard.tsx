import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Check, Tag, Calendar, CheckCircle2, AlertTriangle, GripVertical } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile } from '../../types';

// ── Priority config ─────────────────────────────────────────────────────────
const P: Record<string, { bar: string; badge: string; label: string }> = {
    [TaskPriority.URGENT]: { bar: 'bg-[#dc2626]', badge: 'text-red-400 bg-red-950/60 border-red-800/50', label: 'Urgent' },
    [TaskPriority.HIGH]: { bar: 'bg-[#d97706]', badge: 'text-amber-400 bg-amber-950/60 border-amber-800/50', label: 'High' },
    [TaskPriority.MEDIUM]: { bar: 'bg-[#2563eb]', badge: 'text-amber-400 bg-blue-950/60 border-blue-800/50', label: 'Medium' },
    [TaskPriority.LOW]: { bar: 'bg-[#475569]', badge: 'text-slate-400 bg-slate-800/60 border-slate-700/50', label: 'Low' },
};

// ── Avatar colours — deterministic per index ────────────────────────────────
const AV = ['#3b5bdb', '#7048e8', '#0ca678', '#f59f00', '#e64980', '#1098ad', '#74c0fc', '#a9e34b'];
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

    return (
        <Draggable draggableId={task.id} index={index}>
            {(prov, snap) => (
                <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    style={prov.draggableProps.style}
                    onClick={() => onClick(task)}
                    className={[
                        'relative group/card rounded-xl border cursor-pointer select-none',
                        'bg-[#0d1117] transition-all duration-150',
                        snap.isDragging
                            ? 'shadow-2xl shadow-black/60 scale-[1.03] z-50 border-amber-500/50 rotate-[0.5deg]'
                            : 'hover:shadow-lg hover:shadow-black/40 hover:-translate-y-px',
                        isSelected ? 'border-amber-500/60 ring-2 ring-amber-500/20' :
                            isOverdue ? 'border-red-700/40 hover:border-red-600/60' :
                                'border-white/[0.07] hover:border-white/[0.16]',
                    ].join(' ')}
                >
                    {/* Priority left stripe */}
                    <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${pc.bar} opacity-90`} />

                    {isOverdue && <div className="absolute inset-0 bg-red-500/[0.04] rounded-xl pointer-events-none" />}

                    <div className="pl-4 pr-3 pt-3 pb-3">
                        {/* Top row */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {/* Checkbox */}
                                <div
                                    className={`relative w-4 h-4 flex-shrink-0 transition-opacity cursor-pointer ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}
                                    onClick={e => { e.stopPropagation(); onToggleSelection(task.id); }}
                                >
                                    <div className={`w-full h-full rounded border flex items-center justify-center transition-all
                                        ${isSelected ? 'bg-amber-600 border-amber-500' : 'border-slate-600 bg-transparent'}`}>
                                        {isSelected && <Check size={9} className="text-white" strokeWidth={3.5} />}
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${pc.badge}`}>
                                    {pc.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-mono text-slate-600 group-hover/card:text-slate-400 transition-colors select-none">
                                    #{task.id.substring(0, 5).toUpperCase()}
                                </span>
                                <div
                                    {...prov.dragHandleProps}
                                    onClick={e => e.stopPropagation()}
                                    className="p-0.5 text-slate-700 hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors"
                                >
                                    <GripVertical size={13} />
                                </div>
                            </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-[13px] font-semibold text-slate-200 leading-snug line-clamp-2 mb-2.5 group-hover/card:text-white transition-colors">
                            {task.title}
                        </h4>

                        {/* Client */}
                        {task.clientName && (
                            <div 
                                className="flex items-center gap-1 mb-2.5 hover:text-amber-400 transition-colors"
                                onClick={(e) => {
                                    if (onOpenClientDetail && task.clientIds?.[0]) {
                                        e.stopPropagation();
                                        onOpenClientDetail(task.clientIds[0]);
                                    }
                                }}
                            >
                                <Tag size={9} className="text-slate-600 flex-shrink-0" />
                                <span className="text-[10px] font-bold truncate underline-offset-2 decoration-blue-500/30 group-hover/card:decoration-blue-500/60 transition-all">{task.clientName}</span>
                            </div>
                        )}

                        {/* Subtask progress */}
                        {pct >= 0 && (
                            <div className="mb-3">
                                <div className="flex justify-between text-[9px] font-bold mb-1">
                                    <span className="text-slate-600 uppercase tracking-widest flex items-center gap-1">
                                        <CheckCircle2 size={8} className={pct === 100 ? 'text-emerald-500' : 'text-slate-600'} />
                                        {done}/{total}
                                    </span>
                                    <span className={pct === 100 ? 'text-emerald-400' : 'text-amber-400'}>{pct}%</span>
                                </div>
                                <div className="h-[3px] w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                            <span className={`flex items-center gap-1 text-[10px] font-medium rounded-md px-1.5 py-0.5
                                ${isOverdue ? 'text-red-400 bg-red-950/50' : 'text-slate-500'}`}>
                                {isOverdue
                                    ? <><AlertTriangle size={9} className="animate-pulse" /> Overdue</>
                                    : <><Calendar size={9} /> {formatDate(task.dueDate)}</>
                                }
                            </span>
                            <div className="flex -space-x-1.5">
                                {task.assignedTo.slice(0, 4).map((uid, i) => {
                                    const u = usersList.find(x => x.uid === uid);
                                    const initials = u?.displayName
                                        ? u.displayName.split(' ').map((p: string) => p[0]).join('').substring(0, 2).toUpperCase()
                                        : '?';
                                    return (
                                        <div
                                            key={uid}
                                            title={u?.displayName}
                                            style={{ backgroundColor: avatarColor(i) }}
                                            className="w-5 h-5 rounded-full border border-[#0d1117] flex items-center justify-center text-[8px] font-black text-white flex-shrink-0"
                                        >
                                            {initials}
                                        </div>
                                    );
                                })}
                                {task.assignedTo.length > 4 && (
                                    <div className="w-5 h-5 rounded-full bg-slate-700 border border-[#0d1117] flex items-center justify-center text-[8px] font-black text-slate-400">
                                        +{task.assignedTo.length - 4}
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
