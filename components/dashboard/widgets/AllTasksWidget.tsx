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
        case 'URGENT': return { dot: 'bg-[var(--color-danger)]', text: 'var(--color-danger)', label: 'Urgent', icon: Zap };
        case 'HIGH': return { dot: 'bg-[var(--color-warning)]', text: 'var(--color-warning)', label: 'High', icon: AlertTriangle };
        case 'MEDIUM': return { dot: 'bg-[var(--color-warning)]', text: 'var(--color-warning)', label: 'Medium', icon: Clock };
        default: return { dot: 'bg-[var(--text-muted)]', text: 'var(--text-muted)', label: 'Low', icon: Flag };
    }
};

const getStatusConfig = (status: string) => {
    switch (status) {
        case TaskStatus.IN_PROGRESS: return { label: 'In progress', color: 'var(--color-warning)', bg: 'rgba(217,164,65,0.1)' };
        case TaskStatus.COMPLETED: return { label: 'Completed', color: 'var(--accent)', bg: 'var(--accent-dim)' };
        case TaskStatus.ARCHIVED: return { label: 'Archived', color: 'var(--text-muted)', bg: 'var(--bg-surface)' };
        default: return { label: 'Not started', color: 'var(--text-muted)', bg: 'var(--bg-surface)' };
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
            if (filterStatus === 'active') return t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.ARCHIVED;
            if (filterStatus === 'overdue') return t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.ARCHIVED;
            if (filterStatus === 'review') return t.auditPhase === 'REVIEW_AND_CONCLUSION' && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.ARCHIVED;
            return true; // 'all'
        })
        .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.clientName || '').toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const aOverdue = a.dueDate && new Date(a.dueDate) < now ? 1 : 0;
            const bOverdue = b.dueDate && new Date(b.dueDate) < now ? 1 : 0;
            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
            return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        });

    const overdueCount = recentTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.ARCHIVED).length;
    const reviewCount = recentTasks.filter(t => t.auditPhase === 'REVIEW_AND_CONCLUSION' && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.ARCHIVED).length;
    const activeCount = recentTasks.filter(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.ARCHIVED).length;

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
            <div className="flex flex-wrap gap-1.5">
                <button
                    onClick={() => setFilterStatus('active')}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
                    style={{
                        background: filterStatus === 'active' ? 'var(--accent-dim)' : 'var(--bg-surface)',
                        borderColor: filterStatus === 'active' ? 'var(--border-accent)' : 'var(--border)',
                        color: filterStatus === 'active' ? 'var(--accent)' : 'var(--text-muted)'
                    }}
                >
                    Active · <span className="tabular-nums font-semibold">{activeCount}</span>
                </button>
                {overdueCount > 0 && (
                    <button
                        onClick={() => setFilterStatus('overdue')}
                        className="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
                        style={{
                            background: filterStatus === 'overdue' ? 'rgba(224,112,122,0.15)' : 'rgba(224,112,122,0.08)',
                            borderColor: 'rgba(224,112,122,0.3)',
                            color: 'var(--color-danger)'
                        }}
                    >
                        Overdue · <span className="tabular-nums font-semibold">{overdueCount}</span>
                    </button>
                )}
                {reviewCount > 0 && (
                    <button
                        onClick={() => setFilterStatus('review')}
                        className="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
                        style={{
                            background: filterStatus === 'review' ? 'rgba(106,163,217,0.15)' : 'rgba(106,163,217,0.08)',
                            borderColor: 'rgba(106,163,217,0.3)',
                            color: 'var(--color-info)'
                        }}
                    >
                        Review · <span className="tabular-nums font-semibold">{reviewCount}</span>
                    </button>
                )}
                <button
                    onClick={() => setFilterStatus('all')}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
                    style={{
                        background: filterStatus === 'all' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                        borderColor: filterStatus === 'all' ? 'var(--border-mid)' : 'var(--border)',
                        color: filterStatus === 'all' ? 'var(--text-heading)' : 'var(--text-muted)'
                    }}
                >
                    All · <span className="tabular-nums font-semibold">{recentTasks.length}</span>
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={13} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    placeholder="Search tasks or clients..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-[var(--radius-md)] pl-8 pr-3 py-1.5 text-xs outline-none border transition-colors"
                    style={{ background: 'var(--bg-main)', borderColor: 'var(--border-mid)', color: 'var(--text-heading)' }}
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
                                className="rounded-[var(--radius-md)] border transition-colors duration-150 overflow-hidden"
                                style={{
                                    borderColor: isOverdue ? 'rgba(224,112,122,0.3)' : 'var(--border)',
                                    background: isOverdue ? 'rgba(224,112,122,0.04)' : 'var(--bg-surface)'
                                }}
                            >
                                <div
                                    className="flex items-center gap-2.5 p-2.5 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priority.dot}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-semibold truncate leading-tight" style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--text-heading)' }}>
                                                {task.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {dueStr && (
                                                    <span className="text-[11px] font-medium tabular-nums" style={{ color: isOverdue ? 'var(--color-danger)' : daysUntilDue !== null && daysUntilDue <= 3 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                                                        {isOverdue ? `${Math.abs(daysUntilDue!)}d ago` : dueStr}
                                                    </span>
                                                )}
                                                {isExpanded ? <ChevronUp size={12} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={12} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[11px] font-normal truncate" style={{ color: 'var(--text-muted)' }}>{task.clientName || 'Internal'}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>·</span>
                                            <span className="text-[11px] font-medium" style={{ color: status.color }}>{status.label}</span>
                                            {assigneeNames && (
                                                <>
                                                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                                                    <User size={10} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                                                    <span className="text-[11px] font-normal truncate" style={{ color: 'var(--text-muted)' }}>{assigneeNames}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-3 pb-2.5 pt-0 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                                        <div className="flex flex-wrap gap-1.5 pt-2">
                                            <span className="text-[10px] px-2 py-0.5 rounded-[var(--radius-sm)] border font-semibold" style={{ color: priority.text, borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
                                                {priority.label}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-[var(--radius-sm)] border font-semibold" style={{ color: status.color, borderColor: 'var(--border)', background: status.bg }}>
                                                {status.label}
                                            </span>
                                            {task.subtasks && task.subtasks.length > 0 && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-[var(--radius-sm)] border tabular-nums" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                                    {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} subtasks
                                                </span>
                                            )}
                                        </div>
                                        {task.description && (
                                            <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{task.description}</p>
                                        )}
                                        {(task.assignedTo || []).length > 0 && (
                                            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <User size={11} strokeWidth={1.75} />
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
