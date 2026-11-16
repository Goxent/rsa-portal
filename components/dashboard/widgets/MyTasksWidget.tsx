import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertTriangle, ArrowRight, Zap, Flag } from 'lucide-react';
import { Task, TaskStatus } from '../../../types';

interface MyTasksWidgetProps {
    recentTasks?: Task[];
    userMap?: Record<string, any>;
}

// ── Priority config ────────────────────────────────────────────────────────
const getPriorityConfig = (priority: string) => {
    switch (priority) {
        case 'URGENT': return {
            label: 'Urgent', text: 'var(--color-danger)',
            dot: 'bg-[var(--color-danger)]',
        };
        case 'HIGH': return {
            label: 'High', text: 'var(--color-warning)',
            dot: 'bg-[var(--color-warning)]',
        };
        case 'MEDIUM': return {
            label: 'Medium', text: 'var(--color-warning)',
            dot: 'bg-[var(--color-warning)]',
        };
        default: return {
            label: 'Low', text: 'var(--text-muted)',
            dot: 'bg-[var(--text-muted)]',
        };
    }
};

// ── Status config ─────────────────────────────────────────────────────────
const getStatusConfig = (status: string) => {
    switch (status) {
        case TaskStatus.IN_PROGRESS: return { label: 'In progress', color: 'var(--color-warning)' };
        case TaskStatus.COMPLETED: return { label: 'Completed', color: 'var(--accent)' };
        case TaskStatus.ARCHIVED: return { label: 'Archived', color: 'var(--text-muted)' };
        default: return { label: 'Not started', color: 'var(--text-muted)' };
    }
};

// ── Due date label helper ──────────────────────────────────────────────────
function getDueLabel(dueDate: string | undefined): {
    label: string;
    style: React.CSSProperties;
} | null {
    if (!dueDate) return null;

    const now = new Date();
    const due = new Date(dueDate + 'T00:00:00'); // treat as local midnight
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, style: { color: 'var(--color-danger)' } };
    if (diff === 0) return { label: 'Due today', style: { color: 'var(--color-warning)' } };
    if (diff === 1) return { label: 'Due tomorrow', style: { color: 'var(--color-warning)' } };
    if (diff === 2) return { label: 'Due in 2 days', style: { color: 'var(--color-warning)' } };

    return {
        label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        style: { color: 'var(--text-muted)' },
    };
}

// ── Component ──────────────────────────────────────────────────────────────
const MyTasksWidget: React.FC<MyTasksWidgetProps> = ({ recentTasks = [] }) => {
    const navigate = useNavigate();

    const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    const activeTasks = recentTasks.filter(
        t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.ARCHIVED
    );

    const sorted = [...activeTasks]
        .sort((a, b) => {
            const now = new Date();
            const aOverdue = a.dueDate && new Date(a.dueDate + 'T00:00:00') < now ? 1 : 0;
            const bOverdue = b.dueDate && new Date(b.dueDate + 'T00:00:00') < now ? 1 : 0;
            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
            return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        })
        .slice(0, 5);

    // ── Empty state ────────────────────────────────────────────────────────
    if (sorted.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                <CheckCircle size={24} strokeWidth={1.75} className="mb-2" style={{ color: 'var(--accent)', opacity: 0.7 }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>All caught up</p>
                <p className="text-xs mt-1 max-w-[240px]" style={{ color: 'var(--text-muted)' }}>
                    No pending tasks assigned to you. Check the task board to pick up new work.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">

            {/* ── Compact header ──────────────────────────────────────── */}
            <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Ongoing</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                        {activeTasks.length}
                    </span>
                </div>
                <button
                    onClick={() => navigate('/tasks?boardMode=MY')}
                    className="flex items-center gap-1 text-xs font-medium hover:underline transition-colors"
                    style={{ color: 'var(--accent)' }}
                >
                    View all <ArrowRight size={12} strokeWidth={1.75} />
                </button>
            </div>

            {/* ── Task list ───────────────────────────────────────────── */}
            {sorted.map(task => {
                const priority = getPriorityConfig(task.priority);
                const status = getStatusConfig(task.status);
                const now = new Date();
                const isOverdue = task.dueDate && new Date(task.dueDate + 'T00:00:00') < now;
                const dueLabel = getDueLabel(task.dueDate);

                return (
                    <div
                        key={task.id}
                        onClick={() => navigate('/tasks')}
                        className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 cursor-pointer transition-colors duration-150 border group hover:border-[var(--border-mid)]"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                    >
                        {/* Priority Dot */}
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priority.dot}`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-semibold truncate leading-tight transition-colors" style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--text-heading)' }}>
                                    {task.title}
                                </h4>

                                {/* Due date label */}
                                {dueLabel && (
                                    <span className="text-[11px] font-medium flex items-center gap-1 flex-shrink-0 tabular-nums" style={dueLabel.style}>
                                        <Clock size={11} strokeWidth={1.75} />
                                        {dueLabel.label}
                                    </span>
                                )}
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] font-normal truncate" style={{ color: 'var(--text-muted)' }}>
                                    {task.clientName || 'Internal'}
                                </span>
                                <span className="text-[11px] font-medium flex-shrink-0" style={{ color: status.color }}>
                                    · {status.label}
                                </span>
                                {isOverdue && (
                                    <AlertTriangle size={11} strokeWidth={1.75} className="flex-shrink-0 ml-auto" style={{ color: 'var(--color-danger)' }} />
                                )}
                            </div>
                        </div>

                        {/* Arrow hint - only visible on hover */}
                        <ArrowRight size={13} strokeWidth={1.75} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    </div>
                );
            })}
        </div>
    );
};

export default MyTasksWidget;
