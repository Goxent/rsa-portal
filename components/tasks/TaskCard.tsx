import React from 'react';
import ReactDOM from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import {
    Check, Tag, Calendar, CheckCircle2, AlertTriangle, GripVertical, ArrowRight,
    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen,
    Zap, Flame, Clock, Building2, HelpCircle
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, UserRole, TaskType, AuditPhase } from '../../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../constants/taskTypeChecklists';
import { formatDateDual } from '../../utils/nepaliDate';

// ── Clean Priority Definitions ────────────────────────────────
const PRIORITY_CONFIG: Record<TaskPriority, {
    border: string;
    badgeStyle: React.CSSProperties;
    label: string;
    icon: React.ReactNode;
}> = {
    [TaskPriority.URGENT]: {
        border: 'border-l-[var(--color-danger)]',
        badgeStyle: { color: 'var(--color-danger)', background: 'rgba(224,112,122,0.1)', borderColor: 'rgba(224,112,122,0.25)' },
        label: 'Urgent',
        icon: <Flame size={10} className="flex-shrink-0" />,
    },
    [TaskPriority.HIGH]: {
        border: 'border-l-[var(--color-warning)]',
        badgeStyle: { color: 'var(--color-warning)', background: 'rgba(217,164,65,0.1)', borderColor: 'rgba(217,164,65,0.25)' },
        label: 'High',
        icon: <Zap size={10} className="flex-shrink-0" />,
    },
    [TaskPriority.MEDIUM]: {
        border: 'border-l-[var(--color-info)]',
        badgeStyle: { color: 'var(--color-info)', background: 'rgba(106,163,217,0.1)', borderColor: 'rgba(106,163,217,0.25)' },
        label: 'Medium',
        icon: <Clock size={10} className="flex-shrink-0" />,
    },
    [TaskPriority.LOW]: {
        border: 'border-l-[var(--color-neutral)]',
        badgeStyle: { color: 'var(--text-muted)', background: 'var(--bg-surface)', borderColor: 'var(--border)' },
        label: 'Low',
        icon: null,
    },
};

const AVATAR_BG_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#10b981'];
const getAvatarBg = (i: number) => AVATAR_BG_COLORS[i % AVATAR_BG_COLORS.length];

const ICON_MAP: Record<string, React.ComponentType<any>> = {
    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
};

function formatDualDate(dueDate?: string): string {
    if (!dueDate) return 'No due date';
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

export interface TaskCardProps {
    task: Task;
    index: number;
    usersList: UserProfile[];
    selectedTaskIds: string[];
    onToggleSelection: (id: string) => void;
    onClick: (task: Task) => void;
    onOpenClientDetail?: (clientId: string) => void;
    currentUser: UserProfile | null;
}

const TaskCard: React.FC<TaskCardProps> = React.memo(({
    task,
    index,
    usersList,
    selectedTaskIds,
    onToggleSelection,
    onClick,
    onOpenClientDetail,
    currentUser
}) => {
    const isSelected = selectedTaskIds.includes(task.id);
    const subtasks = task.subtasks || [];
    const done = subtasks.filter(s => s.isCompleted).length;
    const total = subtasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : -1;
    const openQueriesCount = subtasks.filter(s => s.queryStatus === 'OPEN').length;

    const isOverdue = task.dueDate &&
        new Date(task.dueDate) < new Date() &&
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.ARCHIVED;

    const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[TaskPriority.LOW];
    const isCompleted = task.status === TaskStatus.COMPLETED;
    const validAssignees = (task.assignedTo || []).filter(uid => uid && typeof uid === 'string' && uid.trim() !== '');
    const IconComp = task.taskType ? ICON_MAP[TASK_TYPE_ICONS[task.taskType]] : null;

    const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MASTER_ADMIN;
    const isTL = currentUser?.uid === task.teamLeaderId;
    const isReviewer = currentUser?.uid === task.engagementReviewerId;
    const isPartner = currentUser?.uid === task.signingPartnerId;
    const isAssigned = (task.assignedTo || []).includes(currentUser?.uid || '');

    const isDragDisabled = !(isAdmin || isTL || isReviewer || isPartner || isAssigned);

    return (
        <Draggable draggableId={task.id} index={index} isDragDisabled={isDragDisabled}>
            {(prov, snap) => {
                const child = (
                    <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        style={prov.draggableProps.style}
                        className="pb-2.5"
                    >
                        <div
                            {...prov.dragHandleProps}
                            onClick={(e) => {
                                if (snap.isDragging) { e.preventDefault(); e.stopPropagation(); return; }
                                onClick(task);
                            }}
                            className={[
                                'relative group/card rounded-[var(--radius-lg)] cursor-pointer select-none overflow-hidden',
                                'border border-l-2 transition-colors duration-150',
                                pc.border,
                                snap.isDragging
                                    ? 'shadow-2xl z-[9999] ring-1 ring-[var(--accent)]'
                                    : 'shadow-none hover:border-[var(--border-mid)]',
                                isSelected ? 'ring-1 ring-[var(--accent)] border-[var(--border-accent)]' : '',
                                isCompleted ? 'opacity-70' : '',
                            ].filter(Boolean).join(' ')}
                            style={{
                                background: isSelected ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                                borderColor: isSelected ? 'var(--border-accent)' : undefined
                            }}
                        >
                            <div className="p-3 space-y-2">
                                {/* Header: Client Name, Selection Checkbox, Priority */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {/* Selection Checkbox */}
                                        {(isAdmin || isTL || isReviewer || isPartner || isAssigned) && (
                                            <div
                                                className={`w-3.5 h-3.5 rounded-[var(--radius-sm)] border flex items-center justify-center flex-shrink-0 transition-opacity ${
                                                    isSelected ? 'opacity-100 bg-[var(--accent)] border-[var(--accent)]' : 'opacity-0 group-hover/card:opacity-60 border-[var(--border-mid)]'
                                                }`}
                                                onClick={e => { e.stopPropagation(); if (!snap.isDragging) onToggleSelection(task.id); }}
                                                title="Select assignment"
                                            >
                                                {isSelected && <Check size={10} style={{ color: 'var(--on-accent)' }} strokeWidth={3} />}
                                            </div>
                                        )}

                                        {/* Client Name with Icon */}
                                        {task.clientName ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!snap.isDragging && onOpenClientDetail && task.clientIds?.[0]) {
                                                        onOpenClientDetail(task.clientIds[0]);
                                                    }
                                                }}
                                                className="flex items-center gap-1.5 text-left truncate group/client hover:underline"
                                            >
                                                <Building2 size={12} strokeWidth={1.75} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                                <span className="text-xs font-semibold tracking-tight truncate transition-colors group-hover/client:text-[var(--accent)]" style={{ color: 'var(--text-heading)' }}>
                                                    {task.clientName}
                                                </span>
                                            </button>
                                        ) : (
                                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Internal engagement</span>
                                        )}
                                    </div>

                                    {/* Priority Badge & Drag Handle */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-sm)] border" style={pc.badgeStyle}>
                                            {pc.icon}
                                            {pc.label}
                                        </span>

                                        {!isDragDisabled && (
                                            <div className="transition-opacity opacity-0 group-hover/card:opacity-100 cursor-grab" style={{ color: 'var(--text-muted)' }}>
                                                <GripVertical size={13} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: Assignment Title */}
                                <div>
                                    <h4 className={`text-xs font-semibold leading-snug line-clamp-2 transition-colors ${
                                        (isCompleted && task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION)
                                            ? 'line-through'
                                            : 'group-hover/card:text-[var(--accent)]'
                                    }`}
                                    style={{
                                        color: (isCompleted && task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION) ? 'var(--text-muted)' : 'var(--text-heading)'
                                    }}>
                                        {task.title}
                                    </h4>
                                </div>

                                {/* Row 3: Meta Tags (Type, Fiscal Year, Open Queries) */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {task.taskType && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border)] text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                            {IconComp && <IconComp size={10} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />}
                                            <span className="truncate max-w-[120px]">{TASK_TYPE_LABELS[task.taskType]}</span>
                                        </span>
                                    )}

                                    {task.fiscalYear && (
                                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border)] text-[10px] font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                            FY {task.fiscalYear}
                                        </span>
                                    )}

                                    {openQueriesCount > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium border tabular-nums" style={{ color: 'var(--color-warning)', background: 'rgba(217,164,65,0.1)', borderColor: 'rgba(217,164,65,0.25)' }}>
                                            <HelpCircle size={10} />
                                            {openQueriesCount} {openQueriesCount === 1 ? 'query' : 'queries'}
                                        </span>
                                    )}

                                    {task.reviewStatus === 'CHANGES_REQUESTED' && (
                                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium border" style={{ color: 'var(--color-danger)', background: 'rgba(224,112,122,0.1)', borderColor: 'rgba(224,112,122,0.2)' }}>
                                            Rev. needed
                                        </span>
                                    )}
                                </div>

                                {/* Row 4: Progress Bar */}
                                {pct >= 0 && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                            <span className="font-medium flex items-center gap-1">
                                                <CheckCircle2 size={11} style={{ color: pct === 100 ? 'var(--color-success)' : 'var(--text-muted)' }} />
                                                <span>{done}/{total} procedures</span>
                                            </span>
                                            <span className="font-medium" style={{ color: pct === 100 ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                                                {pct}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: pct === 100 ? 'var(--color-success)' : 'var(--accent)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Row 5: Footer — Due Date, Sign-off Chain Pips, Assignee Avatars */}
                                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] gap-2">
                                    {/* Left: Dual Date */}
                                    <div className="flex items-center gap-1.5 text-[11px] font-medium truncate" style={{
                                        color: isOverdue ? 'var(--color-danger)' : 'var(--text-muted)'
                                    }}>
                                        {isOverdue ? (
                                            <>
                                                <AlertTriangle size={12} className="flex-shrink-0" />
                                                <span className="truncate">{formatDualDate(task.dueDate)}</span>
                                            </>
                                        ) : task.dueDate ? (
                                            <>
                                                <Calendar size={12} className="opacity-70 flex-shrink-0" />
                                                <span className="truncate">{formatDualDate(task.dueDate)}</span>
                                            </>
                                        ) : (
                                            <span>No deadline</span>
                                        )}
                                    </div>

                                    {/* Right: Sign-off Pips & Avatars */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* 3-Step Sign-Off Status Pips */}
                                        {(task.teamLeaderId || task.engagementReviewerId || task.signingPartnerId) && (
                                            <div className="flex items-center gap-1" title="Sign-off chain: TL = Team Leader, ER = QC Reviewer, SP = Signing Partner">
                                                {task.teamLeaderId && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[9px] font-medium border" style={
                                                        task.teamLeadApprovedAt
                                                            ? { color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' }
                                                            : { color: 'var(--text-muted)', background: 'var(--bg-surface)', borderColor: 'var(--border)' }
                                                    }>
                                                        TL {task.teamLeadApprovedAt ? '✓' : '○'}
                                                    </span>
                                                )}
                                                {task.engagementReviewerId && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[9px] font-medium border" style={
                                                        task.engagementReviewerApprovedAt
                                                            ? { color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' }
                                                            : { color: 'var(--text-muted)', background: 'var(--bg-surface)', borderColor: 'var(--border)' }
                                                    }>
                                                        ER {task.engagementReviewerApprovedAt ? '✓' : '○'}
                                                    </span>
                                                )}
                                                {task.signingPartnerId && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[9px] font-medium border" style={
                                                        task.signingPartnerApprovedAt
                                                            ? { color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' }
                                                            : { color: 'var(--text-muted)', background: 'var(--bg-surface)', borderColor: 'var(--border)' }
                                                    }>
                                                        SP {task.signingPartnerApprovedAt ? '✓' : '○'}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Assignee Avatars */}
                                        {validAssignees.length > 0 ? (
                                            <div className="flex -space-x-1.5">
                                                {validAssignees.slice(0, 3).map((uid, i) => {
                                                    const u = usersList.find(x => x.uid === uid);
                                                    if (!u) return null;
                                                    const initials = u.displayName
                                                        ? u.displayName.split(' ').map((p: string) => p[0]).join('').substring(0, 2).toUpperCase()
                                                        : '?';
                                                    return (
                                                        <div
                                                            key={uid || i}
                                                            title={u.displayName}
                                                            style={{ backgroundColor: getAvatarBg(i) }}
                                                            className="w-[22px] h-[22px] rounded-full ring-2 ring-[var(--bg-secondary)] flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0"
                                                        >
                                                            {initials}
                                                        </div>
                                                    );
                                                })}
                                                {validAssignees.length > 3 && (
                                                    <div className="w-[22px] h-[22px] rounded-full bg-[var(--bg-surface)] border border-[var(--border)] ring-2 ring-[var(--bg-secondary)] flex items-center justify-center text-[9px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                                        +{validAssignees.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] border border-dashed border-[var(--border-mid)] rounded-[var(--radius-sm)] px-1.5 py-0.5" style={{ color: 'var(--text-muted)' }}>
                                                Unassigned
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

                if (snap.isDragging) {
                    return ReactDOM.createPortal(child, document.body);
                }
                return child;
            }}
        </Draggable>
    );
}, (prev, next) => (
    prev.task.id === next.task.id &&
    prev.task.status === next.task.status &&
    prev.task.auditPhase === next.task.auditPhase &&
    prev.task.title === next.task.title &&
    prev.task.dueDate === next.task.dueDate &&
    prev.task.priority === next.task.priority &&
    prev.task.fiscalYear === next.task.fiscalYear &&
    prev.task.reviewStatus === next.task.reviewStatus &&
    (prev.task.assignedTo?.length || 0) === (next.task.assignedTo?.length || 0) &&
    prev.task.clientName === next.task.clientName &&
    prev.task.subtasks?.length === next.task.subtasks?.length &&
    (prev.task.subtasks?.filter(s => s.isCompleted).length === next.task.subtasks?.filter(s => s.isCompleted).length) &&
    (prev.task.subtasks?.filter(s => s.queryStatus === 'OPEN').length === next.task.subtasks?.filter(s => s.queryStatus === 'OPEN').length) &&
    prev.task.teamLeadApprovedAt === next.task.teamLeadApprovedAt &&
    prev.task.engagementReviewerApprovedAt === next.task.engagementReviewerApprovedAt &&
    prev.task.signingPartnerApprovedAt === next.task.signingPartnerApprovedAt &&
    prev.index === next.index &&
    prev.selectedTaskIds.includes(prev.task.id) === next.selectedTaskIds.includes(next.task.id)
));

export default TaskCard;
