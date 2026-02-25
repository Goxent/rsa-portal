import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Clock, Calendar, Check, Tag, GripVertical, CheckCircle2, AlertTriangle, User } from 'lucide-react';
import { Task, TaskPriority, UserProfile, TaskStatus } from '../../types';
import { motion } from 'framer-motion';

interface TaskCardProps {
    task: Task;
    index: number;
    usersList: UserProfile[];
    selectedTaskIds: string[];
    onToggleSelection: (taskId: string) => void;
    onClick: (task: Task) => void;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; badge: string; bar: string }> = {
    [TaskPriority.URGENT]: { label: 'Urgent', dot: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', bar: 'bg-rose-500' },
    [TaskPriority.HIGH]: { label: 'High', dot: 'bg-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', bar: 'bg-orange-400' },
    [TaskPriority.MEDIUM]: { label: 'Medium', dot: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', bar: 'bg-blue-500' },
    [TaskPriority.LOW]: { label: 'Low', dot: 'bg-slate-500', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20', bar: 'bg-slate-500' },
};

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    index,
    usersList,
    selectedTaskIds,
    onToggleSelection,
    onClick,
}) => {
    const isSelected = selectedTaskIds.includes(task.id);
    const subtaskCompleted = task.subtasks ? task.subtasks.filter(s => s.isCompleted).length : 0;
    const subtaskTotal = task.subtasks ? task.subtasks.length : 0;
    const progressPercent = subtaskTotal > 0 ? Math.round((subtaskCompleted / subtaskTotal) * 100) : 0;

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() &&
        task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.ARCHIVED;

    const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[TaskPriority.LOW];

    // Team lead info
    const teamLead = task.teamLeaderId ? usersList.find(u => u.uid === task.teamLeaderId) : null;

    // Format due date nicely
    const formatDate = (d: string) => {
        try {
            const dt = new Date(d);
            return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch { return d; }
    };

    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={provided.draggableProps.style}
                    onClick={() => onClick(task)}
                    className={`relative group/card rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden
                        bg-slate-900/70 backdrop-blur-sm
                        ${snapshot.isDragging
                            ? 'shadow-2xl shadow-black/40 scale-[1.025] rotate-[0.5deg] z-50 ring-2 ring-blue-500/50 border-blue-500/30'
                            : 'hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5'
                        }
                        ${isSelected
                            ? 'ring-2 ring-cyan-500/50 border-cyan-500/30'
                            : isOverdue
                                ? 'border-rose-500/30 hover:border-rose-500/50'
                                : 'border-white/[0.07] hover:border-white/[0.15]'
                        }`}
                >
                    {/* Priority accent bar (left edge) */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${pCfg.bar} opacity-80`} />

                    {/* Overdue glow */}
                    {isOverdue && (
                        <div className="absolute inset-0 bg-rose-500/5 pointer-events-none rounded-xl" />
                    )}

                    <div className="pl-3 pr-3 pt-3 pb-3">
                        {/* Top row: checkbox, priority, ID, drag handle */}
                        <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                                {/* Checkbox */}
                                <div
                                    className={`relative flex items-center justify-center w-4 h-4 flex-shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}
                                    onClick={(e) => { e.stopPropagation(); onToggleSelection(task.id); }}
                                >
                                    <div className={`w-3.5 h-3.5 border rounded transition-all flex items-center justify-center
                                        ${isSelected ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-500/30' : 'border-slate-600 bg-slate-900/50'}`}>
                                        {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                                    </div>
                                </div>

                                {/* Priority badge */}
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${pCfg.badge}`}>
                                    <div className={`w-1 h-1 rounded-full ${pCfg.dot}`} />
                                    {pCfg.label}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {/* Task ID */}
                                <span className="text-[9px] font-mono font-bold text-slate-600 group-hover/card:text-slate-400 transition-colors">
                                    #{task.id.substring(0, 5).toUpperCase()}
                                </span>
                                {/* Drag handle */}
                                <div {...provided.dragHandleProps} className="p-0.5 text-slate-700 hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing" onClick={e => e.stopPropagation()}>
                                    <GripVertical size={13} />
                                </div>
                            </div>
                        </div>

                        {/* Task title */}
                        <h4 className="text-[13.5px] font-bold text-slate-100 leading-snug mb-2 group-hover/card:text-blue-300 transition-colors pr-1 line-clamp-2">
                            {task.title}
                        </h4>

                        {/* Client tag */}
                        {task.clientName && (
                            <div className="flex items-center gap-1 mb-2.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-lg border border-white/[0.06] max-w-full truncate">
                                    <Tag size={9} className="text-slate-500 flex-shrink-0" />
                                    <span className="truncate">{task.clientName}</span>
                                </span>
                            </div>
                        )}

                        {/* Subtask progress */}
                        {subtaskTotal > 0 && (
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                                        <CheckCircle2 size={9} className={progressPercent === 100 ? 'text-emerald-500' : 'text-slate-500'} />
                                        {subtaskCompleted}/{subtaskTotal} subtasks
                                    </div>
                                    <span className={`text-[9px] font-black ${progressPercent === 100 ? 'text-emerald-400' : 'text-blue-400'}`}>
                                        {progressPercent}%
                                    </span>
                                </div>
                                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ease-out
                                            ${progressPercent === 100
                                                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                                                : 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]'
                                            }`}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Footer: date + assignees */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.05]">
                            {/* Due date */}
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold
                                ${isOverdue
                                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                    : 'text-slate-400 bg-slate-800/40 border-white/[0.05]'
                                }`}>
                                {isOverdue
                                    ? <AlertTriangle size={10} className="animate-pulse" />
                                    : <Calendar size={10} />
                                }
                                {isOverdue ? 'Overdue' : formatDate(task.dueDate)}
                            </div>

                            {/* Assignee avatars */}
                            <div className="flex -space-x-1.5">
                                {task.assignedTo.slice(0, 4).map((uid, i) => {
                                    const u = usersList.find(x => x.uid === uid);
                                    const initials = u?.displayName
                                        ? u.displayName.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase()
                                        : '?';
                                    const colors = ['bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600'];
                                    return (
                                        <div
                                            key={uid}
                                            title={u?.displayName}
                                            className={`w-6 h-6 rounded-full ${colors[i % colors.length]} border-2 border-slate-900 flex items-center justify-center text-[9px] font-black text-white shadow-sm flex-shrink-0`}
                                        >
                                            {initials}
                                        </div>
                                    );
                                })}
                                {task.assignedTo.length > 4 && (
                                    <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[9px] font-black text-slate-400">
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
