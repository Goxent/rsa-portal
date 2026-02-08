import React, { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
    LineChart,
    Line,
} from 'recharts';
import {
    Scale,
    Users,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    ArrowRight,
    CheckCircle,
    Zap,
    Brain,
    Target,
} from 'lucide-react';
import {
    WorkloadPredictionService,
    WorkloadPrediction,
    WorkloadRecommendation,
    TeamWorkloadSummary,
} from '../../services/workload-prediction';

const BURNOUT_COLORS = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
};

const WorkloadBalancingDashboard: React.FC = () => {
    const [predictions, setPredictions] = useState<WorkloadPrediction[]>([]);
    const [recommendations, setRecommendations] = useState<WorkloadRecommendation[]>([]);
    const [summary, setSummary] = useState<TeamWorkloadSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'recommendations'>('overview');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [pred, rec, sum] = await Promise.all([
                WorkloadPredictionService.getAllWorkloadPredictions(),
                WorkloadPredictionService.getRedistributionRecommendations(),
                WorkloadPredictionService.getTeamSummary(),
            ]);
            setPredictions(pred);
            setRecommendations(rec);
            setSummary(sum);
        } catch (error) {
            console.error('Failed to load workload data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getLoadColor = (current: number, capacity: number) => {
        const pct = (current / capacity) * 100;
        if (pct >= 90) return '#ef4444';
        if (pct >= 70) return '#f59e0b';
        if (pct >= 40) return '#10b981';
        return '#6b7280';
    };

    const getBalanceScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    // Prepare chart data
    const barChartData = predictions.map(p => ({
        name: p.staffName.split(' ')[0],
        current: p.currentLoad,
        capacity: p.capacity,
        optimal: p.optimalLoad,
        fill: getLoadColor(p.currentLoad, p.capacity),
    }));

    const distributionData = [
        { name: 'Overloaded', value: summary?.overloadedCount || 0, color: '#ef4444' },
        { name: 'Optimal', value: summary?.optimalCount || 0, color: '#10b981' },
        { name: 'Underutilized', value: summary?.underutilizedCount || 0, color: '#6b7280' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="animate-spin text-brand-500" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Brain className="text-purple-500" />
                        Predictive Workload Balancing
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        AI-powered workload analysis and optimization
                    </p>
                </div>

                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-white/10 rounded-xl transition-colors"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
                {(['overview', 'staff', 'recommendations'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-t-lg capitalize transition-colors ${activeTab === tab
                                ? 'bg-brand-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab}
                        {tab === 'recommendations' && recommendations.length > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-500 text-black rounded-full">
                                {recommendations.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && summary && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-panel rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-purple-500/20">
                                    <Scale size={20} className="text-purple-400" />
                                </div>
                                <span className="text-gray-400 text-sm">Balance Score</span>
                            </div>
                            <p className={`text-3xl font-bold ${getBalanceScoreColor(summary.balanceScore)}`}>
                                {summary.balanceScore}%
                            </p>
                        </div>

                        <div className="glass-panel rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-red-500/20">
                                    <AlertTriangle size={20} className="text-red-400" />
                                </div>
                                <span className="text-gray-400 text-sm">Overloaded</span>
                            </div>
                            <p className="text-3xl font-bold text-red-400">{summary.overloadedCount}</p>
                        </div>

                        <div className="glass-panel rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-green-500/20">
                                    <CheckCircle size={20} className="text-green-400" />
                                </div>
                                <span className="text-gray-400 text-sm">Optimal</span>
                            </div>
                            <p className="text-3xl font-bold text-green-400">{summary.optimalCount}</p>
                        </div>

                        <div className="glass-panel rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-yellow-500/20">
                                    <Zap size={20} className="text-yellow-400" />
                                </div>
                                <span className="text-gray-400 text-sm">Opportunities</span>
                            </div>
                            <p className="text-3xl font-bold text-yellow-400">
                                {summary.redistributionOpportunities}
                            </p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Workload Bar Chart */}
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Current vs Capacity</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={barChartData}>
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
                                    <Bar dataKey="current" name="Current" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="capacity" name="Capacity" fill="#374151" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Distribution */}
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Team Distribution</h3>
                            <div className="flex items-center justify-center h-[300px]">
                                <div className="flex gap-8">
                                    {distributionData.map(d => (
                                        <div key={d.name} className="text-center">
                                            <div
                                                className="w-20 h-20 rounded-full flex items-center justify-center mb-2 mx-auto"
                                                style={{ backgroundColor: `${d.color}20` }}
                                            >
                                                <span className="text-2xl font-bold" style={{ color: d.color }}>
                                                    {d.value}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400">{d.name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Staff Tab */}
            {activeTab === 'staff' && (
                <div className="glass-panel rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Staff</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Load</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Capacity</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Hours Est.</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Next Week</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Burnout Risk</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {predictions.map(p => {
                                    const loadPct = Math.round((p.currentLoad / p.capacity) * 100);
                                    return (
                                        <tr key={p.staffId} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-xs font-bold text-white">
                                                        {p.staffName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{p.staffName}</p>
                                                        <p className="text-xs text-gray-500">{p.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${Math.min(100, loadPct)}%`,
                                                                backgroundColor: getLoadColor(p.currentLoad, p.capacity),
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-sm text-white">{p.currentLoad}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-400">{p.capacity}</td>
                                            <td className="px-4 py-3 text-center text-sm text-white">{p.currentHours}h</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="flex items-center justify-center gap-1 text-sm">
                                                    {p.predictedLoadNextWeek > p.currentLoad ? (
                                                        <TrendingUp size={14} className="text-red-400" />
                                                    ) : (
                                                        <TrendingDown size={14} className="text-green-400" />
                                                    )}
                                                    {p.predictedLoadNextWeek}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span
                                                    className="px-2 py-0.5 text-xs rounded-full"
                                                    style={{
                                                        backgroundColor: `${BURNOUT_COLORS[p.burnoutRisk]}20`,
                                                        color: BURNOUT_COLORS[p.burnoutRisk],
                                                    }}
                                                >
                                                    {p.burnoutRisk}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {p.canTakeMore ? (
                                                    <span className="text-green-400 text-xs">+ Available</span>
                                                ) : p.suggestedReduction > 0 ? (
                                                    <span className="text-red-400 text-xs">- Reduce {p.suggestedReduction}</span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">At capacity</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Recommendations Tab */}
            {activeTab === 'recommendations' && (
                <div className="space-y-4">
                    {recommendations.length === 0 ? (
                        <div className="glass-panel rounded-2xl p-12 text-center">
                            <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
                            <p className="text-lg font-medium text-white">Workload is Balanced!</p>
                            <p className="text-gray-400">No redistribution needed at this time</p>
                        </div>
                    ) : (
                        recommendations.map((rec, index) => (
                            <div
                                key={index}
                                className={`glass-panel rounded-2xl p-4 border-l-4 ${rec.priority === 'high' ? 'border-l-red-500' :
                                        rec.priority === 'medium' ? 'border-l-yellow-500' :
                                            'border-l-gray-500'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                                    rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {rec.priority} priority
                                            </span>
                                        </div>
                                        <h4 className="font-medium text-white mb-1">{rec.taskTitle}</h4>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <span>{rec.currentAssigneeName}</span>
                                            <ArrowRight size={14} className="text-brand-400" />
                                            <span className="text-brand-400">{rec.suggestedAssigneeName}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">{rec.reason}</p>
                                    </div>
                                    <button className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm text-white transition-colors">
                                        Apply
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkloadBalancingDashboard;
