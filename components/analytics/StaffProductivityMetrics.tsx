import React, { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Filter,
    Download,
    RefreshCw,
    Users,
    CheckCircle,
    Clock,
    AlertTriangle,
    ChevronDown,
    X,
    BarChart3,
} from 'lucide-react';
import { StaffProductivityService, StaffMetrics, ProductivityFilters } from '../../services/staff-productivity';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

interface StaffProductivityMetricsProps {
    initialDateRange?: ProductivityFilters['dateRange'];
    departmentFilter?: string;
}

const StaffProductivityMetrics: React.FC<StaffProductivityMetricsProps> = ({
    initialDateRange = 'month',
    departmentFilter,
}) => {
    const [metrics, setMetrics] = useState<StaffMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedStaff, setSelectedStaff] = useState<StaffMetrics | null>(null);
    const [trendData, setTrendData] = useState<{ date: string; completed: number; created: number }[]>([]);

    const [filters, setFilters] = useState<ProductivityFilters>({
        dateRange: initialDateRange,
        department: departmentFilter,
        sortBy: 'score',
        sortOrder: 'desc',
    });

    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadData();
    }, [filters]);

    useEffect(() => {
        loadDepartments();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await StaffProductivityService.getAllStaffMetrics(filters);
            setMetrics(data);

            // Load trend data
            const trends = await StaffProductivityService.getCompletionTrend(null, filters.dateRange);
            setTrendData(trends);
        } catch (err) {
            console.error('Error loading productivity data:', err);
            setError('Failed to load productivity data');
        } finally {
            setLoading(false);
        }
    };

    const loadDepartments = async () => {
        try {
            const depts = await StaffProductivityService.getDepartments();
            setDepartments(depts);
        } catch (err) {
            console.error('Error loading departments:', err);
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text('Staff Productivity Report', 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
        doc.text(`Period: ${filters.dateRange}`, 14, 36);

        autoTable(doc, {
            head: [['Name', 'Dept', 'Score', 'Completion %', 'Tasks', 'Overdue', 'On-Time %']],
            body: metrics.map(m => [
                m.staffName,
                m.department || '-',
                m.productivityScore.toString(),
                `${m.completionRate}%`,
                m.totalTasks.toString(),
                m.overdueTasks.toString(),
                `${m.onTimeRate}%`,
            ]),
            startY: 42,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
        });

        doc.save('productivity-report.pdf');
    };

    const getTrendIcon = (trend: StaffMetrics['trend']) => {
        switch (trend) {
            case 'up':
                return <TrendingUp size={16} className="text-green-400" />;
            case 'down':
                return <TrendingDown size={16} className="text-red-400" />;
            default:
                return <Minus size={16} className="text-gray-400" />;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-green-500/20';
        if (score >= 60) return 'bg-yellow-500/20';
        return 'bg-red-500/20';
    };

    // Calculate summary stats
    const avgScore = metrics.length > 0
        ? Math.round(metrics.reduce((sum, m) => sum + m.productivityScore, 0) / metrics.length)
        : 0;
    const totalCompleted = metrics.reduce((sum, m) => sum + m.completedTasks, 0);
    const totalOverdue = metrics.reduce((sum, m) => sum + m.overdueTasks, 0);
    const avgOnTime = metrics.length > 0
        ? Math.round(metrics.reduce((sum, m) => sum + m.onTimeRate, 0) / metrics.length)
        : 0;

    // Prepare pie chart data
    const pieData = [
        { name: 'Completed', value: totalCompleted },
        { name: 'Active', value: metrics.reduce((sum, m) => sum + m.activeTasks, 0) },
        { name: 'Overdue', value: totalOverdue },
    ];

    // Prepare bar chart data (top 10 by score)
    const barData = metrics.slice(0, 10).map(m => ({
        name: m.staffName.split(' ')[0],
        score: m.productivityScore,
        completion: m.completionRate,
    }));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="animate-spin text-brand-500" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-panel rounded-2xl p-8 text-center">
                <AlertTriangle size={48} className="mx-auto mb-4 text-red-400" />
                <p className="text-red-400">{error}</p>
                <button
                    onClick={loadData}
                    className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-xl text-white"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BarChart3 className="text-brand-500" />
                        Staff Productivity Metrics
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Analyze team performance and productivity trends
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <Filter size={16} />
                        Filters
                    </button>
                    <button
                        onClick={loadData}
                        className="p-2 glass-card hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-xl text-white transition-colors"
                    >
                        <Download size={16} />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-4 animate-in slide-in-from-top-2">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Date Range</label>
                        <select
                            value={filters.dateRange}
                            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as ProductivityFilters['dateRange'] })}
                            className="glass-input px-3 py-2 rounded-lg text-sm"
                        >
                            <option value="week">Last Week</option>
                            <option value="month">This Month</option>
                            <option value="quarter">Last Quarter</option>
                            <option value="year">This Year</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Department</label>
                        <select
                            value={filters.department || ''}
                            onChange={(e) => setFilters({ ...filters, department: e.target.value || undefined })}
                            className="glass-input px-3 py-2 rounded-lg text-sm"
                        >
                            <option value="">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Sort By</label>
                        <select
                            value={filters.sortBy}
                            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as ProductivityFilters['sortBy'] })}
                            className="glass-input px-3 py-2 rounded-lg text-sm"
                        >
                            <option value="score">Productivity Score</option>
                            <option value="completion">Completion Rate</option>
                            <option value="tasks">Total Tasks</option>
                            <option value="name">Name</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Order</label>
                        <select
                            value={filters.sortOrder}
                            onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })}
                            className="glass-input px-3 py-2 rounded-lg text-sm"
                        >
                            <option value="desc">Highest First</option>
                            <option value="asc">Lowest First</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-brand-500/20">
                            <Users size={20} className="text-brand-400" />
                        </div>
                        <span className="text-gray-400 text-sm">Avg Score</span>
                    </div>
                    <p className={`text-3xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</p>
                </div>

                <div className="glass-panel rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-green-500/20">
                            <CheckCircle size={20} className="text-green-400" />
                        </div>
                        <span className="text-gray-400 text-sm">Completed</span>
                    </div>
                    <p className="text-3xl font-bold text-green-400">{totalCompleted}</p>
                </div>

                <div className="glass-panel rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-red-500/20">
                            <AlertTriangle size={20} className="text-red-400" />
                        </div>
                        <span className="text-gray-400 text-sm">Overdue</span>
                    </div>
                    <p className="text-3xl font-bold text-red-400">{totalOverdue}</p>
                </div>

                <div className="glass-panel rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <Clock size={20} className="text-blue-400" />
                        </div>
                        <span className="text-gray-400 text-sm">On-Time Rate</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-400">{avgOnTime}%</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar Chart - Staff Scores */}
                <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Productivity by Staff</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                            <YAxis stroke="#9ca3af" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                }}
                            />
                            <Legend />
                            <Bar dataKey="score" name="Score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="completion" name="Completion %" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Pie Chart - Task Distribution */}
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Task Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Trend Line Chart */}
            <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Completion Trends</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                        <YAxis stroke="#9ca3af" fontSize={12} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                            }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="created" name="Created" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Staff Table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Staff Details</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Staff</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Dept</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Score</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Completion</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Tasks</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Overdue</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">On-Time</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {metrics.map((m) => (
                                <tr
                                    key={m.staffId}
                                    onClick={() => setSelectedStaff(m)}
                                    className="hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-xs font-bold text-white">
                                                {m.staffName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">{m.staffName}</p>
                                                <p className="text-xs text-gray-500">{m.role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-400">{m.department || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-lg text-sm font-bold ${getScoreBg(m.productivityScore)} ${getScoreColor(m.productivityScore)}`}>
                                            {m.productivityScore}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-white">{m.completionRate}%</td>
                                    <td className="px-4 py-3 text-center text-sm text-white">{m.totalTasks}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={m.overdueTasks > 0 ? 'text-red-400 font-medium' : 'text-gray-400'}>
                                            {m.overdueTasks}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-white">{m.onTimeRate}%</td>
                                    <td className="px-4 py-3 text-center">{getTrendIcon(m.trend)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-2xl font-bold text-white">
                                    {selectedStaff.staffName.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedStaff.staffName}</h2>
                                    <p className="text-gray-400">{selectedStaff.role} • {selectedStaff.department || 'No Dept'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Score Display */}
                        <div className="text-center mb-6">
                            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getScoreBg(selectedStaff.productivityScore)}`}>
                                <span className={`text-4xl font-bold ${getScoreColor(selectedStaff.productivityScore)}`}>
                                    {selectedStaff.productivityScore}
                                </span>
                            </div>
                            <p className="text-gray-400 mt-2">Productivity Score</p>
                        </div>

                        {/* Detailed Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Total Tasks</p>
                                <p className="text-2xl font-bold text-white">{selectedStaff.totalTasks}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Completed</p>
                                <p className="text-2xl font-bold text-green-400">{selectedStaff.completedTasks}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Active</p>
                                <p className="text-2xl font-bold text-blue-400">{selectedStaff.activeTasks}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Overdue</p>
                                <p className="text-2xl font-bold text-red-400">{selectedStaff.overdueTasks}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Completion Rate</p>
                                <p className="text-2xl font-bold text-white">{selectedStaff.completionRate}%</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">On-Time Rate</p>
                                <p className="text-2xl font-bold text-white">{selectedStaff.onTimeRate}%</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">This Week</p>
                                <p className="text-2xl font-bold text-white">{selectedStaff.tasksCompletedThisWeek}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">This Month</p>
                                <p className="text-2xl font-bold text-white">{selectedStaff.tasksCompletedThisMonth}</p>
                            </div>
                        </div>

                        {selectedStaff.avgCompletionTimeHours > 0 && (
                            <div className="mt-4 bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Avg. Completion Time</p>
                                <p className="text-xl font-bold text-white">{selectedStaff.avgCompletionTimeHours} hours</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffProductivityMetrics;
