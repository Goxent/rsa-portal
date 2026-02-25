
import React, { useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    LayoutGrid, List as ListIcon, CheckSquare,
    MoreHorizontal, ChevronDown, Clock,
    MessageSquare, Paperclip, CheckCircle2,
    Calendar, AlertCircle, Plus, X, Check,
    Tag, ChevronLeft, ChevronRight, GripVertical
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, UserRole, Client } from '../../types';
import { SIGNING_AUTHORITIES } from '../../constants/firmData';
import TaskCard from './TaskCard';
import { motion, AnimatePresence } from 'framer-motion';

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
    clientsList: Client[];
}

const STATUS_CONFIG: Record<string, {
    label: string;
    dot: string;
    header: string;
    glow: string;
    countBg: string;
    border: string;
}> = {
    [TaskStatus.NOT_STARTED]: {
        label: 'Not Started',
        dot: 'bg-slate-400',
        header: 'from-slate-800/80 to-slate-900/80',
        glow: 'shadow-slate-500/10',
        countBg: 'bg-slate-700/60 text-slate-300',
        border: 'border-t-slate-500',
    },
    [TaskStatus.IN_PROGRESS]: {
        label: 'In Progress',
        dot: 'bg-blue-500',
        header: 'from-blue-900/40 to-slate-900/80',
        glow: 'shadow-blue-500/10',
        countBg: 'bg-blue-500/20 text-blue-300',
        border: 'border-t-blue-500',
    },
    [TaskStatus.UNDER_REVIEW]: {
        label: 'Under Review',
        dot: 'bg-amber-400',
        header: 'from-amber-900/30 to-slate-900/80',
        glow: 'shadow-amber-500/10',
        countBg: 'bg-amber-500/20 text-amber-300',
        border: 'border-t-amber-400',
    },
    [TaskStatus.HALTED]: {
        label: 'Halted',
        dot: 'bg-rose-500',
        header: 'from-rose-900/30 to-slate-900/80',
        glow: 'shadow-rose-500/10',
        countBg: 'bg-rose-500/20 text-rose-300',
        border: 'border-t-rose-500',
    },
    [TaskStatus.COMPLETED]: {
        label: 'Completed',
        dot: 'bg-emerald-500',
        header: 'from-emerald-900/30 to-slate-900/80',
        glow: 'shadow-emerald-500/10',
        countBg: 'bg-emerald-500/20 text-emerald-300',
        border: 'border-t-emerald-500',
    },
    [TaskStatus.ARCHIVED]: {
        label: 'Archived',
        dot: 'bg-slate-600',
        header: 'from-slate-800/60 to-slate-900/80',
        glow: 'shadow-slate-500/5',
        countBg: 'bg-slate-800/60 text-slate-500',
        border: 'border-t-slate-600',
    },
};

const getPriorityStyle = (p: TaskPriority) => {
    switch (p) {
        case TaskPriority.URGENT: return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        case TaskPriority.HIGH: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
        case TaskPriority.MEDIUM: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
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
    onQuickAdd,
    clientsList
}) => {
    const [quickAddStatus, setQuickAddStatus] = React.useState<string | null>(null);
    const [quickAddTitle, setQuickAddTitle] = React.useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (groupBy === 'NONE') {
            localStorage.setItem('kanban_collapsed_columns', JSON.stringify(collapsedColumns));
        }
    }, [collapsedColumns, groupBy]);

    const handleQuickAddSubmit = async (status: TaskStatus) => {
        if (!quickAddTitle.trim()) return;
        await onQuickAdd(status, quickAddTitle);
        setQuickAddTitle('');
        setQuickAddStatus(null);
    };

    const scrollBoard = (dir: 'left' | 'right') => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: dir === 'right' ? 340 : -340, behavior: 'smooth' });
        }
    };

    // ─── LIST VIEW ──────────────────────────────────────────────────
    if (viewMode === 'LIST') {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar h-full">
                <div className="min-w-[1000px] w-full max-w-7xl mx-auto">
                    {/* Header Row */}
                    <div className="grid grid-cols-[auto_1fr_150px_120px_100px_120px] gap-4 px-6 py-4 bg-slate-800/50 border border-white/10 rounded-t-2xl text-[11px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 backdrop-blur-md z-10">
                        <div className="w-5 flex justify-center">#</div>
                        <div>Task Name & Client</div>
                        <div>Assigned To</div>
                        <div>Status</div>
                        <div>Priority</div>
                        <div className="text-right">Due Date</div>
                    </div>

                    <div className="bg-[#0f172a] border-x border-b border-white/10 rounded-b-2xl flex flex-col divide-y divide-white/5">
                        {tasks.map((task) => {
                            const cfg = STATUS_CONFIG[task.status];
                            return (
                                <div
                                    key={task.id}
                                    onClick={() => handleOpenEdit(task)}
                                    className={`grid grid-cols-[auto_1fr_150px_120px_100px_120px] gap-4 px-6 py-4 items-center transition-all cursor-pointer group hover:bg-slate-800/40 ${selectedTaskId === task.id ? 'bg-blue-500/10' : ''}`}
                                >
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

                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${cfg?.dot || 'bg-slate-500'}`} />
                                        <span className="text-xs font-semibold text-slate-300 capitalize">
                                            {task.status.replace('_', ' ').toLowerCase()}
                                        </span>
                                    </div>

                                    <div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded inline-flex uppercase tracking-wider ${getPriorityStyle(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                    </div>

                                    <div className="text-right flex items-center justify-end gap-1.5 text-slate-400 group-hover:text-slate-300 transition-colors">
                                        <Calendar size={13} className="text-slate-500" />
                                        <span className="text-xs font-semibold">{task.dueDate}</span>
                                    </div>
                                </div>
                            );
                        })}
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

    // ─── KANBAN VIEW ─────────────────────────────────────────────────
    const kanbanColumns = groupBy === 'NONE'
        ? [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.UNDER_REVIEW, TaskStatus.HALTED, TaskStatus.COMPLETED, TaskStatus.ARCHIVED]
        : groupBy === 'AUDITOR'
            ? SIGNING_AUTHORITIES
            : usersList.filter(u => u.role !== UserRole.ADMIN).map(u => u.uid);

    const totalTasks = tasks.length;

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            {/* Scroll hint arrows */}
            <div className="relative flex-1 flex flex-col h-full overflow-hidden">
                {/* Left scroll button */}
                <button
                    onClick={() => scrollBoard('left')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-slate-800/90 border border-white/10 shadow-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all backdrop-blur-sm"
                >
                    <ChevronLeft size={18} />
                </button>
                {/* Right scroll button */}
                <button
                    onClick={() => scrollBoard('right')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-slate-800/90 border border-white/10 shadow-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all backdrop-blur-sm"
                >
                    <ChevronRight size={18} />
                </button>

                {/* Scrollable board */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden h-full flex items-start gap-4 px-12 py-6 custom-scrollbar-x"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.3) transparent' }}
                >
                    {kanbanColumns.map(col => {
                        const status = groupBy === 'NONE' ? col as TaskStatus : null;
                        const userId = groupBy === 'ASSIGNEE' ? col as string : null;
                        const auditorName = groupBy === 'AUDITOR' ? col as string : null;
                        const user = userId ? usersList.find(u => u.uid === userId) : null;

                        const title = status
                            ? (STATUS_CONFIG[status]?.label || status.replace('_', ' '))
                            : userId ? (user?.displayName || 'Unknown')
                                : auditorName;

                        const isCollapsed = status ? collapsedColumns.includes(status) : false;

                        const columnTasks = tasks.filter(t => {
                            if (status) return t.status === status;
                            if (userId) return t.assignedTo.includes(userId);
                            if (auditorName) {
                                const taskClient = clientsList.find(c => t.clientIds && t.clientIds.includes(c.id));
                                return taskClient?.signingAuthority === auditorName;
                            }
                            return false;
                        });

                        const cfg = status ? STATUS_CONFIG[status] : {
                            label: title || '',
                            dot: 'bg-blue-400',
                            header: 'from-blue-900/30 to-slate-900/80',
                            glow: 'shadow-blue-500/10',
                            countBg: 'bg-blue-500/20 text-blue-300',
                            border: 'border-t-blue-400',
                        };

                        // Completion %
                        const completedCount = status === TaskStatus.COMPLETED ? columnTasks.length : 0;

                        return (
                            <Droppable key={col} droppableId={col.toString()} type="TASK">
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex flex-col flex-shrink-0 rounded-2xl transition-all duration-300 h-[calc(100vh-220px)]
                                            ${isCollapsed ? 'w-14' : 'w-[320px]'}
                                            ${snapshot.isDraggingOver
                                                ? 'bg-slate-800/60 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/5'
                                                : 'bg-slate-800/20 hover:bg-slate-800/30'
                                            }
                                            border border-white/[0.06]`}
                                    >
                                        {/* ── Column Header ── */}
                                        <div
                                            className={`flex-shrink-0 bg-gradient-to-b ${cfg.header} border-t-[3px] ${cfg.border} rounded-t-2xl px-4 py-3.5 cursor-pointer transition-all
                                                ${isCollapsed ? 'flex-col items-center justify-start gap-3 py-6 px-2' : 'flex items-center justify-between'}`}
                                            onClick={() => status && toggleColumnCollapse(status)}
                                        >
                                            <div className={`flex items-center gap-2.5 ${isCollapsed ? 'rotate-90 origin-center whitespace-nowrap mt-6' : ''}`}>
                                                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shadow-[0_0_8px_currentColor] flex-shrink-0`} />
                                                <h3 className="text-[11px] font-black text-slate-200 uppercase tracking-[0.12em]">{title}</h3>
                                            </div>

                                            {!isCollapsed && (
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${cfg.countBg}`}>
                                                        {columnTasks.length}
                                                    </span>
                                                    {status && (
                                                        <ChevronDown
                                                            size={14}
                                                            className="text-slate-500 hover:text-slate-300 transition-colors"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Column Body ── */}
                                        {!isCollapsed && (
                                            <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4 space-y-2.5 custom-scrollbar">
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

                                                {/* Empty state */}
                                                {columnTasks.length === 0 && (
                                                    <div className="h-28 rounded-xl border-2 border-dashed border-slate-700/40 flex flex-col items-center justify-center text-slate-600 text-[10px] font-bold uppercase tracking-widest gap-2 bg-slate-800/10">
                                                        <div className={`w-6 h-6 rounded-full ${cfg.dot} opacity-20`} />
                                                        Drop tasks here
                                                    </div>
                                                )}

                                                {/* Quick Add */}
                                                {status && (
                                                    <div className="pt-1">
                                                        <AnimatePresence>
                                                            {quickAddStatus === status ? (
                                                                <motion.div
                                                                    key="input"
                                                                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                                                                    transition={{ duration: 0.15 }}
                                                                    className="bg-slate-800 border border-slate-600/60 p-3.5 rounded-xl shadow-2xl"
                                                                >
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        placeholder="Task title..."
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
                                                                        <span className="text-[10px] text-slate-500 font-medium">↵ Enter to save</span>
                                                                        <div className="flex gap-1.5">
                                                                            <button
                                                                                onClick={() => { setQuickAddStatus(null); setQuickAddTitle(''); }}
                                                                                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                                                                            >
                                                                                <X size={13} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleQuickAddSubmit(status)}
                                                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                                                                            >
                                                                                <Plus size={12} /> Add
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            ) : (
                                                                <motion.button
                                                                    key="btn"
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    onClick={() => setQuickAddStatus(status)}
                                                                    className="w-full py-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-800/60 transition-all text-[11px] font-bold uppercase tracking-wider group"
                                                                >
                                                                    <Plus size={13} className="group-hover:scale-110 transition-transform" />
                                                                    Quick Add
                                                                </motion.button>
                                                            )}
                                                        </AnimatePresence>
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
            </div>
        </DragDropContext>
    );
};

export default TaskMainView;
