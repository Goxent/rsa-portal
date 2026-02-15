import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { Task, User, TaskStatus, UserRole } from '../types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';
import {
    LayoutDashboard,
    AlertTriangle,
    CheckCircle2,
    Clock,
    User as UserIcon,
    Briefcase,
    Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

const ResourcePlanningPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [fetchedUsers, fetchedTasks] = await Promise.all([
                    AuthService.getAllUsers(),
                    AuthService.getAllTasks() // Assuming this fetches all tasks. If pagination exists, might need adjustment.
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    // Process Data for Chart
    const workloadData = users.map(user => {
        const userTasks = tasks.filter(t =>
            t.assignedTo.includes(user.uid) &&
            t.status !== TaskStatus.COMPLETED
        );

        const highRiskCount = userTasks.filter(t => t.riskLevel === 'HIGH').length;
        const overdueCount = userTasks.filter(t => {
            if (!t.dueDate) return false;
            return new Date(t.dueDate) < new Date();
        }).length;

        return {
            name: user.displayName,
            uid: user.uid,
            totalTasks: userTasks.length,
            highRisk: highRiskCount,
            overdue: overdueCount,
            tasks: userTasks
        };
    }).sort((a, b) => b.totalTasks - a.totalTasks);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-navy-900 border border-white/10 p-3 rounded-xl shadow-xl">
                    <p className="font-bold text-white mb-2">{label}</p>
                    <p className="text-brand-300 text-sm">Total Active Tasks: {payload[0].value}</p>
                    {payload[0].payload.highRisk > 0 && (
                        <p className="text-red-400 text-sm">High Risk: {payload[0].payload.highRisk}</p>
                    )}
                    {payload[0].payload.overdue > 0 && (
                        <p className="text-amber-400 text-sm">Overdue: {payload[0].payload.overdue}</p>
                    )}
                </div>
            );
        }
        return null;
    };

    const maxTasks = Math.max(...workloadData.map(d => d.totalTasks), 0);

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-brand-500/20 rounded-lg border border-brand-500/30">
                            <LayoutDashboard className="text-brand-400" size={24} />
                        </div>
                        Resource Planning
                    </h1>
                    <p className="text-gray-400 mt-1 ml-14">Workload balancing and team capacity insights</p>
                </div>

                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/5">
                    <div className="px-4 py-2 rounded-lg bg-navy-900/50 border border-white/5">
                        <span className="text-xs text-gray-400 uppercase tracking-wider block">Total Active Tasks</span>
                        <span className="text-xl font-bold text-white">{tasks.filter(t => t.status !== TaskStatus.COMPLETED).length}</span>
                    </div>
                </div>
            </div>

            {/* Main Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-transparent pointer-events-none" />
                    <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <BarChart3 className="text-brand-400" size={20} />
                        Team Workload Distribution
                    </h2>

                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={workloadData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#9ca3af"
                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    angle={-45}
                                    textAnchor="end"
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="totalTasks" radius={[4, 4, 0, 0]} maxBarSize={50} onClick={(data) => setSelectedUser(data.uid === selectedUser ? null : data.uid)}>
                                    {workloadData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.totalTasks > 5 ? '#f43f5e' : entry.totalTasks > 3 ? '#fbbf24' : '#3b82f6'}
                                            className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Insights / Details Panel */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col h-full lg:h-auto">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-amber-400" size={20} />
                        Workload Insights
                    </h2>

                    <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2 max-h-[400px]">
                        {workloadData.filter(d => d.totalTasks > 5).length > 0 ? (
                            workloadData.filter(d => d.totalTasks > 5).map(user => (
                                <div key={user.uid} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-red-200">{user.name}</h3>
                                        <span className="bg-red-500/20 text-red-200 text-xs px-2 py-0.5 rounded-full border border-red-500/20">Overloaded</span>
                                    </div>
                                    <p className="text-xs text-red-300 mb-2">Has {user.totalTasks} active tasks. Consider reassigning.</p>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-black/20 rounded-lg p-2 text-center">
                                            <span className="block text-lg font-bold text-white">{user.highRisk}</span>
                                            <span className="text-[10px] text-gray-400 uppercase">High Risk</span>
                                        </div>
                                        <div className="flex-1 bg-black/20 rounded-lg p-2 text-center">
                                            <span className="block text-lg font-bold text-white">{user.overdue}</span>
                                            <span className="text-[10px] text-gray-400 uppercase">Overdue</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 text-center bg-white/5 rounded-xl border border-white/5 border-dashed">
                                <CheckCircle2 className="text-emerald-500 mb-3" size={32} />
                                <p className="text-gray-300 font-medium">Workload Balanced</p>
                                <p className="text-xs text-gray-500">No team members are currently overloaded (&gt; 5 tasks).</p>
                            </div>
                        )}

                        {workloadData.filter(d => d.totalTasks === 0).length > 0 && (
                            <div className="mt-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Available Capacity</h3>
                                <div className="space-y-2">
                                    {workloadData.filter(d => d.totalTasks === 0).map(user => (
                                        <div key={user.uid} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-xs font-bold text-white">
                                                    {user.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-300">{user.name}</span>
                                            </div>
                                            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">Available</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Selected User Task Drilldown */}
            {selectedUser && (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Briefcase className="text-brand-400" size={24} />
                            Tasks for {users.find(u => u.uid === selectedUser)?.displayName}
                        </h2>
                        <button onClick={() => setSelectedUser(null)} className="text-xs text-gray-400 hover:text-white hover:underline">Clear Selection</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tasks.filter(t => t.assignedTo.includes(selectedUser) && t.status !== TaskStatus.COMPLETED).map(task => (
                            <div key={task.id} className="glass-panel p-4 rounded-xl border border-white/5 hover:border-brand-500/30 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wide border ${task.priority === 'HIGH' ? 'bg-red-500/10 text-red-300 border-red-500/20' : task.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-blue-500/10 text-blue-300 border-blue-500/20'}`}>
                                        {task.priority}
                                    </span>
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <Clock size={10} /> {task.dueDate}
                                    </span>
                                </div>
                                <h3 className="font-bold text-white text-sm mb-1 truncate">{task.title}</h3>
                                <p className="text-xs text-gray-400 mb-3 truncate">{task.clientName || 'Internal'}</p>
                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' : 'bg-gray-500'}`} />
                                        <span className="text-[10px] text-gray-400 uppercase font-medium">{task.status.replace('_', ' ')}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

function BarChart3(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
        </svg>
    )
}

export default ResourcePlanningPage;
