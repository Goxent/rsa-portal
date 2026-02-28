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
            label: 'Urgent', text: 'text-red-400',
            bg: 'bg-red-500/10 border-red-500/20',
            border: 'border-l-red-500',
        };
        case 'HIGH': return {
            label: 'High', text: 'text-orange-400',
            bg: 'bg-orange-500/10 border-orange-500/20',
            border: 'border-l-amber-500',
        };
        case 'MEDIUM': return {
            label: 'Medium', text: 'text-yellow-400',
            bg: 'bg-yellow-500/10 border-yellow-500/20',
            border: 'border-l-yellow-500',
        };
        default: return {
            label: 'Low', text: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/20',
            border: 'border-l-blue-500',
        };
    }
};

// ── Status config — PENDING_REVIEW → UNDER_REVIEW (bug fix) ───────────────
const getStatusConfig = (status: string) => {
    switch (status) {
        case TaskStatus.IN_PROGRESS: return { label: 'In Progress', color: 'text-indigo-400' };
        case TaskStatus.UNDER_REVIEW: return { label: 'Under Review', color: 'text-purple-400' };
        case TaskStatus.COMPLETED: return { label: 'Completed', color: 'text-emerald-400' };
        case TaskStatus.HALTED: return { label: 'Halted', color: 'text-red-400' };
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
        t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.HALTED
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
                <CheckCircle size={26} className="mb-2 text-emerald-500/50" />
                <p className="text-sm font-semibold text-emerald-400">All caught up!</p>
                <p className="text-xs text-gray-600 mt-1">No pending tasks assigned to you</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">

            {/* ── Compact header ──────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-300 uppercase tracking-widest">My Tasks</span>
                    <span className="text-[10px] font-bold bg-white/[0.06] border border-white/[0.08] text-gray-400 rounded-full px-2 py-0.5 tabular-nums">
                        {activeTasks.length}
                    </span>
                </div>
                <button
                    onClick={() => navigate('/tasks?boardMode=MY')}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
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
                            flex items-center gap-3 rounded-xl border-l-2 border border-white/[0.07] px-3 py-2.5
                            cursor-pointer transition-all duration-200 group
                            ${priority.border}
                            ${isOverdue
                                ? 'bg-red-500/[0.05] hover:bg-red-500/[0.08] border-r-red-500/10 border-t-red-500/10 border-b-red-500/10'
                                : 'bg-white/[0.02] hover:bg-white/[0.05]'
                            }
                        `}
                    >
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-2">
                                <h4 className={`text-sm font-semibold truncate leading-tight transition-colors ${isOverdue ? 'text-red-300' : 'text-gray-200 group-hover:text-white'
                                    }`}>
                                    {task.title}
                                </h4>

                                {/* Due date label */}
                                {dueLabel && (
                                    <span className={`text-[10px] font-semibold flex items-center gap-0.5 flex-shrink-0 ${dueLabel.className}`}>
                                        <Clock size={9} />
                                        {dueLabel.label}
                                    </span>
                                )}
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-500 truncate">
                                    {task.clientName || 'Internal'}
                                </span>
                                <span className={`text-[10px] font-medium ${status.color} flex-shrink-0`}>
                                    · {status.label}
                                </span>
                                {task.subtasks && task.subtasks.length > 0 && (
                                    <span className="text-[10px] text-gray-600 flex-shrink-0">
                                        · {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} sub
                                    </span>
                                )}
                                {isOverdue && (
                                    <AlertTriangle size={9} className="text-red-400 flex-shrink-0 animate-pulse ml-auto" />
                                )}
                            </div>
                        </div>

                        {/* Arrow hint */}
                        <ArrowRight size={12} className="text-gray-700 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                    </div>
                );
            })}
        </div>
    );
};

export default MyTasksWidget;
