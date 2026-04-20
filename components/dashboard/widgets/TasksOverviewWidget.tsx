import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckSquare, AlertTriangle, Clock, Zap, Flag,
    ChevronDown, ChevronUp, Search, ArrowRight, User,
    LayoutGrid, UserCheck
} from 'lucide-react';
import { Task, TaskStatus, UserRole } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

interface TasksOverviewWidgetProps {
    recentTasks?: Task[];
    userMap?: Record<string, { displayName: string }>;
    isLoading?: boolean;
}

const PRIORITY_WEIGHT: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const getPriorityConfig = (priority: string) => {
    switch (priority) {
        case 'URGENT': return { dot: 'bg-red-500 animate-pulse', text: 'text-red-500', label: 'Urgent', icon: Zap };
        case 'HIGH': return { dot: 'bg-amber-500', text: 'text-amber-500', label: 'High', icon: AlertTriangle };
        case 'MEDIUM': return { dot: 'bg-amber-500', text: 'text-amber-500', label: 'Medium', icon: Clock };
        default: return { dot: 'bg-slate-400', text: 'text-slate-400', label: 'Low', icon: Flag };
    }
};

const getStatusConfig = (status: string) => {
    switch (status) {
        case TaskStatus.IN_PROGRESS: return { label: 'In Progress', color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500/10 border-brand-500/20' };
        case TaskStatus.COMPLETED: return { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
        case TaskStatus.ARCHIVED: return { label: 'Archived', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
        default: return { label: 'Not Started', color: 'text-slate-500 dark:text-gray-500', bg: 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10' };
    }
};

const TasksOverviewWidget: React.FC<TasksOverviewWidgetProps> = ({ recentTasks = [], userMap = {}, isLoading }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState<'MY' | 'ALL'>(user?.role === UserRole.STAFF ? 'MY' : 'ALL');
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('active');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER;
    const now = new Date();

    const baseTasksForView = useMemo(() => {
        let base = recentTasks.filter(t => t.status !== TaskStatus.ARCHIVED);
        if (viewMode === 'MY' && user) {
            base = base.filter(t => t.assignedTo.includes(user.uid));
        }
        return base;
    }, [recentTasks, viewMode, user]);

    // ── Filter & Sort Logic ───────────────────────────────────────────────
    const filteredTasks = useMemo(() => {
        let base = baseTasksForView.filter(t => {
            if (filterStatus === 'active') return t.status !== TaskStatus.COMPLETED;
            if (filterStatus === 'overdue') return t.dueDate && new Date(t.dueDate + 'T00:00:00') < now && t.status !== TaskStatus.COMPLETED;
            if (filterStatus === 'review') return t.auditPhase === 'REVIEW_AND_CONCLUSION' && t.status !== TaskStatus.COMPLETED;
            return true; // 'all' (excluding archived)
        });

        // Search Filter
        if (search) {
            const q = search.toLowerCase();
            base = base.filter(t => 
                t.title.toLowerCase().includes(q) || 
                (t.clientName || '').toLowerCase().includes(q)
            );
        }

        // Sort
        return base.sort((a, b) => {
            const aOverdue = a.dueDate && new Date(a.dueDate + 'T00:00:00') < now ? 1 : 0;
            const bOverdue = b.dueDate && new Date(b.dueDate + 'T00:00:00') < now ? 1 : 0;
            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
            return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        });
    }, [baseTasksForView, filterStatus, search, now]);

    // Counts for pills
    const activeCount = baseTasksForView.filter(t => t.status !== TaskStatus.COMPLETED).length;
    const overdueCount = baseTasksForView.filter(t => t.dueDate && new Date(t.dueDate + 'T00:00:00') < now && t.status !== TaskStatus.COMPLETED).length;
    const reviewCount = baseTasksForView.filter(t => t.auditPhase === 'REVIEW_AND_CONCLUSION' && t.status !== TaskStatus.COMPLETED).length;
    const allCount = baseTasksForView.length;

    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="h-10 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── Mode Toggle (Header Tabs) ── */}
            {isAdmin && (
                <div className="flex bg-slate-100 dark:bg-brand-950/20 p-1 rounded-xl border border-slate-200 dark:border-brand-500/20 shadow-inner">
                    <button
                        onClick={() => setViewMode('ALL')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                            viewMode === 'ALL' 
                                ? 'bg-white dark:bg-brand-500 text-brand-600 dark:text-white shadow-md shadow-brand-900/10' 
                                : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-brand-400'
                        }`}
                    >
                        <LayoutGrid size={14} /> All Tasks
                    </button>
                    <button
                        onClick={() => setViewMode('MY')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                            viewMode === 'MY' 
                                ? 'bg-white dark:bg-brand-500 text-brand-600 dark:text-white shadow-md shadow-brand-900/10' 
                                : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-brand-400'
                        }`}
                    >
                        <UserCheck size={14} /> My Tasks
                    </button>
                </div>
            )}

            {/* ── Summary Pills ── */}
            <div className="flex flex-wrap gap-1.5">
                <button
                    onClick={() => setFilterStatus('active')}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${filterStatus === 'active' ? 'bg-brand-500/20 border-brand-500/30 text-brand-600 dark:text-brand-300 shadow-[0_0_12px_rgba(101,154,43,0.1)]' : 'bg-slate-50 dark:bg-brand-950/20 border-slate-200 dark:border-brand-500/10 text-slate-500 dark:text-gray-500'}`}
                >
                    Active · {activeCount}
                </button>
                {overdueCount > 0 && (
                    <button
                        onClick={() => setFilterStatus('overdue')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all ${filterStatus === 'overdue' ? 'ring-1 ring-rose-500/50' : ''}`}
                    >
                        ⚠ Overdue · {overdueCount}
                    </button>
                )}
                {reviewCount > 0 && (
                    <button
                        onClick={() => setFilterStatus('review')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-all ${filterStatus === 'review' ? 'ring-1 ring-indigo-500/50' : ''}`}
                    >
                        Review · {reviewCount}
                    </button>
                )}
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${filterStatus === 'all' ? 'bg-slate-200 dark:bg-white/15 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-500'}`}
                >
                    All · {allCount}
                </button>
            </div>

            {/* ── Search ── */}
            <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-500/40" />
                <input
                    type="text"
                    placeholder={`Search ${viewMode === 'MY' ? 'your' : 'all'} tasks...`}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-brand-950/30 border border-slate-200 dark:border-brand-500/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-brand-500/40 focus:ring-2 focus:ring-brand-500/5 transition-all"
                />
            </div>

            {/* ── Task List ── */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-gray-600">
                        <CheckSquare size={32} className="mb-3 opacity-20" />
                        <p className="text-xs font-medium italic">No matching tasks found</p>
                    </div>
                ) : (
                    filteredTasks.slice(0, 15).map(task => {
                        const priority = getPriorityConfig(task.priority);
                        const status = getStatusConfig(task.status);
                        const isOverdue = task.dueDate && new Date(task.dueDate + 'T00:00:00') < now && task.status !== TaskStatus.COMPLETED;
                        const isExpanded = expandedId === task.id;
                        
                        return (
                            <div
                                key={task.id}
                                className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${
                                    isOverdue 
                                        ? 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40' 
                                        : 'border-slate-100 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:border-brand-500/30 dark:hover:bg-white/[0.05]'
                                }`}
                            >
                                <div
                                    className="p-3 cursor-pointer flex items-center gap-3"
                                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priority.dot}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className={`text-[13px] font-bold truncate leading-tight ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-gray-200'}`}>
                                                {task.title}
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                {task.dueDate && (
                                                    <span className={`text-[10px] font-bold ${isOverdue ? 'text-rose-500' : 'text-slate-400 dark:text-gray-600'}`}>
                                                        {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                )}
                                                {isExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-gray-500 truncate uppercase tracking-tight">{task.clientName || 'Internal'}</span>
                                            <span className="text-[10px] text-slate-300 dark:text-gray-700">·</span>
                                            <span className={`text-[10px] font-bold ${status.color} uppercase tracking-tighter`}>{status.label}</span>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-3 pb-3 pt-1 border-t border-slate-50 dark:border-white/5 space-y-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className={`text-[9px] px-2 py-0.5 rounded border font-black uppercase tracking-widest ${priority.text} bg-white dark:bg-white/5 border-slate-200 dark:border-white/10`}>
                                                {priority.label}
                                            </span   >
                                            <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-widest ${status.bg} ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                        {task.description && (
                                            <p className="text-[11px] text-slate-600 dark:text-gray-500 leading-relaxed italic line-clamp-2">"{task.description}"</p>
                                        )}
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                {task.assignedTo.slice(0, 3).map(uid => (
                                                    <div key={uid} className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-[8px] font-black text-brand-600 dark:text-brand-400 ring-2 ring-white dark:ring-[#161b22]">
                                                        {userMap[uid]?.displayName?.[0] || 'U'}
                                                    </div>
                                                ))}
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/tasks?taskId=${task.id}`);
                                                }}
                                                className="flex items-center gap-1 text-[10px] font-bold text-brand-500 hover:text-brand-600 transition-colors"
                                            >
                                                Details <ArrowRight size={10} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── View All Link ── */}
            <button
                onClick={() => navigate(viewMode === 'MY' ? '/tasks?boardMode=MY' : '/tasks')}
                className="w-full py-3 bg-slate-50 dark:bg-white/5 hover:bg-brand-500 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 border border-slate-200 dark:border-white/10 group flex items-center justify-center gap-2"
            >
                Manage all {viewMode === 'MY' ? 'personal' : 'firm'} tasks
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
    );
};

export default TasksOverviewWidget;
