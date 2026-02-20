
import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    LayoutGrid, List as ListIcon, CheckSquare,
    MoreHorizontal, ChevronDown, Clock,
    MessageSquare, Paperclip, CheckCircle2,
    Calendar, AlertCircle, Plus, X
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

const WIP_LIMITS: Record<string, number> = {
    [TaskStatus.IN_PROGRESS]: 5,
    [TaskStatus.UNDER_REVIEW]: 5
};

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
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-3">
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            className={`group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${selectedTaskId === task.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                        >
                            <div className="flex items-center gap-3 shrink-0">
                                <input
                                    type="checkbox"
                                    checked={selectedTaskIds.includes(task.id)}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onToggleSelection(task.id);
                                    }}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                                />
                                <div className={`w-2 h-2 rounded-full ${getStatusConfig(task.status).bg}`} />
                            </div>
                            <div className="flex-1 min-w-0" onClick={() => handleOpenEdit(task)}>
                                <h4 className="text-sm font-bold text-white truncate">{task.title}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{task.clientName || 'Internal'}</span>
                                    <span className="text-[10px] text-gray-400">•</span>
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <Calendar size={10} /> {task.dueDate}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2" onClick={() => handleOpenEdit(task)}>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getPriorityStyle(task.priority)}`}>
                                    {task.priority}
                                </span>
                                <div className="flex -space-x-1.5 ml-2">
                                    {task.assignedTo.slice(0, 3).map(uid => {
                                        const user = usersList.find(u => u.uid === uid);
                                        return (
                                            <div key={uid} className="w-6 h-6 rounded-full bg-blue-500/20 border border-slate-900 flex items-center justify-center text-[8px] font-bold text-blue-400 shadow-sm" title={user?.displayName}>
                                                {user?.displayName ? user.displayName.substring(0, 1).toUpperCase() : '?'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
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
                                    className={`flex flex-col rounded-2xl shrink-0 transition-all duration-300 h-full max-h-full ${groupBy === 'NONE'
                                            ? (isCollapsed ? 'w-14 items-center bg-white/5' : 'w-full min-w-0 flex-1')
                                            : (isCollapsed ? 'w-14 items-center bg-white/5' : 'w-80')
                                        } ${snapshot.isDraggingOver ? 'bg-white/5 ring-1 ring-white/10' : ''}`}
                                >
                                    <div
                                        className={`p-4 flex items-center justify-between cursor-pointer group/header ${isCollapsed ? 'flex-col gap-4 py-8' : ''}`}
                                        onClick={() => status && toggleColumnCollapse(status)}
                                    >
                                        <div className={`flex items-center gap-3 ${isCollapsed ? 'rotate-90 origin-center whitespace-nowrap mt-8' : ''}`}>
                                            <div className={`w-2 h-2 rounded-full ${config.bg}`} />
                                            <h3 className="text-xs font-bold text-white uppercase tracking-widest">{title}</h3>
                                            {!isCollapsed && (
                                                <div className="flex items-center gap-2">
                                                    {status && WIP_LIMITS[status] && columnTasks.length > WIP_LIMITS[status] && (
                                                        <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 animate-pulse">
                                                            OVER LIMIT ({columnTasks.length}/{WIP_LIMITS[status]})
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status && WIP_LIMITS[status] && columnTasks.length > WIP_LIMITS[status] ? 'bg-rose-500 text-white' : 'bg-white/5 text-gray-500 border border-white/5'}`}>
                                                        {columnTasks.length}
                                                        {status && WIP_LIMITS[status] && <span className="text-gray-600"> / {WIP_LIMITS[status]}</span>}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="flex-1 px-3 space-y-4 pb-6">
                                            {columnTasks.map((task, index) => (
                                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            style={provided.draggableProps.style}
                                                            onClick={() => handleOpenEdit(task)}
                                                            className={`bg-[#1e293b] border p-4 rounded-xl shadow-xl transition-all ${snapshot.isDragging ? 'shadow-2xl scale-105 border-blue-500 rotate-1' : selectedTaskId === task.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-white/5 hover:border-white/10'}`}
                                                        >
                                                            <div className="flex justify-between items-start gap-2 mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedTaskIds.includes(task.id)}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            onToggleSelection(task.id);
                                                                        }}
                                                                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                                                                    />
                                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getPriorityStyle(task.priority)}`}>
                                                                        {task.priority}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-gray-600 font-mono tracking-wider">
                                                                    #{task.id.toString().substring(0, 4).toUpperCase()}
                                                                </span>
                                                            </div>

                                                            <h4 className="text-sm font-bold text-white mb-4 leading-tight">{task.title}</h4>

                                                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                                                <div className="flex items-center gap-1.5 text-gray-500">
                                                                    <Calendar size={12} />
                                                                    <span className="text-[10px] font-bold">{task.dueDate}</span>
                                                                </div>
                                                                <div className="flex -space-x-1.5">
                                                                    {task.assignedTo.slice(0, 3).map(uid => {
                                                                        const u = usersList.find(x => x.uid === uid);
                                                                        return (
                                                                            <div key={uid} className="w-6 h-6 rounded-full bg-blue-500/20 border border-slate-900 flex items-center justify-center text-[8px] font-bold text-blue-400" title={u?.displayName}>
                                                                                {u?.displayName ? u.displayName.substring(0, 1).toUpperCase() : '?'}
                                                                            </div>
                                                                        );
                                                                    })}
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
