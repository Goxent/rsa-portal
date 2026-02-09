import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, CheckCircle, Clock, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';

const AdvancedAnalyticsPage: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('30'); // days
    const [stats, setStats] = useState({
        totalTasks: 0,
        completedTasks: 0,
        totalStaff: 0,
        avgCompletionTime: 0,
    });

    useEffect(() => {
        loadAnalytics();
    }, [dateRange]);

    const loadAnalytics = async () => {
        setLoading(true);
        // Load data from Firebase
        const tasks = await AuthService.getAllTasks();
        const staff = await AuthService.getAllUsers();

        setStats({
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
            totalStaff: staff.length,
            avgCompletionTime: 5.2, // Mock data
        });
        setLoading(false);
    };

    // Mock data for charts
    const taskCompletionData = [
        { name: 'Mon', completed: 12, pending: 8 },
        { name: 'Tue', completed: 15, pending: 6 },
        { name: 'Wed', completed: 10, pending: 10 },
        { name: 'Thu', completed: 18, pending: 4 },
        { name: 'Fri', completed: 14, pending: 7 },
        { name: 'Sat', completed: 8, pending: 3 },
        { name: 'Sun', completed: 5, pending: 2 },
    ];

    const staffPerformanceData = [
        { name: 'John Doe', tasks: 45, completion: 92 },
        { name: 'Jane Smith', tasks: 38, completion: 88 },
        { name: 'Bob Johnson', tasks: 42, completion: 85 },
        { name: 'Alice Brown', tasks: 35, completion: 95 },
    ];

    const priorityDistribution = [
        { name: 'High', value: 35, color: '#ef4444' },
        { name: 'Medium', value: 45, color: '#f59e0b' },
        { name: 'Low', value: 20, color: '#22c55e' },
    ];

    const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white">Advanced Analytics</h1>
                    <p className="text-sm text-gray-400">Performance insights and trends</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-4 py-2 rounded-lg text-sm"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center">
                        <Download size={16} className="mr-2" /> Export
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-400">Total Tasks</p>
                        <TrendingUp className="text-blue-400" size={20} />
                    </div>
                    <h3 className="text-3xl font-bold text-white">{stats.totalTasks}</h3>
                    <p className="text-xs text-green-400 mt-1">+12% from last period</p>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-400">Completed</p>
                        <CheckCircle className="text-green-400" size={20} />
                    </div>
                    <h3 className="text-3xl font-bold text-white">{stats.completedTasks}</h3>
                    <p className="text-xs text-green-400 mt-1">
                        {stats.totalTasks > 0 ? ((stats.completedTasks / stats.totalTasks) * 100).toFixed(0) : 0}% completion rate
                    </p>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-400">Active Staff</p>
                        <Users className="text-purple-400" size={20} />
                    </div>
                    <h3 className="text-3xl font-bold text-white">{stats.totalStaff}</h3>
                    <p className="text-xs text-gray-400 mt-1">Across all departments</p>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-400">Avg. Completion</p>
                        <Clock className="text-amber-400" size={20} />
                    </div>
                    <h3 className="text-3xl font-bold text-white">{stats.avgCompletionTime}d</h3>
                    <p className="text-xs text-green-400 mt-1">-1.2 days improved</p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Task Completion Trend */}
                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="font-bold text-white mb-4">Task Completion Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={taskCompletionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#f3f4f6' }}
                            />
                            <Legend />
                            <Bar dataKey="completed" fill="#22c55e" name="Completed" />
                            <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Staff Performance */}
                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="font-bold text-white mb-4">Staff Performance</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={staffPerformanceData} layout="horizontal">
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" stroke="#9ca3af" />
                            <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                            />
                            <Bar dataKey="completion" fill="#3b82f6" name="Completion %" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Priority Distribution */}
                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="font-bold text-white mb-4">Task Priority Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={priorityDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {priorityDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Weekly Trend */}
                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="font-bold text-white mb-4">Weekly Productivity Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={taskCompletionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AdvancedAnalyticsPage;
