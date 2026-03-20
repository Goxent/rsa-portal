import React, { useState, useEffect } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
} from 'recharts';
import {
    Users,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Star,
    Filter,
    Download,
    RefreshCw,
    ChevronRight,
    X,
    Heart,
    Target,
    Zap,
} from 'lucide-react';
import {
    ClientEngagementService,
    ClientEngagementScore,
    EngagementTier
} from '../../services/client-engagement';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TIER_COLORS: Record<EngagementTier, string> = {
    inactive: '#6b7280',
    low: '#ef4444',
    medium: '#f59e0b',
    high: '#10b981',
    champion: '#3b82f6',
};

const TIER_LABELS: Record<EngagementTier, string> = {
    inactive: 'Inactive',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    champion: 'Champion',
};

const ClientEngagementDashboard: React.FC = () => {
    const [scores, setScores] = useState<ClientEngagementScore[]>([]);
    const [summary, setSummary] = useState<{
        totalClients: number;
        avgScore: number;
        tierBreakdown: Record<EngagementTier, number>;
        atRiskCount: number;
        championsCount: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<ClientEngagementScore | null>(null);
    const [filters, setFilters] = useState({
        tier: '' as EngagementTier | '',
        riskLevel: '' as 'low' | 'medium' | 'high' | '',
        sortBy: 'score' as 'score' | 'name' | 'risk',
        sortOrder: 'desc' as 'asc' | 'desc',
    });
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadData();
    }, [filters]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [scoresData, summaryData] = await Promise.all([
                ClientEngagementService.getAllClientScores({
                    tier: filters.tier || undefined,
                    riskLevel: filters.riskLevel || undefined,
                    sortBy: filters.sortBy,
                    sortOrder: filters.sortOrder,
                }),
                ClientEngagementService.getEngagementSummary(),
            ]);
            setScores(scoresData);
            setSummary(summaryData);
        } catch (error) {
            console.error('Failed to load engagement data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text('Client Engagement Report', 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

        if (summary) {
            doc.text(`Total Clients: ${summary.totalClients}`, 14, 38);
            doc.text(`Average Score: ${summary.avgScore}`, 14, 44);
            doc.text(`At-Risk Clients: ${summary.atRiskCount}`, 14, 50);
            doc.text(`Champions: ${summary.championsCount}`, 14, 56);
        }

        autoTable(doc, {
            head: [['Client', 'Business', 'Score', 'Tier', 'Risk', 'Improvements']],
            body: scores.map(s => [
                s.clientName,
                s.businessName || '-',
                s.totalScore.toString(),
                TIER_LABELS[s.tier],
                s.riskLevel,
                s.improvements.slice(0, 2).join(', '),
            ]),
            startY: 64,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [59, 130, 246] },
        });

        doc.save('client-engagement-report.pdf');
    };

    const getTierBadgeClass = (tier: EngagementTier) => {
        const baseClass = 'px-2 py-0.5 text-xs rounded-full font-medium';
        switch (tier) {
            case 'champion': return `${baseClass} bg-amber-500/20 text-amber-400`;
            case 'high': return `${baseClass} bg-green-500/20 text-green-400`;
            case 'medium': return `${baseClass} bg-yellow-500/20 text-yellow-400`;
            case 'low': return `${baseClass} bg-red-500/20 text-red-400`;
            default: return `${baseClass} bg-gray-500/20 text-gray-400`;
        }
    };

    // Prepare pie chart data
    const pieData = summary ? Object.entries(summary.tierBreakdown)
        .filter(([_, count]) => count > 0)
        .map(([tier, count]) => ({
            name: TIER_LABELS[tier as EngagementTier],
            value: count,
            color: TIER_COLORS[tier as EngagementTier],
        })) : [];

    // Prepare bar chart data (top 10 clients)
    const barData = scores.slice(0, 10).map(s => ({
        name: s.clientName.length > 12 ? s.clientName.slice(0, 12) + '...' : s.clientName,
        score: s.totalScore,
        fill: TIER_COLORS[s.tier],
    }));

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
                        <Heart className="text-pink-500" />
                        Client Engagement Scoring
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Track and improve client relationships
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
                        Export
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-4 animate-in slide-in-from-top-2">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Tier</label>
                        <select
                            value={filters.tier}
                            onChange={(e) => setFilters({ ...filters, tier: e.target.value as EngagementTier | '' })}
                            className="glass-input px-3 py-2 rounded-lg text-sm"
                        >
                            <option value="">All Tiers</option>
                            <option value="champion">Champion</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Risk Level</label>
                        <select
                            value={filters.riskLevel}
                            onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value as 'low' | 'medium' | 'high' | '' })}
                            className="glass-input px-3 py-2 rounded-lg text-sm"
                        >
                            <option value="">All Risk Levels</option>
                            <option value="high">High Risk</option>
                            <option value="medium">Medium Risk</option>
                            <option value="low">Low Risk</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Sort By</label>
                        <select
                            value={filters.sortBy}
                            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as 'score' | 'name' | 'risk' })}
                            className="glass-input px-3 py-2 rounded-lg text-sm"
                        >
                            <option value="score">Score</option>
                            <option value="name">Name</option>
                            <option value="risk">Risk Level</option>
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
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-panel rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-brand-500/20">
                                <Users size={20} className="text-brand-400" />
                            </div>
                            <span className="text-gray-400 text-sm">Total Clients</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{summary.totalClients}</p>
                    </div>

                    <div className="glass-panel rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-green-500/20">
                                <Target size={20} className="text-green-400" />
                            </div>
                            <span className="text-gray-400 text-sm">Avg Score</span>
                        </div>
                        <p className="text-3xl font-bold text-green-400">{summary.avgScore}</p>
                    </div>

                    <div className="glass-panel rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-red-500/20">
                                <AlertTriangle size={20} className="text-red-400" />
                            </div>
                            <span className="text-gray-400 text-sm">At Risk</span>
                        </div>
                        <p className="text-3xl font-bold text-red-400">{summary.atRiskCount}</p>
                    </div>

                    <div className="glass-panel rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-amber-500/20">
                                <Star size={20} className="text-amber-400" />
                            </div>
                            <span className="text-gray-400 text-sm">Champions</span>
                        </div>
                        <p className="text-3xl font-bold text-amber-400">{summary.championsCount}</p>
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tier Distribution */}
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Engagement Tiers</h3>
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
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
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

                {/* Top Clients Bar Chart */}
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Top Client Scores</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis type="number" stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
                            <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={80} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                }}
                            />
                            <Bar dataKey="score" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Client List */}
            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Client Details</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Client</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Score</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Tier</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Risk</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Top Improvement</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {scores.map((s) => (
                                <tr key={s.clientId} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-white">{s.clientName}</p>
                                            {s.businessName && (
                                                <p className="text-xs text-gray-500">{s.businessName}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full"
                                            style={{ backgroundColor: `${TIER_COLORS[s.tier]}20` }}>
                                            <span className="text-lg font-bold" style={{ color: TIER_COLORS[s.tier] }}>
                                                {s.totalScore}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={getTierBadgeClass(s.tier)}>
                                            {TIER_LABELS[s.tier]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${s.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                                                s.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-green-500/20 text-green-400'
                                            }`}>
                                            {s.riskLevel}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-400">
                                        {s.improvements[0] || 'None'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => setSelectedClient(s)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                        >
                                            <ChevronRight size={16} className="text-gray-400" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Client Detail Modal */}
            {selectedClient && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">{selectedClient.clientName}</h2>
                                <p className="text-gray-400">{selectedClient.businessName || 'No business name'}</p>
                            </div>
                            <button
                                onClick={() => setSelectedClient(null)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Score Overview */}
                        <div className="flex items-center gap-6 mb-6">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${TIER_COLORS[selectedClient.tier]}20` }}>
                                <span className="text-4xl font-bold" style={{ color: TIER_COLORS[selectedClient.tier] }}>
                                    {selectedClient.totalScore}
                                </span>
                            </div>
                            <div>
                                <span className={getTierBadgeClass(selectedClient.tier)}>
                                    {TIER_LABELS[selectedClient.tier]}
                                </span>
                                <p className="text-gray-400 text-sm mt-2">
                                    Last interaction: {selectedClient.lastInteraction
                                        ? new Date(selectedClient.lastInteraction).toLocaleDateString()
                                        : 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Radar Chart */}
                        <div className="mb-6">
                            <ResponsiveContainer width="100%" height={250}>
                                <RadarChart data={[
                                    { category: 'Tasks', value: selectedClient.taskActivityScore },
                                    { category: 'Communication', value: selectedClient.communicationScore },
                                    { category: 'Billing', value: selectedClient.billingScore },
                                    { category: 'Documents', value: selectedClient.documentScore },
                                    { category: 'Retention', value: selectedClient.retentionScore },
                                ]}>
                                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                    <PolarAngleAxis dataKey="category" stroke="#9ca3af" fontSize={12} />
                                    <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#9ca3af" fontSize={10} />
                                    <Radar
                                        name="Score"
                                        dataKey="value"
                                        stroke={TIER_COLORS[selectedClient.tier]}
                                        fill={TIER_COLORS[selectedClient.tier]}
                                        fillOpacity={0.3}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Score Breakdown */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Task Activity</p>
                                <p className="text-2xl font-bold text-white">{selectedClient.taskActivityScore}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Communication</p>
                                <p className="text-2xl font-bold text-white">{selectedClient.communicationScore}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Billing</p>
                                <p className="text-2xl font-bold text-white">{selectedClient.billingScore}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Documents</p>
                                <p className="text-2xl font-bold text-white">{selectedClient.documentScore}</p>
                            </div>
                        </div>

                        {/* Insights */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                                    <Zap size={16} /> Strengths
                                </h4>
                                <ul className="space-y-1">
                                    {selectedClient.strengths.map((s, i) => (
                                        <li key={i} className="text-sm text-gray-300">• {s}</li>
                                    ))}
                                    {selectedClient.strengths.length === 0 && (
                                        <li className="text-sm text-gray-500">No notable strengths</li>
                                    )}
                                </ul>
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                                    <Target size={16} /> Improvements
                                </h4>
                                <ul className="space-y-1">
                                    {selectedClient.improvements.map((s, i) => (
                                        <li key={i} className="text-sm text-gray-300">• {s}</li>
                                    ))}
                                    {selectedClient.improvements.length === 0 && (
                                        <li className="text-sm text-gray-500">No improvements needed</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientEngagementDashboard;
