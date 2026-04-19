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
            label: 'Urgent', text: 'text-red-500 dark:text-red-400',
            dot: 'bg-red-500',
        };
        case 'HIGH': return {
            label: 'High', text: 'text-amber-500 dark:text-amber-400',
            dot: 'bg-amber-500',
        };
        case 'MEDIUM': return {
            label: 'Medium', text: 'text-amber-500 dark:text-amber-400',
            dot: 'bg-amber-500',
        };
        default: return {
            label: 'Low', text: 'text-slate-400',
            dot: 'bg-slate-300 dark:bg-slate-600',
        };
    }
};

// ── Status config — PENDING_REVIEW → UNDER_REVIEW (bug fix) ───────────────
const getStatusConfig = (status: string) => {
    switch (status) {
        case TaskStatus.IN_PROGRESS: return { label: 'In Progress', color: 'text-amber-400' };
        case TaskStatus.COMPLETED: return { label: 'Completed', color: 'text-brand-400' };
        case TaskStatus.ARCHIVED: return { label: 'Archived', color: 'text-amber-600' };
        default: return { label: 'Not Started', color: 'text-gray-400' };
    }
};

// ── Due date label helper ──────────────────────────────────────────────────
function getDueLabel(dueDate: string | undefined): {
    label: string;
    className: string;
} | null {
    if (!dueDate) return null;

    const now = new Date();
    const due = new Date(dueDate + 'T00:00:00'); // treat as local midnight
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, className: 'text-red-400' };
    if (diff === 0) return { label: 'Due today', className: 'text-amber-400' };
    if (diff === 1) return { label: 'Due tomorrow', className: 'text-amber-400' };
    if (diff === 2) return { label: 'Due in 2 days', className: 'text-amber-400' };

    return {
        label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        className: 'text-gray-500',
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
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <CheckCircle size={26} className="mb-2 text-brand-500/50" />
                <p className="text-sm font-semibold text-brand-400">All caught up!</p>
                <p className="text-xs text-gray-600 mt-1">No pending tasks assigned to you</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">

            {/* ── Compact header ──────────────────────────────────────── */}
            <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Ongoing</span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 tabular-nums">
                        {activeTasks.length}
                    </span>
                </div>
                <button
                    onClick={() => navigate('/tasks?boardMode=MY')}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-indigo-300 transition-colors font-semibold"
                >
                    View All <ArrowRight size={11} />
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
                        className={`
                            flex items-center gap-3 rounded-xl px-3 py-2.5
                            cursor-pointer transition-all duration-300 group
                            hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:shadow-sm hover:translate-x-1 border border-transparent hover:border-slate-200/50 dark:hover:border-white/5
                        `}
                    >
                        {/* Priority Dot */}
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priority.dot}`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-2">
                                <h4 className={`text-[13px] font-bold truncate leading-tight transition-colors ${isOverdue ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white'
                                    }`}>
                                    {task.title}
                                </h4>

                                {/* Due date label */}
                                {dueLabel && (
                                    <span className={`text-[10px] font-bold flex items-center gap-1 flex-shrink-0 ${dueLabel.className}`}>
                                        <Clock size={10} />
                                        {dueLabel.label}
                                    </span>
                                )}
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-600 truncate uppercase tracking-tight">
                                    {task.clientName || 'Internal'}
                                </span>
                                <span className={`text-[10px] font-bold ${status.color} flex-shrink-0 uppercase tracking-tight opacity-70`}>
                                    · {status.label}
                                </span>
                                {isOverdue && (
                                    <AlertTriangle size={10} className="text-red-500 dark:text-red-400 flex-shrink-0 ml-auto" />
                                )}
                            </div>
                        </div>

                        {/* Arrow hint - only visible on hover */}
                        <ArrowRight size={14} className="text-slate-300 dark:text-gray-700 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                    </div>
                );
            })}
        </div>
    );
};

export default MyTasksWidget;
