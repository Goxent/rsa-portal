import React, { useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    List as ListIcon, Plus, X, Check, Tag,
    Calendar, Clock, CheckCircle2, AlertTriangle, UserCircle2,
    GripVertical, ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, UserRole, Client, AuditPhase } from '../../types';
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
    groupBy: 'NONE' | 'AUDITOR' | 'ASSIGNEE' | 'PHASE';
    onQuickAdd: (status: TaskStatus, title: string) => Promise<void>;
    clientsList: Client[];
    onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
    onOpenReassign?: (taskId: string) => void;
    onSelectAll?: () => void;
    onOpenClientDetail?: (clientId: string) => void;
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
        countBg: 'bg-blue-900/60 text-amber-300',
        ring: 'ring-amber-500/20',
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
    label: '', topBar: 'bg-amber-600', dot: 'bg-blue-400',
    headerBg: 'bg-blue-900/40', bodyBg: 'bg-blue-950/20',
    countBg: 'bg-blue-800/50 text-amber-300', ring: 'ring-amber-500/20',
};

// ── Helpers used by the LIST view ────────────────────────────────────────────
const P: Record<string, { bar: string; badge: string; label: string }> = {
    [TaskPriority.URGENT]: { bar: 'bg-[#dc2626]', badge: 'text-red-400 bg-red-950/60 border-red-800/50', label: 'Urgent' },
    [TaskPriority.HIGH]: { bar: 'bg-[#d97706]', badge: 'text-amber-400 bg-amber-950/60 border-amber-800/50', label: 'High' },
    [TaskPriority.MEDIUM]: { bar: 'bg-[#2563eb]', badge: 'text-amber-400 bg-blue-950/60 border-blue-800/50', label: 'Medium' },
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
        [TaskPriority.MEDIUM]: 'text-amber-400 bg-blue-950/60 border-blue-800/50',
        [TaskPriority.LOW]: 'text-slate-400 bg-slate-800/60 border-slate-700/50',
    };
    return map[p] ?? map[TaskPriority.LOW];
};

const TaskMainView: React.FC<TaskMainViewProps> = ({
    viewMode, tasks, onDragEnd, handleOpenEdit, usersList,
    collapsedColumns, toggleColumnCollapse, selectedTaskId,
    selectedTaskIds, onToggleSelection, groupBy, onQuickAdd, clientsList, onUpdateTaskStatus, onOpenReassign, onSelectAll, onOpenClientDetail
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

    const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

    // ── LIST VIEW ──────────────────────────────────────────────────────────
    if (viewMode === 'LIST') {
        return (
            <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="min-w-full md:min-w-[900px] max-w-7xl mx-auto overflow-x-hidden md:overflow-x-visible">
                    {!isMobile && (
                        <div className="grid grid-cols-[24px_1fr_160px_130px_110px_130px] gap-x-4 px-5 py-3 border-b border-white/[0.06] text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 sticky top-0 bg-[#0a0f1e]/95 backdrop-blur-md z-10">
                            <div className="flex items-center justify-center">
                                <button
                                    onClick={onSelectAll}
                                    title="Select All Visible Tasks"
                                    className={`relative w-4 h-4 rounded border flex items-center justify-center transition-all ${allSelected ? 'bg-amber-600 border-amber-500' : 'border-slate-600 hover:border-slate-400 bg-transparent'}`}
                                >
                                    {allSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                </button>
                            </div>
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
                                    ${selectedTaskId === task.id ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-[#0a0f1e]'}`}
                            >
                                {/* Selected Checkbox (Hidden on true mobile view for space, or keeping if needed) */}
                                {!isMobile && (
                                    <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
                                        <div className={`relative w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all
                                            ${selectedTaskIds.includes(task.id) ? 'bg-amber-600 border-amber-500' : 'border-slate-700 bg-transparent opacity-0 group-hover:opacity-100'}`}
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
                                        {task.clientName && (
                                            <div 
                                                className="flex items-center gap-1 hover:text-amber-400 transition-all cursor-pointer"
                                                onClick={(e) => {
                                                    if (onOpenClientDetail && task.clientIds?.[0]) {
                                                        e.stopPropagation();
                                                        onOpenClientDetail(task.clientIds[0]);
                                                    }
                                                }}
                                            >
                                                <Tag size={10} className="text-slate-700" /> 
                                                <span className="truncate max-w-[160px] md:max-w-[140px] underline-offset-2 hover:underline font-bold">{task.clientName}</span>
                                            </div>
                                        )}
                                        <span className="font-mono text-slate-800 hidden md:inline">#{task.id.substring(0, 5).toUpperCase()}</span>
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
                                            className="flex-1 bg-amber-600/90 hover:bg-amber-500 flex flex-col items-center justify-center text-blue-50 transition-colors"
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

    // ── SIDE-BY-SIDE PHASE KANBAN VIEW ────────────────────────────────────
    const PHASE_ORDER = [AuditPhase.ONBOARDING, AuditPhase.PLANNING_AND_EXECUTION, AuditPhase.REVIEW_AND_CONCLUSION];
    const STATUS_COLS = [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.UNDER_REVIEW, TaskStatus.COMPLETED];

    const PHASE_META: Record<string, { label: string; color: string; dot: string; bg: string; border: string; headerBg: string; topBar: string }> = {
        [AuditPhase.ONBOARDING]: { label: 'Onboarding', color: 'text-cyan-400', dot: 'bg-cyan-400', bg: 'bg-[#0c1a24]', border: 'border-cyan-500/20', headerBg: 'bg-cyan-950/40', topBar: 'bg-cyan-500' },
        [AuditPhase.PLANNING_AND_EXECUTION]: { label: 'Planning & Execution', color: 'text-amber-400', dot: 'bg-amber-400', bg: 'bg-[#1a1508]', border: 'border-amber-500/20', headerBg: 'bg-amber-950/40', topBar: 'bg-amber-500' },
        [AuditPhase.REVIEW_AND_CONCLUSION]: { label: 'Review & Conclusion', color: 'text-emerald-400', dot: 'bg-emerald-400', bg: 'bg-[#0a1f15]', border: 'border-emerald-500/20', headerBg: 'bg-emerald-950/40', topBar: 'bg-emerald-500' },
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="h-full flex flex-col min-h-0">
                <div className="relative flex-1 min-h-0">
                    {/* Left scroll arrow */}
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-[40] pointer-events-none">
                        <button type="button" onClick={() => scroll('left')}
                            className="pointer-events-auto w-8 h-8 rounded-full bg-[#1e293b]/90 border border-white/[0.08] shadow-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#334155]/90 transition-all backdrop-blur-sm">
                            <ChevronLeft size={16} />
                        </button>
                    </div>
                    {/* Right scroll arrow */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 z-[40] pointer-events-none">
                        <button type="button" onClick={() => scroll('right')}
                            className="pointer-events-auto w-8 h-8 rounded-full bg-[#1e293b]/90 border border-white/[0.08] shadow-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#334155]/90 transition-all backdrop-blur-sm">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Horizontal scroll container — 3 phase columns side by side */}
                    <div ref={boardRef} className="h-full flex items-stretch gap-3 overflow-x-auto overflow-y-hidden px-4 md:px-8 py-4 kanban-scroll">
                        {PHASE_ORDER.map(phase => {
                            const pm = PHASE_META[phase];
                            const phaseTasks = tasks.filter(t => (t.auditPhase || AuditPhase.ONBOARDING) === phase);

                            return (
                                <div key={phase} className={`flex flex-col flex-shrink-0 w-[280px] sm:w-[320px] rounded-2xl overflow-hidden border ${pm.border} h-full`}>
                                    {/* Phase header */}
                                    <div className={`relative flex-shrink-0 ${pm.headerBg} border-b ${pm.border} px-4 py-3`}>
                                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${pm.topBar}`} />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-2.5 h-2.5 rounded-full ${pm.dot}`} />
                                                <span className={`text-[11px] font-black uppercase tracking-[0.12em] ${pm.color}`}>{pm.label}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                {phaseTasks.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Phase body — scrollable, contains status sections */}
                                    <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${pm.bg}`}>
                                        {STATUS_COLS.map(status => {
                                            const droppableId = `${phase}::${status}`;
                                            const cfg = S[status] ?? FALLBACK_COL;
                                            const colTasks = phaseTasks.filter(t => t.status === status);

                                            return (
                                                <Droppable key={droppableId} droppableId={droppableId} type="TASK">
                                                    {(prov, snap) => (
                                                        <div
                                                            ref={prov.innerRef}
                                                            {...prov.droppableProps}
                                                            className={[
                                                                'px-2.5 pb-1 transition-colors duration-150',
                                                                snap.isDraggingOver ? 'bg-white/[0.03]' : '',
                                                            ].join(' ')}
                                                        >
                                                            {/* Status section header */}
                                                            <div className="flex items-center gap-2 px-1 py-2 sticky top-0 z-[5]" style={{ backdropFilter: 'blur(8px)' }}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.12em] flex-1">{cfg.label}</span>
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${cfg.countBg}`}>{colTasks.length}</span>
                                                            </div>

                                                            {/* Task cards */}
                                                            <div className="flex flex-col gap-1.5 min-h-[40px]">
                                                                {colTasks.map((task, i) => (
                                                                    <TaskCard
                                                                        key={task.id}
                                                                        task={task}
                                                                        index={i}
                                                                        usersList={usersList}
                                                                        selectedTaskIds={selectedTaskIds}
                                                                        onToggleSelection={onToggleSelection}
                                                                        onClick={handleOpenEdit}
                                                                        onOpenClientDetail={onOpenClientDetail}
                                                                    />
                                                                ))}
                                                                {prov.placeholder}

                                                                {colTasks.length === 0 && (
                                                                    <div className="flex items-center justify-center gap-1.5 min-h-[32px] rounded-lg border border-dashed border-white/[0.04] text-[8px] text-slate-700 font-bold uppercase tracking-widest mb-1">
                                                                        <div className={`w-2 h-2 rounded-full ${cfg.dot} opacity-15`} />
                                                                        Drop here
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Droppable>
                                            );
                                        })}

                                        {/* Quick add at bottom of column */}
                                        <div className="px-2.5 pb-2.5 pt-1">
                                            <AnimatePresence mode="wait">
                                                {quickAddStatus === `${phase}::ADD` ? (
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
                                                                if (e.key === 'Enter') submitQuickAdd(TaskStatus.NOT_STARTED);
                                                                if (e.key === 'Escape') { setQuickAddStatus(null); setQuickAddTitle(''); }
                                                            }}
                                                            className="w-full bg-transparent text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none mb-2 font-medium"
                                                        />
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] text-slate-600 font-medium uppercase tracking-wider">↵ save · Esc cancel</span>
                                                            <div className="flex gap-1.5">
                                                                <button onClick={() => { setQuickAddStatus(null); setQuickAddTitle(''); }}
                                                                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors">
                                                                    <X size={12} />
                                                                </button>
                                                                <button onClick={() => submitQuickAdd(TaskStatus.NOT_STARTED)}
                                                                    className="px-2.5 h-6 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[10px] font-bold transition-colors flex items-center gap-1">
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
                                                        onClick={() => setQuickAddStatus(`${phase}::ADD`)}
                                                        className="w-full py-2 rounded-xl border border-dashed border-slate-800 text-slate-700 hover:text-slate-400 hover:border-slate-600 hover:bg-white/[0.02] transition-all text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 group"
                                                    >
                                                        <Plus size={12} className="group-hover:scale-110 transition-transform" /> Add task
                                                    </motion.button>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

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
        </DragDropContext>
    );
};

export default TaskMainView;
