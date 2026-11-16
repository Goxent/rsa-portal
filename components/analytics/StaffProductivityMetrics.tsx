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
                return <TrendingUp size={15} style={{ color: 'var(--color-success)' }} />;
            case 'down':
                return <TrendingDown size={15} style={{ color: 'var(--color-danger)' }} />;
            default:
                return <Minus size={15} style={{ color: 'var(--text-muted)' }} />;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-[var(--color-success)]';
        if (score >= 60) return 'text-[var(--color-warning)]';
        return 'text-[var(--color-danger)]';
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-[rgba(79,178,134,0.1)] border-[rgba(79,178,134,0.25)]';
        if (score >= 60) return 'bg-[rgba(217,164,65,0.1)] border-[rgba(217,164,65,0.25)]';
        return 'bg-[rgba(224,112,122,0.1)] border-[rgba(224,112,122,0.25)]';
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
            <div className="flex items-center justify-center min-h-[300px]">
                <RefreshCw className="animate-spin text-[var(--accent)]" size={28} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-[var(--bg-surface)] border border-[rgba(224,112,122,0.25)] rounded-xl p-8 text-center max-w-md mx-auto">
                <AlertTriangle size={36} className="mx-auto mb-3 text-[var(--color-danger)]" />
                <p className="text-xs text-[var(--color-danger)] mb-4">{error}</p>
                <button
                    onClick={loadData}
                    className="px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
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
                    <h2 className="text-2xl font-bold text-[var(--text-heading)] flex items-center gap-2">
                        <BarChart3 className="text-[var(--accent)]" size={24} />
                        Staff Productivity Metrics
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        Analyze team performance and productivity trends
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-heading)] transition-colors"
                    >
                        <Filter size={14} />
                        Filters
                    </button>
                    <button
                        onClick={loadData}
                        className="p-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
                        title="Refresh data"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                    >
                        <Download size={14} />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 flex flex-wrap gap-4">
                    <div>
                        <label className="text-xs text-[var(--text-muted)] block mb-1">Date range</label>
                        <select
                            value={filters.dateRange}
                            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as ProductivityFilters['dateRange'] })}
                            className="bg-[var(--bg-main)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                        >
                            <option value="week">Last week</option>
                            <option value="month">This month</option>
                            <option value="quarter">Last quarter</option>
                            <option value="year">This year</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-[var(--text-muted)] block mb-1">Department</label>
                        <select
                            value={filters.department || ''}
                            onChange={(e) => setFilters({ ...filters, department: e.target.value || undefined })}
                            className="bg-[var(--bg-main)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                        >
                            <option value="">All departments</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-[var(--text-muted)] block mb-1">Sort by</label>
                        <select
                            value={filters.sortBy}
                            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as ProductivityFilters['sortBy'] })}
                            className="bg-[var(--bg-main)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                        >
                            <option value="score">Productivity score</option>
                            <option value="completion">Completion rate</option>
                            <option value="tasks">Total tasks</option>
                            <option value="name">Name</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-[var(--text-muted)] block mb-1">Order</label>
                        <select
                            value={filters.sortOrder}
                            onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })}
                            className="bg-[var(--bg-main)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                        >
                            <option value="desc">Highest first</option>
                            <option value="asc">Lowest first</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">Average score</span>
                        <div className="p-1.5 rounded-md bg-[var(--accent-dim)] text-[var(--accent)]">
                            <Users size={16} />
                        </div>
                    </div>
                    <p className={`text-2xl font-bold tabular-nums ${getScoreColor(avgScore)}`}>{avgScore}</p>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">Completed tasks</span>
                        <div className="p-1.5 rounded-md bg-[rgba(79,178,134,0.1)] text-[var(--color-success)]">
                            <CheckCircle size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-[var(--color-success)]">{totalCompleted}</p>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">Overdue tasks</span>
                        <div className="p-1.5 rounded-md bg-[rgba(224,112,122,0.1)] text-[var(--color-danger)]">
                            <AlertTriangle size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-[var(--color-danger)]">{totalOverdue}</p>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">On-time rate</span>
                        <div className="p-1.5 rounded-md bg-[rgba(217,164,65,0.1)] text-[var(--color-warning)]">
                            <Clock size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-[var(--color-warning)]">{avgOnTime}%</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar Chart - Staff Scores */}
                <div className="lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-4">Productivity by Staff</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    borderColor: 'var(--border)',
                                    borderRadius: '8px',
                                    color: 'var(--text-heading)',
                                    fontSize: '12px'
                                }}
                            />
                            <Legend />
                            <Bar dataKey="score" name="Score" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="completion" name="Completion %" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Pie Chart - Task Distribution */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-4">Task Distribution</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    borderColor: 'var(--border)',
                                    borderRadius: '8px',
                                    color: 'var(--text-heading)',
                                    fontSize: '12px'
                                }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Trend Line Chart */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-4">Completion Trends</h3>
                <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--bg-elevated)',
                                borderColor: 'var(--border)',
                                borderRadius: '8px',
                                color: 'var(--text-heading)',
                                fontSize: '12px'
                            }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--color-success)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="created" name="Created" stroke="var(--accent)" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Staff Table */}
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border)]">
                    <h3 className="text-sm font-semibold text-[var(--text-heading)]">Staff Details</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border)] font-medium text-[var(--text-muted)]">
                            <tr>
                                <th className="text-left px-4 py-2.5">Staff</th>
                                <th className="text-left px-4 py-2.5">Department</th>
                                <th className="text-center px-4 py-2.5">Score</th>
                                <th className="text-center px-4 py-2.5">Completion</th>
                                <th className="text-center px-4 py-2.5">Tasks</th>
                                <th className="text-center px-4 py-2.5">Overdue</th>
                                <th className="text-center px-4 py-2.5">On-time</th>
                                <th className="text-center px-4 py-2.5">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {metrics.map((m) => (
                                <tr
                                    key={m.staffId}
                                    onClick={() => setSelectedStaff(m)}
                                    className="hover:bg-[var(--bg-elevated)]/50 cursor-pointer transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-xs font-semibold text-[var(--accent)]">
                                                {m.staffName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-[var(--text-heading)]">{m.staffName}</p>
                                                <p className="text-[11px] text-[var(--text-muted)]">{m.role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-[var(--text-muted)]">{m.department || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums border ${getScoreBg(m.productivityScore)} ${getScoreColor(m.productivityScore)}`}>
                                            {m.productivityScore}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-[var(--text-heading)] tabular-nums">{m.completionRate}%</td>
                                    <td className="px-4 py-3 text-center text-[var(--text-heading)] tabular-nums">{m.totalTasks}</td>
                                    <td className="px-4 py-3 text-center tabular-nums">
                                        <span className={m.overdueTasks > 0 ? 'text-[var(--color-danger)] font-semibold' : 'text-[var(--text-muted)]'}>
                                            {m.overdueTasks}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-[var(--text-heading)] tabular-nums">{m.onTimeRate}%</td>
                                    <td className="px-4 py-3 text-center">{getTrendIcon(m.trend)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-xl font-bold text-[var(--accent)]">
                                    {selectedStaff.staffName.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-[var(--text-heading)]">{selectedStaff.staffName}</h2>
                                    <p className="text-xs text-[var(--text-muted)]">{selectedStaff.role} • {selectedStaff.department || 'General'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-heading)] rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Score Display */}
                        <div className="text-center mb-5">
                            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full border ${getScoreBg(selectedStaff.productivityScore)}`}>
                                <span className={`text-3xl font-bold tabular-nums ${getScoreColor(selectedStaff.productivityScore)}`}>
                                    {selectedStaff.productivityScore}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-1.5 font-medium">Productivity Score</p>
                        </div>

                        {/* Detailed Metrics */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3">
                                <p className="text-[var(--text-muted)]">Total tasks</p>
                                <p className="text-xl font-bold text-[var(--text-heading)] tabular-nums mt-0.5">{selectedStaff.totalTasks}</p>
                            </div>
                            <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3">
                                <p className="text-[var(--text-muted)]">Completed</p>
                                <p className="text-xl font-bold text-[var(--color-success)] tabular-nums mt-0.5">{selectedStaff.completedTasks}</p>
                            </div>
                            <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3">
                                <p className="text-[var(--text-muted)]">Active</p>
                                <p className="text-xl font-bold text-[var(--color-warning)] tabular-nums mt-0.5">{selectedStaff.activeTasks}</p>
                            </div>
                            <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3">
                                <p className="text-[var(--text-muted)]">Overdue</p>
                                <p className="text-xl font-bold text-[var(--color-danger)] tabular-nums mt-0.5">{selectedStaff.overdueTasks}</p>
                            </div>
                            <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3">
                                <p className="text-[var(--text-muted)]">Completion rate</p>
                                <p className="text-xl font-bold text-[var(--text-heading)] tabular-nums mt-0.5">{selectedStaff.completionRate}%</p>
                            </div>
                            <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3">
                                <p className="text-[var(--text-muted)]">On-time rate</p>
                                <p className="text-xl font-bold text-[var(--text-heading)] tabular-nums mt-0.5">{selectedStaff.onTimeRate}%</p>
                            </div>
                            <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3">
                                <p className="text-[var(--text-muted)]">This week</p>
                                <p className="text-xl font-bold text-[var(--text-heading)] tabular-nums mt-0.5">{selectedStaff.tasksCompletedThisWeek}</p>
                            </div>
                            <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3">
                                <p className="text-[var(--text-muted)]">This month</p>
                                <p className="text-xl font-bold text-[var(--text-heading)] tabular-nums mt-0.5">{selectedStaff.tasksCompletedThisMonth}</p>
                            </div>
                        </div>

                        {selectedStaff.avgCompletionTimeHours > 0 && (
                            <div className="mt-3 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg p-3 text-xs">
                                <p className="text-[var(--text-muted)]">Average completion time</p>
                                <p className="text-base font-bold text-[var(--text-heading)] tabular-nums mt-0.5">{selectedStaff.avgCompletionTimeHours} hours</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffProductivityMetrics;
