
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip
} from 'recharts';
import { Users, AlertCircle, Activity, CheckSquare, Clock, CalendarDays, UserCheck, UserX, X, BarChart2, Briefcase, ExternalLink, Mail, Phone, MapPin, Calendar as CalendarIcon, Flag } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { UserProfile, Task, UserRole, CalendarEvent } from '../types';
import { toBS } from '../utils/dateUtils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const StatCard = ({ title, value, subtext, icon: Icon, gradient, delay, onClick }: any) => (
    <div
        onClick={onClick}
        className={`p-6 rounded-2xl border border-white/5 relative overflow-hidden group bg-gradient-to-br ${gradient} shadow-lg opacity-0 animate-fade-in-up transform transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-white/20 cursor-pointer`}
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="absolute -right-4 -top-4 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:rotate-12 group-hover:scale-110">
            <Icon size={96} className="text-white" />
        </div>
        <div className="relative z-10">
            <div className="bg-white/20 w-fit p-3 rounded-xl mb-4 backdrop-blur-md shadow-inner">
                <Icon className="text-white" size={24} />
            </div>
            <p className="text-sm font-medium text-white/80 mb-1 uppercase tracking-wide">{title}</p>
            <h3 className="text-4xl font-extrabold text-white tracking-tight font-heading">{value}</h3>
            <div className="mt-3 flex items-center">
                <span className="text-xs font-bold text-white/90 bg-white/10 px-2 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
                    {subtext}
                </span>
            </div>
        </div>
    </div>
);

// Helper interface for the unified schedule list
interface ScheduleItem {
    id: string;
    title: string;
    date: string;
    type: 'EVENT' | 'DEADLINE';
    subType?: string; // e.g., 'MEETING' or 'URGENT'
    description?: string;
}

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Data State
    const [activeStaffCount, setActiveStaffCount] = useState(0);
    const [taskData, setTaskData] = useState<any[]>([]);
    const [recentTasks, setRecentTasks] = useState<Task[]>([]);
    const [upcomingSchedule, setUpcomingSchedule] = useState<ScheduleItem[]>([]);
    const [scheduleRangeLabel, setScheduleRangeLabel] = useState('');

    // Staff Availability Data
    const [staffStats, setStaffStats] = useState<{ busy: (UserProfile & { taskCount: number })[], free: UserProfile[] }>({ busy: [], free: [] });

    // User Map for Avatar Lookups
    const [userMap, setUserMap] = useState<Record<string, UserProfile>>({});

    // Modal State for Admin
    const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);
    const [selectedStaffTasks, setSelectedStaffTasks] = useState<Task[]>([]);
    const [staffPerformance, setStaffPerformance] = useState({ completed: 0, pending: 0, lateCount: 0 });

    useEffect(() => {
        if (user) {
            loadDashboardData();
        }
    }, [user]);

    const loadDashboardData = async () => {
        if (!user) return;

        const isAdmin = user.role === UserRole.ADMIN;

        // 1. Fetch Basic Data
        const allUsers = isAdmin ? await AuthService.getAllUsers() : [user];
        const allTasks = await AuthService.getAllTasks();
        const allEvents = await AuthService.getAllEvents();

        // Build User Map for quick lookups
        const userMapData: Record<string, UserProfile> = {};
        if (isAdmin) {
            allUsers.forEach(u => userMapData[u.uid] = u);
        } else {
            // If not admin, we might need other users for shared tasks, but for now just map self
            userMapData[user.uid] = user;
            // In a real app we might fetch all users anyway to show avatars of teammates
            // For now let's just fetch all users if we want to show avatars correctly even for non-admins
            const users = await AuthService.getAllUsers();
            users.forEach(u => userMapData[u.uid] = u);
        }
        setUserMap(userMapData);

        // Filter tasks based on role for stats
        const relevantTasks = isAdmin ? allTasks : allTasks.filter(t => t.assignedTo.includes(user.uid));

        // 2. Active Staff Count
        if (isAdmin) {
            setActiveStaffCount(Math.floor(allUsers.length * 0.9));
        } else {
            setActiveStaffCount(1);
        }

        // 3. Task Distribution
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

        // 4. Recent Tasks Table
        const sortedTasks = [...relevantTasks].sort((a, b) => {
            const pMap = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
            return pMap[b.priority] - pMap[a.priority];
        }).slice(0, 5);
        setRecentTasks(sortedTasks);

        // 5. Build Upcoming Schedule (Events + Deadlines)
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Logic: Greater of (Today + 30 Days) OR (End of Next Month)
        const datePlus30 = new Date(now);
        datePlus30.setDate(datePlus30.getDate() + 30);

        // End of Next Month calculation
        const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

        const cutoffDate = datePlus30 > endOfNextMonth ? datePlus30 : endOfNextMonth;
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        setScheduleRangeLabel(`Showing until ${cutoffDate.toLocaleDateString()}`);

        // A. Office Events (Visible to Everyone)
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

        // B. Task Deadlines 
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

        // C. Merge and Sort by Date
        const mergedSchedule = [...futureEvents, ...futureDeadlines].sort((a, b) => {
            return a.date.localeCompare(b.date);
        });

        setUpcomingSchedule(mergedSchedule);

        // 6. Staff Availability Logic (ADMIN ONLY)
        if (isAdmin) {
            const activeTasksList = allTasks.filter(t => t.status !== 'COMPLETED');
            const busyList: (UserProfile & { taskCount: number })[] = [];
            const freeList: UserProfile[] = [];

            allUsers.forEach(u => {
                const userActiveTasks = activeTasksList.filter(t => t.assignedTo.includes(u.uid));
                if (userActiveTasks.length > 0) {
                    busyList.push({ ...u, taskCount: userActiveTasks.length });
                } else {
                    freeList.push(u);
                }
            });
            setStaffStats({ busy: busyList, free: freeList });
        }
    };

    const handleStaffClick = async (staff: UserProfile) => {
        if (user?.role !== UserRole.ADMIN) return;

        const allTasks = await AuthService.getAllTasks();
        const staffTasks = allTasks.filter(t => t.assignedTo.includes(staff.uid) && t.status !== 'COMPLETED');
        const completedTasks = allTasks.filter(t => t.assignedTo.includes(staff.uid) && t.status === 'COMPLETED');
        const late = await AuthService.getLateCountLast30Days(staff.uid);

        setSelectedStaff(staff);
        setSelectedStaffTasks(staffTasks);
        setStaffPerformance({
            completed: completedTasks.length,
            pending: staffTasks.length,
            lateCount: late
        });
    };

    const navigateToAttendance = (uid: string) => {
        navigate('/attendance', { state: { filterUserId: uid } });
    };

    const navigateToStaffProfile = () => {
        navigate('/staff');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    return (
        <div className="space-y-8">
            {/* Welcome Banner */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-navy-800 to-brand-900 shadow-2xl border border-white/10 animate-fade-in">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-brand-600/10 to-accent-purple/10"></div>

                <div className="relative p-8 flex flex-col md:flex-row justify-between items-center z-10">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 font-heading tracking-tight">
                            Good {new Date().getHours() < 12 ? 'Morning' : 'Afternoon'}, <span className="text-brand-500">{user?.displayName.split(' ')[0]}</span>
                        </h1>
                        <p className="text-gray-400 text-sm max-w-xl">
                            Here is your daily executive summary and performance metrics.
                        </p>
                    </div>
                    <div className="mt-6 md:mt-0 flex space-x-4">
                        <div className="glass-panel px-5 py-3 rounded-xl flex items-center space-x-3">
                            <CalendarDays size={20} className="text-accent-cyan" />
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Date (AD / BS)</p>
                                <p className="text-white font-mono text-sm">{new Date().toLocaleDateString()} / {toBS(new Date())} BS</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {user?.role === UserRole.ADMIN ? (
                    <StatCard
                        title="Active Staff"
                        value={activeStaffCount.toString()}
                        subtext="View Directory"
                        icon={Users}
                        gradient="from-brand-600 to-brand-800"
                        delay={100}
                        onClick={() => navigate('/staff')}
                    />
                ) : (
                    <StatCard
                        title="My Tasks"
                        value={taskData.find(d => d.name === 'Pending' || d.name === 'In Progress')?.value || 0}
                        subtext="Active Assignments"
                        icon={Briefcase}
                        gradient="from-brand-600 to-brand-800"
                        delay={100}
                        onClick={() => navigate('/tasks')}
                    />
                )}

                <StatCard
                    title="Task Completion"
                    value={`${Math.round((taskData.find(d => d.name === 'Completed')?.value || 0) / (taskData.reduce((a, b) => a + b.value, 0) || 1) * 100)}%`}
                    subtext="Efficiency Rate"
                    icon={Activity}
                    gradient="from-emerald-600 to-teal-800"
                    delay={200}
                />
                <StatCard
                    title="Pending Deliverables"
                    value={taskData.find(d => d.name === 'Pending')?.value || 0}
                    subtext="Needs Attention"
                    icon={AlertCircle}
                    gradient="from-amber-500 to-orange-700"
                    delay={300}
                    onClick={() => navigate('/tasks')}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* STAFF AVAILABILITY - ADMIN ONLY */}
                {user?.role === UserRole.ADMIN && (
                    <div className="lg:col-span-2 glass-panel p-6 rounded-2xl shadow-xl animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="text-lg font-bold text-white flex items-center font-heading">
                                <Users size={18} className="mr-2 text-brand-500" /> Staff Availability & Workload
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-72 overflow-y-auto custom-scrollbar pr-2">
                            {/* Busy Staff */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wide flex items-center mb-3">
                                    <UserCheck size={14} className="mr-1" /> Currently Assigned
                                </h4>
                                {staffStats.busy.length > 0 ? (
                                    staffStats.busy.map(staff => (
                                        <div
                                            key={staff.uid}
                                            onClick={() => handleStaffClick(staff)}
                                            className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
                                        >
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-700 to-navy-800 flex items-center justify-center text-xs font-bold text-white border border-white/10 mr-3">
                                                    {getInitials(staff.displayName)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-200 group-hover:text-white">{staff.displayName}</p>
                                                    <p className="text-[10px] text-gray-500">{staff.role}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-bold text-orange-400">{staff.taskCount} Tasks</span>
                                                <div className="w-16 h-1 bg-navy-900 rounded-full mt-1">
                                                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(staff.taskCount * 20, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No active assignments.</p>
                                )}
                            </div>

                            {/* Free Staff */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center mb-3">
                                    <UserX size={14} className="mr-1" /> Unassigned / Free
                                </h4>
                                {staffStats.free.length > 0 ? (
                                    staffStats.free.map(staff => (
                                        <div
                                            key={staff.uid}
                                            onClick={() => handleStaffClick(staff)}
                                            className="flex items-center justify-between bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-900 to-emerald-800 flex items-center justify-center text-xs font-bold text-emerald-100 border border-emerald-500/30 mr-3">
                                                    {getInitials(staff.displayName)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-emerald-100">{staff.displayName}</p>
                                                    <p className="text-[10px] text-emerald-400/70">{staff.role}</p>
                                                </div>
                                            </div>
                                            <span className="px-2 py-1 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/20">
                                                Available
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic">All staff are currently busy.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Task Distribution (Responsive Width based on role) */}
                <div className={`${user?.role === UserRole.ADMIN ? '' : 'lg:col-span-2'} glass-panel p-6 rounded-2xl shadow-xl flex flex-col animate-fade-in-up`} style={{ animationDelay: '500ms' }}>
                    <h3 className="text-lg font-bold text-white mb-4 font-heading flex items-center"><CheckSquare size={18} className="mr-2 text-emerald-500" /> Task Status</h3>
                    <div className="flex-1 min-h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={taskData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {taskData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                            <p className="text-4xl font-bold text-white animate-pulse-slow">{taskData.reduce((a, b) => a + b.value, 0)}</p>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Total Tasks</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid for Upcoming Events & Recent Tasks */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Upcoming Schedule Panel */}
                <div className="glass-panel p-6 rounded-2xl shadow-xl animate-fade-in-up" style={{ animationDelay: '550ms' }}>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white font-heading flex items-center">
                                <CalendarIcon size={18} className="mr-2 text-purple-400" /> Upcoming Schedule
                            </h3>
                            <p className="text-[10px] text-gray-400 mt-1">{scheduleRangeLabel}</p>
                        </div>
                        <button onClick={() => navigate('/calendar')} className="text-xs text-purple-300 hover:text-white transition-colors">View Calendar</button>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {upcomingSchedule.length > 0 ? (
                            upcomingSchedule.map((item) => (
                                <div key={item.id} className="flex items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border mr-4 ${item.type === 'EVENT' ? 'bg-purple-900/30 border-purple-500/30 text-purple-300' : 'bg-orange-900/30 border-orange-500/30 text-orange-300'
                                        }`}>
                                        <span className="text-[10px] font-bold uppercase">{new Date(item.date).toLocaleString('default', { month: 'short' })}</span>
                                        <span className="text-lg font-bold leading-none">{new Date(item.date).getDate()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-gray-200 text-sm group-hover:text-white truncate">{item.title}</h4>
                                            {item.type === 'DEADLINE' && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase flex-shrink-0 ml-2">Due</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-xs text-gray-500 flex items-center truncate">
                                                {item.type === 'EVENT' ? <Clock size={12} className="mr-1" /> : <Briefcase size={12} className="mr-1" />}
                                                <span className="truncate">{item.description || item.subType}</span>
                                            </p>
                                            {item.subType === 'URGENT' && <Flag size={12} className="text-red-500 flex-shrink-0 ml-2" fill="currentColor" />}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500 bg-white/5 rounded-xl border border-white/5 border-dashed">
                                <p className="text-sm">No upcoming events or deadlines.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Tasks Panel */}
                <div className="glass-panel p-6 rounded-2xl shadow-xl animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white font-heading flex items-center">
                            <Clock size={18} className="mr-2 text-accent-gold" /> {user?.role === UserRole.ADMIN ? 'Critical Tasks Overview' : 'My Recent Tasks'}
                        </h3>
                        <button
                            onClick={() => navigate('/tasks')}
                            className="text-xs bg-brand-600/20 text-brand-300 px-4 py-2 rounded-lg hover:bg-brand-600/30 transition-colors border border-brand-500/20 font-medium"
                        >
                            View All Tasks
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-300">
                            <thead>
                                <tr className="border-b border-white/5 text-gray-500 uppercase tracking-wider text-xs">
                                    <th className="pb-4 pl-4 font-semibold">Task / Client</th>
                                    <th className="pb-4 font-semibold">Assigned</th>
                                    <th className="pb-4 font-semibold">Status</th>
                                    <th className="pb-4 font-semibold">Priority</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {recentTasks.map((task) => (
                                    <tr key={task.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="py-4 pl-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-white group-hover:text-brand-400 transition-colors">{task.title}</span>
                                                <span className="text-xs text-gray-500">{task.clientName}</span>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex -space-x-2">
                                                {task.assignedTo.map((uid, idx) => {
                                                    const u = userMap[uid];
                                                    return (
                                                        <div key={uid} className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-700 to-navy-600 flex items-center justify-center text-xs font-bold text-white border border-white/10 shadow-sm" title={u?.displayName}>
                                                            {getInitials(u?.displayName || '?')}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide border ${task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    task.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        'bg-navy-700 text-gray-400 border-white/5'
                                                }`}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            <span className={`flex items-center text-xs font-bold ${task.priority === 'URGENT' ? 'text-red-400' :
                                                    task.priority === 'HIGH' ? 'text-orange-400' : 'text-blue-400'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full mr-2 shadow-[0_0_8px_currentColor] ${task.priority === 'URGENT' ? 'bg-red-500' :
                                                        task.priority === 'HIGH' ? 'bg-orange-500' : 'bg-blue-500'
                                                    }`}></div>
                                                {task.priority}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {recentTasks.length === 0 && (
                                    <tr><td colSpan={4} className="py-8 text-center text-gray-500">No recent tasks found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-navy-800 to-navy-900 border-b border-white/10 flex justify-between items-start">
                            <div className="flex items-center space-x-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-accent-purple flex items-center justify-center text-2xl font-bold text-white shadow-lg border border-white/20">
                                    {getInitials(selectedStaff.displayName)}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white font-heading">{selectedStaff.displayName}</h2>
                                    <div className="flex items-center space-x-2 text-sm text-gray-400 mt-1">
                                        <span className="bg-white/10 px-2 py-0.5 rounded text-xs">{selectedStaff.role}</span>
                                        <span>•</span>
                                        <span>{selectedStaff.department}</span>
                                        <span>•</span>
                                        <button onClick={navigateToStaffProfile} className="text-brand-400 hover:text-white hover:underline flex items-center">
                                            View Full Profile <ExternalLink size={12} className="ml-1" />
                                        </button>
                                    </div>
                                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                        <span className="flex items-center"><Mail size={12} className="mr-1" /> {selectedStaff.email}</span>
                                        <span className="flex items-center"><Phone size={12} className="mr-1" /> {selectedStaff.phoneNumber || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedStaff(null)} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-lg transition-colors"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {/* Performance Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <p className="text-xs text-gray-400 uppercase font-bold mb-1">Tasks Pending</p>
                                    <p className="text-2xl font-bold text-white">{staffPerformance.pending}</p>
                                    <div className="w-full bg-navy-900 h-1 mt-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-500 w-1/2"></div>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <p className="text-xs text-gray-400 uppercase font-bold mb-1">Tasks Completed</p>
                                    <p className="text-2xl font-bold text-emerald-400">{staffPerformance.completed}</p>
                                    <div className="w-full bg-navy-900 h-1 mt-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-3/4"></div>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <p className="text-xs text-gray-400 uppercase font-bold mb-1">Lateness (30d)</p>
                                    <p className={`text-2xl font-bold ${staffPerformance.lateCount > 3 ? 'text-red-400' : 'text-gray-200'}`}>{staffPerformance.lateCount}</p>
                                    <button
                                        onClick={() => navigateToAttendance(selectedStaff.uid)}
                                        className="text-[10px] text-blue-400 mt-2 hover:underline flex items-center"
                                    >
                                        View Attendance History <ExternalLink size={10} className="ml-1" />
                                    </button>
                                </div>
                            </div>

                            {/* Engaged Tasks */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                    <Briefcase size={18} className="mr-2 text-brand-500" /> Currently Engaged Tasks
                                </h3>
                                <div className="space-y-3">
                                    {selectedStaffTasks.length > 0 ? (
                                        selectedStaffTasks.map(task => (
                                            <div key={task.id} className="glass-panel p-4 rounded-xl flex justify-between items-center group hover:bg-white/5 transition-colors">
                                                <div>
                                                    <h4 className="font-bold text-gray-200 text-sm group-hover:text-white">{task.title}</h4>
                                                    <p className="text-xs text-gray-500">{task.clientName} • Assigned: {task.createdAt}</p>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border mb-1 ${task.priority === 'URGENT' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                            task.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                        }`}>
                                                        {task.priority}
                                                    </span>
                                                    <span className="text-xs text-white font-mono flex items-center">
                                                        <Clock size={12} className="mr-1 text-gray-400" /> Due: {task.dueDate} <span className="text-gray-500 ml-1">({toBS(task.dueDate)} BS)</span>
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center bg-white/5 rounded-xl border border-white/5 text-gray-500">
                                            No active tasks found for this user.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
