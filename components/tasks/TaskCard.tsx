import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Clock, Calendar, Check, Tag, MoreHorizontal, MessageSquare, Paperclip, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Task, TaskPriority, UserProfile, TaskStatus } from '../../types';

interface TaskCardProps {
    task: Task;
    index: number;
    usersList: UserProfile[];
    selectedTaskIds: string[];
    onToggleSelection: (taskId: string) => void;
    onClick: (task: Task) => void;
}

const getPriorityStyle = (p: TaskPriority) => {
    switch (p) {
        case TaskPriority.URGENT: return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        case TaskPriority.HIGH: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
        case TaskPriority.MEDIUM: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
};

const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
        case TaskPriority.URGENT: return 'bg-rose-500';
        case TaskPriority.HIGH: return 'bg-orange-500';
        case TaskPriority.MEDIUM: return 'bg-blue-500';
        default: return 'bg-slate-500';
    }
};

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    index,
    usersList,
    selectedTaskIds,
    onToggleSelection,
    onClick
}) => {
    const isSelected = selectedTaskIds.includes(task.id);
    const subtaskCompleted = task.subtasks ? task.subtasks.filter(s => s.isCompleted).length : 0;
    const subtaskTotal = task.subtasks ? task.subtasks.length : 0;
    const progressPercent = subtaskTotal > 0 ? (subtaskCompleted / subtaskTotal) * 100 : 0;

    // Check if task is overdue based on dueDate (only if not completed/archived)
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() &&
        task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.ARCHIVED;

    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={provided.draggableProps.style}
                    onClick={() => onClick(task)}
                    className={`relative overflow-hidden group/card p-4 rounded-xl shadow-md transition-all duration-200 border bg-white dark:bg-slate-800/60 dark:backdrop-blur-sm
                        ${snapshot.isDragging ? 'shadow-2xl scale-[1.02] rotate-1 z-50 ring-2 ring-blue-500/50' : 'hover:-translate-y-1 hover:shadow-xl'}
                        ${isSelected ? 'ring-2 ring-cyan-500/50 border-cyan-500/30' : 'border-slate-200 dark:border-slate-700/50 hover:border-blue-500/30 dark:hover:border-slate-500/50'}
                        ${isOverdue ? 'border-l-4 border-l-rose-500 dark:border-l-rose-500 bg-rose-50/50 dark:bg-rose-900/10' : ''}`}
                >
                    {/* Priority Lead Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPriorityColor(task.priority)} shadow-[2px_0_10px_-2px_rgba(0,0,0,0.3)]`} />

                    {/* Header: Select Checkbox, Priority, ID */}
                    <div className="relative z-10 flex justify-between items-start gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div
                                className={`relative flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelection(task.id);
                                }}
                            >
                                <div className={`w-3.5 h-3.5 border rounded transition-all flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-500/20' : 'border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50'}`}>
                                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                </div>
                            </div>

                            {/* Priority Badge */}
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1.5 ${getPriorityStyle(task.priority)}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(task.priority)} shadow-sm shrink-0`} />
                                {task.priority}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 font-mono tracking-widest group-hover/card:text-blue-500 transition-colors">
                                #{task.id.toString().substring(0, 4).toUpperCase()}
                            </span>
                        </div>
                    </div>

                    <h4 className="text-[14px] font-bold text-slate-900 dark:text-slate-100 mb-3 leading-snug group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors cursor-pointer">
                        {task.title}
                    </h4>

                    {/* Metadata: Client & Progress */}
                    <div className="space-y-3 pl-0.5">
                        {task.clientName && (
                            <div className="flex items-center gap-1.5">
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/5 truncate">
                                    <Tag size={10} className="text-slate-400" />
                                    {task.clientName}
                                </div>
                            </div>
                        )}

                        {/* Subtask Progress Bar - Premium Version */}
                        {subtaskTotal > 0 && (
                            <div className="group/progress">
                                <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <CheckCircle2 size={10} className={progressPercent === 100 ? 'text-emerald-500' : 'text-slate-400'} />
                                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{subtaskCompleted}/{subtaskTotal} Tasks</span>
                                    </div>
                                    <span className="text-[9px] font-black text-blue-500 dark:text-blue-400">{Math.round(progressPercent)}%</span>
                                </div>
                                <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-200/50 dark:border-white/5 shadow-inner">
                                    <div
                                        className={`h-full transition-all duration-700 ease-out relative ${progressPercent === 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]'}`}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer: Date & Assignees */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${isOverdue ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 shadow-sm shadow-rose-500/5' : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5'}`}>
                            <Calendar size={11} className={isOverdue ? 'text-rose-500 animate-pulse' : 'text-slate-400'} />
                            <span className="text-[10px] font-bold">{isOverdue ? "Overdue" : task.dueDate}</span>
                        </div>

                        {/* Staff Avatar Stack */}
                        <div className="flex -space-x-2">
                            {task.assignedTo.slice(0, 3).map(uid => {
                                const u = usersList.find(x => x.uid === uid);
                                return (
                                    <div key={uid} className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-blue-400 ring-1 ring-slate-200 dark:ring-white/10" title={u?.displayName}>
                                        {u?.displayName ? u.displayName.substring(0, 1).toUpperCase() : '?'}
                                    </div>
                                );
                            })}
                            {task.assignedTo.length > 3 && (
                                <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[9px] font-black text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-white/10">
                                    +{task.assignedTo.length - 3}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
};

export default TaskCard;
