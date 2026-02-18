import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { Task, User, TaskStatus } from '../types';
import {
    LayoutDashboard, AlertTriangle, CheckCircle2, Clock, Briefcase,
    Loader2, ChevronDown, ChevronUp, Search, Users, Zap,
    TrendingUp, TrendingDown, Filter, X, ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import StaffCapacityHeatmap from '../components/resource-planning/StaffCapacityHeatmap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StaffWorkload {
    uid: string;
    name: string;
    totalTasks: number;
    highRisk: number;
    overdue: number;
    inProgress: number;
    tasks: Task[];
}

type SortKey = 'totalTasks' | 'highRisk' | 'overdue' | 'name';
type FilterKey = 'all' | 'overloaded' | 'free' | 'atrisk';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getCapacityLevel = (count: number) => {
    if (count === 0) return { label: 'Free', color: 'emerald', bar: 'from-emerald-500 to-teal-400', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    if (count <= 2) return { label: 'Light', color: 'brand', bar: 'from-brand-500 to-indigo-400', dot: 'bg-brand-400', text: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/20' };
    if (count <= 4) return { label: 'Moderate', color: 'yellow', bar: 'from-yellow-400 to-amber-400', dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
    if (count <= 6) return { label: 'Heavy', color: 'orange', bar: 'from-orange-400 to-amber-500', dot: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
    return { label: 'Critical', color: 'red', bar: 'from-red-500 to-rose-500', dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
};

const getPriorityStyle = (priority?: string) => {
    if (priority === 'HIGH') return 'bg-red-500/10 text-red-300 border-red-500/20';
    if (priority === 'MEDIUM') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
};

const getStatusStyle = (status: string) => {
    if (status === TaskStatus.IN_PROGRESS) return 'bg-brand-500/10 text-brand-300 border-brand-500/20';
    if (status === TaskStatus.PENDING_REVIEW) return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

// ─── Staff Card ───────────────────────────────────────────────────────────────
const StaffCard: React.FC<{
    staff: StaffWorkload;
    maxTasks: number;
    isSelected: boolean;
    onSelect: () => void;
}> = ({ staff, maxTasks, isSelected, onSelect }) => {
    const cap = getCapacityLevel(staff.totalTasks);
    const barWidth = staff.totalTasks === 0 ? 3 : Math.min((staff.totalTasks / Math.max(maxTasks, 1)) * 100, 100);
    const initials = staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div
            onClick={onSelect}
            className={`relative group rounded-2xl border p-4 cursor-pointer transition-all duration-200 hover:scale-[1.01]
                ${isSelected
                    ? 'bg-brand-500/10 border-brand-500/40 shadow-lg shadow-brand-500/10'
                    : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15'
                }`}
        >
            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand-400 shadow-lg shadow-brand-400/50" />
            )}

            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-sm font-bold text-white shadow-lg">
                        {initials}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0a0f1e] shadow-md ${cap.dot}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                        <h3 className="font-semibold text-white text-sm truncate">{staff.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cap.bg} ${cap.border} ${cap.text}`}>
                            {cap.label}
                        </span>
                    </div>

                    {/* Task count + bar */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] text-gray-400">{staff.totalTasks} active task{staff.totalTasks !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r ${cap.bar} rounded-full transition-all duration-700`}
                            style={{ width: `${barWidth}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Risk indicators */}
            {(staff.highRisk > 0 || staff.overdue > 0) && (
                <div className="flex gap-3 mt-3 pt-3 border-t border-white/5">
                    {staff.overdue > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-red-400">
                            <Clock size={11} />
                            <span>{staff.overdue} overdue</span>
                        </div>
                    )}
                    {staff.highRisk > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                            <Zap size={11} />
                            <span>{staff.highRisk} high risk</span>
                        </div>
                    )}
                </div>
            )}

            {/* Click hint */}
            <div className={`absolute bottom-3 right-3 transition-all duration-200 ${isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                <ArrowUpRight size={14} className="text-gray-500" />
            </div>
        </div>
    );
};

// ─── Task Card ────────────────────────────────────────────────────────────────
const TaskCard: React.FC<{ task: Task }> = ({ task }) => {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
    const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

    return (
        <div className="p-4 bg-white/3 rounded-xl border border-white/8 hover:bg-white/6 hover:border-white/15 transition-all duration-150 group">
            <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold uppercase tracking-wide ${getPriorityStyle(task.priority)}`}>
                    {task.priority || 'LOW'}
                </span>
                {dueDateStr && (
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                        <Clock size={9} />
                        {isOverdue ? 'Overdue · ' : ''}{dueDateStr}
                    </span>
                )}
            </div>
            <h4 className="font-semibold text-white text-sm mb-1 leading-snug">{task.title}</h4>
            <p className="text-[11px] text-gray-500 mb-3 truncate">{task.clientName || 'Internal'}</p>
            <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-md border ${getStatusStyle(task.status)}`}>
                    {task.status.replace(/_/g, ' ')}
                </span>
                {task.riskLevel === 'HIGH' && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <Zap size={9} /> High Risk
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ResourcePlanningPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('totalTasks');
    const [sortAsc, setSortAsc] = useState(false);
    const [filter, setFilter] = useState<FilterKey>('all');
    const [search, setSearch] = useState('');
    const [showHeatmap, setShowHeatmap] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [fetchedUsers, fetchedTasks] = await Promise.all([
                    AuthService.getAllUsers(),
                    AuthService.getAllTasks()
                ]);
                setUsers(fetchedUsers);
                setTasks(fetchedTasks);
            } catch (error) {
                console.error('Failed to fetch resource data:', error);
                toast.error('Failed to load resource data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const workloadData: StaffWorkload[] = useMemo(() => {
        return users.map(user => {
            const userTasks = tasks.filter(t =>
                t.assignedTo.includes(user.uid) &&
                t.status !== TaskStatus.COMPLETED &&
                t.status !== TaskStatus.HALTED
            );
            return {
                uid: user.uid,
                name: user.displayName || 'Unknown',
                totalTasks: userTasks.length,
                highRisk: userTasks.filter(t => t.riskLevel === 'HIGH').length,
                overdue: userTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length,
                inProgress: userTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
                tasks: userTasks,
            };
        });
    }, [users, tasks]);

    const activeTasks = tasks.filter(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.HALTED);
    const overloadedCount = workloadData.filter(d => d.totalTasks >= 5).length;
    const freeCount = workloadData.filter(d => d.totalTasks === 0).length;
    const totalOverdue = workloadData.reduce((sum, d) => sum + d.overdue, 0);
    const totalHighRisk = workloadData.reduce((sum, d) => sum + d.highRisk, 0);

    const filteredData = useMemo(() => {
        let data = [...workloadData];
        // Filter
        if (filter === 'overloaded') data = data.filter(d => d.totalTasks >= 5);
        else if (filter === 'free') data = data.filter(d => d.totalTasks === 0);
        else if (filter === 'atrisk') data = data.filter(d => d.highRisk > 0 || d.overdue > 0);
        // Search
        if (search.trim()) data = data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
        // Sort
        data.sort((a, b) => {
            let diff = 0;
            if (sortKey === 'name') diff = a.name.localeCompare(b.name);
            else diff = (a[sortKey] as number) - (b[sortKey] as number);
            return sortAsc ? diff : -diff;
        });
        return data;
    }, [workloadData, filter, search, sortKey, sortAsc]);

    const maxTasks = Math.max(...workloadData.map(d => d.totalTasks), 1);
    const selectedStaff = workloadData.find(d => d.uid === selectedUser);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(p => !p);
        else { setSortKey(key); setSortAsc(false); }
    };

    const SortIcon = ({ k }: { k: SortKey }) => (
        sortKey === k
            ? (sortAsc ? <ChevronUp size={12} className="text-brand-400" /> : <ChevronDown size={12} className="text-brand-400" />)
            : <ChevronDown size={12} className="text-gray-600" />
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                <p className="text-sm text-gray-400">Loading resource data...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-brand-500/15 rounded-xl border border-brand-500/25">
                            <LayoutDashboard className="text-brand-400" size={20} />
                        </div>
                        Resource Planning
                    </h1>
                    <p className="text-gray-500 text-sm mt-1 ml-12">Team capacity · workload balance · task distribution</p>
                </div>
                <button
                    onClick={() => setShowHeatmap(p => !p)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${showHeatmap ? 'bg-brand-500/15 border-brand-500/30 text-brand-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    <TrendingUp size={15} />
                    {showHeatmap ? 'Hide' : 'Show'} Capacity Heatmap
                </button>
            </div>

            {/* ── KPI Summary Bar ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    {
                        icon: <Users size={16} className="text-brand-400" />,
                        value: users.length,
                        label: 'Team Members',
                        sub: `${freeCount} available`,
                        accent: 'border-brand-500/20 bg-brand-500/5',
                    },
                    {
                        icon: <Briefcase size={16} className="text-indigo-400" />,
                        value: activeTasks.length,
                        label: 'Active Tasks',
                        sub: `${workloadData.length > 0 ? (activeTasks.length / workloadData.length).toFixed(1) : 0} avg/person`,
                        accent: 'border-indigo-500/20 bg-indigo-500/5',
                    },
                    {
                        icon: <AlertTriangle size={16} className="text-red-400" />,
                        value: overloadedCount,
                        label: 'Overloaded',
                        sub: overloadedCount > 0 ? 'Needs attention' : 'All balanced',
                        accent: overloadedCount > 0 ? 'border-red-500/25 bg-red-500/8' : 'border-emerald-500/20 bg-emerald-500/5',
                    },
                    {
                        icon: <Clock size={16} className="text-amber-400" />,
                        value: totalOverdue,
                        label: 'Overdue Tasks',
                        sub: `${totalHighRisk} high risk`,
                        accent: totalOverdue > 0 ? 'border-amber-500/25 bg-amber-500/8' : 'border-emerald-500/20 bg-emerald-500/5',
                    },
                ].map((kpi, i) => (
                    <div key={i} className={`rounded-2xl border p-4 ${kpi.accent}`}>
                        <div className="flex items-center gap-2 mb-2">{kpi.icon}</div>
                        <div className="text-2xl font-bold text-white mb-0.5">{kpi.value}</div>
                        <div className="text-xs font-medium text-gray-300">{kpi.label}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Heatmap (collapsible) ── */}
            {showHeatmap && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                    <div className="glass-panel rounded-2xl border border-white/5 p-1 h-[420px]">
                        <StaffCapacityHeatmap users={users} tasks={tasks} />
                    </div>
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
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search staff..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50 transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Filter pills */}
                        <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl p-1">
                            {([
                                { key: 'all', label: 'All' },
                                { key: 'overloaded', label: '🔴 Overloaded' },
                                { key: 'atrisk', label: '⚠️ At Risk' },
                                { key: 'free', label: '🟢 Free' },
                            ] as { key: FilterKey; label: string }[]).map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.key ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Filter size={11} />
                            <span>Sort:</span>
                            {([
                                { key: 'totalTasks', label: 'Tasks' },
                                { key: 'overdue', label: 'Overdue' },
                                { key: 'highRisk', label: 'Risk' },
                                { key: 'name', label: 'Name' },
                            ] as { key: SortKey; label: string }[]).map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => handleSort(s.key)}
                                    className={`flex items-center gap-0.5 px-2 py-1 rounded-lg transition-all ${sortKey === s.key ? 'text-brand-400 bg-brand-500/10' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {s.label} <SortIcon k={s.key} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cards Grid */}
                    {filteredData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                            <Users size={32} className="mb-3 opacity-30" />
                            <p className="text-sm">No staff match your filters</p>
                        </div>
                    ) : (
                        <div className={`grid gap-3 ${selectedUser ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                            {filteredData.map(staff => (
                                <StaffCard
                                    key={staff.uid}
                                    staff={staff}
                                    maxTasks={maxTasks}
                                    isSelected={selectedUser === staff.uid}
                                    onSelect={() => setSelectedUser(prev => prev === staff.uid ? null : staff.uid)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Drilldown Panel ── */}
                {selectedUser && selectedStaff && (
                    <div className="xl:col-span-1 animate-in slide-in-from-right-4 duration-300">
                        <div className="glass-panel rounded-2xl border border-white/8 p-5 sticky top-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-sm font-bold text-white">
                                        {selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-white text-sm">{selectedStaff.name}</h2>
                                        <p className="text-[11px] text-gray-500">{selectedStaff.totalTasks} active tasks</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Mini stats */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {[
                                    { label: 'Total', value: selectedStaff.totalTasks, color: 'text-white' },
                                    { label: 'Overdue', value: selectedStaff.overdue, color: selectedStaff.overdue > 0 ? 'text-red-400' : 'text-gray-400' },
                                    { label: 'High Risk', value: selectedStaff.highRisk, color: selectedStaff.highRisk > 0 ? 'text-amber-400' : 'text-gray-400' },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                                        <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Task list */}
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Briefcase size={11} /> Assigned Tasks
                            </h3>
                            {selectedStaff.tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-600">
                                    <CheckCircle2 size={24} className="mb-2 text-emerald-500/50" />
                                    <p className="text-xs">No active tasks</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                                    {selectedStaff.tasks
                                        .sort((a, b) => {
                                            // Sort: overdue first, then high priority, then by due date
                                            const aOverdue = a.dueDate && new Date(a.dueDate) < new Date() ? 1 : 0;
                                            const bOverdue = b.dueDate && new Date(b.dueDate) < new Date() ? 1 : 0;
                                            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
                                            const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                                            return (priorityOrder[a.priority || 'LOW'] || 2) - (priorityOrder[b.priority || 'LOW'] || 2);
                                        })
                                        .map(task => <TaskCard key={task.id} task={task} />)
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Insights Footer ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Overloaded alert */}
                {overloadedCount > 0 && (
                    <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle size={16} className="text-red-400" />
                            <h3 className="font-bold text-red-200 text-sm">Overloaded Staff ({overloadedCount})</h3>
                        </div>
                        <div className="space-y-2">
                            {workloadData.filter(d => d.totalTasks >= 5).map(d => (
                                <div key={d.uid} className="flex items-center justify-between text-xs">
                                    <span className="text-red-300 font-medium">{d.name}</span>
                                    <div className="flex items-center gap-3 text-gray-400">
                                        <span>{d.totalTasks} tasks</span>
                                        {d.overdue > 0 && <span className="text-red-400">{d.overdue} overdue</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-red-400/70 mt-3">Consider reassigning tasks from overloaded members to available staff.</p>
                    </div>
                )}

                {/* Available capacity */}
                {freeCount > 0 && (
                    <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <h3 className="font-bold text-emerald-200 text-sm">Available Capacity ({freeCount})</h3>
                        </div>
                        <div className="space-y-2">
                            {workloadData.filter(d => d.totalTasks === 0).map(d => (
                                <div key={d.uid} className="flex items-center justify-between text-xs">
                                    <span className="text-emerald-300 font-medium">{d.name}</span>
                                    <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Ready to assign</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-emerald-400/70 mt-3">These team members have no active tasks and can take on new work.</p>
                    </div>
                )}

                {/* Balanced state */}
                {overloadedCount === 0 && freeCount === 0 && (
                    <div className="md:col-span-2 bg-brand-500/8 border border-brand-500/20 rounded-2xl p-4 flex items-center gap-4">
                        <CheckCircle2 size={32} className="text-brand-400 flex-shrink-0" />
                        <div>
                            <h3 className="font-bold text-brand-200 text-sm mb-0.5">Team Workload is Well Balanced</h3>
                            <p className="text-[12px] text-brand-400/70">All team members have active tasks and no one is overloaded. Great distribution!</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResourcePlanningPage;
