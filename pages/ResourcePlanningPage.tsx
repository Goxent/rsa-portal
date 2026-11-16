import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Task, UserProfile, TaskStatus } from '../types';
import {
    LayoutDashboard, AlertTriangle, CheckCircle2, Clock, Briefcase,
    Loader2, ChevronDown, ChevronUp, Search, Users, Zap,
    TrendingUp, Filter, X, ExternalLink, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUsers } from '../hooks/useStaff';
import { useTasks } from '../hooks/useTasks';
import StaffCapacityHeatmap from '../components/resource-planning/StaffCapacityHeatmap';
import ReassignModal from '../components/resource-planning/ReassignModal';
import { AuthService } from '../services/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StaffWorkload {
    uid: string;
    name: string;
    totalTasks: number;
    estimatedWorkdays: number;
    highRisk: number;
    overdue: number;
    inProgress: number;
    tasks: Task[];
}

type SortKey = 'totalTasks' | 'highRisk' | 'overdue' | 'name';
type FilterKey = 'all' | 'overloaded' | 'free' | 'atrisk';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getCapacityLevel = (count: number) => {
    if (count === 0) {
        return {
            label: 'Free',
            dot: 'bg-[var(--color-success)]',
            text: 'text-[var(--color-success)]',
            bg: 'bg-[rgba(79,178,134,0.1)]',
            border: 'border-[rgba(79,178,134,0.25)]'
        };
    }
    
    const intensity = Math.min(Math.ceil(count / 2), 4);
    const configs = [
        { label: 'Light', dot: 'bg-[var(--accent)]', text: 'text-[var(--accent)]', bg: 'bg-[var(--accent-dim)]', border: 'border-[var(--border-accent)]' },
        { label: 'Moderate', dot: 'bg-[var(--accent)]', text: 'text-[var(--accent)]', bg: 'bg-[var(--accent-dim)]', border: 'border-[var(--border-accent)]' },
        { label: 'Steady', dot: 'bg-[var(--color-warning)]', text: 'text-[var(--color-warning)]', bg: 'bg-[rgba(217,164,65,0.1)]', border: 'border-[rgba(217,164,65,0.25)]' },
        { label: 'Heavy', dot: 'bg-[var(--color-danger)]', text: 'text-[var(--color-danger)]', bg: 'bg-[rgba(224,112,122,0.1)]', border: 'border-[rgba(224,112,122,0.25)]' },
        { label: 'Critical', dot: 'bg-[var(--color-danger)]', text: 'text-[var(--color-danger)]', bg: 'bg-[rgba(224,112,122,0.15)]', border: 'border-[rgba(224,112,122,0.3)]' },
    ];
    
    return configs[intensity] || configs[4];
};

const getPriorityStyle = (priority?: string) => {
    if (priority === 'HIGH') return 'bg-[rgba(224,112,122,0.1)] text-[var(--color-danger)] border-[rgba(224,112,122,0.25)]';
    if (priority === 'MEDIUM') return 'bg-[rgba(217,164,65,0.1)] text-[var(--color-warning)] border-[rgba(217,164,65,0.25)]';
    return 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)]';
};

const getStatusStyle = (status: string) => {
    if (status === TaskStatus.IN_PROGRESS) return 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--border-accent)]';
    if (status === TaskStatus.UNDER_REVIEW) return 'bg-[rgba(106,163,217,0.1)] text-[var(--color-info)] border-[rgba(106,163,217,0.25)]';
    return 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)]';
};

// ─── Staff Card ───────────────────────────────────────────────────────────────
const StaffCard: React.FC<{
    staff: StaffWorkload;
    maxDays: number;
    sprintCapacity: number;
    isSelected: boolean;
    onSelect: () => void;
}> = ({ staff, maxDays, sprintCapacity, isSelected, onSelect }) => {
    const cap = getCapacityLevel(staff.totalTasks);
    const sprintPct = Math.min((staff.estimatedWorkdays / Math.max(sprintCapacity, 1)) * 100, 100);
    const sprintColor = sprintPct >= 100 ? 'var(--color-danger)' : sprintPct >= 70 ? 'var(--color-warning)' : 'var(--color-success)';
    const initials = staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    // 4-Week Timeline Logic
    const weekLoads = useMemo(() => {
        const loads = [0, 0, 0, 0];
        const today = new Date();
        
        staff.tasks.forEach(t => {
            if (!t.dueDate) return;
            const due = new Date(t.dueDate);
            const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
            const weekIndex = Math.floor(diffDays / 7);
            if (weekIndex >= 0 && weekIndex < 4) {
                loads[weekIndex]++;
            }
        });
        return loads;
    }, [staff.tasks]);

    return (
        <div
            onClick={onSelect}
            className={`relative group rounded-xl border p-4 cursor-pointer transition-colors duration-150
                ${isSelected
                    ? 'bg-[var(--accent-dim)] border-[var(--border-accent)] ring-1 ring-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--border-mid)]'
                }`}
        >
            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--accent)]" />
            )}

            <div className="flex items-start gap-3.5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--text-heading)]">
                        {initials}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-surface)] ${cap.dot}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                        <h3 className="font-semibold text-[var(--text-heading)] text-sm truncate">{staff.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${cap.bg} ${cap.border} ${cap.text}`}>
                            {cap.label}
                        </span>
                    </div>

                    {/* Workload summary */}
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-[var(--text-heading)] font-semibold tabular-nums">{staff.estimatedWorkdays} days estimated</span>
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">({staff.totalTasks} tasks)</span>
                    </div>

                    {/* Sprint capacity progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-[var(--border)] my-2 overflow-hidden" title={`${Math.round(sprintPct)}% of sprint capacity`}>
                        <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${sprintPct}%`, backgroundColor: sprintColor }}
                        />
                    </div>

                    {/* 4-Week Timeline View */}
                    <div className="flex gap-1 h-1.5 mb-1">
                        {weekLoads.map((load, i) => (
                            <div 
                                key={i} 
                                className="flex-1 rounded-full bg-[var(--border)] overflow-hidden relative"
                                title={`Week ${i+1}: ${load} tasks`}
                            >
                                <div 
                                    className="h-full transition-all duration-300 bg-[var(--accent)]"
                                    style={{ opacity: load === 0 ? 0 : Math.min(0.3 + (load * 0.2), 1) }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Risk indicators */}
            {(staff.highRisk > 0 || staff.overdue > 0) && (
                <div className="flex gap-3 mt-3 pt-2.5 border-t border-[var(--border)]">
                    {staff.overdue > 0 && (
                        <div className="flex items-center gap-1 text-xs text-[var(--color-danger)] font-medium tabular-nums">
                            <Clock size={12} />
                            <span>{staff.overdue} overdue</span>
                        </div>
                    )}
                    {staff.highRisk > 0 && (
                        <div className="flex items-center gap-1 text-xs text-[var(--color-warning)] font-medium tabular-nums">
                            <Zap size={12} />
                            <span>{staff.highRisk} at risk</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Task Card ────────────────────────────────────────────────────────────────
const TaskCard: React.FC<{ task: Task; onClick?: () => void; onReassign?: (e: React.MouseEvent) => void }> = ({ task, onClick, onReassign }) => {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
    const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

    return (
        <div
            onClick={onClick}
            className={`p-3.5 bg-[var(--bg-main)] rounded-lg border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors group relative ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${getPriorityStyle(task.priority)}`}>
                    {task.priority ? task.priority.charAt(0) + task.priority.slice(1).toLowerCase() : 'Low'}
                </span>
                <div className="flex items-center gap-2">
                    {onReassign && (
                        <button 
                            type="button"
                            onClick={onReassign}
                            className="p-1 rounded-md bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors opacity-0 group-hover:opacity-100"
                            title="Reassign task"
                        >
                            <Users size={12} />
                        </button>
                    )}
                    {dueDateStr && (
                        <span className={`flex items-center gap-1 text-[11px] tabular-nums ${isOverdue ? 'text-[var(--color-danger)] font-medium' : 'text-[var(--text-muted)]'}`}>
                            <Clock size={11} />
                            {isOverdue ? 'Overdue · ' : ''}{dueDateStr}
                        </span>
                    )}
                </div>
            </div>
            <h4 className="font-medium text-[var(--text-heading)] text-sm mb-1 leading-snug">{task.title}</h4>
            <p className="text-xs text-[var(--text-muted)] mb-2.5 truncate">{task.clientName || 'Internal'}</p>
            <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-md border ${getStatusStyle(task.status)}`}>
                    {task.status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                </span>
                {task.riskLevel === 'HIGH' && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--color-warning)] font-medium">
                        <Zap size={11} /> High risk
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ResourcePlanningPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();

    const { data: users = [], isLoading: usersLoading } = useUsers();
    const { data: tasks = [], isLoading: tasksLoading } = useTasks();
    const loading = usersLoading || tasksLoading;

    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [selectedDept, setSelectedDept] = useState<string>('All');
    const [reassignTarget, setReassignTarget] = useState<Task | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortAsc, setSortAsc] = useState(true);
    const [filter, setFilter] = useState<FilterKey>('all');
    const [search, setSearch] = useState('');
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [overloadThreshold, setOverloadThreshold] = useState(5);
    const [sprintCapacity, setSprintCapacity] = useState(10);

    const workloadData: StaffWorkload[] = useMemo(() => {
        return users.map(user => {
            const userTasks = tasks.filter(t =>
                t.assignedTo.includes(user.uid) &&
                t.status !== TaskStatus.COMPLETED &&
                t.status !== TaskStatus.HALTED
            );
            const estimatedWorkdays = userTasks.reduce((sum, t) => sum + ((t as any).estimatedDays || 1), 0);
            return {
                uid: user.uid,
                name: user.displayName || 'Unknown',
                totalTasks: userTasks.length,
                estimatedWorkdays,
                highRisk: userTasks.filter(t => t.riskLevel === 'HIGH').length,
                overdue: userTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length,
                inProgress: userTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
                tasks: userTasks,
            };
        });
    }, [users, tasks]);

    const activeTasks = tasks.filter(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.HALTED);
    const overloadedCount = workloadData.filter(d => d.estimatedWorkdays >= sprintCapacity).length;
    const freeCount = workloadData.filter(d => d.totalTasks === 0).length;
    const totalOverdue = workloadData.reduce((sum, d) => sum + d.overdue, 0);
    const totalHighRisk = workloadData.reduce((sum, d) => sum + d.highRisk, 0);

    const deadlinesThisWeek = tasks.filter(t => {
        if (!t.dueDate || t.status === TaskStatus.COMPLETED) return false;
        const due = new Date(t.dueDate);
        const today = new Date();
        const endOfWeek = new Date();
        endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
        return due >= today && due <= endOfWeek;
    }).length;

    const deadlinesNextWeek = tasks.filter(t => {
        if (!t.dueDate || t.status === TaskStatus.COMPLETED) return false;
        const due = new Date(t.dueDate);
        const today = new Date();
        const startOfNextWeek = new Date();
        startOfNextWeek.setDate(today.getDate() + (8 - today.getDay()));
        const endOfNextWeek = new Date();
        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
        return due >= startOfNextWeek && due <= endOfNextWeek;
    }).length;

    const filteredData = useMemo(() => {
        let data = [...workloadData];
        if (filter === 'overloaded') data = data.filter(d => d.estimatedWorkdays >= sprintCapacity);
        else if (filter === 'free') data = data.filter(d => d.totalTasks === 0);
        else if (filter === 'atrisk') data = data.filter(d => d.highRisk > 0 || d.overdue > 0);

        if (selectedDept !== 'All') {
            data = data.filter(d => {
                const user = users.find(u => u.uid === d.uid);
                return user?.department === selectedDept;
            });
        }

        if (search.trim()) data = data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

        data.sort((a, b) => {
            let diff = 0;
            if (sortKey === 'name') diff = a.name.localeCompare(b.name);
            else diff = (a[sortKey] as number) - (b[sortKey] as number);
            return sortAsc ? diff : -diff;
        });
        return data;
    }, [workloadData, filter, search, sortKey, sortAsc, selectedDept, sprintCapacity, users]);

    const maxDays = Math.max(...workloadData.map(d => d.estimatedWorkdays), 1);
    const selectedStaff = workloadData.find(d => d.uid === selectedUser);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(p => !p);
        else { setSortKey(key); setSortAsc(false); }
    };

    const handleReassign = async (targetUserId: string) => {
        if (!reassignTarget || !selectedUser) return;
        try {
            const newAssignedTo = reassignTarget.assignedTo.filter(uid => uid !== selectedUser);
            if (!newAssignedTo.includes(targetUserId)) {
                newAssignedTo.push(targetUserId);
            }

            await AuthService.updateTask(reassignTarget.id!, { assignedTo: newAssignedTo });
            toast.success(`Task reassigned to ${users.find(u => u.uid === targetUserId)?.displayName}`);
            setReassignTarget(null);
        } catch (error) {
            console.error("Reassign error:", error);
            toast.error("Failed to reassign task");
        }
    };

    const SortIcon = ({ k }: { k: SortKey }) => (
        sortKey === k
            ? (sortAsc ? <ChevronUp size={12} className="text-[var(--accent)]" /> : <ChevronDown size={12} className="text-[var(--accent)]" />)
            : <ChevronDown size={12} className="text-[var(--text-subtle)]" />
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Loading resource data...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-[var(--text-heading)] tracking-tight">
                        Resource planning
                    </h1>
                    <p className="text-[var(--text-muted)] text-xs mt-0.5">Team capacity, workload balance, and task distribution</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowHeatmap(p => !p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        showHeatmap 
                        ? 'bg-[var(--accent-dim)] border-[var(--border-accent)] text-[var(--accent)]' 
                        : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                    }`}
                >
                    <TrendingUp size={13} />
                    {showHeatmap ? 'Hide' : 'Show'} heatmap
                </button>
            </div>

            {/* ── KPI Summary Bar ── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    {
                        icon: <Users size={15} className="text-[var(--accent)]" />,
                        value: users.length,
                        label: 'Team members',
                        sub: `${freeCount} available`,
                    },
                    {
                        icon: <Briefcase size={15} className="text-[var(--color-info)]" />,
                        value: activeTasks.length,
                        label: 'Active tasks',
                        sub: `${workloadData.length > 0 ? (activeTasks.length / workloadData.length).toFixed(1) : 0} avg / member`,
                    },
                    {
                        icon: <AlertTriangle size={15} className={overloadedCount > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'} />,
                        value: overloadedCount,
                        label: 'Overloaded',
                        sub: overloadedCount > 0 ? 'Action needed' : 'All balanced',
                    },
                    {
                        icon: <Clock size={15} className={totalOverdue > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--text-muted)]'} />,
                        value: totalOverdue,
                        label: 'Overdue tasks',
                        sub: `${totalHighRisk} high risk`,
                    },
                    {
                        icon: <Calendar size={15} className="text-[var(--accent)]" />,
                        value: deadlinesThisWeek,
                        label: 'Due this week',
                        sub: `${deadlinesNextWeek} due next week`,
                    },
                ].map((kpi, i) => (
                    <div key={i} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4">
                        <div className="flex items-center justify-between mb-2">
                            {kpi.icon}
                            <span className="text-xs text-[var(--text-muted)]">{kpi.label}</span>
                        </div>
                        <div className="font-display text-2xl font-semibold text-[var(--text-heading)] tabular-nums">{kpi.value}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Heatmap ── */}
            {showHeatmap && (
                <div className="h-[420px]">
                    <StaffCapacityHeatmap users={selectedDept === 'All' ? users : users.filter(u => u.department === selectedDept)} tasks={tasks} />
                </div>
            )}

            {/* ── Main Content: Staff Grid + Drilldown ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Staff Grid */}
                <div className={`${selectedUser ? 'xl:col-span-2' : 'xl:col-span-3'} space-y-4`}>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[180px]">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search staff..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-heading)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--border-accent)] transition-colors"
                            />
                            {search && (
                                <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)]">
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Filter pills */}
                        <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-1">
                            {([
                                { key: 'all', label: 'All' },
                                { key: 'overloaded', label: `Overloaded (≥${overloadThreshold})` },
                                { key: 'atrisk', label: 'At risk' },
                                { key: 'free', label: 'Free' },
                            ] as { key: FilterKey; label: string }[]).map(f => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFilter(f.key)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                        filter === f.key 
                                        ? 'bg-[var(--accent)] text-[var(--on-accent)]' 
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Overload threshold control */}
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <span className="whitespace-nowrap">Overload at:</span>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={overloadThreshold}
                                onChange={e => setOverloadThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-12 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md text-xs text-center text-[var(--text-heading)] py-1 tabular-nums focus:outline-none focus:border-[var(--border-accent)]"
                            />
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Filter size={11} />
                            <span>Sort:</span>
                            {([
                                { key: 'name', label: 'Name' },
                                { key: 'totalTasks', label: 'Tasks' },
                                { key: 'overdue', label: 'Overdue' },
                                { key: 'highRisk', label: 'Risk' },
                            ] as { key: SortKey; label: string }[]).map(s => (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => handleSort(s.key)}
                                    className={`flex items-center gap-0.5 px-2 py-1 rounded-md transition-colors ${
                                        sortKey === s.key ? 'text-[var(--accent)] bg-[var(--accent-dim)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                                    }`}
                                >
                                    {s.label} <SortIcon k={s.key} />
                                </button>
                            ))}
                        </div>

                        {/* Department Tabs */}
                        <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-1 overflow-x-auto">
                            {['All', 'Audit', 'Tax', 'Admin', 'Consulting', 'R. Sapkota & Associates'].map(dept => (
                                <button
                                    key={dept}
                                    type="button"
                                    onClick={() => setSelectedDept(dept)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                                        selectedDept === dept ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                                    }`}
                                >
                                    {dept}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cards Grid */}
                    {filteredData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-[var(--text-muted)]">
                            <Users size={32} className="mb-2 opacity-30" />
                            <p className="text-sm">No staff match your filters</p>
                        </div>
                    ) : (
                        <div className={`grid gap-3 ${selectedUser ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                            {filteredData.map(staff => (
                                <StaffCard
                                    key={staff.uid}
                                    staff={staff}
                                    maxDays={maxDays}
                                    sprintCapacity={sprintCapacity}
                                    isSelected={selectedUser === staff.uid}
                                    onSelect={() => setSelectedUser(prev => prev === staff.uid ? null : staff.uid)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Drilldown Panel ── */}
                {selectedUser && selectedStaff && (
                    <div className="xl:col-span-1">
                        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4 sticky top-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--text-heading)]">
                                        {selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-[var(--text-heading)] text-sm">{selectedStaff.name}</h2>
                                        <p className="text-xs text-[var(--text-muted)] tabular-nums">{selectedStaff.totalTasks} active tasks</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedUser(null)}
                                    className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--accent-dim)] transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Mini stats */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {[
                                    { label: 'Total', value: selectedStaff.totalTasks, color: 'text-[var(--text-heading)]' },
                                    { label: 'Overdue', value: selectedStaff.overdue, color: selectedStaff.overdue > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--text-muted)]' },
                                    { label: 'High risk', value: selectedStaff.highRisk, color: selectedStaff.highRisk > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--text-muted)]' },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-[var(--bg-main)] rounded-lg p-2.5 text-center border border-[var(--border)]">
                                        <div className={`text-lg font-semibold tabular-nums ${stat.color}`}>{stat.value}</div>
                                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Task list */}
                            <h3 className="text-xs font-medium text-[var(--text-muted)] mb-2.5 flex items-center gap-1.5">
                                <Briefcase size={12} /> Assigned tasks
                            </h3>
                            {selectedStaff.tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
                                    <CheckCircle2 size={20} className="mb-1 text-[var(--color-success)]" />
                                    <p className="text-xs">No active tasks</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                                    {selectedStaff.tasks
                                        .sort((a, b) => {
                                            const aOverdue = a.dueDate && new Date(a.dueDate) < new Date() ? 1 : 0;
                                            const bOverdue = b.dueDate && new Date(b.dueDate) < new Date() ? 1 : 0;
                                            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
                                            const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                                            return (priorityOrder[a.priority || 'LOW'] || 2) - (priorityOrder[b.priority || 'LOW'] || 2);
                                        })
                                        .map(task => (
                                            <TaskCard 
                                                key={task.id} 
                                                task={task} 
                                                onClick={() => navigate(`/tasks?staff=${selectedUser}`)} 
                                                onReassign={(e) => { e.stopPropagation(); setReassignTarget(task); }}
                                            />
                                        ))
                                    }
                                </div>
                            )}
                            
                            {/* Navigate to full workflow view */}
                            <button
                                type="button"
                                onClick={() => navigate(`/tasks?staff=${selectedUser}`)}
                                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent-dim)] border border-[var(--border-accent)] text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors"
                            >
                                <ExternalLink size={13} /> View all in workflow
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Insights Footer ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Overloaded alert */}
                {overloadedCount > 0 && (
                    <div className="bg-[rgba(224,112,122,0.06)] border border-[rgba(224,112,122,0.25)] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2.5">
                            <AlertTriangle size={15} className="text-[var(--color-danger)]" />
                            <h3 className="font-semibold text-[var(--color-danger)] text-sm">Overloaded staff ({overloadedCount})</h3>
                        </div>
                        <div className="space-y-1.5">
                            {workloadData.filter(d => d.estimatedWorkdays >= sprintCapacity).map(d => (
                                <div key={d.uid} className="flex items-center justify-between text-xs">
                                    <span className="text-[var(--text-heading)] font-medium">{d.name}</span>
                                    <div className="flex items-center gap-3 text-[var(--text-muted)] tabular-nums">
                                        <span>{d.estimatedWorkdays} days</span>
                                        <span>{d.totalTasks} tasks</span>
                                        {d.overdue > 0 && <span className="text-[var(--color-danger)] font-medium">{d.overdue} overdue</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-2.5">Consider reassigning tasks from overloaded members to available staff.</p>
                    </div>
                )}

                {/* Available capacity */}
                {freeCount > 0 && (
                    <div className="bg-[rgba(79,178,134,0.06)] border border-[rgba(79,178,134,0.25)] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2.5">
                            <CheckCircle2 size={15} className="text-[var(--color-success)]" />
                            <h3 className="font-semibold text-[var(--color-success)] text-sm">Available capacity ({freeCount})</h3>
                        </div>
                        <div className="space-y-1.5">
                            {workloadData.filter(d => d.totalTasks === 0).map(d => (
                                <div key={d.uid} className="flex items-center justify-between text-xs">
                                    <span className="text-[var(--text-heading)] font-medium">{d.name}</span>
                                    <span className="text-[var(--color-success)] bg-[rgba(79,178,134,0.1)] px-2 py-0.5 rounded-md border border-[rgba(79,178,134,0.2)]">Ready to assign</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-2.5">These team members have no active tasks and can take on new work.</p>
                    </div>
                )}

                {/* Balanced state */}
                {overloadedCount === 0 && freeCount === 0 && (
                    <div className="md:col-span-2 bg-[rgba(79,178,134,0.06)] border border-[rgba(79,178,134,0.25)] rounded-xl p-4 flex items-center gap-3.5">
                        <CheckCircle2 size={24} className="text-[var(--color-success)] flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-[var(--text-heading)] text-sm mb-0.5">Team workload is well balanced</h3>
                            <p className="text-xs text-[var(--text-muted)]">All team members have active tasks and no one is overloaded.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Reassign Modal */}
            {reassignTarget && (
                <ReassignModal 
                    task={reassignTarget}
                    users={users}
                    onClose={() => setReassignTarget(null)}
                    onReassign={handleReassign}
                />
            )}
        </div>
    );
};

export default ResourcePlanningPage;
