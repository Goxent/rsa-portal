import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, X, ExternalLink, Mail, Phone, MapPin, Calendar as CalendarIcon, Flag } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { UserProfile, Task, UserRole, CalendarEvent } from '../types';
import { toBS } from '../utils/dateUtils';
import WidgetContainer from '../components/dashboard/WidgetContainer';
import AttendanceWidget from '../components/dashboard/AttendanceWidget';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';

import { Client } from '../types';

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
    const navigate = useNavigate();

    // Data State - passed to widgets
    const [activeStaffCount, setActiveStaffCount] = useState(0);
    const [taskData, setTaskData] = useState<{ name: string; value: number }[]>([]);
    const [recentTasks, setRecentTasks] = useState<Task[]>([]);
    const [recentCompletedTasks, setRecentCompletedTasks] = useState<Task[]>([]); // Added State
    const [upcomingSchedule, setUpcomingSchedule] = useState<ScheduleItem[]>([]);
    const [staffStats, setStaffStats] = useState<{ busy: (UserProfile & { taskCount: number })[]; free: UserProfile[]; byDepartment: Record<string, number> }>({ busy: [], free: [], byDepartment: {} });
    const [userMap, setUserMap] = useState<Record<string, UserProfile>>({});
    const [staffPerformance, setStaffPerformance] = useState({ completed: 0, pending: 0, lateCount: 0 });

    // Client Stats
    const [clientStats, setClientStats] = useState({ total: 0, active: 0, mySigned: 0, byService: {} as Record<string, number> });

    const [isLoading, setIsLoading] = useState(true);

    // Modal State for Staff Details
    const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);
    const [selectedStaffTasks, setSelectedStaffTasks] = useState<Task[]>([]);

    useEffect(() => {
        if (user) {
            loadDashboardData();
        }
    }, [user]);

    const loadDashboardData = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            const isAdmin = user.role === UserRole.ADMIN;

            // Fetch Basic Data
            const allUsers = isAdmin ? await AuthService.getAllUsers() : [user];
            const allTasks = await AuthService.getAllTasks();
            const allEvents = await AuthService.getAllEvents();
            const allClients = await AuthService.getAllClients();

            // Build User Map
            const userMapData: Record<string, UserProfile> = {};
            const users = await AuthService.getAllUsers();
            users.forEach(u => userMapData[u.uid] = u);
            setUserMap(userMapData);

            // Filter tasks based on role
            const relevantTasks = isAdmin ? allTasks : allTasks.filter(t => t.assignedTo.includes(user.uid));

            // Active Staff Count
            if (isAdmin) {
                setActiveStaffCount(Math.floor(allUsers.length * 0.9));
            }

            // Task Distribution
            const statusCounts = {
                'COMPLETED': 0,
                'IN_PROGRESS': 0,
                'UNDER_REVIEW': 0,
                'NOT_STARTED': 0
            };

            relevantTasks.forEach(t => {
                if (statusCounts[t.status as keyof typeof statusCounts] !== undefined) {
                    statusCounts[t.status as keyof typeof statusCounts]++;
                }
            });

            setTaskData([
                { name: 'Completed', value: statusCounts.COMPLETED },
                { name: 'In Progress', value: statusCounts.IN_PROGRESS },
                { name: 'Review', value: statusCounts.UNDER_REVIEW },
                { name: 'Pending', value: statusCounts.NOT_STARTED }
            ]);

            // Recent Tasks (sorted by priority)
            const sortedTasks = [...relevantTasks].sort((a, b) => {
                const pMap: Record<string, number> = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
                return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
            }).slice(0, 5);
            setRecentTasks(sortedTasks);

            // Recent Completed Tasks (for Activity Feed)
            const completedRecent = [...relevantTasks]
                .filter(t => t.status === 'COMPLETED')
                .sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime())
                .slice(0, 10);
            setRecentCompletedTasks(completedRecent);

            // Upcoming Schedule
            const now = new Date();
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
            setUpcomingSchedule(mergedSchedule);

            // Staff Stats Processing
            const activeStaffList = allUsers.filter(u => u.status !== 'Inactive');
            const deptStats: Record<string, number> = {};
            activeStaffList.forEach(u => {
                const dept = u.department || 'Unassigned';
                deptStats[dept] = (deptStats[dept] || 0) + 1;
            });

            // Staff Availability (Admin only)
            if (isAdmin) {
                const activeTasksList = allTasks.filter(t => t.status !== 'COMPLETED');
                const busyList: (UserProfile & { taskCount: number })[] = [];
                const freeList: UserProfile[] = [];

                // Exclude ADMIN and MASTER_ADMIN from workload widget
                const staffOnlyUsers = allUsers.filter(u =>
                    u.role !== UserRole.ADMIN && u.role !== UserRole.MASTER_ADMIN
                );

                staffOnlyUsers.forEach(u => {
                    const userActiveTasks = activeTasksList.filter(t => t.assignedTo.includes(u.uid));
                    if (userActiveTasks.length > 0) {
                        busyList.push({ ...u, taskCount: userActiveTasks.length });
                    } else {
                        freeList.push(u);
                    }
                });
                setStaffStats({ busy: busyList, free: freeList, byDepartment: deptStats });
            } else {
                setStaffStats({ busy: [], free: [], byDepartment: deptStats });
            }

            // User's own performance
            const myTasks = allTasks.filter(t => t.assignedTo.includes(user.uid));
            const myCompleted = myTasks.filter(t => t.status === 'COMPLETED').length;
            const myPending = myTasks.filter(t => t.status !== 'COMPLETED').length;
            const lateCount = await AuthService.getLateCountLast30Days(user.uid);
            setStaffPerformance({ completed: myCompleted, pending: myPending, lateCount });

            // Client Stats Processing
            const activeClients = allClients.filter(c => c.status === 'Active');
            const mySignedClients = allClients.filter(c => c.signingAuthorityId === user.uid || c.signingAuthority === user.displayName);

            const serviceDist: Record<string, number> = {};
            activeClients.forEach(c => {
                serviceDist[c.serviceType] = (serviceDist[c.serviceType] || 0) + 1;
            });

            setClientStats({
                total: allClients.length,
                active: activeClients.length,
                mySigned: mySignedClients.length,
                byService: serviceDist
            });

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Dashboard data object to pass to widgets
    const dashboardData = {
        activeStaffCount,
        taskData,
        recentTasks,
        upcomingSchedule,
        staffStats,
        userMap,
        staffPerformance,
        clientStats,
        recentCompletedTasks,
        isLoading,
    };

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-navy-800 to-brand-900 shadow-2xl border border-white/10 animate-fade-in">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-brand-600/10 to-accent-purple/10"></div>

                <div className="relative p-6 md:p-8 flex flex-col md:flex-row justify-between items-center z-10">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 font-heading tracking-tight">
                            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, <span className="text-brand-500">{user?.displayName?.split(' ')[0]}</span>
                        </h1>
                        <p className="text-gray-400 text-sm max-w-xl">
                            Welcome to your customizable dashboard. Drag widgets to rearrange, or click "Customize" to add new ones.
                        </p>
                    </div>
                    <div className="mt-4 md:mt-0 flex space-x-4">
                        <div className="glass-panel px-4 py-2 md:px-5 md:py-3 rounded-xl flex items-center space-x-3">
                            <CalendarDays size={20} className="text-accent-cyan" />
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Date (AD / BS)</p>
                                <p className="text-white font-mono text-sm">{new Date().toLocaleDateString()} / {toBS(new Date())} BS</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance Widget - Always Top */}
            <AttendanceWidget />

            {/* Widget Container */}
            {isLoading ? (
                <DashboardSkeleton />
            ) : (
                user && (
                    <WidgetContainer
                        userId={user.uid}
                        isAdmin={user.role === UserRole.ADMIN}
                        dashboardData={dashboardData}
                    />
                )
            )}

            {/* Staff Detail Modal (preserved from original) */}
            {selectedStaff && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="glass-modal rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-2xl font-bold text-white">
                                        {selectedStaff.displayName?.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{selectedStaff.displayName}</h2>
                                        <p className="text-sm text-gray-400">{selectedStaff.role} • {selectedStaff.department}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedStaff(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>

                            {/* Contact Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                                    <Mail size={16} className="text-brand-400" />
                                    <span className="text-sm text-gray-300 truncate">{selectedStaff.email}</span>
                                </div>
                                {selectedStaff.phoneNumber && (
                                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                                        <Phone size={16} className="text-green-400" />
                                        <span className="text-sm text-gray-300">{selectedStaff.phoneNumber}</span>
                                    </div>
                                )}
                            </div>

                            {/* Performance Stats */}
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <div className="bg-green-500/10 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-green-400">{staffPerformance.completed}</p>
                                    <p className="text-xs text-gray-400">Completed</p>
                                </div>
                                <div className="bg-blue-500/10 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-blue-400">{staffPerformance.pending}</p>
                                    <p className="text-xs text-gray-400">Pending</p>
                                </div>
                                <div className="bg-red-500/10 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-red-400">{staffPerformance.lateCount}</p>
                                    <p className="text-xs text-gray-400">Late (30d)</p>
                                </div>
                            </div>

                            {/* Active Tasks */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-3">Active Tasks</h3>
                                {selectedStaffTasks.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {selectedStaffTasks.map(task => (
                                            <div key={task.id} className="bg-white/5 p-3 rounded-lg flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm text-white">{task.title}</p>
                                                    <p className="text-xs text-gray-400">{task.clientName}</p>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded-full ${task.priority === 'URGENT' ? 'bg-red-500/20 text-red-400' :
                                                    task.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {task.priority}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No active tasks assigned</p>
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
