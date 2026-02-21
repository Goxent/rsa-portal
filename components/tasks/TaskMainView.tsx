
import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    LayoutGrid, List as ListIcon, CheckSquare,
    MoreHorizontal, ChevronDown, Clock,
    MessageSquare, Paperclip, CheckCircle2,
    Calendar, AlertCircle, Plus, X, Check,
    Tag
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, UserRole } from '../../types';
import TaskCard from './TaskCard';

interface TaskMainViewProps {
    viewMode: 'LIST' | 'KANBAN';
    tasks: Task[];
    onDragEnd: (result: DropResult) => void;
    handleOpenEdit: (task: Task) => void;
    usersList: UserProfile[];
    collapsedColumns: TaskStatus[];
    toggleColumnCollapse: (status: TaskStatus) => void;
    selectedTaskId?: string;
    selectedTaskIds: string[];
    onToggleSelection: (taskId: string) => void;
    groupBy: 'NONE' | 'AUDITOR' | 'ASSIGNEE';
    onQuickAdd: (status: TaskStatus, title: string) => Promise<void>;
}

// Removed WIP Limits

const TaskMainView: React.FC<TaskMainViewProps> = ({
    viewMode,
    tasks,
    onDragEnd,
    handleOpenEdit,
    usersList,
    collapsedColumns,
    toggleColumnCollapse,
    selectedTaskId,
    selectedTaskIds,
    onToggleSelection,
    groupBy,
    onQuickAdd
}) => {
    const [quickAddStatus, setQuickAddStatus] = React.useState<string | null>(null);
    const [quickAddTitle, setQuickAddTitle] = React.useState('');

    const handleQuickAddSubmit = async (status: TaskStatus) => {
        if (!quickAddTitle.trim()) return;
        await onQuickAdd(status, quickAddTitle);
        setQuickAddTitle('');
        setQuickAddStatus(null);
    };

    const getPriorityStyle = (p: TaskPriority) => {
        switch (p) {
            case TaskPriority.URGENT: return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            case TaskPriority.HIGH: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case TaskPriority.MEDIUM: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    const getStatusConfig = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.NOT_STARTED: return { color: 'text-gray-400', bg: 'bg-gray-400' };
            case TaskStatus.IN_PROGRESS: return { color: 'text-blue-400', bg: 'bg-blue-400' };
            case TaskStatus.UNDER_REVIEW: return { color: 'text-amber-400', bg: 'bg-amber-400' };
            case TaskStatus.HALTED: return { color: 'text-rose-400', bg: 'bg-rose-400' };
            case TaskStatus.COMPLETED: return { color: 'text-emerald-400', bg: 'bg-emerald-400' };
            case TaskStatus.ARCHIVED: return { color: 'text-slate-500', bg: 'bg-slate-500' };
        }
    };

    if (viewMode === 'LIST') {
        return (
            <div className="flex-1 overflow-x-auto overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="min-w-[1000px] w-full max-w-7xl mx-auto">
                    {/* Header Row */}
                    <div className="grid grid-cols-[auto_1fr_150px_120px_100px_120px] gap-4 px-6 py-4 bg-slate-800/50 border border-white/10 rounded-t-2xl text-[11px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 backdrop-blur-md z-10 transition-colors">
                        <div className="w-5 flex justify-center">#</div>
                        <div>Task Name & Client</div>
                        <div>Assigned To</div>
                        <div>Status</div>
                        <div>Priority</div>
                        <div className="text-right">Due Date</div>
                    </div>

                    {/* Task Rows */}
                    <div className="bg-[#0f172a] border-x border-b border-white/10 rounded-b-2xl flex flex-col divide-y divide-white/5">
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                onClick={() => handleOpenEdit(task)}
                                className={`grid grid-cols-[auto_1fr_150px_120px_100px_120px] gap-4 px-6 py-4 items-center transition-all cursor-pointer group hover:bg-slate-800/40 ${selectedTaskId === task.id ? 'bg-blue-500/10' : ''}`}
                            >
                                {/* Checkbox */}
                                <div className="w-5 flex justify-center items-center">
                                    <div className="relative flex items-center justify-center" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTaskIds.includes(task.id)}
                                            onChange={() => onToggleSelection(task.id)}
                                            className="w-4 h-4 rounded border-white/20 bg-slate-800 text-blue-500 focus:ring-blue-500/50 cursor-pointer appearance-none checked:bg-blue-500 transition-colors"
                                        />
                                        {selectedTaskIds.includes(task.id) && <Check size={10} className="absolute text-white pointer-events-none" />}
                                    </div>
                                </div>

                                {/* Task Name & Client & Tags */}
                                <div className="min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <h4 className="text-[15px] font-bold text-white truncate group-hover:text-blue-400 transition-colors">{task.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-300 font-semibold tracking-wider bg-slate-800/80 px-2 py-0.5 rounded border border-white/5 truncate max-w-[150px]">
                                            {task.clientName || 'Internal'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono tracking-widest flex-shrink-0">
                                            #{task.id.toString().substring(0, 4).toUpperCase()}
                                        </span>

                                        {/* Tags inline */}
                                        {task.tags && task.tags.length > 0 && (
                                            <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                                                {task.tags.map(tag => (
                                                    <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/50 border border-white/5 text-slate-400 flex items-center gap-1">
                                                        <Tag size={8} /> {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {task.totalTimeSpent ? (
                                            <div className="flex items-center gap-1 text-[9px] text-blue-400 font-semibold ml-auto shrink-0 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                                <Clock size={10} /> {task.totalTimeSpent}m
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Assignees */}
                                <div className="flex -space-x-2 overflow-hidden">
                                    {task.assignedTo.slice(0, 4).map(uid => {
                                        const user = usersList.find(u => u.uid === uid);
                                        return (
                                            <div key={uid} className="w-7 h-7 rounded-full bg-slate-700 border-2 border-[#0f172a] flex items-center justify-center text-[10px] font-bold text-slate-200 shadow-sm shrink-0" title={user?.displayName}>
                                                {user?.displayName ? user.displayName.substring(0, 1).toUpperCase() : '?'}
                                            </div>
                                        );
                                    })}
                                    {task.assignedTo.length > 4 && (
                                        <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-[#0f172a] flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm shrink-0">
                                            +{task.assignedTo.length - 4}
                                        </div>
                                    )}
                                </div>

                                {/* Status */}
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getStatusConfig(task.status).bg} shadow-sm`} />
                                    <span className="text-xs font-semibold text-slate-300 capitalize">
                                        {task.status.replace('_', ' ').toLowerCase()}
                                    </span>
                                </div>

                                {/* Priority */}
                                <div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded inline-flex uppercase tracking-wider ${getPriorityStyle(task.priority)}`}>
                                        {task.priority}
                                    </span>
                                </div>

                                {/* Due Date */}
                                <div className="text-right flex items-center justify-end gap-1.5 text-slate-400 group-hover:text-slate-300 transition-colors">
                                    <Calendar size={13} className="text-slate-500" />
                                    <span className="text-xs font-semibold">{task.dueDate}</span>
                                </div>
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <div className="py-24 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                                    <ListIcon size={24} className="text-slate-500" />
                                </div>
                                <p className="text-slate-300 font-bold mb-1">No tasks found</p>
                                <p className="text-sm text-slate-500">Adjust your filters or create a new task.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Kanban Logic
    const kanbanColumns = groupBy === 'NONE'
        ? [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.UNDER_REVIEW, TaskStatus.HALTED, TaskStatus.COMPLETED, TaskStatus.ARCHIVED]
        : usersList.filter(u => groupBy === 'AUDITOR' ? u.role === UserRole.ADMIN : true).map(u => u.uid);

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className={`flex-1 overflow-hidden p-6 h-full ${groupBy === 'NONE' ? 'grid grid-cols-5 gap-4' : 'flex overflow-x-auto gap-6'} items-start`}>
                {kanbanColumns.map(col => {
                    const status = groupBy === 'NONE' ? col as TaskStatus : null;
                    const userId = groupBy !== 'NONE' ? col as string : null;
                    const user = userId ? usersList.find(u => u.uid === userId) : null;

                    const title = status ? status.replace('_', ' ') : user?.displayName || 'Unknown';
                    const isCollapsed = status ? collapsedColumns.includes(status) : false;
                    const columnTasks = tasks.filter(t => status ? t.status === status : t.assignedTo.includes(userId!));
                    const config = status ? getStatusConfig(status) : { color: 'text-blue-400', bg: 'bg-blue-400' };

                    return (
                        <Droppable key={col} droppableId={col.toString()} type="TASK">
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`flex flex-col rounded-2xl shrink-0 transition-all duration-300 h-full max-h-[calc(100vh-200px)] ${groupBy === 'NONE'
                                        ? (isCollapsed ? 'w-14 items-center bg-transparent' : 'w-full min-w-0 flex-1')
                                        : (isCollapsed ? 'w-14 items-center bg-transparent' : 'w-[320px]')
                                        } ${snapshot.isDraggingOver ? 'bg-slate-800/30' : ''}`}
                                >
                                    {/* Column Header */}
                                    <div
                                        className={`p-4 mb-2 flex items-center justify-between cursor-pointer group/header bg-slate-800/20 hover:bg-slate-800/40 border-t-4 ${status === TaskStatus.COMPLETED ? 'border-emerald-500' : status === TaskStatus.IN_PROGRESS ? 'border-blue-500' : status === TaskStatus.UNDER_REVIEW ? 'border-amber-500' : status === TaskStatus.HALTED ? 'border-rose-500' : status === TaskStatus.ARCHIVED ? 'border-slate-500' : 'border-slate-400'} rounded-t-xl transition-colors ${isCollapsed ? 'flex-col gap-4 py-8 border-t-0 border-l-4' : ''} shadow-sm`}
                                        onClick={() => status && toggleColumnCollapse(status)}
                                    >
                                        <div className={`flex items-center gap-3 ${isCollapsed ? 'rotate-90 origin-center whitespace-nowrap mt-8' : ''}`}>
                                            <div className={`w-2 h-2 rounded-full ${config.bg}`} />
                                            <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">{title}</h3>
                                            {!isCollapsed && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                                        {columnTasks.length}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="flex-1 px-1 space-y-3 pb-20 overflow-y-auto custom-scrollbar">
                                            {columnTasks.map((task, index) => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    index={index}
                                                    usersList={usersList}
                                                    selectedTaskIds={selectedTaskIds}
                                                    onToggleSelection={onToggleSelection}
                                                    onClick={handleOpenEdit}
                                                />
                                            ))}
                                            {provided.placeholder}

                                            {/* Empty State Placeholder */}
                                            {columnTasks.length === 0 && !isCollapsed && (
                                                <div className="h-24 rounded-xl border-2 border-dashed border-slate-700/50 flex items-center justify-center text-slate-500 text-xs font-semibold uppercase tracking-widest bg-slate-800/10 mb-2">
                                                    Drop tasks here
                                                </div>
                                            )}

                                            {/* Quick Add Input */}
                                            {status && !isCollapsed && (
                                                <div className="mt-1">
                                                    {quickAddStatus === status ? (
                                                        <div className="bg-slate-800 border border-slate-600 p-3 rounded-xl animate-in fade-in zoom-in-95 shadow-lg">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Enter task title..."
                                                                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none font-medium mb-3"
                                                                value={quickAddTitle}
                                                                onChange={(e) => setQuickAddTitle(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleQuickAddSubmit(status);
                                                                    if (e.key === 'Escape') {
                                                                        setQuickAddStatus(null);
                                                                        setQuickAddTitle('');
                                                                    }
                                                                }}
                                                            />
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] text-slate-500 font-medium">Press Enter to save</span>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            setQuickAddStatus(null);
                                                                            setQuickAddTitle('');
                                                                        }}
                                                                        className="p-1 hover:bg-slate-700 rounded text-slate-400 transition-colors"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleQuickAddSubmit(status)}
                                                                        className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                                    >
                                                                        <Plus size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setQuickAddStatus(status)}
                                                            className="w-full py-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-800/50 transition-all text-[11px] font-bold uppercase tracking-wider group"
                                                        >
                                                            <Plus size={14} className="group-hover:scale-110 transition-transform" />
                                                            Quick Add
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    );
                })}
            </div>
        </DragDropContext>
    );
};

export default TaskMainView;
