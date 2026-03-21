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
                        'relative group/card rounded-xl border border-white/[0.04] cursor-pointer select-none',
                        'bg-[#0c0f16] hover:bg-[#111621] transition-all duration-300',
                        snap.isDragging
                            ? 'shadow-2xl shadow-black/80 scale-[1.02] z-50 ring-1 ring-amber-500/50 rotate-[1deg]'
                            : 'hover:shadow-xl hover:shadow-black/50 hover:border-white/[0.08] hover:-translate-y-0.5',
                        isSelected ? 'border-amber-500/50 bg-[#161208] ring-1 ring-amber-500/20' : '',
                        isOverdue ? 'border-red-900/40 bg-red-950/10 hover:border-red-700/50' : ''
                    ].filter(Boolean).join(' ')}
                >
                    {/* Priority Top Accents */}
                    <div className={`absolute left-0 right-0 top-0 h-[3px] rounded-t-xl opacity-30 ${pc.bar}`} />
                    <div className={`absolute left-0 top-0 right-0 h-10 bg-gradient-to-b from-${pc.bar.replace('bg-', '')}/10 to-transparent rounded-t-xl pointer-events-none opacity-50`} />

                    <div className="p-3">
                        {/* Top row: Tags & Selection */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {/* Checkbox */}
                                <div
                                    className={`relative w-4 h-4 flex-shrink-0 transition-all duration-200 cursor-pointer ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover/card:opacity-100 group-hover/card:scale-100'}`}
                                    onClick={e => { e.stopPropagation(); onToggleSelection(task.id); }}
                                >
                                    <div className={`w-full h-full rounded-[4px] border flex items-center justify-center transition-all ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-500/50 bg-black/20 hover:border-slate-400'}`}>
                                        {isSelected && <Check size={10} className="text-black" strokeWidth={4} />}
                                    </div>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] border uppercase tracking-wider ${pc.badge}`}>
                                    {pc.label}
                                </span>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-white/[0.04] text-slate-300 border border-white/[0.05]">
                                    {task.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-slate-600 group-hover/card:text-slate-400 transition-colors uppercase tracking-wider">
                                    #{task.id.substring(0, 4)}
                                </span>
                                <div {...prov.dragHandleProps} onClick={e => e.stopPropagation()} className="px-0.5 text-slate-700 hover:text-slate-300 cursor-grab active:cursor-grabbing transition-colors">
                                    <GripVertical size={14} />
                                </div>
                            </div>
                        </div>

                        {/* Title */}
                        <h4 className={`text-[13px] font-medium leading-relaxed line-clamp-2 mb-2 transition-colors ${isSelected ? 'text-amber-100' : 'text-slate-200 group-hover/card:text-white'}`}>
                            {task.title}
                        </h4>

                        {/* Client context */}
                        {task.clientName && (
                            <div 
                                className="inline-flex items-center gap-1.5 mb-3 px-1.5 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all cursor-pointer group/client"
                                onClick={(e) => {
                                    if (onOpenClientDetail && task.clientIds?.[0]) {
                                        e.stopPropagation();
                                        onOpenClientDetail(task.clientIds[0]);
                                    }
                                }}
                            >
                                <Tag size={10} className="text-blue-400/70 group-hover/client:text-blue-400 transition-colors" />
                                <span className="text-[10px] font-medium text-slate-400 group-hover/client:text-slate-200 transition-colors truncate max-w-[140px]">
                                    {task.clientName}
                                </span>
                            </div>
                        )}

                        {/* Subtask progress */}
                        {pct >= 0 && (
                            <div className="mb-3 px-1">
                                <div className="flex justify-between items-center text-[9px] font-bold mb-1.5">
                                    <span className="text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <CheckCircle2 size={10} className={pct === 100 ? 'text-emerald-500' : 'text-slate-600'} />
                                        {done}/{total} Tasks
                                    </span>
                                    <span className={pct === 100 ? 'text-emerald-500' : pct > 0 ? 'text-blue-400' : 'text-slate-500'}>{pct}%</span>
                                </div>
                                <div className="h-[4px] w-full bg-black/40 rounded-full overflow-hidden shadow-inner">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ease-out ${pct === 100 ? 'bg-emerald-500 shadow-[0_0_8px_#10b98180]' : 'bg-blue-500 shadow-[0_0_8px_#3b82f680]'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Footer details */}
                        <div className="flex flex-wrap items-center justify-between pt-2.5 mt-1 border-t border-white/[0.03] gap-2">
                            <div className={`flex items-center gap-1.5 text-[10px] font-semibold rounded-md px-1.5 py-1 ${isOverdue ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-slate-500 bg-black/20 border border-white/[0.02]'}`}>
                                {isOverdue
                                    ? <><AlertTriangle size={11} className="animate-pulse" /> Overdue</>
                                    : <><Calendar size={11} /> {formatDate(task.dueDate)}</>
                                }
                            </div>
                            
                            <div className="flex -space-x-1.5 hover:space-x-0.5 transition-all duration-300">
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
                                            className="w-[22px] h-[22px] rounded-full ring-2 ring-[#0c0f16] flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 shadow-sm transition-transform hover:scale-110 hover:z-10"
                                        >
                                            {initials}
                                        </div>
                                    );
                                })}
                                {task.assignedTo.length > 4 && (
                                    <div className="w-[22px] h-[22px] rounded-full bg-slate-800 ring-2 ring-[#0c0f16] flex items-center justify-center text-[9px] font-bold text-slate-300 shadow-sm">
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
