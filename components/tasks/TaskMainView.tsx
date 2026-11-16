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
    badgeStyle: React.CSSProperties;
}> = {
    [TaskStatus.NOT_STARTED]: {
        label: 'Not started',
        dotColor: 'bg-[var(--text-muted)]',
        badgeStyle: { color: 'var(--text-muted)', background: 'var(--bg-surface)', borderColor: 'var(--border)' },
    },
    [TaskStatus.IN_PROGRESS]: {
        label: 'In progress',
        dotColor: 'bg-[var(--accent)]',
        badgeStyle: { color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--border-accent)' },
    },
    [TaskStatus.UNDER_REVIEW]: {
        label: 'Under review',
        dotColor: 'bg-[var(--color-info)]',
        badgeStyle: { color: 'var(--color-info)', background: 'rgba(106,163,217,0.1)', borderColor: 'rgba(106,163,217,0.25)' },
    },
    [TaskStatus.HALTED]: {
        label: 'On hold',
        dotColor: 'bg-[var(--color-warning)]',
        badgeStyle: { color: 'var(--color-warning)', background: 'rgba(217,164,65,0.1)', borderColor: 'rgba(217,164,65,0.25)' },
    },
    [TaskStatus.COMPLETED]: {
        label: 'Completed',
        dotColor: 'bg-[var(--color-success)]',
        badgeStyle: { color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' },
    },
};

const PHASE_CONFIG: Record<AuditPhase, {
    label: string;
    shortLabel: string;
    stepNum: string;
    badgeStyle: React.CSSProperties;
}> = {
    [AuditPhase.ONBOARDING]: {
        label: 'Onboarding & Acceptance',
        shortLabel: 'P1: Onboarding',
        stepNum: '01',
        badgeStyle: { color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--border-accent)' },
    },
    [AuditPhase.PLANNING_AND_EXECUTION]: {
        label: 'Planning & Execution',
        shortLabel: 'P2: Execution',
        stepNum: '02',
        badgeStyle: { color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--border-accent)' },
    },
    [AuditPhase.REVIEW_AND_CONCLUSION]: {
        label: 'Review & Conclusion',
        shortLabel: 'P3: Review',
        stepNum: '03',
        badgeStyle: { color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' },
    },
};

const PRIORITY_BADGES: Record<TaskPriority, { badgeStyle: React.CSSProperties; label: string }> = {
    [TaskPriority.URGENT]: { badgeStyle: { color: 'var(--color-danger)', background: 'rgba(224,112,122,0.1)', borderColor: 'rgba(224,112,122,0.25)' }, label: 'Urgent' },
    [TaskPriority.HIGH]: { badgeStyle: { color: 'var(--color-warning)', background: 'rgba(217,164,65,0.1)', borderColor: 'rgba(217,164,65,0.25)' }, label: 'High' },
    [TaskPriority.MEDIUM]: { badgeStyle: { color: 'var(--color-info)', background: 'rgba(106,163,217,0.1)', borderColor: 'rgba(106,163,217,0.25)' }, label: 'Medium' },
    [TaskPriority.LOW]: { badgeStyle: { color: 'var(--text-muted)', background: 'var(--bg-surface)', borderColor: 'var(--border)' }, label: 'Low' },
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
                        <div
                            className="grid grid-cols-[36px_minmax(280px,2fr)_150px_130px_130px_100px_140px] gap-x-4 px-6 py-2.5 border-b border-[var(--border)] text-xs font-medium sticky top-0 z-20"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                        >
                            <div className="flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={onSelectAll}
                                    className={`w-4 h-4 rounded-[var(--radius-sm)] border flex items-center justify-center transition-colors ${
                                        allSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-mid)] bg-[var(--bg-surface)]'
                                    }`}
                                >
                                    {allSelected && <Check size={10} style={{ color: 'var(--on-accent)' }} strokeWidth={3} />}
                                </button>
                            </div>
                            <div>Assignment / client</div>
                            <div>Assignees</div>
                            <div>Phase</div>
                            <div>Status</div>
                            <div>Priority</div>
                            <div className="text-right">Due date (BS / AD)</div>
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
                                    className={`grid ${isMobile ? 'grid-cols-1 gap-y-3 p-3.5' : 'grid-cols-[36px_minmax(280px,2fr)_150px_130px_130px_100px_140px] gap-x-4 px-4 py-2.5'} items-center cursor-pointer group transition-colors duration-150 rounded-[var(--radius-md)] border ${
                                        isSelected
                                            ? 'border-[var(--border-accent)]'
                                            : 'border-[var(--border)] hover:border-[var(--border-mid)]'
                                    } ${isCompleted ? 'opacity-70' : ''}`}
                                    style={{
                                        background: isSelected ? 'var(--accent-dim)' : 'var(--bg-secondary)'
                                    }}
                                >
                                    {!isMobile && (
                                        <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
                                            {canEditTask(task) ? (
                                                <div
                                                    className={`w-4 h-4 rounded-[var(--radius-sm)] border cursor-pointer flex items-center justify-center transition-colors ${
                                                        isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-mid)] bg-[var(--bg-surface)]'
                                                    }`}
                                                    onClick={() => onToggleSelection(task.id)}
                                                >
                                                    {isSelected && <Check size={10} style={{ color: 'var(--on-accent)' }} strokeWidth={3} />}
                                                </div>
                                            ) : (
                                                <Lock size={12} style={{ color: 'var(--text-muted)' }} />
                                            )}
                                        </div>
                                    )}

                                    {/* Assignment Title & Client */}
                                    <div className="min-w-0 flex flex-col justify-center gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`text-xs font-semibold tracking-tight truncate transition-colors ${
                                                    isCompleted ? 'line-through' : 'group-hover:text-[var(--accent)]'
                                                }`}
                                                style={{ color: isCompleted ? 'var(--text-muted)' : 'var(--text-heading)' }}
                                            >
                                                {task.title}
                                            </span>
                                        </div>

                                        {task.clientName && (
                                            <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                                <Building2 size={11} className="flex-shrink-0" />
                                                <span className="truncate">{task.clientName}</span>
                                                {task.fiscalYear && (
                                                    <span className="tabular-nums">· FY {task.fiscalYear}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {!isMobile && (
                                        <>
                                            {/* Assignees */}
                                            <div className="flex -space-x-1.5 items-center">
                                                {(!task.assignedTo || task.assignedTo.length === 0) ? (
                                                    <span className="text-[10px] border border-dashed border-[var(--border-mid)] rounded-[var(--radius-sm)] px-2 py-0.5" style={{ color: 'var(--text-muted)' }}>
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
                                                                    className={`w-5 h-5 rounded-full ring-1 ring-[var(--bg-secondary)] flex items-center justify-center text-[9px] font-semibold text-white ${av.bg} ${av.text}`}
                                                                >
                                                                    {getInitials(u?.displayName || '?')}
                                                                </div>
                                                            );
                                                        })}
                                                        {task.assignedTo.length > 3 && (
                                                            <div className="w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] ring-1 ring-[var(--bg-secondary)] flex items-center justify-center text-[9px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                                                +{task.assignedTo.length - 3}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* Phase Badge */}
                                            <div>
                                                {pm ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium border" style={pm.badgeStyle}>
                                                        {pm.shortLabel}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }} className="text-xs">—</span>
                                                )}
                                            </div>

                                            {/* Status Badge */}
                                            <div>
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-medium border" style={sc.badgeStyle}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
                                                    {sc.label}
                                                </span>
                                            </div>

                                            {/* Priority Badge */}
                                            <div>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium border" style={pc.badgeStyle}>
                                                    {pc.label}
                                                </span>
                                            </div>

                                            {/* Due Date */}
                                            <div className="text-right text-xs font-medium tabular-nums" style={{
                                                color: isOverdue ? 'var(--color-danger)' : 'var(--text-muted)'
                                            }}>
                                                {formatDualDate(task.dueDate)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {tasks.length === 0 && (
                        <div className="py-20 text-center">
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>No assignments match your filter</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Try resetting search or adjusting your filter criteria.</p>
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
                    <div className="h-full w-full flex-1 flex gap-4 overflow-x-auto px-6 py-4 kanban-scroll custom-scrollbar overflow-y-auto">
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
                                    className="flex flex-col flex-1 min-w-[320px] md:min-w-[340px] xl:min-w-[360px] h-full min-h-[580px] rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden"
                                    style={{ background: 'var(--bg-surface)' }}
                                >
                                    {/* Phase Header */}
                                    <div className="p-3.5 border-b border-[var(--border)]" style={{ background: 'var(--bg-secondary)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-[10px] font-semibold text-white bg-[var(--accent)]">
                                                    {pm.stepNum}
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-semibold tracking-tight" style={{ color: 'var(--text-heading)' }}>
                                                        {pm.label}
                                                    </h3>
                                                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                        {phaseTotal} {phaseTotal === 1 ? 'assignment' : 'assignments'} · {phaseProgress}% complete
                                                    </span>
                                                </div>
                                            </div>

                                            <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                                {phaseCompleted}/{phaseTotal}
                                            </span>
                                        </div>

                                        {/* Phase Progress Bar */}
                                        <div className="h-1 w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{ width: `${phaseProgress}%`, backgroundColor: 'var(--accent)' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Phase Columns / Status Groups */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2.5">
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
                                                            className={`rounded-[var(--radius-md)] p-2 transition-colors border ${
                                                                snap.isDraggingOver
                                                                    ? 'border-[var(--border-accent)]'
                                                                    : 'border-[var(--border)]'
                                                            }`}
                                                            style={{
                                                                background: snap.isDraggingOver ? 'var(--accent-dim)' : 'var(--bg-secondary)'
                                                            }}
                                                        >
                                                            {/* Status Header */}
                                                            <div className="flex items-center justify-between px-1.5 py-1 mb-1.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                                                                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                                        {cfg.label}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                                    {colTasks.length}
                                                                </span>
                                                            </div>

                                                            {/* Cards */}
                                                            <div className={`flex flex-col gap-2 min-h-[10px] ${
                                                                !hasAny && snap.isDraggingOver ? 'min-h-[50px]' : ''
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
                                                                    <div className="flex items-center justify-center min-h-[40px] rounded-[var(--radius-md)] border border-dashed border-[var(--border-accent)] text-xs font-medium" style={{ color: 'var(--accent)' }}>
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
