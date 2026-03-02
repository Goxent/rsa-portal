import React, { useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    List as ListIcon, Plus, X, Check, Tag,
    Calendar, Clock, CheckCircle2, AlertTriangle, UserCircle2,
    GripVertical, ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, UserRole, Client } from '../../types';
import { SIGNING_AUTHORITIES } from '../../constants/firmData';
import { AnimatePresence, motion } from 'framer-motion';
import { useMedia } from 'react-use';
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
    clientsList: Client[];
    onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
    onOpenReassign?: (taskId: string) => void;
}

// ── Status config — deliberate, non-AI colour palette ──────────────────────
const S = {
    [TaskStatus.NOT_STARTED]: {
        label: 'Not Started',
        topBar: 'bg-[#475569]',
        dot: 'bg-[#94a3b8]',
        headerBg: 'bg-[#1e293b]/60',
        bodyBg: 'bg-[#111827]/40',
        countBg: 'bg-slate-700/80 text-slate-300',
        ring: 'ring-slate-500/20',
    },
    [TaskStatus.IN_PROGRESS]: {
        label: 'In Progress',
        topBar: 'bg-[#2563eb]',
        dot: 'bg-[#3b82f6]',
        headerBg: 'bg-[#1e3a5f]/60',
        bodyBg: 'bg-[#0f1f3d]/30',
        countBg: 'bg-blue-900/60 text-blue-300',
        ring: 'ring-blue-500/20',
    },
    [TaskStatus.UNDER_REVIEW]: {
        label: 'Under Review',
        topBar: 'bg-[#d97706]',
        dot: 'bg-[#f59e0b]',
        headerBg: 'bg-[#3d2c0a]/60',
        bodyBg: 'bg-[#1c1308]/30',
        countBg: 'bg-amber-900/50 text-amber-300',
        ring: 'ring-amber-500/20',
    },
    [TaskStatus.HALTED]: {
        label: 'Halted',
        topBar: 'bg-[#dc2626]',
        dot: 'bg-[#ef4444]',
        headerBg: 'bg-[#3b0f0f]/60',
        bodyBg: 'bg-[#1a0808]/30',
        countBg: 'bg-red-900/50 text-red-300',
        ring: 'ring-red-500/20',
    },
    [TaskStatus.COMPLETED]: {
        label: 'Completed',
        topBar: 'bg-[#059669]',
        dot: 'bg-[#10b981]',
        headerBg: 'bg-[#0a2e1f]/60',
        bodyBg: 'bg-[#051510]/30',
        countBg: 'bg-emerald-900/50 text-emerald-300',
        ring: 'ring-emerald-500/20',
    },
    [TaskStatus.ARCHIVED]: {
        label: 'Archived',
        topBar: 'bg-[#374151]',
        dot: 'bg-[#6b7280]',
        headerBg: 'bg-[#1f2937]/50',
        bodyBg: 'bg-[#111827]/30',
        countBg: 'bg-gray-800/60 text-gray-500',
        ring: 'ring-gray-600/10',
    },
} as Record<string, {
    label: string; topBar: string; dot: string;
    headerBg: string; bodyBg: string; countBg: string; ring: string;
}>;

const FALLBACK_COL = {
    label: '', topBar: 'bg-blue-600', dot: 'bg-blue-400',
    headerBg: 'bg-blue-900/40', bodyBg: 'bg-blue-950/20',
    countBg: 'bg-blue-800/50 text-blue-300', ring: 'ring-blue-500/20',
};

// ── Helpers used by the LIST view ────────────────────────────────────────────
const P: Record<string, { bar: string; badge: string; label: string }> = {
    [TaskPriority.URGENT]: { bar: 'bg-[#dc2626]', badge: 'text-red-400 bg-red-950/60 border-red-800/50', label: 'Urgent' },
    [TaskPriority.HIGH]: { bar: 'bg-[#d97706]', badge: 'text-amber-400 bg-amber-950/60 border-amber-800/50', label: 'High' },
    [TaskPriority.MEDIUM]: { bar: 'bg-[#2563eb]', badge: 'text-blue-400 bg-blue-950/60 border-blue-800/50', label: 'Medium' },
    [TaskPriority.LOW]: { bar: 'bg-[#475569]', badge: 'text-slate-400 bg-slate-800/60 border-slate-700/50', label: 'Low' },
};
const AV = ['#3b5bdb', '#7048e8', '#0ca678', '#f59f00', '#e64980', '#1098ad', '#74c0fc', '#a9e34b'];
const avatarColor = (i: number) => AV[i % AV.length];
function formatDate(d?: string) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
}

// ────────────────────────────────────────────────────────────────────────────
// TaskMainView
// ────────────────────────────────────────────────────────────────────────────
// ── getPriorityStyle remains for the LIST view badge lookup ─────────────────
const getPriorityStyle = (p: TaskPriority) => {
    const map: Record<string, string> = {
        [TaskPriority.URGENT]: 'text-red-400 bg-red-950/60 border-red-800/50',
        [TaskPriority.HIGH]: 'text-amber-400 bg-amber-950/60 border-amber-800/50',
        [TaskPriority.MEDIUM]: 'text-blue-400 bg-blue-950/60 border-blue-800/50',
        [TaskPriority.LOW]: 'text-slate-400 bg-slate-800/60 border-slate-700/50',
    };
    return map[p] ?? map[TaskPriority.LOW];
};

const TaskMainView: React.FC<TaskMainViewProps> = ({
    viewMode, tasks, onDragEnd, handleOpenEdit, usersList,
    collapsedColumns, toggleColumnCollapse, selectedTaskId,
    selectedTaskIds, onToggleSelection, groupBy, onQuickAdd, clientsList, onUpdateTaskStatus, onOpenReassign
}) => {
    const isMobile = useMedia('(max-width: 768px)', false);
    const [quickAddStatus, setQuickAddStatus] = React.useState<string | null>(null);
    const [quickAddTitle, setQuickAddTitle] = React.useState('');
    const boardRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (groupBy === 'NONE') localStorage.setItem('kanban_collapsed_columns', JSON.stringify(collapsedColumns));
    }, [collapsedColumns, groupBy]);

    const submitQuickAdd = async (status: TaskStatus) => {
        if (!quickAddTitle.trim()) return;
        await onQuickAdd(status, quickAddTitle);
        setQuickAddTitle('');
        setQuickAddStatus(null);
    };

    const scroll = (dir: 'left' | 'right') => {
        boardRef.current?.scrollBy({ left: dir === 'right' ? 360 : -360, behavior: 'smooth' });
    };

    // ── LIST VIEW ──────────────────────────────────────────────────────────
    if (viewMode === 'LIST') {
        return (
            <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="min-w-full md:min-w-[900px] max-w-7xl mx-auto overflow-x-hidden md:overflow-x-visible">
                    {!isMobile && (
                        <div className="grid grid-cols-[24px_1fr_160px_130px_110px_130px] gap-x-4 px-5 py-3 border-b border-white/[0.06] text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 sticky top-0 bg-[#0a0f1e]/95 backdrop-blur-md z-10">
                            <div />
                            <div>Task / Client</div>
                            <div>Assigned</div>
                            <div>Status</div>
                            <div>Priority</div>
                            <div className="text-right">Due</div>
                        </div>
                    )}
                    {tasks.map(task => {
                        const sc = S[task.status];
                        const pc = P[task.priority] ?? P[TaskPriority.LOW];
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
                            && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.ARCHIVED;
                        const content = (
                            <div
                                onClick={() => handleOpenEdit(task)}
                                className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-[24px_1fr_160px_130px_110px_130px]'} gap-x-4 px-5 py-4 md:py-3.5 items-center cursor-pointer group rounded-lg transition-all mb-0.5
                                    hover:bg-white/[0.03] border border-transparent ${!isMobile && 'hover:border-white/[0.06]'}
                                    ${selectedTaskId === task.id ? 'bg-blue-500/[0.06] border-blue-500/20' : 'bg-[#0a0f1e]'}`}
                            >
                                {/* Selected Checkbox (Hidden on true mobile view for space, or keeping if needed) */}
                                {!isMobile && (
                                    <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
                                        <div className={`relative w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all
                                            ${selectedTaskIds.includes(task.id) ? 'bg-blue-600 border-blue-500' : 'border-slate-700 bg-transparent opacity-0 group-hover:opacity-100'}`}
                                            onClick={() => onToggleSelection(task.id)}>
                                            {selectedTaskIds.includes(task.id) && <Check size={9} className="text-white" strokeWidth={3.5} />}
                                        </div>
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1 md:mb-0.5">
                                        <span className="text-sm md:text-[13px] font-semibold text-slate-200 truncate group-hover:text-white transition-colors">{task.title}</span>
                                        {task.tags?.map(t => <span key={t} className="hidden md:inline text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500">{t}</span>)}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] md:text-[10px] text-slate-600">
                                        {task.clientName && <><Tag size={10} /> <span className="truncate max-w-[160px] md:max-w-[140px]">{task.clientName}</span></>}
                                        <span className="font-mono text-slate-700 hidden md:inline">#{task.id.substring(0, 5).toUpperCase()}</span>
                                    </div>

                                    {/* Mobile Only Meta Row */}
                                    {isMobile && (
                                        <div className="flex flex-wrap items-center gap-3 mt-3">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wide ${pc.badge}`}>{pc.label}</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full ${sc?.dot ?? 'bg-slate-500'}`} />
                                                <span className="text-[10px] text-slate-400 font-medium">{sc?.label ?? task.status.replace('_', ' ')}</span>
                                            </div>
                                            <div className={`text-[10px] font-medium flex items-center gap-1 ml-auto ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                                                {isOverdue ? <AlertTriangle size={10} className="animate-pulse" /> : <Calendar size={10} />}
                                                {formatDate(task.dueDate)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {!isMobile && (
                                    <>
                                        <div className="flex -space-x-1.5">
                                            {task.assignedTo.slice(0, 4).map((uid, i) => {
                                                const u = usersList.find(x => x.uid === uid);
                                                return (
                                                    <div key={uid} title={u?.displayName}
                                                        style={{ backgroundColor: avatarColor(i) }}
                                                        className="w-6 h-6 rounded-full border-2 border-[#0a0f1e] flex items-center justify-center text-[9px] font-black text-white">
                                                        {u?.displayName?.split(' ').map((p: string) => p[0]).join('').substring(0, 2).toUpperCase() ?? '?'}
                                                    </div>
                                                );
                                            })}
                                            {task.assignedTo.length > 4 && <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-[#0a0f1e] flex items-center justify-center text-[9px] text-slate-400">+{task.assignedTo.length - 4}</div>}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${sc?.dot ?? 'bg-slate-500'}`} />
                                            <span className="text-[11px] text-slate-400 font-medium">{sc?.label ?? task.status.replace('_', ' ')}</span>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wide ${pc.badge}`}>{pc.label}</span>
                                        <div className={`text-right text-[11px] font-medium flex items-center justify-end gap-1 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                                            {isOverdue ? <AlertTriangle size={10} className="animate-pulse" /> : <Calendar size={10} />}
                                            {formatDate(task.dueDate)}
                                        </div>
                                    </>
                                )}
                            </div>
                        );

                        if (isMobile) {
                            return (
                                <div key={task.id} className="relative mb-2 rounded-xl overflow-hidden bg-slate-800 border border-white/[0.06]">
                                    {/* Action items underneath */}
                                    <div className="absolute inset-y-0 right-0 w-[140px] flex">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onUpdateTaskStatus?.(task.id, TaskStatus.COMPLETED); }}
                                            className="flex-1 bg-emerald-600/90 hover:bg-emerald-500 flex flex-col items-center justify-center text-emerald-50 transition-colors"
                                        >
                                            <CheckCircle2 size={18} className="mb-1" />
                                            <span className="text-[10px] font-bold">Done</span>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onOpenReassign?.(task.id); }}
                                            className="flex-1 bg-blue-600/90 hover:bg-blue-500 flex flex-col items-center justify-center text-blue-50 transition-colors"
                                        >
                                            <UserCircle2 size={18} className="mb-1" />
                                            <span className="text-[10px] font-bold">Assign</span>
                                        </button>
                                    </div>

                                    {/* Swipe wrapper */}
                                    <motion.div
                                        drag="x"
                                        dragConstraints={{ left: -140, right: 0 }}
                                        dragElastic={0.1}
                                        dragDirectionLock
                                        className="relative z-10 w-full"
                                    >
                                        {content}
                                    </motion.div>
                                </div>
                            );
                        }

                        return <React.Fragment key={task.id}>{content}</React.Fragment>;
                    })}
                    {tasks.length === 0 && (
                        <div className="py-32 flex flex-col items-center justify-center text-center">
                            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center mb-4">
                                <ListIcon size={22} className="text-slate-600" />
                            </div>
                            <p className="text-slate-400 font-semibold mb-1">No tasks found</p>
                            <p className="text-sm text-slate-600">Adjust your filters or create a new task.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── KANBAN VIEW ────────────────────────────────────────────────────────
    const columns = groupBy === 'NONE'
        ? [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.UNDER_REVIEW, TaskStatus.HALTED, TaskStatus.COMPLETED, TaskStatus.ARCHIVED]
        : groupBy === 'AUDITOR'
            ? SIGNING_AUTHORITIES
            : usersList.filter(u => u.role !== UserRole.ADMIN).map(u => u.uid);

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            {/* Full height wrapper */}
            <div className="h-full flex flex-col min-h-0">

                {/* Relative wrapper so arrows can be absolutely pinned to edges */}
                <div className="relative flex-1 min-h-0">

                    {/* Left scroll arrow — pinned to left edge of the viewport area */}
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
                        <button
                            onClick={() => scroll('left')}
                            className="pointer-events-auto w-8 h-8 rounded-full bg-[#1e293b]/90 border border-white/[0.08] shadow-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#334155]/90 transition-all backdrop-blur-sm"
                        >
                            <ChevronLeft size={16} />
                        </button>
                    </div>

                    {/* Right scroll arrow — pinned to right edge of the viewport area */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
                        <button
                            onClick={() => scroll('right')}
                            className="pointer-events-auto w-8 h-8 rounded-full bg-[#1e293b]/90 border border-white/[0.08] shadow-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#334155]/90 transition-all backdrop-blur-sm"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Board scroll container — scrolls horizontally */}
                    <div
                        ref={boardRef}
                        className="h-full flex items-stretch gap-3 overflow-x-auto overflow-y-hidden px-10 py-4 kanban-scroll"
                    >
                        {columns.map(col => {
                            const status = groupBy === 'NONE' ? col as TaskStatus : null;
                            const userId = groupBy === 'ASSIGNEE' ? col as string : null;
                            const auditorName = groupBy === 'AUDITOR' ? col as string : null;
                            const colUser = userId ? usersList.find(u => u.uid === userId) : null;

                            const title = status
                                ? (S[status]?.label ?? status.replace('_', ' '))
                                : userId ? (colUser?.displayName ?? 'Unknown')
                                    : auditorName ?? '';

                            const isCollapsed = status ? collapsedColumns.includes(status) : false;
                            const cfg = (status ? S[status] : null) ?? FALLBACK_COL;

                            const colTasks = tasks.filter(t => {
                                if (status) return t.status === status;
                                if (userId) return t.assignedTo.includes(userId);
                                if (auditorName) {
                                    const tc = clientsList.find(c => t.clientIds?.includes(c.id));
                                    return tc?.signingAuthority === auditorName;
                                }
                                return false;
                            });

                            return (
                                <Droppable key={col} droppableId={col.toString()} type="TASK">
                                    {(prov, snap) => (
                                        <div
                                            ref={prov.innerRef}
                                            {...prov.droppableProps}
                                            className={[
                                                'flex flex-col flex-shrink-0 rounded-2xl overflow-hidden',
                                                'border transition-colors duration-200',
                                                isCollapsed ? 'w-10' : 'w-[290px]',
                                                snap.isDraggingOver
                                                    ? `border-white/20 ring-2 ${cfg.ring} shadow-xl`
                                                    : 'border-white/[0.06]',
                                                // Full height of the parent flex container:
                                                'h-full',
                                            ].join(' ')}
                                        >
                                            {/* ── Column header ── */}
                                            <div
                                                className={[
                                                    'relative flex-shrink-0',
                                                    cfg.headerBg,
                                                    'border-b border-white/[0.06] backdrop-blur-sm',
                                                    isCollapsed
                                                        ? 'flex flex-col items-center py-4 gap-4 cursor-pointer min-h-full'
                                                        : 'flex items-center justify-between px-4 py-3 cursor-pointer',
                                                ].join(' ')}
                                                onClick={() => status && toggleColumnCollapse(status)}
                                            >
                                                {/* Colour stripe at top */}
                                                <div className={`absolute top-0 left-0 right-0 h-[3px] ${cfg.topBar}`} />

                                                {isCollapsed ? (
                                                    <>
                                                        {/* Collapsed: stacked dot → count → vertical title */}
                                                        <div className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0 mt-1`} />
                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${cfg.countBg} tabular-nums`}>
                                                            {colTasks.length}
                                                        </span>
                                                        <span
                                                            className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] flex-1"
                                                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                                                        >
                                                            {title}
                                                        </span>
                                                        {status && <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />}
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0`} />
                                                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.1em]">{title}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${cfg.countBg}`}>
                                                                {colTasks.length}
                                                            </span>
                                                            {status && <ChevronDown size={13} className="text-slate-600" />}
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* ── Column body — THIS scrolls vertically ── */}
                                            {!isCollapsed && (
                                                <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-2.5 custom-scrollbar ${cfg.bodyBg}`}>
                                                    {colTasks.map((task, i) => (
                                                        <TaskCard
                                                            key={task.id}
                                                            task={task}
                                                            index={i}
                                                            usersList={usersList}
                                                            selectedTaskIds={selectedTaskIds}
                                                            onToggleSelection={onToggleSelection}
                                                            onClick={handleOpenEdit}
                                                        />
                                                    ))}
                                                    {prov.placeholder}

                                                    {/* Empty drop zone */}
                                                    {colTasks.length === 0 && (
                                                        <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[100px] rounded-xl border-2 border-dashed border-white/[0.05] text-[10px] text-slate-700 font-bold uppercase tracking-widest">
                                                            <div className={`w-4 h-4 rounded-full ${cfg.dot} opacity-20`} />
                                                            Drop here
                                                        </div>
                                                    )}

                                                    {/* Quick add */}
                                                    {status && (
                                                        <AnimatePresence mode="wait">
                                                            {quickAddStatus === status ? (
                                                                <motion.div
                                                                    key="input"
                                                                    initial={{ opacity: 0, y: 6 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: 6 }}
                                                                    transition={{ duration: 0.12 }}
                                                                    className="bg-[#161d2d] border border-slate-700 rounded-xl p-3 shadow-2xl"
                                                                >
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        placeholder="Task title..."
                                                                        value={quickAddTitle}
                                                                        onChange={e => setQuickAddTitle(e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') submitQuickAdd(status);
                                                                            if (e.key === 'Escape') { setQuickAddStatus(null); setQuickAddTitle(''); }
                                                                        }}
                                                                        className="w-full bg-transparent text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none mb-2.5 font-medium"
                                                                    />
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[9px] text-slate-600 font-medium uppercase tracking-wider">↵ to save · Esc to cancel</span>
                                                                        <div className="flex gap-1.5">
                                                                            <button onClick={() => { setQuickAddStatus(null); setQuickAddTitle(''); }}
                                                                                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors">
                                                                                <X size={12} />
                                                                            </button>
                                                                            <button onClick={() => submitQuickAdd(status)}
                                                                                className="px-2.5 h-6 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[10px] font-bold transition-colors flex items-center gap-1">
                                                                                <Plus size={11} /> Add
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
                                                                    className="w-full py-2 rounded-xl border border-dashed border-slate-800 text-slate-700 hover:text-slate-400 hover:border-slate-600 hover:bg-white/[0.02] transition-all text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 group"
                                                                >
                                                                    <Plus size={12} className="group-hover:scale-110 transition-transform" /> Add task
                                                                </motion.button>
                                                            )}
                                                        </AnimatePresence>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            );
                        })}
                    </div>{/* end boardRef scrollable div */}
                </div>{/* end relative wrapper */}
            </div>
        </DragDropContext>
    );
};

export default TaskMainView;
