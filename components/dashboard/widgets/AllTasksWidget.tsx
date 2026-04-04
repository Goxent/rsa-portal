import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckSquare, AlertTriangle, Clock, Zap, Flag,
    ChevronDown, ChevronUp, Search, Filter, ArrowRight, User
} from 'lucide-react';
import { Task, TaskStatus } from '../../../types';

interface AllTasksWidgetProps {
    recentTasks?: Task[];
    userMap?: Record<string, { displayName: string }>;
    isLoading?: boolean;
}

const PRIORITY_WEIGHT: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const getPriorityConfig = (priority: string) => {
    switch (priority) {
        case 'URGENT': return { dot: 'bg-red-400 animate-pulse', text: 'text-red-400', label: 'Urgent', icon: Zap };
        case 'HIGH': return { dot: 'bg-orange-400', text: 'text-orange-400', label: 'High', icon: AlertTriangle };
        case 'MEDIUM': return { dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Medium', icon: Clock };
        default: return { dot: 'bg-blue-400', text: 'text-amber-400', label: 'Low', icon: Flag };
    }
};

const getStatusConfig = (status: string) => {
    switch (status) {
        case TaskStatus.IN_PROGRESS: return { label: 'In Progress', color: 'text-brand-400', bg: 'bg-brand-500/10 border-brand-500/20' };
        case TaskStatus.UNDER_REVIEW: return { label: 'Under Review', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
        case TaskStatus.COMPLETED: return { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
        case TaskStatus.HALTED: return { label: 'Halted', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
        default: return { label: 'Not Started', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' };
    }
};

const AllTasksWidget: React.FC<AllTasksWidgetProps> = ({ recentTasks = [], userMap = {}, isLoading }) => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('active');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const now = new Date();

    // Filter and sort
    const filtered = recentTasks
        .filter(t => {
            if (filterStatus === 'active') return t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.HALTED;
            if (filterStatus === 'overdue') return t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED;
            if (filterStatus === 'review') return t.status === TaskStatus.UNDER_REVIEW;
            return true; // 'all'
        })
        .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.clientName || '').toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const aOverdue = a.dueDate && new Date(a.dueDate) < now ? 1 : 0;
            const bOverdue = b.dueDate && new Date(b.dueDate) < now ? 1 : 0;
            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
            return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        });

    const overdueCount = recentTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED).length;
    const reviewCount = recentTasks.filter(t => t.status === TaskStatus.UNDER_REVIEW).length;
    const activeCount = recentTasks.filter(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.HALTED).length;

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Summary pills */}
            <div className="flex flex-wrap gap-2 text-slate-700">
                <button
                    onClick={() => setFilterStatus('active')}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${filterStatus === 'active' ? 'bg-brand-500/20 border-brand-500/30 text-brand-700 dark:text-brand-300' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-500 hover:text-brand-700 dark:hover:text-gray-300'}`}
                >
                    Active · {activeCount}
                </button>
                {overdueCount > 0 && (
                    <button
                        onClick={() => setFilterStatus('overdue')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${filterStatus === 'overdue' ? 'bg-red-500/20 border-red-500/30 text-red-700 dark:text-red-300' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/15'}`}
                    >
                        ⚠ Overdue · {overdueCount}
                    </button>
                )}
                {reviewCount > 0 && (
                    <button
                        onClick={() => setFilterStatus('review')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${filterStatus === 'review' ? 'bg-purple-500/20 border-purple-500/30 text-purple-700 dark:text-purple-300' : 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15'}`}
                    >
                        Review · {reviewCount}
                    </button>
                )}
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${filterStatus === 'all' ? 'bg-slate-200 dark:bg-white/15 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`}
                >
                    All · {recentTasks.length}
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-600" />
                <input
                    type="text"
                    placeholder="Search tasks or clients..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-brand-500/40 focus:bg-white/6 transition-all"
                />
            </div>

            {/* Task list */}
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5 custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-gray-600">
                        <CheckSquare size={24} className="mb-2 opacity-30" />
                        <p className="text-xs">No tasks match this filter</p>
                    </div>
                ) : (
                    filtered.slice(0, 20).map(task => {
                        const priority = getPriorityConfig(task.priority);
                        const status = getStatusConfig(task.status);
                        const isOverdue = task.dueDate && new Date(task.dueDate) < now && task.status !== TaskStatus.COMPLETED;
                        const isExpanded = expandedId === task.id;
                        const daysUntilDue = task.dueDate
                            ? Math.ceil((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                            : null;
                        const dueStr = task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : null;

                        // Get assignee names
                        const assigneeNames = (task.assignedTo || [])
                            .map(uid => userMap[uid]?.displayName?.split(' ')[0] || '?')
                            .slice(0, 2)
                            .join(', ');

                        return (
                            <div
                                key={task.id}
                                className={`rounded-xl border transition-all duration-300 overflow-hidden hover:-translate-y-0.5 hover:shadow-lg ${isOverdue
                                        ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10'
                                        : 'border-slate-200 dark:border-white/[0.05] bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-slate-300 dark:hover:border-white/[0.1]'
                                    }`}
                            >
                                <div
                                    className="flex items-center gap-2.5 p-2.5 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                                >
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className={`text-[12px] font-bold truncate ${isOverdue ? 'text-red-700 dark:text-red-200' : 'text-slate-900 dark:text-white'}`}>
                                                {task.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {dueStr && (
                                                    <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-600 dark:text-red-400' : daysUntilDue !== null && daysUntilDue <= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-gray-600'}`}>
                                                        {isOverdue ? `${Math.abs(daysUntilDue!)}d ago` : dueStr}
                                                    </span>
                                                )}
                                                {isExpanded ? <ChevronUp size={11} className="text-slate-400 dark:text-gray-600" /> : <ChevronDown size={11} className="text-slate-400 dark:text-gray-700" />}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] text-slate-500 dark:text-gray-500 truncate font-medium">{task.clientName || 'Internal'}</span>
                                            <span className="text-[10px] text-slate-300 dark:text-gray-700">·</span>
                                            <span className={`text-[10px] font-bold ${status.color}`}>{status.label}</span>
                                            {assigneeNames && (
                                                <>
                                                    <span className="text-[10px] text-slate-300 dark:text-gray-700">·</span>
                                                    <User size={9} className="text-slate-400 dark:text-gray-600 flex-shrink-0" />
                                                    <span className="text-[10px] text-slate-500 dark:text-gray-500 truncate">{assigneeNames}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-3 pb-2.5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-2">
                                        <div className="flex flex-wrap gap-1.5 pt-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-black uppercase tracking-wide ${priority.text} bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10`}>
                                                {priority.label}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${status.bg} ${status.color}`}>
                                                {status.label}
                                            </span>
                                            {task.subtasks && task.subtasks.length > 0 && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-md border bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400">
                                                    {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} subtasks
                                                </span>
                                            )}
                                        </div>
                                        {task.description && (
                                            <p className="text-[11px] text-slate-600 dark:text-gray-500 line-clamp-2">{task.description}</p>
                                        )}
                                        {(task.assignedTo || []).length > 0 && (
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-gray-500">
                                                <User size={10} />
                                                {(task.assignedTo || []).map(uid => userMap[uid]?.displayName || uid).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {filtered.length > 20 && (
                <p className="text-[10px] text-slate-400 dark:text-gray-600 text-center">Showing 20 of {filtered.length} tasks</p>
            )}

            <button
                onClick={() => navigate('/tasks')}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors font-bold border border-brand-200 dark:border-transparent hover:border-brand-500/25 rounded-xl hover:bg-brand-500/5 bg-brand-50 dark:bg-transparent"
            >
                Manage all tasks <ArrowRight size={12} />
            </button>
        </div>
    );
};

export default AllTasksWidget;
