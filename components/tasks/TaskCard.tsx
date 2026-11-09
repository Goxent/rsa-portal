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
    badge: string;
    label: string;
    icon: React.ReactNode;
}> = {
    [TaskPriority.URGENT]: {
        border: 'border-l-rose-500',
        badge: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
        label: 'Urgent',
        icon: <Flame size={10} className="text-rose-500 flex-shrink-0" />,
    },
    [TaskPriority.HIGH]: {
        border: 'border-l-amber-500',
        badge: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
        label: 'High',
        icon: <Zap size={10} className="text-amber-500 flex-shrink-0" />,
    },
    [TaskPriority.MEDIUM]: {
        border: 'border-l-indigo-500',
        badge: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        label: 'Medium',
        icon: <Clock size={10} className="text-indigo-500 flex-shrink-0" />,
    },
    [TaskPriority.LOW]: {
        border: 'border-l-slate-400 dark:border-l-slate-600',
        badge: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',
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
                                'relative group/card rounded-2xl cursor-pointer select-none overflow-hidden',
                                'border border-l-4 transition-all duration-200',
                                'bg-white dark:bg-[#13151f]',
                                'border-slate-200 dark:border-white/[0.08]',
                                pc.border,
                                snap.isDragging
                                    ? 'shadow-2xl scale-[1.02] z-[9999] ring-2 ring-indigo-500/40 bg-white dark:bg-[#1a1d2c] rotate-1'
                                    : 'shadow-sm hover:border-slate-300 dark:hover:border-white/[0.18] hover:-translate-y-0.5 hover:shadow-md',
                                isSelected ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40' : '',
                                isCompleted ? 'opacity-65' : '',
                            ].filter(Boolean).join(' ')}
                        >
                            <div className="p-3.5 space-y-2.5">
                                {/* Header: Client Name, Selection Checkbox, Priority */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {/* Selection Checkbox */}
                                        {(isAdmin || isTL || isReviewer || isPartner || isAssigned) && (
                                            <div
                                                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-opacity ${
                                                    isSelected ? 'opacity-100 bg-emerald-500 border-emerald-500' : 'opacity-0 group-hover/card:opacity-60 border-slate-300 dark:border-slate-600 hover:border-slate-400'
                                                }`}
                                                onClick={e => { e.stopPropagation(); if (!snap.isDragging) onToggleSelection(task.id); }}
                                                title="Select assignment"
                                            >
                                                {isSelected && <Check size={10} className="text-white" strokeWidth={3.5} />}
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
                                                <Building2 size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0 group-hover/client:text-indigo-500" />
                                                <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 tracking-tight truncate group-hover/client:text-indigo-600 dark:group-hover/client:text-indigo-400">
                                                    {task.clientName}
                                                </span>
                                            </button>
                                        ) : (
                                            <span className="text-[11px] font-semibold text-slate-400">Internal Engagement</span>
                                        )}
                                    </div>

                                    {/* Priority Badge & Drag Handle */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${pc.badge}`}>
                                            {pc.icon}
                                            {pc.label}
                                        </span>

                                        {!isDragDisabled && (
                                            <div className="text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors opacity-0 group-hover/card:opacity-100 cursor-grab">
                                                <GripVertical size={13} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: Assignment Title */}
                                <div>
                                    <h4 className={`text-[13px] font-semibold leading-snug line-clamp-2 transition-colors ${
                                        (isCompleted && task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION)
                                            ? 'line-through text-slate-400 dark:text-slate-500'
                                            : 'text-slate-900 dark:text-slate-100 group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-300'
                                    }`}>
                                        {task.title}
                                    </h4>
                                </div>

                                {/* Row 3: Meta Tags (Type, Fiscal Year, Open Queries) */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {task.taskType && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                            {IconComp && <IconComp size={10} className="text-indigo-500 flex-shrink-0" />}
                                            <span className="truncate max-w-[120px]">{TASK_TYPE_LABELS[task.taskType]}</span>
                                        </span>
                                    )}

                                    {task.fiscalYear && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[10px] font-bold text-slate-500">
                                            FY {task.fiscalYear}
                                        </span>
                                    )}

                                    {openQueriesCount > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                            <HelpCircle size={10} />
                                            {openQueriesCount} {openQueriesCount === 1 ? 'Query' : 'Queries'}
                                        </span>
                                    )}

                                    {task.reviewStatus === 'CHANGES_REQUESTED' && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-500">
                                            Rev. Needed
                                        </span>
                                    )}
                                </div>

                                {/* Row 4: Progress Bar */}
                                {pct >= 0 && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                <CheckCircle2 size={11} className={pct === 100 ? 'text-emerald-500' : 'text-slate-400'} />
                                                <span>{done}/{total} procedures</span>
                                            </span>
                                            <span className={`font-bold ${pct === 100 ? 'text-emerald-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {pct}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    pct === 100 ? 'bg-emerald-500' :
                                                    pct >= 60 ? 'bg-indigo-500' :
                                                    pct >= 30 ? 'bg-amber-500' : 'bg-slate-400'
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Row 5: Footer — Due Date, Sign-off Chain Pips, Assignee Avatars */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.06] gap-2">
                                    {/* Left: Dual Date */}
                                    <div className={`flex items-center gap-1.5 text-[11px] font-medium truncate ${
                                        isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                                    }`}>
                                        {isOverdue ? (
                                            <>
                                                <AlertTriangle size={12} className="animate-pulse flex-shrink-0" />
                                                <span className="truncate">{formatDualDate(task.dueDate)}</span>
                                            </>
                                        ) : task.dueDate ? (
                                            <>
                                                <Calendar size={12} className="opacity-70 flex-shrink-0" />
                                                <span className="truncate">{formatDualDate(task.dueDate)}</span>
                                            </>
                                        ) : (
                                            <span className="text-slate-400">No deadline</span>
                                        )}
                                    </div>

                                    {/* Right: Sign-off Pips & Avatars */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* 3-Step Sign-Off Status Pips */}
                                        {(task.teamLeaderId || task.engagementReviewerId || task.signingPartnerId) && (
                                            <div className="flex items-center gap-1" title="Sign-off chain: TL = Team Leader, ER = QC Reviewer, SP = Signing Partner">
                                                {task.teamLeaderId && (
                                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                                        task.teamLeadApprovedAt ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' : 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 border-slate-200 dark:border-white/[0.08]'
                                                    }`}>
                                                        TL {task.teamLeadApprovedAt ? '✓' : '○'}
                                                    </span>
                                                )}
                                                {task.engagementReviewerId && (
                                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                                        task.engagementReviewerApprovedAt ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' : 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 border-slate-200 dark:border-white/[0.08]'
                                                    }`}>
                                                        ER {task.engagementReviewerApprovedAt ? '✓' : '○'}
                                                    </span>
                                                )}
                                                {task.signingPartnerId && (
                                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                                        task.signingPartnerApprovedAt ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' : 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 border-slate-200 dark:border-white/[0.08]'
                                                    }`}>
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
                                                            className="w-[22px] h-[22px] rounded-full ring-2 ring-white dark:ring-[#13151f] flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 shadow-sm"
                                                        >
                                                            {initials}
                                                        </div>
                                                    );
                                                })}
                                                {validAssignees.length > 3 && (
                                                    <div className="w-[22px] h-[22px] rounded-full bg-slate-200 dark:bg-slate-700 ring-2 ring-white dark:ring-[#13151f] flex items-center justify-center text-[9px] font-bold text-slate-700 dark:text-slate-300">
                                                        +{validAssignees.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5">
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
