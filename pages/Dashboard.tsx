import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Task, UserProfile, UserRole } from '../types';
import { useTheme } from '../context/ThemeContext';
import WidgetContainer from '../components/dashboard/WidgetContainer';
import AttendanceWidget from '../components/dashboard/AttendanceWidget';
import CommandStrip from '../components/dashboard/CommandStrip';
import { useTasks } from '../hooks/useTasks';
import { useUsers } from '../hooks/useStaff';
import { useEvents } from '../hooks/useEvents';
import { useAttendanceHistory } from '../hooks/useAttendance';
import { useQuery } from '@tanstack/react-query';
import { ComplianceService, complianceKeys } from '../services/advanced';
import NepaliDate from 'nepali-date-converter';
import GreetingsWidget from '../components/dashboard/widgets/GreetingsWidget';
import FocusWidget from '../components/dashboard/widgets/FocusWidget';
import ReviewerActionCenter from '../components/dashboard/widgets/ReviewerActionCenter';
import FirmDeadlinesStrip from '../components/dashboard/widgets/FirmDeadlinesStrip';
import { SkeletonCard } from '../components/common/SkeletonCard';

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
    const { theme } = useTheme();
    const navigate = useNavigate();

    // ── Data Hooks ─────────────────────────────────────────────────────────
    const { data: allTasks = [], isLoading: tasksLoading } = useTasks();
    const { data: usersForMap = [], isLoading: usersLoading } = useUsers();
    const { data: allEvents = [], isLoading: eventsLoading } = useEvents();
    const { data: attendanceHistory = [] } = useAttendanceHistory(user?.uid);

    // D11: Statutory & Compliance Deadlines
    const { data: complianceEvents = [], isLoading: complianceLoading } = useQuery({
        queryKey: complianceKeys.all,
        queryFn: () => ComplianceService.getEvents(),
        staleTime: 1000 * 60 * 15,
    });

    const isLoading = tasksLoading || usersLoading || eventsLoading;

    // ── Derived Attendance State (for command strip) ───────────────────────
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayAttendance = attendanceHistory?.find((a: any) => a.date === todayStr);
    let currentAttendanceStatus: 'Not Clocked In' | 'Clocked In' | 'Shift Completed' = 'Not Clocked In';
    if (todayAttendance) {
        if (todayAttendance.checkOut) currentAttendanceStatus = 'Shift Completed';
        else if (todayAttendance.checkIn) currentAttendanceStatus = 'Clocked In';
    }

    // ── Computed Schedule & Lookup Map ─────────────────────────────────────
    const {
        userMap,
        upcomingSchedule,
    } = useMemo(() => {
        if (!user) return { userMap: {}, upcomingSchedule: [] };

        const isManagerOrAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN || user.role === UserRole.MANAGER;

        const uMap: Record<string, UserProfile> = {};
        usersForMap.forEach(u => (uMap[u.uid] = u));

        const now = new Date();
        const datePlus30 = new Date(now);
        datePlus30.setDate(datePlus30.getDate() + 30);
        const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        const cutoffDate = datePlus30 > endOfNextMonth ? datePlus30 : endOfNextMonth;
        // L3 Fix: Local date formatting (en-CA)
        const cutoffDateStr = cutoffDate.toLocaleDateString('en-CA');

        const futureEvents = allEvents
            .filter(e => e.date >= todayStr && e.date <= cutoffDateStr)
            .map(e => ({ id: e.id, title: e.title, date: e.date, type: 'EVENT' as const, subType: e.type, description: e.time }));

        // D8: Managers & Admins see team deadlines; preparers see their assigned tasks
        const deadlineTasks = isManagerOrAdmin
            ? allTasks
            : allTasks.filter(t => t.assignedTo?.includes(user.uid));

        const futureDeadlines = deadlineTasks
            .filter(t => t.dueDate >= todayStr && t.dueDate <= cutoffDateStr && t.status !== 'COMPLETED' && t.status !== 'ARCHIVED')
            .map(t => ({ id: t.id, title: t.title, date: t.dueDate, type: 'DEADLINE' as const, subType: t.priority, description: t.clientName }));

        const mergedSchedule = [...futureEvents, ...futureDeadlines].sort((a, b) => a.date.localeCompare(b.date));

        return {
            userMap: uMap,
            upcomingSchedule: mergedSchedule,
        };
    }, [user, allTasks, usersForMap, allEvents, todayStr]);

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    React.useEffect(() => {
        document.title = 'Dashboard — RSA';
        return () => { document.title = 'RSA'; };
    }, []);

    // ── Command strip derived values (D5, D6) ──────────────────────────────
    const uid = user?.uid ?? '';
    const now = new Date();

    // D5: Tasks where user is actively involved
    const myOpenTasks = allTasks.filter(t =>
        t.status !== 'COMPLETED' && t.status !== 'ARCHIVED' && (
            t.assignedTo?.includes(uid) ||
            t.engagementReviewerId === uid ||
            t.signingPartnerId === uid ||
            t.teamLeaderId === uid
        )
    ).length;

    // Overdue tasks assigned to or overseen by the user
    const myOverdueTasks = allTasks.filter(t =>
        t.status !== 'COMPLETED' &&
        t.status !== 'ARCHIVED' &&
        t.dueDate &&
        new Date(t.dueDate + 'T00:00:00') < now &&
        (t.assignedTo?.includes(uid) || t.teamLeaderId === uid)
    ).length;

    // Tasks currently in review involving the user
    const myInReviewTasks = allTasks.filter(t =>
        t.status === 'UNDER_REVIEW' && (
            t.assignedTo?.includes(uid) ||
            t.engagementReviewerId === uid ||
            t.signingPartnerId === uid ||
            t.teamLeaderId === uid
        )
    ).length;

    // L4: Local-date comparison for tasks completed today
    const completedToday = allTasks.filter(t =>
        t.assignedTo?.includes(uid) &&
        t.status === 'COMPLETED' &&
        t.completedAt &&
        new Date(t.completedAt).toLocaleDateString('en-CA') === todayStr
    ).length;

    const dashboardData = {
        upcomingSchedule,
        userMap,
        isLoading,
        myOpenTasks,
        completedToday,
        allTasks,
    };

    const handleViewTask = (task: Task) => {
        navigate(`/tasks?taskId=${task.id}`);
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6 min-h-full overflow-x-hidden p-6 pb-24 custom-scrollbar bg-transparent">

            {/* ── COMMAND STRIP ── sticky at top (D1, D6) */}
            <CommandStrip
                pendingTasksCount={myOpenTasks}
                overdueCount={myOverdueTasks}
                inReviewCount={myInReviewTasks}
                attendanceStatus={currentAttendanceStatus}
                currentUserUid={user?.uid}
            />

            <div className="space-y-6 relative z-10 animate-in fade-in duration-700">
                {isLoading ? (
                    <div className="space-y-6">
                        <div className="h-40 bg-white/[0.03] rounded-3xl border border-white/5 animate-pulse" />
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <SkeletonCard height={200} lines={4} hasAvatar />
                            <SkeletonCard height={200} lines={4} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <SkeletonCard key={i} height={300} lines={6} />)}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* 1. Daily Kickoff Row: Greetings & Today's Focus (Side-by-Side) */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                            <GreetingsWidget 
                                pendingCount={myOpenTasks} 
                                completedToday={completedToday} 
                            />
                            <FocusWidget />
                        </div>

                        {/* 2. Attendance Center - Prominent daily clock-in & task logging */}
                        {user?.role !== UserRole.MASTER_ADMIN && (
                            <div className="w-full">
                                <AttendanceWidget />
                            </div>
                        )}

                        {/* 3. Reviewer's Action Center (D2, D3, D4) */}
                        <ReviewerActionCenter 
                            tasks={allTasks} 
                            currentUser={user} 
                            onViewTask={handleViewTask} 
                        />

                        {/* 4. Statutory & Firm Compliance Deadlines Strip (D11) */}
                        <FirmDeadlinesStrip 
                            complianceEvents={complianceEvents} 
                            isLoading={complianceLoading} 
                        />

                        {/* 5. Main Widget Ecosystem (Upcoming Schedule & Tasks Overview) */}
                        <div className="flex flex-col gap-6">
                            {user && (
                                <WidgetContainer
                                    userId={user.uid}
                                    userRole={user.role}
                                    dashboardData={dashboardData}
                                    isAdmin={isAdmin}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
