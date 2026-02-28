import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Phone, Briefcase, Clock as ClockIcon, Users, CheckSquare, Building2, CalendarDays, ArrowRight } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { UserProfile, Task, UserRole } from '../types';
import { useTheme } from '../context/ThemeContext';
import WidgetContainer from '../components/dashboard/WidgetContainer';
import AttendanceWidget from '../components/dashboard/AttendanceWidget';
import GreetingsWidget from '../components/dashboard/widgets/GreetingsWidget';
import FocusWidget from '../components/dashboard/widgets/FocusWidget';
import ComplianceBanner from '../components/dashboard/widgets/ComplianceBanner';
import WorkloadHeatmap from '../components/dashboard/widgets/WorkloadHeatmap';
import AiInsightWidget from '../components/dashboard/widgets/AiInsightWidget';
import { useTasks } from '../hooks/useTasks';
import { useUsers } from '../hooks/useStaff';
import { useClients } from '../hooks/useClients';
import { useEvents } from '../hooks/useEvents';
import { useAttendanceHistory } from '../hooks/useAttendance';
import { useQuery } from '@tanstack/react-query';
import NepaliDate from 'nepali-date-converter';

// Helper interface for the unified schedule list
interface ScheduleItem {
    id: string;
    title: string;
    date: string;
    type: 'EVENT' | 'DEADLINE';
    subType?: string;
    description?: string;
}

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    // ── Data Hooks ─────────────────────────────────────────────────────────
    const { data: allTasks = [], isLoading: tasksLoading } = useTasks();
    const { data: usersForMap = [], isLoading: usersLoading } = useUsers();
    const { data: allClients = [], isLoading: clientsLoading } = useClients();
    const { data: allEvents = [], isLoading: eventsLoading } = useEvents();
    const { data: attendanceHistory = [] } = useAttendanceHistory(user?.uid);

    const { data: lateCount = 0 } = useQuery({
        queryKey: ['lateCount', user?.uid],
        queryFn: () => user ? AuthService.getLateCountLast30Days(user.uid) : Promise.resolve(0),
        enabled: !!user,
        staleTime: 1000 * 60 * 60,
    });

    const isLoading = tasksLoading || usersLoading || eventsLoading || clientsLoading;

    // ── Derived Attendance State (for command strip) ───────────────────────

    // ── Computed Dashboard Data ────────────────────────────────────────────
    const {
        userMap,
        activeStaffCount,
        taskData,
        recentTasks,
        recentCompletedTasks,
        upcomingSchedule,
        relevantTasks,
        staffStats,
        clientStats,
        staffPerformance,
    } = useMemo(() => {
        if (!user) return {
            userMap: {}, activeStaffCount: 0, taskData: [], recentTasks: [],
            recentCompletedTasks: [], upcomingSchedule: [], relevantTasks: [],
            staffStats: { busy: [], free: [], byDepartment: {} },
            clientStats: { total: 0, active: 0, mySigned: 0, byService: {} },
            staffPerformance: { completed: 0, pending: 0, lateCount: 0 },
        };

        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN;

        const uMap: Record<string, UserProfile> = {};
        usersForMap.forEach(u => (uMap[u.uid] = u));

        const allUsers = isAdmin ? usersForMap : [user];
        const activeCount = isAdmin ? Math.floor(allUsers.length * 0.9) : 0;

        const relTasks = isAdmin ? allTasks : allTasks.filter(t => t.assignedTo.includes(user.uid));

        const statusCounts = { COMPLETED: 0, IN_PROGRESS: 0, UNDER_REVIEW: 0, NOT_STARTED: 0 };
        relTasks.forEach(t => {
            if (statusCounts[t.status as keyof typeof statusCounts] !== undefined)
                statusCounts[t.status as keyof typeof statusCounts]++;
        });

        const tData = [
            { name: 'Completed', value: statusCounts.COMPLETED },
            { name: 'In Progress', value: statusCounts.IN_PROGRESS },
            { name: 'Review', value: statusCounts.UNDER_REVIEW },
            { name: 'Pending', value: statusCounts.NOT_STARTED },
        ];

        const now = new Date();
        const sortedTasks = [...relTasks].sort((a, b) => {
            const aO = a.dueDate && new Date(a.dueDate) < now ? 1 : 0;
            const bO = b.dueDate && new Date(b.dueDate) < now ? 1 : 0;
            if (bO !== aO) return bO - aO;
            const pMap: Record<string, number> = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
            return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
        });
        const recTasks = isAdmin ? sortedTasks : sortedTasks.slice(0, 5);

        const recCompleted = [...relTasks]
            .filter(t => t.status === 'COMPLETED')
            .sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime())
            .slice(0, 10);

        const todayStr = now.toLocaleDateString('en-CA');
        const datePlus30 = new Date(now);
        datePlus30.setDate(datePlus30.getDate() + 30);
        const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        const cutoffDate = datePlus30 > endOfNextMonth ? datePlus30 : endOfNextMonth;
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        const futureEvents = allEvents
            .filter(e => e.date >= todayStr && e.date <= cutoffDateStr)
            .map(e => ({ id: e.id, title: e.title, date: e.date, type: 'EVENT' as const, subType: e.type, description: e.time }));

        const deadlineTasks = isAdmin ? allTasks : allTasks.filter(t => t.assignedTo.includes(user.uid));
        const futureDeadlines = deadlineTasks
            .filter(t => t.dueDate >= todayStr && t.dueDate <= cutoffDateStr && t.status !== 'COMPLETED')
            .map(t => ({ id: t.id, title: t.title, date: t.dueDate, type: 'DEADLINE' as const, subType: t.priority, description: t.clientName }));

        const mergedSchedule = [...futureEvents, ...futureDeadlines].sort((a, b) => a.date.localeCompare(b.date));

        const activeStaffList = allUsers.filter(u => u.status !== 'Inactive');
        const deptStats: Record<string, number> = {};
        activeStaffList.forEach(u => {
            const dept = u.department || 'Unassigned';
            deptStats[dept] = (deptStats[dept] || 0) + 1;
        });

        const sStats = { busy: [] as any[], free: [] as any[], byDepartment: deptStats };
        if (isAdmin) {
            const activeTasksList = allTasks.filter(t => t.status !== 'COMPLETED');
            const busyList: (UserProfile & { taskCount: number })[] = [];
            const freeList: UserProfile[] = [];
            const staffOnly = allUsers.filter(u => u.role !== UserRole.ADMIN && u.role !== UserRole.MASTER_ADMIN);
            staffOnly.forEach(u => {
                const uActive = activeTasksList.filter(t => t.assignedTo.includes(u.uid));
                if (uActive.length > 0) busyList.push({ ...u, taskCount: uActive.length });
                else freeList.push(u);
            });
            sStats.busy = busyList;
            sStats.free = freeList;
        }

        const myTasks = allTasks.filter(t => t.assignedTo.includes(user.uid));
        const sPerf = {
            completed: myTasks.filter(t => t.status === 'COMPLETED').length,
            pending: myTasks.filter(t => t.status !== 'COMPLETED').length,
            lateCount,
        };

        const activeClients = allClients.filter(c => c.status === 'Active');
        const mySignedClients = allClients.filter(c => c.signingAuthorityId === user.uid || c.signingAuthority === user.displayName);
        const serviceDist: Record<string, number> = {};
        activeClients.forEach(c => { serviceDist[c.serviceType] = (serviceDist[c.serviceType] || 0) + 1; });
        const cStats = { total: allClients.length, active: activeClients.length, mySigned: mySignedClients.length, byService: serviceDist };

        return {
            userMap: uMap, activeStaffCount: activeCount, taskData: tData,
            recentTasks: recTasks, recentCompletedTasks: recCompleted,
            upcomingSchedule: mergedSchedule, relevantTasks: relTasks,
            staffStats: sStats, clientStats: cStats, staffPerformance: sPerf,
        };
    }, [user, allTasks, usersForMap, allEvents, allClients, lateCount]);

    // Modal State for Staff Details
    const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);
    const [selectedStaffTasks, setSelectedStaffTasks] = useState<Task[]>([]);

    const dashboardData = {
        activeStaffCount, taskData, recentTasks, upcomingSchedule,
        staffStats, userMap, staffPerformance, clientStats,
        recentCompletedTasks, isLoading,
    };

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    // Command strip derived values
    const myOpenTasks = allTasks.filter(t => t.assignedTo.includes(user?.uid ?? '') && t.status !== 'COMPLETED').length;
    const todayStr = new Date().toLocaleDateString('en-CA');
    const completedToday = allTasks.filter(t =>
        t.assignedTo.includes(user?.uid ?? '') &&
        t.status === 'COMPLETED' &&
        (t.completedAt ?? '').startsWith(todayStr)
    ).length;
    const bsDate = useMemo(() => {
        try { return new NepaliDate(new Date()).format('DD MMMM YYYY'); }
        catch { return ''; }
    }, []);
    const adDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Next 7 days schedule for sidebar
    const next7Days = useMemo(() => {
        const today = new Date().toLocaleDateString('en-CA');
        const limit = new Date();
        limit.setDate(limit.getDate() + 7);
        const limitStr = limit.toLocaleDateString('en-CA');
        return upcomingSchedule.filter(i => i.date >= today && i.date <= limitStr).slice(0, 6);
    }, [upcomingSchedule]);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-5 h-full overflow-y-auto overflow-x-hidden pb-6 custom-scrollbar">

            {/* ── 1. COMMAND STRIP ──────────────────────────────────────── */}
            <div className="flex-none bg-white/[0.02] border border-white/[0.05] rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">

                {/* Left: Date */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <CalendarDays size={13} className="text-blue-400" />
                        <span className="font-medium text-white">{adDate}</span>
                        {bsDate && (
                            <>
                                <span className="text-gray-600">|</span>
                                <span className="text-gray-500">{bsDate} BS</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Center: Micro-stat pills */}
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-full text-xs font-bold text-gray-300 transition-all">
                        <CheckSquare size={11} className="text-blue-400" />
                        <span className="text-white tabular-nums">{relevantTasks.length}</span>
                        <span className="text-gray-500 font-normal">Total Tasks</span>
                    </button>
                    <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-full text-xs font-bold text-gray-300 transition-all">
                        <ClockIcon size={11} className="text-amber-400" />
                        <span className="text-white tabular-nums">{myOpenTasks}</span>
                        <span className="text-gray-500 font-normal">My Open</span>
                    </button>
                    <button onClick={() => navigate('/clients')} className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-full text-xs font-bold text-gray-300 transition-all">
                        <Building2 size={11} className="text-emerald-400" />
                        <span className="text-white tabular-nums">{allClients.length}</span>
                        <span className="text-gray-500 font-normal">Clients</span>
                    </button>
                    {isAdmin && (
                        <button onClick={() => navigate('/staff')} className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-full text-xs font-bold text-gray-300 transition-all">
                            <Users size={11} className="text-violet-400" />
                            <span className="text-white tabular-nums">{usersForMap.length}</span>
                            <span className="text-gray-500 font-normal">Staff</span>
                        </button>
                    )}
                </div>

                {/* Right: Day progress */}
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500/60 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(Math.max((new Date().getHours() / 17) * 100, 0), 100)}%` }}
                        />
                    </div>
                    <span className="text-gray-600 font-mono">
                        {Math.min(Math.max(Math.round(((new Date().getHours() - 9) / 8) * 100), 0), 100)}% of work day
                    </span>
                </div>
            </div>

            {/* ── 2. HERO ROW (60/40) ───────────────────────────────────── */}
            <div className="flex-none grid grid-cols-1 lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3">
                    <GreetingsWidget pendingCount={myOpenTasks} completedToday={completedToday} />
                </div>
                <div className="lg:col-span-2"><FocusWidget /></div>
            </div>

            {/* ── 3. MAIN CONTENT + RIGHT SIDEBAR ──────────────────────── */}
            <div className="flex gap-5 min-h-0">

                {/* Left: Widget Grid */}
                <div className="flex-1 min-w-0">
                    {user && (
                        <WidgetContainer
                            userId={user.uid}
                            dashboardData={dashboardData}
                            isAdmin={isAdmin}
                        />
                    )}
                </div>

                {/* Right: Sticky Sidebar */}
                <div className="w-[320px] flex-shrink-0 flex flex-col gap-4 sticky top-4 self-start">

                    {/* Compliance Banner (conditional) */}
                    {upcomingSchedule.filter(i => i.type === 'DEADLINE').length > 0 && (
                        <ComplianceBanner deadlines={upcomingSchedule.filter(i => i.type === 'DEADLINE')} />
                    )}

                    {/* ── Upcoming Panel ── */}
                    {(() => {
                        const getRelativeDate = (dateStr: string) => {
                            const today = new Date().toISOString().split('T')[0];
                            const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                            if (dateStr === today) return 'Today';
                            if (dateStr === tomorrow) return 'Tomorrow';
                            return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        };

                        const items = upcomingSchedule.slice(0, 8);

                        // Border color: blue = EVENT, red = URGENT deadline, amber = HIGH deadline, slate = rest
                        const getBorderColor = (item: ScheduleItem) => {
                            if (item.type === 'EVENT') return 'border-l-blue-500';
                            if (item.subType === 'URGENT') return 'border-l-red-500';
                            if (item.subType === 'HIGH') return 'border-l-amber-500';
                            return 'border-l-slate-600';
                        };

                        // Subtype pill colors
                        const getSubtypePill = (item: ScheduleItem) => {
                            if (item.type === 'EVENT') return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
                            if (item.subType === 'URGENT') return 'bg-red-500/10 border-red-500/20 text-red-400';
                            if (item.subType === 'HIGH') return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                            return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
                        };

                        return (
                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 space-y-3">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CalendarDays size={13} className="text-blue-400" />
                                        <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest">Upcoming</h3>
                                        <span className="text-[10px] font-bold bg-white/[0.06] border border-white/[0.08] text-gray-500 rounded-full px-1.5 py-0.5 tabular-nums">
                                            {upcomingSchedule.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Items */}
                                {items.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 gap-1">
                                        <span className="text-xl">🎉</span>
                                        <p className="text-xs font-semibold text-emerald-400">Clear schedule ahead</p>
                                        <p className="text-[10px] text-gray-600">No upcoming events or deadlines</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                className={`flex items-stretch gap-0 rounded-xl overflow-hidden border-l-2 bg-white/[0.02] hover:bg-white/[0.04] transition-colors ${getBorderColor(item)}`}
                                            >
                                                {/* Icon column */}
                                                <div className="flex items-center justify-center w-8 flex-shrink-0">
                                                    {item.type === 'DEADLINE'
                                                        ? <ClockIcon size={11} className="text-gray-500" />
                                                        : <CalendarDays size={11} className="text-gray-500" />}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0 py-2 pr-2">
                                                    <div className="flex items-center justify-between gap-1.5">
                                                        <p className="text-xs font-semibold text-gray-200 truncate leading-tight">
                                                            {item.title}
                                                        </p>
                                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border flex-shrink-0 ${getSubtypePill(item)}`}>
                                                            {item.type === 'DEADLINE' ? (item.subType ?? 'DUE') : (item.subType ?? 'EVENT')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={`text-[10px] font-medium ${getRelativeDate(item.date) === 'Today' ? 'text-amber-400' :
                                                                getRelativeDate(item.date) === 'Tomorrow' ? 'text-blue-400' :
                                                                    'text-gray-500'
                                                            }`}>{getRelativeDate(item.date)}</span>
                                                        {item.description && (
                                                            <>
                                                                <span className="text-gray-700 text-[10px]">·</span>
                                                                <span className="text-[10px] text-gray-600 truncate">{item.description}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* View all link */}
                                <button
                                    onClick={() => navigate('/calendar')}
                                    className="flex items-center justify-center gap-1.5 w-full pt-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
                                >
                                    View all in Calendar <ArrowRight size={11} />
                                </button>
                            </div>
                        );
                    })()}

                    {/* Attendance Widget */}
                    <AttendanceWidget />
                </div>
            </div>

            {/* ── 4. ADMIN SECTION ──────────────────────────────────────── */}
            {isAdmin && (
                <div className="flex-none grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-[300px]">
                    <WorkloadHeatmap staffStats={staffStats} totalTasks={relevantTasks.length} />
                    <AiInsightWidget />
                </div>
            )}

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400">
                                    {selectedStaff.displayName?.charAt(0)}
                                </div>
                                {selectedStaff.displayName}
                                <span className="text-gray-500 text-sm font-normal">({selectedStaff.role})</span>
                            </h2>
                            <button onClick={() => setSelectedStaff(null)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-100 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                                    <p className="text-slate-500 dark:text-gray-500 text-xs uppercase font-bold mb-1">Email</p>
                                    <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300"><Mail size={14} /> {selectedStaff.email}</div>
                                </div>
                                <div className="bg-slate-100 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                                    <p className="text-slate-500 dark:text-gray-500 text-xs uppercase font-bold mb-1">Phone</p>
                                    <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300"><Phone size={14} /> {selectedStaff.phoneNumber || 'N/A'}</div>
                                </div>
                                <div className="bg-slate-100 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                                    <p className="text-slate-500 dark:text-gray-500 text-xs uppercase font-bold mb-1">Department</p>
                                    <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300"><Briefcase size={14} /> {selectedStaff.department || 'Unassigned'}</div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-md font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <ClockIcon size={16} className="text-brand-500 dark:text-brand-400" /> Recent Activity
                                </h3>
                                {selectedStaffTasks.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedStaffTasks.map(task => (
                                            <div key={task.id} className="bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-medium text-slate-900 dark:text-white">{task.title}</h4>
                                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{task.clientName} • Due: {task.dueDate}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${task.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400' :
                                                    task.status === 'IN_PROGRESS' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400' :
                                                        'bg-gray-100 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20 text-gray-700 dark:text-gray-400'
                                                    }`}>
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-500 dark:text-gray-500 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 border-dashed">
                                        No recent tasks found
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
