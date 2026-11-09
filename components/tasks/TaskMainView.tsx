import React from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import {
    Check, Tag, Calendar, AlertTriangle, Lock, Building2
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, Client, AuditPhase } from '../../types';
import { getAvatarColor, getInitials } from '../../utils/userUtils';
import { motion } from 'framer-motion';
import { useMedia } from 'react-use';
import TaskCard from './TaskCard';
import { formatDateDual } from '../../utils/nepaliDate';

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
    clientsList: Client[];
    onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
    onOpenReassign?: (taskId: string) => void;
    onSelectAll?: () => void;
    onOpenClientDetail?: (clientId: string) => void;
    currentUser: UserProfile | null;
    canEditTask: (task: Task) => boolean;
}

// ── Clean Status Configurations ──────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
    label: string;
    dotColor: string;
    bgBadge: string;
    textBadge: string;
    borderBadge: string;
}> = {
    [TaskStatus.NOT_STARTED]: {
        label: 'Not Started',
        dotColor: 'bg-slate-400',
        bgBadge: 'bg-slate-100 dark:bg-slate-800/40',
        textBadge: 'text-slate-600 dark:text-slate-400',
        borderBadge: 'border-slate-200 dark:border-slate-700/50',
    },
    [TaskStatus.IN_PROGRESS]: {
        label: 'In Progress',
        dotColor: 'bg-blue-500',
        bgBadge: 'bg-blue-50 dark:bg-blue-950/30',
        textBadge: 'text-blue-700 dark:text-blue-400',
        borderBadge: 'border-blue-200 dark:border-blue-900/40',
    },
    [TaskStatus.UNDER_REVIEW]: {
        label: 'Under Review',
        dotColor: 'bg-purple-500',
        bgBadge: 'bg-purple-50 dark:bg-purple-950/30',
        textBadge: 'text-purple-700 dark:text-purple-400',
        borderBadge: 'border-purple-200 dark:border-purple-900/40',
    },
    [TaskStatus.HALTED]: {
        label: 'On Hold',
        dotColor: 'bg-amber-500',
        bgBadge: 'bg-amber-50 dark:bg-amber-950/30',
        textBadge: 'text-amber-700 dark:text-amber-400',
        borderBadge: 'border-amber-200 dark:border-amber-900/40',
    },
    [TaskStatus.COMPLETED]: {
        label: 'Completed',
        dotColor: 'bg-emerald-500',
        bgBadge: 'bg-emerald-50 dark:bg-emerald-950/30',
        textBadge: 'text-emerald-700 dark:text-emerald-400',
        borderBadge: 'border-emerald-200 dark:border-emerald-900/40',
    },
};

const PHASE_CONFIG: Record<AuditPhase, {
    label: string;
    shortLabel: string;
    stepNum: string;
    accent: string;
    textAccent: string;
    badgeBg: string;
}> = {
    [AuditPhase.ONBOARDING]: {
        label: 'Onboarding & Acceptance',
        shortLabel: 'P1: Onboarding',
        stepNum: '01',
        accent: 'bg-blue-500',
        textAccent: 'text-blue-600 dark:text-blue-400',
        badgeBg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300',
    },
    [AuditPhase.PLANNING_AND_EXECUTION]: {
        label: 'Planning & Execution',
        shortLabel: 'P2: Execution',
        stepNum: '02',
        accent: 'bg-indigo-500',
        textAccent: 'text-indigo-600 dark:text-indigo-400',
        badgeBg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300',
    },
    [AuditPhase.REVIEW_AND_CONCLUSION]: {
        label: 'Review & Conclusion',
        shortLabel: 'P3: Review',
        stepNum: '03',
        accent: 'bg-emerald-500',
        textAccent: 'text-emerald-600 dark:text-emerald-400',
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    },
};

const PRIORITY_BADGES: Record<TaskPriority, { badge: string; label: string }> = {
    [TaskPriority.URGENT]: { badge: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40', label: 'Urgent' },
    [TaskPriority.HIGH]: { badge: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40', label: 'High' },
    [TaskPriority.MEDIUM]: { badge: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/40', label: 'Medium' },
    [TaskPriority.LOW]: { badge: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50', label: 'Low' },
};

function formatDualDate(dueDate?: string): string {
    if (!dueDate) return '—';
    try {
        const dual = formatDateDual(dueDate);
        const nepaliParts = dual.bsFull ? dual.bsFull.split(' ') : [];
        const bsShort = nepaliParts.length >= 2 ? `${nepaliParts[0]} ${nepaliParts[1]}` : dual.bs;
        const adShort = new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${bsShort} (${adShort})`;
    } catch {
        return dueDate;
    }
}

const TaskMainView: React.FC<TaskMainViewProps> = ({
    viewMode, tasks, onDragEnd, handleOpenEdit, usersList,
    selectedTaskIds, onToggleSelection, onSelectAll, onOpenClientDetail,
    canEditTask, currentUser
}) => {
    const isMobile = useMedia('(max-width: 768px)', false);
    const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

    // ── LIST / TABLE VIEW ────────────────────────────────────────────────────────
    if (viewMode === 'LIST') {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar bg-transparent">
                <div className="min-w-full md:min-w-[950px] w-full pb-10">
                    {!isMobile && (
                        <div className="grid grid-cols-[36px_minmax(280px,2fr)_150px_130px_130px_100px_140px] gap-x-4 px-6 py-3 border-b border-slate-200 dark:border-white/[0.08] text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50/95 dark:bg-[#0c0e15]/95 backdrop-blur-md z-20">
                            <div className="flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={onSelectAll}
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                        allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400 dark:border-slate-600 hover:border-slate-500 bg-white dark:bg-transparent'
                                    }`}
                                >
                                    {allSelected && <Check size={10} className="text-white" strokeWidth={3.5} />}
                                </button>
                            </div>
                            <div>Assignment / Client</div>
                            <div>Assignees</div>
                            <div>Phase</div>
                            <div>Status</div>
                            <div>Priority</div>
                            <div className="text-right">Due Date (BS / AD)</div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 px-6 pt-3">
                        {[...tasks].sort((a, b) => (a.title || '').localeCompare(b.title || '')).map((task, idx) => {
                            const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG[TaskStatus.NOT_STARTED];
                            const pc = PRIORITY_BADGES[task.priority] ?? PRIORITY_BADGES[TaskPriority.LOW];
                            const pm = task.auditPhase ? PHASE_CONFIG[task.auditPhase] : null;
                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
                                && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.ARCHIVED;
                            const isCompleted = task.status === TaskStatus.COMPLETED;
                            const isSelected = selectedTaskIds.includes(task.id);

                            return (
                                <div
                                    key={task.id || `task-${idx}`}
                                    onClick={() => handleOpenEdit(task)}
                                    className={`grid ${isMobile ? 'grid-cols-1 gap-y-3 p-4' : 'grid-cols-[36px_minmax(280px,2fr)_150px_130px_130px_100px_140px] gap-x-4 px-4 py-3'} items-center cursor-pointer group transition-all duration-150 rounded-xl border ${
                                        isSelected
                                            ? 'border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                                            : 'border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.14] bg-white dark:bg-[#13151f] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] shadow-sm'
                                    } ${isCompleted ? 'opacity-60' : ''}`}
                                >
                                    {!isMobile && (
                                        <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
                                            {canEditTask(task) ? (
                                                <div
                                                    className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all ${
                                                        isSelected ? 'bg-indigo-600 border-indigo-600 opacity-100' : 'border-slate-300 dark:border-slate-600 opacity-60 group-hover:opacity-100'
                                                    }`}
                                                    onClick={() => onToggleSelection(task.id)}
                                                >
                                                    {isSelected && <Check size={10} className="text-white" strokeWidth={3.5} />}
                                                </div>
                                            ) : (
                                                <Lock size={12} className="text-slate-400 opacity-40" />
                                            )}
                                        </div>
                                    )}

                                    {/* Assignment Title & Client */}
                                    <div className="min-w-0 flex flex-col justify-center gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[13px] font-semibold tracking-tight truncate ${
                                                isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                                            }`}>
                                                {task.title}
                                            </span>
                                        </div>

                                        {task.clientName && (
                                            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                <Building2 size={11} className="text-slate-400 flex-shrink-0" />
                                                <span className="truncate">{task.clientName}</span>
                                                {task.fiscalYear && (
                                                    <span className="text-[10px] text-slate-400 font-normal">· FY {task.fiscalYear}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {!isMobile && (
                                        <>
                                            {/* Assignees */}
                                            <div className="flex -space-x-1.5 items-center">
                                                {(!task.assignedTo || task.assignedTo.length === 0) ? (
                                                    <span className="text-[10px] text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded px-2 py-0.5">
                                                        Unassigned
                                                    </span>
                                                ) : (
                                                    <>
                                                        {(task.assignedTo || []).slice(0, 3).map((uid, i) => {
                                                            const u = usersList.find(x => x.uid === uid);
                                                            const av = getAvatarColor(uid);
                                                            return (
                                                                <div
                                                                    key={uid || i}
                                                                    title={u?.displayName}
                                                                    className={`w-6 h-6 rounded-full border-2 border-white dark:border-[#13151f] flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${av.bg} ${av.text}`}
                                                                >
                                                                    {getInitials(u?.displayName || '?')}
                                                                </div>
                                                            );
                                                        })}
                                                        {task.assignedTo.length > 3 && (
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-[#13151f] flex items-center justify-center text-[9px] font-bold text-slate-700 dark:text-slate-300">
                                                                +{task.assignedTo.length - 3}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* Phase Badge */}
                                            <div>
                                                {pm ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${pm.badgeBg}`}>
                                                        {pm.shortLabel}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-[11px]">—</span>
                                                )}
                                            </div>

                                            {/* Status Badge */}
                                            <div>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${sc.bgBadge} ${sc.textBadge} ${sc.borderBadge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
                                                    {sc.label}
                                                </span>
                                            </div>

                                            {/* Priority Badge */}
                                            <div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${pc.badge}`}>
                                                    {pc.label}
                                                </span>
                                            </div>

                                            {/* Due Date */}
                                            <div className={`text-right text-[11px] font-medium ${
                                                isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-400'
                                            }`}>
                                                {formatDualDate(task.dueDate)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {tasks.length === 0 && (
                        <div className="py-24 text-center">
                            <p className="text-[13px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">No assignments match your filter</p>
                            <p className="text-[12px] text-slate-400 mt-1">Try resetting search or adjusting your filter criteria.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── KANBAN VIEW ──────────────────────────────────────────────────────────────
    const PHASE_ORDER = [AuditPhase.ONBOARDING, AuditPhase.PLANNING_AND_EXECUTION, AuditPhase.REVIEW_AND_CONCLUSION];
    const STATUS_COLS = [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.UNDER_REVIEW, TaskStatus.HALTED, TaskStatus.COMPLETED];

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="h-full flex flex-col min-h-0 overflow-hidden relative">
                <div className="flex-1 min-h-0 relative w-full h-full z-10">
                    <div className="h-full w-full flex-1 flex gap-5 overflow-x-auto px-6 py-5 kanban-scroll custom-scrollbar overflow-y-auto">
                        {PHASE_ORDER.map((phase) => {
                            const pm = PHASE_CONFIG[phase];
                            const phaseTasks = tasks.filter(t =>
                                (t.auditPhase || AuditPhase.ONBOARDING) === phase &&
                                t.status !== TaskStatus.ARCHIVED
                            );
                            const phaseTotal = phaseTasks.length;
                            const phaseCompleted = phaseTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
                            const phaseProgress = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;

                            return (
                                <div
                                    key={phase}
                                    className="flex flex-col flex-1 min-w-[340px] md:min-w-[360px] xl:min-w-[380px] h-full min-h-[580px] rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#0e1017]/70 backdrop-blur-md shadow-sm overflow-hidden"
                                >
                                    {/* Phase Header */}
                                    <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#13151f]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white ${pm.accent}`}>
                                                    {pm.stepNum}
                                                </div>
                                                <div>
                                                    <h3 className="text-[13px] font-bold text-slate-900 dark:text-white tracking-tight">
                                                        {pm.label}
                                                    </h3>
                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        {phaseTotal} {phaseTotal === 1 ? 'assignment' : 'assignments'} · {phaseProgress}% complete
                                                    </span>
                                                </div>
                                            </div>

                                            <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                                                {phaseCompleted}/{phaseTotal}
                                            </span>
                                        </div>

                                        {/* Phase Progress Bar */}
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${pm.accent}`}
                                                style={{ width: `${phaseProgress}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Phase Columns / Status Groups */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                                        {STATUS_COLS.map((status) => {
                                            const droppableId = `${phase}::${status}`;
                                            const cfg = STATUS_CONFIG[status];
                                            const colTasks = phaseTasks.filter(t => t.status === status);
                                            const hasAny = colTasks.length > 0;

                                            return (
                                                <Droppable key={droppableId} droppableId={droppableId} type="TASK">
                                                    {(prov, snap) => (
                                                        <div
                                                            ref={prov.innerRef}
                                                            {...prov.droppableProps}
                                                            className={`rounded-xl p-2.5 transition-all ${
                                                                snap.isDraggingOver
                                                                    ? 'bg-indigo-50/80 dark:bg-indigo-950/30 ring-2 ring-indigo-500/40'
                                                                    : 'bg-white/80 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.04]'
                                                            }`}
                                                        >
                                                            {/* Status Header */}
                                                            <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                                        {cfg.label}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                                                                    {colTasks.length}
                                                                </span>
                                                            </div>

                                                            {/* Cards */}
                                                            <div className={`flex flex-col min-h-[10px] ${
                                                                !hasAny && snap.isDraggingOver ? 'min-h-[64px]' : ''
                                                            }`}>
                                                                {colTasks.map((task, i) => (
                                                                    <TaskCard
                                                                        key={task.id || `task-${i}`}
                                                                        task={task}
                                                                        index={i}
                                                                        usersList={usersList}
                                                                        selectedTaskIds={selectedTaskIds}
                                                                        onToggleSelection={onToggleSelection}
                                                                        onClick={handleOpenEdit}
                                                                        onOpenClientDetail={onOpenClientDetail}
                                                                        currentUser={currentUser}
                                                                    />
                                                                ))}
                                                                {prov.placeholder}

                                                                {!hasAny && snap.isDraggingOver && (
                                                                    <div className="flex items-center justify-center min-h-[48px] rounded-xl border-2 border-dashed border-indigo-400/40 text-[11px] font-semibold text-indigo-500">
                                                                        Drop here
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Droppable>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </DragDropContext>
    );
};

export default TaskMainView;
