
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
        }
    };

    if (viewMode === 'LIST') {
        return (
            <div className="flex-1 overflow-x-auto overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="min-w-[1000px] w-full max-w-7xl mx-auto">
                    {/* Header Row */}
                    <div className="grid grid-cols-[auto_1fr_150px_120px_100px_120px] gap-4 px-6 py-4 bg-black/40 border border-white/5 rounded-t-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest sticky top-0 backdrop-blur-md z-10">
                        <div className="w-5 flex justify-center">#</div>
                        <div>Task Name & Client</div>
                        <div>Assigned To</div>
                        <div>Status</div>
                        <div>Priority</div>
                        <div className="text-right">Due Date</div>
                    </div>

                    {/* Task Rows */}
                    <div className="bg-[#0a0f1d]/50 border-x border-b border-white/5 rounded-b-2xl flex flex-col divide-y divide-white/5">
                        {tasks.map((task, index) => (
                            <div
                                key={task.id}
                                onClick={() => handleOpenEdit(task)}
                                className={`grid grid-cols-[auto_1fr_150px_120px_100px_120px] gap-4 px-6 py-4 items-center transition-all cursor-pointer group hover:bg-white/[0.02] ${selectedTaskId === task.id ? 'bg-blue-500/10' : ''}`}
                            >
                                {/* Checkbox / Index */}
                                <div className="w-5 flex justify-center items-center">
                                    <div className="relative flex items-center justify-center" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTaskIds.includes(task.id)}
                                            onChange={() => onToggleSelection(task.id)}
                                            className="w-4 h-4 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50 cursor-pointer appearance-none checked:bg-blue-500 transition-colors"
                                        />
                                        {selectedTaskIds.includes(task.id) && <Check size={10} className="absolute text-white pointer-events-none" />}
                                    </div>
                                </div>

                                {/* Task Name & Client & Tags */}
                                <div className="min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <h4 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">{task.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 truncate max-w-[150px]">
                                            {task.clientName || 'Internal'}
                                        </span>
                                        <span className="text-[10px] text-gray-600 font-mono tracking-widest flex-shrink-0">
                                            #{task.id.toString().substring(0, 4).toUpperCase()}
                                        </span>

                                        {/* Tags inline */}
                                        {task.tags && task.tags.length > 0 && (
                                            <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                                                {task.tags.map(tag => (
                                                    <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-gray-400 flex items-center gap-1">
                                                        <Tag size={8} /> {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {task.totalTimeSpent ? (
                                            <div className="flex items-center gap-1 text-[9px] text-blue-400 font-bold ml-auto shrink-0 bg-blue-500/10 px-1.5 py-0.5 rounded">
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
                                            <div key={uid} className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-[#0a0f1d] flex items-center justify-center text-[9px] font-bold text-blue-300 shadow-sm ring-1 ring-white/10 shrink-0" title={user?.displayName}>
                                                {user?.displayName ? user.displayName.substring(0, 1).toUpperCase() : '?'}
                                            </div>
                                        );
                                    })}
                                    {task.assignedTo.length > 4 && (
                                        <div className="w-7 h-7 rounded-full bg-black/50 border border-[#0a0f1d] flex items-center justify-center text-[9px] font-bold text-gray-400 shadow-sm ring-1 ring-white/10 shrink-0">
                                            +{task.assignedTo.length - 4}
                                        </div>
                                    )}
                                </div>

                                {/* Status */}
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getStatusConfig(task.status).bg} shadow-[0_0_8px_currentColor]`} />
                                    <span className="text-xs font-bold text-gray-300 capitalize">
                                        {task.status.replace('_', ' ').toLowerCase()}
                                    </span>
                                </div>

                                {/* Priority */}
                                <div>
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded bg-black/40 border uppercase tracking-wider ${getPriorityStyle(task.priority)}`}>
                                        {task.priority}
                                    </span>
                                </div>

                                {/* Due Date */}
                                <div className="text-right flex items-center justify-end gap-2 text-gray-400 group-hover:text-gray-300 transition-colors">
                                    <Calendar size={14} className="text-blue-500/70" />
                                    <span className="text-xs font-bold">{task.dueDate}</span>
                                </div>
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <div className="py-20 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <ListIcon size={24} className="text-gray-500" />
                                </div>
                                <p className="text-gray-400 font-bold mb-1">No tasks found</p>
                                <p className="text-sm text-gray-500">Adjust your filters or create a new task.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Kanban Logic
    const kanbanColumns = groupBy === 'NONE'
        ? [TaskStatus.HALTED, TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.UNDER_REVIEW, TaskStatus.COMPLETED]
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
                                        ? (isCollapsed ? 'w-14 items-center bg-white/5' : 'w-full min-w-0 flex-1')
                                        : (isCollapsed ? 'w-14 items-center bg-white/5' : 'w-[320px]')
                                        } ${snapshot.isDraggingOver ? 'bg-white/5 ring-1 ring-white/10' : ''}`}
                                >
                                    <div
                                        className={`p-4 flex items-center justify-between cursor-pointer group/header ${isCollapsed ? 'flex-col gap-4 py-8' : ''}`}
                                        onClick={() => status && toggleColumnCollapse(status)}
                                    >
                                        <div className={`flex items-center gap-3 ${isCollapsed ? 'rotate-90 origin-center whitespace-nowrap mt-8' : ''}`}>
                                            <div className={`w-3 h-3 rounded bg-gradient-to-br from-white/20 to-transparent border border-white/20 flex items-center justify-center`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${config.bg}`} />
                                            </div>
                                            <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>
                                            {!isCollapsed && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-black/40 text-gray-400 border border-white/5 shadow-inner">
                                                        {columnTasks.length}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="flex-1 px-3 space-y-4 pb-20 overflow-y-auto custom-scrollbar">
                                            {columnTasks.map((task, index) => (
                                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            style={provided.draggableProps.style}
                                                            onClick={() => handleOpenEdit(task)}
                                                            className={`relative overflow-hidden group/card p-5 rounded-2xl shadow-xl transition-all duration-300 border backdrop-blur-md
                                                                ${snapshot.isDragging ? 'shadow-2xl scale-105 rotate-2 z-50 ring-2 ring-blue-500/50' : 'hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/10'}
                                                                ${selectedTaskId === task.id ? 'ring-2 ring-cyan-500/50' : ''}
                                                                bg-gradient-to-br from-[#131b2f] to-[#0a0f1d]
                                                                border-white/5 hover:border-white/20`}
                                                        >
                                                            {/* Dynamic Status/Priority Accent */}
                                                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${task.priority === TaskPriority.URGENT ? 'bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.6)]' :
                                                                task.priority === TaskPriority.HIGH ? 'bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.6)]' :
                                                                    task.priority === TaskPriority.MEDIUM ? 'bg-gradient-to-b from-blue-500 to-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.6)]' :
                                                                        'bg-gradient-to-b from-gray-500 to-gray-600'
                                                                }`} />

                                                            {/* subtle texture gradient backgound glow */}
                                                            <div className={`absolute -right-12 -top-12 w-32 h-32 rounded-full blur-3xl opacity-[0.15] pointer-events-none transition-all group-hover/card:opacity-[0.25] group-hover/card:scale-110 ${getStatusConfig(task.status).bg}`} />

                                                            <div className="relative z-10 flex justify-between items-start gap-2 mb-3">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <div className="relative flex items-center justify-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedTaskIds.includes(task.id)}
                                                                            onChange={(e) => {
                                                                                e.stopPropagation();
                                                                                onToggleSelection(task.id);
                                                                            }}
                                                                            className="w-5 h-5 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50 cursor-pointer appearance-none checked:bg-blue-500 transition-colors"
                                                                        />
                                                                        {selectedTaskIds.includes(task.id) && <Check size={12} className="absolute text-white pointer-events-none" />}
                                                                    </div>
                                                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded bg-black/40 border uppercase tracking-wider ${getPriorityStyle(task.priority)} shrink-0`}>
                                                                        {task.priority}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-black text-gray-500/50 font-mono tracking-widest group-hover/card:text-gray-400 transition-colors shrink-0">
                                                                    #{task.id.toString().substring(0, 4).toUpperCase()}
                                                                </span>
                                                            </div>

                                                            <h4 className="text-[15px] font-bold text-white mb-3 leading-snug group-hover/card:text-blue-100 transition-colors">{task.title}</h4>

                                                            {task.tags && task.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mb-4">
                                                                    {task.tags.map(tag => (
                                                                        <span key={tag} className="text-[9px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex items-center gap-2 text-gray-400 bg-black/20 px-2.5 py-1 rounded-lg border border-white/5">
                                                                        <Calendar size={12} className="text-blue-400/70" />
                                                                        <span className="text-[10px] font-bold">{task.dueDate}</span>
                                                                    </div>
                                                                    {task.totalTimeSpent ? (
                                                                        <div className="flex items-center gap-1 text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20" title="Time Logged">
                                                                            <Clock size={10} /> {task.totalTimeSpent}m
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <div className="flex -space-x-2">
                                                                    {task.assignedTo.slice(0, 3).map(uid => {
                                                                        const u = usersList.find(x => x.uid === uid);
                                                                        return (
                                                                            <div key={uid} className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-[#131b2f] flex items-center justify-center text-[9px] font-bold text-blue-300 shadow-lg ring-1 ring-white/10" title={u?.displayName}>
                                                                                {u?.displayName ? u.displayName.substring(0, 1).toUpperCase() : '?'}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {task.assignedTo.length > 3 && (
                                                                        <div className="w-7 h-7 rounded-full bg-black/50 border border-[#131b2f] flex items-center justify-center text-[9px] font-bold text-gray-400 shadow-lg ring-1 ring-white/10">
                                                                            +{task.assignedTo.length - 3}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}

                                            {/* Quick Add Input */}
                                            {status && !isCollapsed && (
                                                <div className="mt-2">
                                                    {quickAddStatus === status ? (
                                                        <div className="bg-[#1e293b] border border-blue-500/50 p-3 rounded-xl animate-in fade-in zoom-in-95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 shadow-lg shadow-blue-500/10">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Enter task title..."
                                                                className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none font-medium mb-3"
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
                                                                <span className="text-[10px] text-gray-500 font-medium">Press Enter to save</span>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            setQuickAddStatus(null);
                                                                            setQuickAddTitle('');
                                                                        }}
                                                                        className="p-1 hover:bg-white/10 rounded text-gray-400 transition-colors"
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
                                                            className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all text-xs font-bold group"
                                                        >
                                                            <Plus size={14} className="group-hover:scale-110 transition-transform" />
                                                            QUICK ADD
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
