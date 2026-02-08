import React, { useState, useEffect } from 'react';
import {
    Shield,
    AlertTriangle,
    CheckCircle,
    Lock,
    Users,
    Activity,
    Clock,
    Eye,
    Download,
    RefreshCw,
    Search,
    Filter,
    X,
    ChevronDown,
    AlertCircle,
    FileText,
    User,
    Bell,
} from 'lucide-react';
import { AuditLogger } from '../../services/audit-logger';
import {
    AuditLogEntry,
    AuditLogFilters,
    SecurityAlert,
    SecurityStats,
    AuditAction,
    AuditRiskLevel
} from '../../types/security';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const RISK_COLORS = {
    low: 'text-gray-400 bg-gray-500/20',
    medium: 'text-yellow-400 bg-yellow-500/20',
    high: 'text-orange-400 bg-orange-500/20',
    critical: 'text-red-400 bg-red-500/20',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
    auth: Lock,
    user: User,
    task: CheckCircle,
    client: Users,
    attendance: Clock,
    leave: Bell,
    resource: FileText,
    settings: Shield,
    export: Download,
    search: Search,
};

const SecurityDashboard: React.FC = () => {
    const [stats, setStats] = useState<SecurityStats | null>(null);
    const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'alerts'>('overview');

    // Filters
    const [filters, setFilters] = useState<AuditLogFilters>({});
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') {
            loadLogs();
        }
    }, [activeTab, filters]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsData, alertsData, logsData] = await Promise.all([
                AuditLogger.getSecurityStats(),
                AuditLogger.getAlerts(),
                AuditLogger.getLogs({ ...filters, searchQuery }),
            ]);
            setStats(statsData);
            setAlerts(alertsData);
            setLogs(logsData);
        } catch (error) {
            console.error('Failed to load security data', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLogs = async () => {
        try {
            const logsData = await AuditLogger.getLogs({ ...filters, searchQuery });
            setLogs(logsData);
        } catch (error) {
            console.error('Failed to load logs', error);
        }
    };

    const handleResolveAlert = async (alertId: string) => {
        await AuditLogger.resolveAlert(alertId);
        setAlerts(alerts.filter(a => a.id !== alertId));
        loadData();
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text('Security Audit Report', 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

        if (stats) {
            doc.text(`Security Score: ${stats.securityScore}/100`, 14, 38);
            doc.text(`Logins (24h): ${stats.totalLogins24h}`, 14, 44);
            doc.text(`Failed Logins (24h): ${stats.failedLogins24h}`, 14, 50);
            doc.text(`Active Alerts: ${stats.activeAlerts}`, 14, 56);
        }

        autoTable(doc, {
            head: [['Time', 'User', 'Action', 'Resource', 'Risk']],
            body: logs.slice(0, 100).map(log => [
                new Date(log.timestamp).toLocaleString(),
                log.userName,
                log.action,
                log.resource,
                log.riskLevel,
            ]),
            startY: 64,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [59, 130, 246] },
        });

        doc.save('security-audit-report.pdf');
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Poor';
    };

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
                        <Shield className="text-brand-500" />
                        Security Dashboard
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Monitor security events and audit logs
                    </p>
                </div>

                <div className="flex gap-2">
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
                        Export Report
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
                {(['overview', 'logs', 'alerts'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-t-lg capitalize transition-colors ${activeTab === tab
                                ? 'bg-brand-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab}
                        {tab === 'alerts' && alerts.length > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 rounded-full">
                                {alerts.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                    {/* Security Score */}
                    <div className="glass-panel rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Security Score</h3>
                            <span className={`text-sm ${getScoreColor(stats.securityScore)}`}>
                                {getScoreLabel(stats.securityScore)}
                            </span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="relative w-32 h-32">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="56"
                                        stroke="currentColor"
                                        strokeWidth="12"
                                        fill="transparent"
                                        className="text-white/10"
                                    />
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="56"
                                        stroke="currentColor"
                                        strokeWidth="12"
                                        fill="transparent"
                                        strokeDasharray={`${stats.securityScore * 3.52} 352`}
                                        strokeLinecap="round"
                                        className={getScoreColor(stats.securityScore)}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={`text-4xl font-bold ${getScoreColor(stats.securityScore)}`}>
                                        {stats.securityScore}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 grid grid-cols-2 gap-4">
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Lock size={16} className="text-green-400" />
                                        <span className="text-sm text-gray-400">Logins (24h)</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{stats.totalLogins24h}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle size={16} className="text-red-400" />
                                        <span className="text-sm text-gray-400">Failed (24h)</span>
                                    </div>
                                    <p className="text-2xl font-bold text-red-400">{stats.failedLogins24h}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Activity size={16} className="text-blue-400" />
                                        <span className="text-sm text-gray-400">Changes (24h)</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{stats.dataChanges24h}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Bell size={16} className="text-yellow-400" />
                                        <span className="text-sm text-gray-400">Active Alerts</span>
                                    </div>
                                    <p className="text-2xl font-bold text-yellow-400">{stats.activeAlerts}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Alerts */}
                    {alerts.length > 0 && (
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Active Alerts</h3>
                            <div className="space-y-3">
                                {alerts.slice(0, 5).map(alert => (
                                    <div
                                        key={alert.id}
                                        className={`flex items-center justify-between p-4 rounded-xl ${alert.severity === 'critical' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <AlertCircle
                                                size={20}
                                                className={alert.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-white">{alert.description}</p>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(alert.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleResolveAlert(alert.id)}
                                            className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                                        >
                                            Resolve
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Activity */}
                    <div className="glass-panel rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                        <div className="space-y-2">
                            {logs.slice(0, 10).map(log => {
                                const [category] = log.action.split('.') as [string];
                                const Icon = ACTION_ICONS[category] || Activity;

                                return (
                                    <div
                                        key={log.id}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        <div className={`p-2 rounded-lg ${RISK_COLORS[log.riskLevel].split(' ')[1]}`}>
                                            <Icon size={16} className={RISK_COLORS[log.riskLevel].split(' ')[0]} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{log.description}</p>
                                            <p className="text-xs text-gray-500">
                                                {log.userName} • {new Date(log.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${RISK_COLORS[log.riskLevel]}`}>
                                            {log.riskLevel}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
                <div className="space-y-4">
                    {/* Search and Filters */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                                placeholder="Search logs..."
                                className="w-full pl-10 pr-4 py-2 glass-input rounded-xl text-sm"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <Filter size={16} />
                            Filters
                        </button>
                    </div>

                    {showFilters && (
                        <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-4">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Risk Level</label>
                                <select
                                    value={filters.riskLevel || ''}
                                    onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value as AuditRiskLevel || undefined })}
                                    className="glass-input px-3 py-2 rounded-lg text-sm"
                                >
                                    <option value="">All</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={filters.startDate?.split('T')[0] || ''}
                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                    className="glass-input px-3 py-2 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={filters.endDate?.split('T')[0] || ''}
                                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                    className="glass-input px-3 py-2 rounded-lg text-sm"
                                />
                            </div>
                            <button
                                onClick={() => { setFilters({}); setSearchQuery(''); }}
                                className="self-end px-3 py-2 text-sm text-gray-400 hover:text-white"
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    {/* Logs Table */}
                    <div className="glass-panel rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Time</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">User</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Action</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Resource</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Risk</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-300">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-brand-500/30 flex items-center justify-center text-xs text-white">
                                                        {log.userName.charAt(0)}
                                                    </div>
                                                    <span className="text-sm text-white">{log.userName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-300">{log.action}</td>
                                            <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-xs">{log.resource}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${RISK_COLORS[log.riskLevel]}`}>
                                                    {log.riskLevel}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {logs.length === 0 && (
                            <div className="py-12 text-center text-gray-400">
                                <Activity size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No audit logs found</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
                <div className="space-y-4">
                    {alerts.length === 0 ? (
                        <div className="glass-panel rounded-2xl p-12 text-center">
                            <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
                            <p className="text-lg font-medium text-white">All Clear!</p>
                            <p className="text-gray-400">No active security alerts</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {alerts.map(alert => (
                                <div
                                    key={alert.id}
                                    className={`glass-panel rounded-2xl p-4 ${alert.severity === 'critical' ? 'border-l-4 border-red-500' : 'border-l-4 border-yellow-500'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle
                                                size={24}
                                                className={alert.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}
                                            />
                                            <div>
                                                <p className="font-medium text-white">{alert.description}</p>
                                                <p className="text-sm text-gray-400 mt-1">
                                                    Type: {alert.type.replace('_', ' ')} • {new Date(alert.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleResolveAlert(alert.id)}
                                            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm text-white transition-colors"
                                        >
                                            Resolve
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SecurityDashboard;
