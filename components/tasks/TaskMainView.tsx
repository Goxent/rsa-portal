import React, { useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    List as ListIcon, Plus, X, Check, Tag,
    Calendar, Clock, CheckCircle2, AlertTriangle, UserCircle2,
    GripVertical, ChevronDown
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

// ── Status config — refined palette ──────────────────────────────────────
const S = {
    [TaskStatus.NOT_STARTED]: {
        label: 'Not Started',
        topBar: 'bg-slate-500',
        dot: 'bg-slate-400',
        dotColor: '#94a3b8',
        headerBg: 'bg-slate-900/40',
        bodyBg: 'bg-slate-950/20',
        countBg: 'bg-slate-800/80 text-slate-300 border border-slate-700/50',
        ring: 'ring-slate-500/20',
        dropGlow: 'bg-slate-500/5',
    },
    [TaskStatus.IN_PROGRESS]: {
        label: 'In Progress',
        topBar: 'bg-blue-500',
        dot: 'bg-blue-400',
        dotColor: '#60a5fa',
        headerBg: 'bg-blue-950/30',
        bodyBg: 'bg-blue-950/10',
        countBg: 'bg-blue-900/60 text-blue-300 border border-blue-800/50',
        ring: 'ring-blue-500/20',
        dropGlow: 'bg-blue-500/5',
    },
    [TaskStatus.UNDER_REVIEW]: {
        label: 'Under Review',
        topBar: 'bg-amber-500',
        dot: 'bg-amber-400',
        dotColor: '#fbbf24',
        headerBg: 'bg-amber-950/25',
        bodyBg: 'bg-amber-950/10',
        countBg: 'bg-amber-900/60 text-amber-300 border border-amber-800/50',
        ring: 'ring-amber-500/20',
        dropGlow: 'bg-amber-500/5',
    },
    [TaskStatus.HALTED]: {
        label: 'Halted',
        topBar: 'bg-red-500',
        dot: 'bg-red-400',
        dotColor: '#f87171',
        headerBg: 'bg-red-950/25',
        bodyBg: 'bg-red-950/10',
        countBg: 'bg-red-900/60 text-red-300 border border-red-800/50',
        ring: 'ring-red-500/20',
        dropGlow: 'bg-red-500/5',
    },
    [TaskStatus.COMPLETED]: {
        label: 'Completed',
        topBar: 'bg-emerald-500',
        dot: 'bg-emerald-400',
        dotColor: '#34d399',
        headerBg: 'bg-emerald-950/25',
        bodyBg: 'bg-emerald-950/10',
        countBg: 'bg-emerald-900/60 text-emerald-300 border border-emerald-800/50',
        ring: 'ring-emerald-500/20',
        dropGlow: 'bg-emerald-500/5',
    },
    [TaskStatus.ARCHIVED]: {
        label: 'Archived',
        topBar: 'bg-gray-600',
        dot: 'bg-gray-500',
        dotColor: '#6b7280',
        headerBg: 'bg-gray-900/25',
        bodyBg: 'bg-gray-950/10',
        countBg: 'bg-gray-800/60 text-gray-500 border border-gray-700/50',
        ring: 'ring-gray-600/10',
        dropGlow: 'bg-gray-500/5',
    },
} as Record<string, {
    label: string; topBar: string; dot: string; dotColor: string;
    headerBg: string; bodyBg: string; countBg: string; ring: string; dropGlow: string;
}>;

const FALLBACK_COL = {
    label: '', topBar: 'bg-amber-600', dot: 'bg-blue-400', dotColor: '#60a5fa',
    headerBg: 'bg-blue-900/40', bodyBg: 'bg-blue-950/20',
    countBg: 'bg-blue-800/50 text-amber-300', ring: 'ring-amber-500/20', dropGlow: 'bg-amber-500/5',
};

// ── Helpers used by the LIST view ────────────────────────────────────────────
const P: Record<string, { bar: string; badge: string; label: string; accent?: string }> = {
    [TaskPriority.URGENT]: { bar: 'bg-[#dc2626]', badge: 'text-red-300 bg-red-500/15 border-red-500/25', label: 'Urgent', accent: '#ef4444' },
    [TaskPriority.HIGH]: { bar: 'bg-[#d97706]', badge: 'text-amber-300 bg-amber-500/15 border-amber-500/25', label: 'High', accent: '#f59e0b' },
    [TaskPriority.MEDIUM]: { bar: 'bg-[#10b981]', badge: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25', label: 'Medium', accent: '#10b981' },
    [TaskPriority.LOW]: { bar: 'bg-[#475569]', badge: 'text-slate-400 bg-slate-500/10 border-slate-500/20', label: 'Low', accent: '#64748b' },
};
const AV = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
const avatarColor = (i: number) => AV[i % AV.length];
function formatDate(d?: string) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
}

// ────────────────────────────────────────────────────────────────────────────
// TaskMainView
// ────────────────────────────────────────────────────────────────────────────
const getPriorityStyle = (p: TaskPriority) => {
    const map: Record<string, string> = {
        [TaskPriority.URGENT]: 'text-red-300 bg-red-500/15 border-red-500/25',
        [TaskPriority.HIGH]: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
        [TaskPriority.MEDIUM]: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25',
        [TaskPriority.LOW]: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
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

    React.useEffect(() => {
        if (groupBy === 'NONE') localStorage.setItem('kanban_collapsed_columns', JSON.stringify(collapsedColumns));
    }, [collapsedColumns, groupBy]);

    const submitQuickAdd = async (status: TaskStatus) => {
        if (!quickAddTitle.trim()) return;
        await onQuickAdd(status, quickAddTitle);
        setQuickAddTitle('');
        setQuickAddStatus(null);
    };


    const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

    // ── LIST VIEW ──────────────────────────────────────────────────────────
    if (viewMode === 'LIST') {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar bg-transparent">
                <div className="min-w-full md:min-w-[900px] max-w-7xl mx-auto overflow-x-hidden md:overflow-x-visible pb-24">
                    {!isMobile && (
                        <div className="grid grid-cols-[32px_1fr_180px_140px_100px_120px] gap-x-4 px-6 py-2.5 border-b border-white/[0.06] text-[10px] font-semibold text-slate-500 uppercase tracking-widest sticky top-0 bg-[#09090b]/95 backdrop-blur-xl z-20">
                            <div className="flex items-center justify-center">
                                <button
                                    onClick={onSelectAll}
                                    title="Select All Visible Tasks"
                                    className={`relative w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${allSelected ? 'bg-amber-500 border-amber-400' : 'border-slate-700 hover:border-slate-500 bg-transparent'}`}
                                >
                                    {allSelected && <Check size={10} className="text-black" strokeWidth={3.5} />}
                                </button>
                            </div>
                            <div className="flex items-center">Task</div>
                            <div className="flex items-center">Assignees</div>
                            <div className="flex items-center">Status</div>
                            <div className="flex items-center">Priority</div>
                            <div className="flex items-center justify-end">Due Date</div>
                        </div>
                    )}
                    <div className="flex flex-col">
                        {tasks.map(task => {
                            const sc = S[task.status];
                            const pc = P[task.priority] ?? P[TaskPriority.LOW];
                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
                                && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.ARCHIVED;
                            const isCompleted = task.status === TaskStatus.COMPLETED;

                            const content = (
                                <div
                                    onClick={() => handleOpenEdit(task)}
                                    className={`grid ${isMobile ? 'grid-cols-1 gap-y-3' : 'grid-cols-[32px_1fr_180px_140px_100px_120px] gap-x-4'} px-6 py-2.5 items-center cursor-pointer group transition-all duration-300 border-b border-white/[0.03]
                                        hover:bg-white/[0.03] ${selectedTaskIds.includes(task.id) ? 'bg-emerald-500/[0.08] shadow-[inset_2px_0_0_#10b981]' : 'bg-transparent'}
                                        ${isCompleted ? 'opacity-50' : ''}`}
                                >
                                    {/* Selected Checkbox */}
                                    {!isMobile && (
                                        <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
                                            <div className={`relative w-4 h-4 rounded-[4px] border cursor-pointer flex items-center justify-center transition-all duration-150
                                                ${selectedTaskIds.includes(task.id) ? 'bg-emerald-500 border-emerald-400 opacity-100' : 'border-slate-700 bg-transparent opacity-0 group-hover:opacity-100'}`}
                                                onClick={() => onToggleSelection(task.id)}>
                                                {selectedTaskIds.includes(task.id) && <Check size={10} className="text-black" strokeWidth={3.5} />}
                                            </div>
                                        </div>
                                    )}

                                    {/* Title Column */}
                                    <div className="min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-[13px] font-medium truncate transition-colors ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-white'}`}>{task.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <span className="font-mono text-slate-700 uppercase text-[10px]">#{task.id.substring(0, 5)}</span>
                                            {task.clientName && (
                                                <div 
                                                    className="flex items-center gap-1 hover:text-amber-400 transition-colors cursor-pointer text-slate-400 font-medium"
                                                    onClick={(e) => {
                                                        if (onOpenClientDetail && task.clientIds?.[0]) {
                                                            e.stopPropagation();
                                                            onOpenClientDetail(task.clientIds[0]);
                                                        }
                                                    }}
                                                >
                                                    <Tag size={10} className="opacity-70" /> 
                                                    <span className="truncate max-w-[150px]">{task.clientName}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Mobile Details Row */}
                                        {isMobile && (
                                            <div className="flex flex-wrap items-center gap-3 mt-2.5 pt-2.5 border-t border-white/[0.04]">
                                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${pc.badge}`}>{pc.label}</span>
                                                <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 rounded-full px-2 py-0.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${sc?.dot ?? 'bg-slate-500'}`} />
                                                    <span className="text-[10px] text-slate-300 font-medium">{sc?.label ?? task.status.replace('_', ' ')}</span>
                                                </div>
                                                <div className={`text-[10px] font-medium flex items-center gap-1 flex-shrink-0 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                                                    {isOverdue ? <AlertTriangle size={10} className="animate-pulse" /> : <Calendar size={10} className="opacity-70" />}
                                                    {formatDate(task.dueDate)}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Desktop Columns */}
                                    {!isMobile && (
                                        <>
                                            {/* Assignees */}
                                            <div className="flex -space-x-1.5 items-center">
                                                {task.assignedTo.length === 0 ? (
                                                    <span className="text-[10px] text-slate-600 border border-dashed border-slate-700/60 rounded-full px-2 py-0.5">Unassigned</span>
                                                ) : (
                                                    <>
                                                        {task.assignedTo.slice(0, 4).map((uid, i) => {
                                                            const u = usersList.find(x => x.uid === uid);
                                                            return (
                                                                <div key={uid} title={u?.displayName}
                                                                    style={{ backgroundColor: avatarColor(i) }}
                                                                    className="w-6 h-6 rounded-full border-[1.5px] border-[#09090b] flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                                                                    {u?.displayName?.split(' ').map((p: string) => p[0]).join('').substring(0, 2).toUpperCase() ?? '?'}
                                                                </div>
                                                            );
                                                        })}
                                                        {task.assignedTo.length > 4 && <div className="w-6 h-6 rounded-full bg-slate-800 border-[1.5px] border-[#09090b] flex items-center justify-center text-[9px] text-slate-400 font-medium z-10">+{task.assignedTo.length - 4}</div>}
                                                    </>
                                                )}
                                            </div>
                                            
                                            {/* Status Pill */}
                                            <div className="flex items-center">
                                                <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.05] rounded-md px-2 py-1 transition-colors group-hover:bg-white/[0.05]">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${sc?.dot ?? 'bg-slate-500'}`} />
                                                    <span className="text-[10px] text-slate-300 font-medium">{sc?.label ?? task.status.replace('_', ' ')}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Priority */}
                                            <div className="flex items-center">
                                                <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.04] pl-1 pr-1.5 py-[2px] rounded">
                                                    <div className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: pc.accent || '#64748b' }} />
                                                    <span className="text-[9.5px] font-medium text-slate-300 tracking-wide">{pc.label}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Due Date */}
                                            <div className={`text-right text-[11px] font-medium flex items-center justify-end gap-1 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                                                {isOverdue ? <AlertTriangle size={10} className="animate-pulse" /> : <Calendar size={10} className="opacity-60" />}
                                                {formatDate(task.dueDate)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );

                        if (isMobile) {
                            return (
                                <div key={task.id} className="relative mb-2 rounded-xl overflow-hidden bg-slate-800/50 border border-white/[0.06]">
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
                    </div>

                    {tasks.length === 0 && (
                        <div className="py-32 flex flex-col items-center justify-center text-center">
                            <div className="w-14 h-14 rounded-2xl bg-slate-800/30 border border-white/[0.06] flex items-center justify-center mb-4">
                                <ListIcon size={22} className="text-slate-600" />
                            </div>
                            <p className="text-slate-400 font-medium mb-1">No tasks found</p>
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

    const PHASE_META: Record<string, { label: string; color: string; dot: string; bg: string; border: string; headerBg: string; topBar: string; accentHex: string }> = {
        [AuditPhase.ONBOARDING]: { label: 'Onboarding', color: 'text-cyan-400', dot: 'bg-cyan-400', bg: 'bg-[#080f14]', border: 'border-white/[0.06]', headerBg: 'bg-[#0a1520]/80', topBar: 'bg-cyan-500', accentHex: '#22d3ee' },
        [AuditPhase.PLANNING_AND_EXECUTION]: { label: 'Planning & Execution', color: 'text-amber-400', dot: 'bg-amber-400', bg: 'bg-[#0f0d08]', border: 'border-white/[0.06]', headerBg: 'bg-[#151008]/80', topBar: 'bg-amber-500', accentHex: '#fbbf24' },
        [AuditPhase.REVIEW_AND_CONCLUSION]: { label: 'Review & Conclusion', color: 'text-emerald-400', dot: 'bg-emerald-400', bg: 'bg-[#080f0d]', border: 'border-white/[0.06]', headerBg: 'bg-[#0a1510]/80', topBar: 'bg-emerald-500', accentHex: '#34d399' },
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="h-full flex flex-col min-h-0 overflow-hidden">
                <div className="relative flex-1 min-h-0">
                    {/* Horizontal scroll container — 3 phase columns side by side */}
                    <div className="h-full flex items-start gap-4 overflow-x-auto overflow-y-auto px-4 md:px-6 py-4 kanban-scroll custom-scrollbar">
                        {PHASE_ORDER.map(phase => {
                            const pm = PHASE_META[phase];
                            const phaseTasks = tasks.filter(t => (t.auditPhase || AuditPhase.ONBOARDING) === phase);

                            return (
                                <div key={phase} className={`flex flex-col flex-1 min-w-[280px] sm:min-w-[310px] rounded-xl overflow-hidden border ${pm.border} bg-[#06080a]/40 backdrop-blur-md`}>
                                    {/* Phase header */}
                                    <div className={`relative flex-shrink-0 ${pm.headerBg} backdrop-blur-sm px-4 py-3`}>
                                        <div
                                            className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
                                            style={{ background: `linear-gradient(90deg, ${pm.accentHex}, transparent)` }}
                                        />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${pm.dot}`} style={{ boxShadow: `0 0 8px ${pm.accentHex}40` }} />
                                                <span className={`text-[11px] font-bold uppercase tracking-[0.1em] ${pm.color}`}>{pm.label}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
                                                {phaseTasks.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Phase body — scrollable, contains status sections */}
                                    <div className={`${pm.bg} flex-1`}>
                                        {STATUS_COLS
                                            .filter(status => !(phase === AuditPhase.ONBOARDING && status === TaskStatus.UNDER_REVIEW))
                                            .map(status => {
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
                                                                `pb-2 transition-all duration-300 flex flex-col`,
                                                                snap.isDraggingOver ? `ring-1 ring-inset ${cfg.ring} bg-white/[0.02]` : '',
                                                            ].filter(Boolean).join(' ')}
                                                        >
                                                            {/* Status section header */}
                                                            <div className={`flex items-center gap-2 px-3 py-2 sticky top-0 z-[5] ${cfg.headerBg} border-b border-white/[0.03] transition-colors duration-300 ${snap.isDraggingOver ? 'bg-opacity-80' : ''}`} style={{ backdropFilter: 'blur(12px)' }}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} transition-transform duration-300 ${snap.isDraggingOver ? 'scale-125' : ''}`} style={{ boxShadow: `0 0 6px ${cfg.dotColor}40` }} />
                                                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] flex-1 text-slate-400">{cfg.label}</span>
                                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${cfg.countBg}`}>{colTasks.length}</span>
                                                            </div>

                                                            {/* Task cards */}
                                                            <div className="flex flex-col gap-1.5 min-h-[48px] px-2 pt-1.5">
                                                                {colTasks.map((task, i) => (
                                                                    <div key={task.id} className="rounded-xl">
                                                                        <TaskCard
                                                                            task={task}
                                                                            index={i}
                                                                            usersList={usersList}
                                                                            selectedTaskIds={selectedTaskIds}
                                                                            onToggleSelection={onToggleSelection}
                                                                            onClick={handleOpenEdit}
                                                                            onOpenClientDetail={onOpenClientDetail}
                                                                        />
                                                                    </div>
                                                                ))}
                                                                {prov.placeholder}

                                                                {colTasks.length === 0 && (
                                                                    <div className="flex items-center justify-center min-h-[36px] rounded-lg border border-dashed border-white/[0.06] text-[9px] font-medium uppercase tracking-wider text-slate-700 mb-1 transition-colors hover:border-white/[0.1] hover:text-slate-600">
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
                                        <div className="px-2 pb-2.5 pt-1">
                                            <AnimatePresence mode="wait">
                                                {quickAddStatus === `${phase}::ADD` ? (
                                                    <motion.div
                                                        key="input"
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 4 }}
                                                        transition={{ duration: 0.1 }}
                                                        className="bg-[#0d1117] border border-white/[0.08] rounded-xl p-3 shadow-xl"
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
                                                            <span className="text-[9px] text-slate-600 font-medium">↵ save · Esc cancel</span>
                                                            <div className="flex gap-1.5">
                                                                <button onClick={() => { setQuickAddStatus(null); setQuickAddTitle(''); }}
                                                                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
                                                                    <X size={12} />
                                                                </button>
                                                                <button onClick={() => submitQuickAdd(TaskStatus.NOT_STARTED)}
                                                                    className="px-2.5 h-6 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[10px] font-bold transition-colors flex items-center gap-1">
                                                                    <Plus size={10} /> Add
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
                                                        className="w-full py-2 rounded-lg border border-dashed border-white/[0.06] text-slate-700 hover:text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.02] transition-all text-[10px] font-semibold flex items-center justify-center gap-1.5 group"
                                                    >
                                                        <Plus size={11} className="group-hover:scale-110 transition-transform" /> Add task
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
                        <div className="w-14 h-14 rounded-2xl bg-slate-800/30 border border-white/[0.06] flex items-center justify-center mb-4">
                            <ListIcon size={22} className="text-slate-600" />
                        </div>
                        <p className="text-slate-400 font-medium mb-1">No tasks found</p>
                        <p className="text-sm text-slate-600">Adjust your filters or create a new task.</p>
                    </div>
                )}
            </div>
        </DragDropContext>
    );
};

export default TaskMainView;
