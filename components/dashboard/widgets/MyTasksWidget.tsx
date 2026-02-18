import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle, Clock, AlertTriangle, ArrowRight, Zap,
    ChevronDown, ChevronUp, Briefcase, Flag
} from 'lucide-react';
import { Task, TaskStatus } from '../../../types';

interface MyTasksWidgetProps {
    recentTasks?: Task[];
    userMap?: Record<string, any>;
}

const getPriorityConfig = (priority: string) => {
    switch (priority) {
        case 'URGENT': return { label: 'Urgent', dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: Zap };
        case 'HIGH': return { label: 'High', dot: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: AlertTriangle };
        case 'MEDIUM': return { label: 'Medium', dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: Clock };
        default: return { label: 'Low', dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Flag };
    }
};

const getStatusConfig = (status: string) => {
    switch (status) {
        case TaskStatus.IN_PROGRESS: return { label: 'In Progress', color: 'text-brand-400', bar: 'bg-brand-500' };
        case TaskStatus.PENDING_REVIEW: return { label: 'Under Review', color: 'text-purple-400', bar: 'bg-purple-500' };
        case TaskStatus.COMPLETED: return { label: 'Completed', color: 'text-emerald-400', bar: 'bg-emerald-500' };
        case TaskStatus.HALTED: return { label: 'Halted', color: 'text-red-400', bar: 'bg-red-500' };
        default: return { label: 'Not Started', color: 'text-gray-400', bar: 'bg-gray-500' };
    }
};

const MyTasksWidget: React.FC<MyTasksWidgetProps> = ({ recentTasks = [] }) => {
    const navigate = useNavigate();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Sort: overdue first, then by priority weight
    const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sorted = [...recentTasks]
        .filter(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.HALTED)
        .sort((a, b) => {
            const aOverdue = a.dueDate && new Date(a.dueDate) < new Date() ? 1 : 0;
            const bOverdue = b.dueDate && new Date(b.dueDate) < new Date() ? 1 : 0;
            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
            return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        })
        .slice(0, 5);

    if (sorted.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <CheckCircle size={28} className="mb-2 text-emerald-500/50" />
                <p className="text-sm font-medium text-emerald-400">All caught up!</p>
                <p className="text-xs text-gray-600 mt-1">No pending tasks assigned to you</p>
            </div>
        );
    }

    const overdueCount = sorted.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;

    return (
        <div className="space-y-2">
            {/* Overdue alert banner */}
            {overdueCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 mb-3">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    <span><strong>{overdueCount}</strong> task{overdueCount > 1 ? 's are' : ' is'} overdue — action needed</span>
                </div>
            )}

            {sorted.map((task) => {
                const priority = getPriorityConfig(task.priority);
                const status = getStatusConfig(task.status);
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                const isExpanded = expandedId === task.id;
                const dueStr = task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : null;
                const daysUntilDue = task.dueDate
                    ? Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                return (
                    <div
                        key={task.id}
                        className={`rounded-xl border transition-all duration-200 overflow-hidden
                            ${isOverdue ? 'border-red-500/25 bg-red-500/5' : 'border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15'}`}
                    >
                        {/* Main row */}
                        <div
                            className="flex items-center gap-3 p-3 cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : task.id)}
                        >
                            {/* Priority dot */}
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot} ${isOverdue ? 'animate-pulse' : ''}`} />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className={`text-sm font-semibold truncate leading-tight ${isOverdue ? 'text-red-200' : 'text-white'}`}>
                                        {task.title}
                                    </h4>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {dueStr && (
                                            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${isOverdue ? 'text-red-400' : daysUntilDue !== null && daysUntilDue <= 3 ? 'text-amber-400' : 'text-gray-500'}`}>
                                                <Clock size={9} />
                                                {isOverdue ? `${Math.abs(daysUntilDue!)}d ago` : dueStr}
                                            </span>
                                        )}
                                        {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-600" />}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-gray-500 truncate">{task.clientName || 'Internal'}</span>
                                    <span className={`text-[10px] font-medium ${status.color}`}>· {status.label}</span>
                                </div>
                            </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                            <div className="px-3 pb-3 pt-0 border-t border-white/5 space-y-2 animate-in slide-in-from-top-1 duration-150">
                                <div className="flex flex-wrap gap-2 pt-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold uppercase tracking-wide ${priority.bg} ${priority.text}`}>
                                        {priority.label} Priority
                                    </span>
                                    {task.riskLevel === 'HIGH' && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-md border bg-amber-500/10 border-amber-500/20 text-amber-400 font-medium flex items-center gap-1">
                                            <Zap size={9} /> High Risk
                                        </span>
                                    )}
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-md border bg-white/5 border-white/10 text-gray-400">
                                            {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} subtasks
                                        </span>
                                    )}
                                </div>
                                {task.description && (
                                    <p className="text-[11px] text-gray-500 line-clamp-2">{task.description}</p>
                                )}
                                <button
                                    onClick={() => navigate('/tasks')}
                                    className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 transition-colors font-medium"
                                >
                                    Open task <ArrowRight size={10} />
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}

            <button
                onClick={() => navigate('/tasks')}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-xs text-brand-400 hover:text-brand-300 hover:bg-brand-500/5 rounded-xl transition-all font-medium border border-transparent hover:border-brand-500/15"
            >
                View all tasks <ArrowRight size={12} />
            </button>
        </div>
    );
};

export default MyTasksWidget;
