import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clock as ClockIcon, CheckSquare, CalendarDays, ArrowRight } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { UserProfile, Task, UserRole } from '../types';
import { useTheme } from '../context/ThemeContext';
import WidgetContainer from '../components/dashboard/WidgetContainer';
import AttendanceWidget from '../components/dashboard/AttendanceWidget';
import { useTasks } from '../hooks/useTasks';
import { useUsers } from '../hooks/useStaff';
import { useEvents } from '../hooks/useEvents';
import { useAttendanceHistory } from '../hooks/useAttendance';
import { useQuery } from '@tanstack/react-query';
import NepaliDate from 'nepali-date-converter';
import GreetingsWidget from '../components/dashboard/widgets/GreetingsWidget';

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
    const { data: allEvents = [], isLoading: eventsLoading } = useEvents();
    const { data: attendanceHistory = [] } = useAttendanceHistory(user?.uid);

    const { data: lateCount = 0 } = useQuery({
        queryKey: ['lateCount', user?.uid],
        queryFn: () => user ? AuthService.getLateCountLast30Days(user.uid) : Promise.resolve(0),
        enabled: !!user,
        staleTime: 1000 * 60 * 60,
    });

    const isLoading = tasksLoading || usersLoading || eventsLoading;

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
    } = useMemo(() => {
        if (!user) return {
            userMap: {}, activeStaffCount: 0, taskData: [], recentTasks: [],
            recentCompletedTasks: [], upcomingSchedule: [], relevantTasks: [],
            staffStats: { busy: [], free: [], byDepartment: {} },
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

        return {
            userMap: uMap, activeStaffCount: activeStaffCount, taskData: tData,
            recentTasks: recTasks, recentCompletedTasks: recCompleted,
            upcomingSchedule: mergedSchedule, relevantTasks: relTasks,
            staffStats: sStats,
        };
    }, [user, allTasks, usersForMap, allEvents, lateCount]);

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
        staffStats, userMap,
        recentCompletedTasks, isLoading, myOpenTasks, completedToday,
        relevantTasks,
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6 h-full overflow-y-auto overflow-x-hidden p-2 md:p-4 lg:p-6 custom-scrollbar relative">
            {/* Top ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-brand-500/10 blur-[100px] pointer-events-none" />

            {/* ── 1. UNIFIED HEADER (Greetings Widget) ── */}
            <div className="flex-none">
                <GreetingsWidget 
                    pendingCount={myOpenTasks} 
                    completedToday={completedToday} 
                />
            </div>

            {/* ── 2. MAIN CONTENT + RIGHT SIDEBAR ──────────────────────── */}
            <div className="flex flex-col xl:flex-row gap-6 flex-none relative z-10">

                {/* Left: Widget Grid */}
                <div className="flex-1 min-w-0 flex flex-col gap-6">
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
            </div>
        </div>
    );
};

export default Dashboard;
