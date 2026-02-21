import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Clock, Calendar, Check, Tag, MoreHorizontal, MessageSquare, Paperclip } from 'lucide-react';
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
                    {/* Priority Bar Indicator (if not overdue which overrides left border) */}
                    {!isOverdue && (
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPriorityColor(task.priority)}`} />
                    )}

                    {/* Header: Select Checkbox, Priority, ID, Hover actions */}
                    <div className="relative z-10 flex justify-between items-start gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className={`relative flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity ${isSelected ? '!opacity-100' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onToggleSelection(task.id);
                                    }}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-blue-500 cursor-pointer appearance-none checked:bg-blue-500 transition-colors"
                                />
                                {isSelected && <Check size={10} className="absolute text-white pointer-events-none" />}
                            </div>

                            {/* Priority Dot & Label */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 ${getPriorityStyle(task.priority)} shrink-0`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(task.priority)}`} />
                                {task.priority}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-500 font-mono tracking-widest group-hover/card:text-slate-400 transition-colors shrink-0">
                                #{task.id.toString().substring(0, 4).toUpperCase()}
                            </span>
                            <button className="opacity-0 group-hover/card:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity hidden md:block" onClick={(e) => { e.stopPropagation(); /* Context Menu Hook Placeholder */ }}>
                                <MoreHorizontal size={14} />
                            </button>
                        </div>
                    </div>

                    <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-100 mb-2 leading-relaxed group-hover/card:text-blue-600 dark:group-hover/card:text-white transition-colors pl-1 cursor-pointer line-clamp-2">
                        {task.title}
                    </h4>

                    {/* Client Label and Tags and Comments (Middle row) */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3 pl-1">
                        {task.clientName && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 max-w-[120px] truncate">
                                {task.clientName}
                            </span>
                        )}
                        {task.tags?.map(tag => (
                            <span key={tag} className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 border border-transparent text-slate-500 dark:text-slate-300">
                                <Tag size={8} /> {tag}
                            </span>
                        ))}
                        {task.comments && task.comments.length > 0 && (
                            <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">
                                <MessageSquare size={10} /> {task.comments.length}
                            </span>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
                            <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">
                                <Paperclip size={10} /> {task.attachments.length}
                            </span>
                        )}
                    </div>

                    {/* Subtask Progress Bar */}
                    {subtaskTotal > 0 && (
                        <div className="mb-3 px-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{subtaskCompleted}/{subtaskTotal} Subtasks</span>
                                <span className="text-[9px] font-bold text-slate-500">{Math.round(progressPercent)}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Footer: Due Date, Time, Assignees */}
                    <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${isOverdue ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                <Calendar size={11} className={isOverdue ? 'text-rose-500' : 'text-slate-400'} />
                                <span className="text-[10px] font-semibold">{isOverdue ? "Overdue" : task.dueDate}</span>
                            </div>
                            {task.totalTimeSpent ? (
                                <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded border border-blue-200 dark:border-blue-500/20" title="Time Logged">
                                    <Clock size={10} /> {task.totalTimeSpent}m
                                </div>
                            ) : null}
                        </div>

                        {/* Assignee Avatars */}
                        <div className="flex -space-x-1.5">
                            {task.assignedTo.slice(0, 3).map(uid => {
                                const u = usersList.find(x => x.uid === uid);
                                return (
                                    <div key={uid} className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-200 shadow-sm" title={u?.displayName}>
                                        {u?.displayName ? u.displayName.substring(0, 1).toUpperCase() : '?'}
                                    </div>
                                );
                            })}
                            {task.assignedTo.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400 shadow-sm">
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
