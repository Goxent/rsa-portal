import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Phone, Briefcase, Clock as ClockIcon } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { UserProfile, Task, UserRole } from '../types';
import { useTheme } from '../context/ThemeContext';
import WidgetContainer from '../components/dashboard/WidgetContainer';
import AttendanceWidget from '../components/dashboard/AttendanceWidget';
import GreetingsWidget from '../components/dashboard/widgets/GreetingsWidget';
import FocusWidget from '../components/dashboard/widgets/FocusWidget';
import ComplianceBanner from '../components/dashboard/widgets/ComplianceBanner';
import WorkloadHeatmap from '../components/dashboard/widgets/WorkloadHeatmap';
import { useTasks } from '../hooks/useTasks';
import { useUsers } from '../hooks/useStaff';
import { useClients } from '../hooks/useClients';
import { useEvents } from '../hooks/useEvents';
import { useQuery } from '@tanstack/react-query';

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

    // Data Hooks
    const { data: allTasks = [], isLoading: tasksLoading } = useTasks();
    const { data: usersForMap = [], isLoading: usersLoading } = useUsers();
    const { data: allClients = [], isLoading: clientsLoading } = useClients();
    const { data: allEvents = [], isLoading: eventsLoading } = useEvents();

    const { data: lateCount = 0 } = useQuery({
        queryKey: ['lateCount', user?.uid],
        queryFn: () => user ? AuthService.getLateCountLast30Days(user.uid) : Promise.resolve(0),
        enabled: !!user,
        staleTime: 1000 * 60 * 60 // 1 hour
    });

    const isLoading = tasksLoading || usersLoading || eventsLoading || clientsLoading;

    // Computed Data
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
        staffPerformance
    } = useMemo(() => {
        if (!user) return {
            userMap: {}, activeStaffCount: 0, taskData: [], recentTasks: [],
            recentCompletedTasks: [], upcomingSchedule: [], relevantTasks: [],
            staffStats: { busy: [], free: [], byDepartment: {} },
            clientStats: { total: 0, active: 0, mySigned: 0, byService: {} },
            staffPerformance: { completed: 0, pending: 0, lateCount: 0 }
        };

        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN;

        // User Map
        const uMap: Record<string, UserProfile> = {};
        usersForMap.forEach(u => uMap[u.uid] = u);

        // Active Staff Count
        const allUsers = isAdmin ? usersForMap : [user];
        const activeCount = isAdmin ? Math.floor(allUsers.length * 0.9) : 0;

        // Relevant Tasks
        const relTasks = isAdmin ? allTasks : allTasks.filter(t => t.assignedTo.includes(user.uid));

        // Task Stats
        const statusCounts = {
            'COMPLETED': 0,
            'IN_PROGRESS': 0,
            'UNDER_REVIEW': 0,
            'NOT_STARTED': 0
        };

        relTasks.forEach(t => {
            if (statusCounts[t.status as keyof typeof statusCounts] !== undefined) {
                statusCounts[t.status as keyof typeof statusCounts]++;
            }
        });

        const tData = [
            { name: 'Completed', value: statusCounts.COMPLETED },
            { name: 'In Progress', value: statusCounts.IN_PROGRESS },
            { name: 'Review', value: statusCounts.UNDER_REVIEW },
            { name: 'Pending', value: statusCounts.NOT_STARTED }
        ];

        // Recent Tasks
        const now = new Date();
        const sortedTasks = [...relTasks].sort((a, b) => {
            const aOverdue = a.dueDate && new Date(a.dueDate) < now ? 1 : 0;
            const bOverdue = b.dueDate && new Date(b.dueDate) < now ? 1 : 0;
            if (bOverdue !== aOverdue) return bOverdue - aOverdue;
            const pMap: Record<string, number> = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
            return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
        });
        const recTasks = isAdmin ? sortedTasks : sortedTasks.slice(0, 5);

        // Recent Completed
        const recCompleted = [...relTasks]
            .filter(t => t.status === 'COMPLETED')
            .sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime())
            .slice(0, 10);

        // Schedule
        const todayStr = now.toLocaleDateString('en-CA');
        const datePlus30 = new Date(now);
        datePlus30.setDate(datePlus30.getDate() + 30);
        const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        const cutoffDate = datePlus30 > endOfNextMonth ? datePlus30 : endOfNextMonth;
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        const futureEvents = allEvents
            .filter(e => e.date >= todayStr && e.date <= cutoffDateStr)
            .map(e => ({
                id: e.id,
                title: e.title,
                date: e.date,
                type: 'EVENT' as const,
                subType: e.type,
                description: e.time
            }));

        const deadlineTasks = isAdmin
            ? allTasks
            : allTasks.filter(t => t.assignedTo.includes(user.uid));

        const futureDeadlines = deadlineTasks
            .filter(t => t.dueDate >= todayStr && t.dueDate <= cutoffDateStr && t.status !== 'COMPLETED')
            .map(t => ({
                id: t.id,
                title: t.title,
                date: t.dueDate,
                type: 'DEADLINE' as const,
                subType: t.priority,
                description: t.clientName
            }));

        const mergedSchedule = [...futureEvents, ...futureDeadlines].sort((a, b) => {
            return a.date.localeCompare(b.date);
        });

        // Staff Stats
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
            const staffOnlyUsers = allUsers.filter(u => u.role !== UserRole.ADMIN && u.role !== UserRole.MASTER_ADMIN);

            staffOnlyUsers.forEach(u => {
                const userActiveTasks = activeTasksList.filter(t => t.assignedTo.includes(u.uid));
                if (userActiveTasks.length > 0) {
                    busyList.push({ ...u, taskCount: userActiveTasks.length });
                } else {
                    freeList.push(u);
                }
            });
            sStats.busy = busyList;
            sStats.free = freeList;
        }

        // Staff Performance (My Performance)
        const myTasks = allTasks.filter(t => t.assignedTo.includes(user.uid));
        const myCompleted = myTasks.filter(t => t.status === 'COMPLETED').length;
        const myPending = myTasks.filter(t => t.status !== 'COMPLETED').length;
        const sPerf = { completed: myCompleted, pending: myPending, lateCount: lateCount };

        // Client Stats
        const activeClients = allClients.filter(c => c.status === 'Active');
        const mySignedClients = allClients.filter(c => c.signingAuthorityId === user.uid || c.signingAuthority === user.displayName);
        const serviceDist: Record<string, number> = {};
        activeClients.forEach(c => {
            serviceDist[c.serviceType] = (serviceDist[c.serviceType] || 0) + 1;
        });
        const cStats = {
            total: allClients.length,
            active: activeClients.length,
            mySigned: mySignedClients.length,
            byService: serviceDist
        };

        return {
            userMap: uMap,
            activeStaffCount: activeCount,
            taskData: tData,
            recentTasks: recTasks,
            recentCompletedTasks: recCompleted,
            upcomingSchedule: mergedSchedule,
            relevantTasks: relTasks,
            staffStats: sStats,
            clientStats: cStats,
            staffPerformance: sPerf
        };

    }, [user, allTasks, usersForMap, allEvents, allClients, lateCount]);

    // Modal State for Staff Details
    const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);
    const [selectedStaffTasks, setSelectedStaffTasks] = useState<Task[]>([]);

    // Dashboard data object to pass to widgets
    const dashboardData = {
        activeStaffCount,
        taskData,
        recentTasks,       // admin: all tasks sorted by urgency; staff: top 5 own tasks
        upcomingSchedule,
        staffStats,
        userMap,
        staffPerformance,
        clientStats,
        recentCompletedTasks,
        isLoading,
    };

    // Admin check for heatmap
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    return (
        <div className="space-y-6">
            {/* Attendance Widget - Moved to Top */}
            <div className="w-full relative">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 to-transparent rounded-2xl blur-xl -z-10 opacity-50"></div>
                <AttendanceWidget />
            </div>

            {/* Greetings & Focus Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <GreetingsWidget />
                </div>
                <div className="lg:col-span-1">
                    <FocusWidget />
                </div>
            </div>

            {/* Compliance Banner - Show only if there are urgency deadlines */}
            <div className="w-full">
                <ComplianceBanner deadlines={upcomingSchedule.filter(i => i.type === 'DEADLINE')} />
            </div>

            {/* Admin Exclusive: Workload Heatmap */}
            {isAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[300px]">
                    <WorkloadHeatmap staffStats={staffStats} totalTasks={relevantTasks.length} />
                    {/* Placeholder for future widget or we can expand heatmap */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/5 flex items-center justify-center text-gray-400">
                        <p>More admin insights coming...</p>
                    </div>
                </div>
            )}

            {/* Widget Container */}
            {user && (
                <WidgetContainer
                    userId={user.uid}
                    dashboardData={dashboardData}
                    isAdmin={isAdmin}
                />
            )}

            {/* Staff Detail Modal (preserved from original) */}
            {selectedStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400">
                                    {selectedStaff.displayName?.charAt(0)}
                                </div>
                                {selectedStaff.displayName} <span className="text-gray-500 text-sm font-normal">({selectedStaff.role})</span>
                            </h2>
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <p className="text-gray-500 text-xs uppercase font-bold mb-1">Email</p>
                                    <div className="flex items-center gap-2 text-gray-300">
                                        <Mail size={14} /> {selectedStaff.email}
                                    </div>
                                </div>
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <p className="text-gray-500 text-xs uppercase font-bold mb-1">Phone</p>
                                    <div className="flex items-center gap-2 text-gray-300">
                                        <Phone size={14} /> {selectedStaff.phoneNumber || 'N/A'}
                                    </div>
                                </div>
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <p className="text-gray-500 text-xs uppercase font-bold mb-1">Department</p>
                                    <div className="flex items-center gap-2 text-gray-300">
                                        <Briefcase size={14} /> {selectedStaff.department || 'Unassigned'}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                                    <ClockIcon size={16} className="text-brand-400" /> Recent Activity
                                </h3>
                                {selectedStaffTasks.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedStaffTasks.map(task => (
                                            <div key={task.id} className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-medium text-white">{task.title}</h4>
                                                    <p className="text-xs text-gray-400 mt-1">{task.clientName} • Due: {task.dueDate}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${task.status === 'COMPLETED' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                                    task.status === 'IN_PROGRESS' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                        'bg-gray-500/10 border-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500 bg-white/5 rounded-xl border border-white/5 border-dashed">
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
