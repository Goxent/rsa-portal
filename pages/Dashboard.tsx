import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clock as ClockIcon, Users, CheckSquare, Building2, CalendarDays, ArrowRight, BarChart2 } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { UserProfile, Task, UserRole } from '../types';
import { useTheme } from '../context/ThemeContext';
import WidgetContainer from '../components/dashboard/WidgetContainer';
import AttendanceWidget from '../components/dashboard/AttendanceWidget';
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
        const activeStaffCount = isAdmin ? allUsers.filter(u => u.status === 'Active').length : 0;

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
            userMap: uMap, activeStaffCount: activeStaffCount, taskData: tData,
            recentTasks: recTasks, recentCompletedTasks: recCompleted,
            upcomingSchedule: mergedSchedule, relevantTasks: relTasks,
            staffStats: sStats, clientStats: cStats, staffPerformance: sPerf,
        };
    }, [user, allTasks, usersForMap, allEvents, allClients, lateCount]);

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
    const workDayPct = Math.min(Math.max(Math.round(((new Date().getHours() - 9) / 8) * 100), 0), 100);

    // Next 7 days schedule for sidebar
    const next7Days = useMemo(() => {
        const today = new Date().toLocaleDateString('en-CA');
        const limit = new Date();
        limit.setDate(limit.getDate() + 7);
        const limitStr = limit.toLocaleDateString('en-CA');
        return upcomingSchedule.filter(i => i.date >= today && i.date <= limitStr).slice(0, 6);
    }, [upcomingSchedule]);

    const dashboardData = {
        activeStaffCount, taskData, recentTasks, upcomingSchedule,
        staffStats, userMap, staffPerformance, clientStats,
        recentCompletedTasks, isLoading, myOpenTasks, completedToday
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-5 h-full overflow-y-auto overflow-x-hidden pb-6 custom-scrollbar">

            {/* ── 1. UNIFIED HEADER (Replaces Command Strip & Greetings Widget) ── */}
            <div className="flex-none flex flex-col md:flex-row items-start md:items-end justify-between gap-4 px-2 py-2">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            {(() => {
                                const h = new Date().getHours();
                                if (h < 12) return 'Good Morning, ';
                                if (h < 17) return 'Good Afternoon, ';
                                return 'Good Evening, ';
                            })()}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                                {user?.displayName?.split(' ')[0] ?? 'Team'}
                            </span>
                        </h1>
                    </div>
                    <p className="text-gray-400 text-sm">
                        {completedToday > 0
                            ? `${completedToday} task${completedToday !== 1 ? 's' : ''} completed today. ${myOpenTasks > 0 ? `${myOpenTasks} still open.` : 'All clear!'}`
                            : `${myOpenTasks > 0 ? `${myOpenTasks} task${myOpenTasks !== 1 ? 's' : ''} pending.` : 'Your workspace is ready. No pending tasks.'}`
                        }
                    </p>
                </div>

                {/* Right: Clean Global Stats */}
                <div className="flex items-center gap-6 text-sm">
                    <button onClick={() => navigate('/tasks')} className="flex flex-col items-end group hover:opacity-80 transition-opacity">
                        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-0.5">Tasks</span>
                        <div className="flex items-center gap-1.5 text-white font-bold">
                            <CheckSquare size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
                            {relevantTasks.length}
                        </div>
                    </button>
                    <button onClick={() => navigate('/clients')} className="flex flex-col items-end group hover:opacity-80 transition-opacity">
                        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-0.5">Clients</span>
                        <div className="flex items-center gap-1.5 text-white font-bold">
                            <Building2 size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                            {allClients.length}
                        </div>
                    </button>
                    {isAdmin && (
                        <button onClick={() => navigate('/staff')} className="flex flex-col items-end group hover:opacity-80 transition-opacity">
                            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-0.5">Staff</span>
                            <div className="flex items-center gap-1.5 text-white font-bold">
                                <Users size={14} className="text-violet-400 group-hover:scale-110 transition-transform" />
                                {usersForMap.length}
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* ── 2. MAIN CONTENT + RIGHT SIDEBAR ──────────────────────── */}
            <div className="flex flex-col xl:flex-row gap-5 flex-none">

                {/* Left: Widget Grid */}
                <div className="flex-1 min-w-0 flex flex-col gap-5">
                    <AttendanceWidget />
                    {user && (
                        <WidgetContainer
                            userId={user.uid}
                            userRole={user.role}
                            dashboardData={dashboardData}
                            isAdmin={isAdmin}
                        />
                    )}
                </div>

                {/* Right: Sticky Sidebar */}
                <div className="w-full xl:w-[320px] flex-shrink-0 flex flex-col gap-4 sticky top-4 self-start max-h-none xl:max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">

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
                        const getDotColor = (item: any) => {
                            if (item.type === 'EVENT') return 'bg-blue-400';
                            if (item.subType === 'URGENT') return 'bg-red-500';
                            if (item.subType === 'HIGH') return 'bg-amber-500';
                            return 'bg-slate-300 dark:bg-slate-600';
                        };

                        const getRelativeDateColor = (date: string) => {
                            const rel = getRelativeDate(date);
                            if (rel === 'Today') return 'text-amber-500 dark:text-amber-400';
                            if (rel === 'Tomorrow') return 'text-blue-500 dark:text-blue-400';
                            return 'text-slate-400 dark:text-gray-500';
                        };

                        return (
                            <div className="bg-transparent space-y-3">
                                {/* Header */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Upcoming</span>
                                        <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 tabular-nums">
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
                                    <div className="space-y-1">
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/[0.03] group cursor-pointer"
                                                onClick={() => navigate('/calendar')}
                                            >
                                                {/* Status Dot */}
                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getDotColor(item)}`} />

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-1.5">
                                                        <p className="text-[13px] font-bold text-slate-700 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white truncate leading-tight transition-colors">
                                                            {item.title}
                                                        </p>
                                                        <span className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-wider flex-shrink-0">
                                                            {item.type === 'DEADLINE' ? (item.subType ?? 'DUE') : (item.subType ?? 'EVENT')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[10px] font-bold uppercase tracking-tight ${getRelativeDateColor(item.date)}`}>{getRelativeDate(item.date)}</span>
                                                        {item.description && (
                                                            <>
                                                                <span className="text-slate-200 dark:text-gray-800 text-[10px]">·</span>
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-600 truncate uppercase tracking-tight">{item.description}</span>
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
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
