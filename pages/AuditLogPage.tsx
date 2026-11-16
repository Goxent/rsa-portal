import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { Search, Filter, FileSpreadsheet, Activity, ListIcon, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { UserRole } from '../types';
import * as ExcelJS from 'exceljs';
import { toast } from 'react-hot-toast';

interface AuditLogEntry {
    id?: string;
    action: string;
    userName?: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    performedBy?: string;
    adminName?: string;
    entityType?: string;
    entityId?: string;
    details?: string | any;
    oldData?: any;
    newData?: any;
    timestamp: any;
}

const AuditLogPage: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('ALL');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        const canViewLogs = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
        if (!canViewLogs) {
            setLoading(false);
            return;
        }

        const fetchLogs = async () => {
            try {
                const logsRef = collection(db, 'auditLogs');
                const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));
                const snapshot = await getDocs(q);

                const fetchedLogs: AuditLogEntry[] = [];
                snapshot.forEach(doc => {
                    fetchedLogs.push({ id: doc.id, ...doc.data() } as AuditLogEntry);
                });

                setLogs(fetchedLogs);
            } catch (error) {
                console.error('Error fetching audit logs:', error);
                toast.error('Failed to load audit logs.');
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [user]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch =
                (log.details && typeof log.details === 'string' && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (log.userName || log.adminName || log.performedBy || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.targetType || log.entityType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.targetId || log.entityId || '').toLowerCase().includes(searchTerm.toLowerCase());

            let matchesAction = true;
            if (actionFilter !== 'ALL') {
                if (actionFilter === 'CREATE') matchesAction = log.action.includes('CREATED') || log.action === 'CREATE';
                else if (actionFilter === 'UPDATE') matchesAction = log.action.includes('UPDATED') || log.action === 'UPDATE';
                else if (actionFilter === 'DELETE') matchesAction = log.action.includes('DELETED') || log.action === 'DELETE';
                else matchesAction = log.action === actionFilter;
            }

            let matchesDate = true;
            if (dateRange.start && dateRange.end) {
                const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                const start = new Date(dateRange.start);
                const end = new Date(dateRange.end);
                end.setHours(23, 59, 59, 999);
                if (logDate < start || logDate > end) matchesDate = false;
            }

            return matchesSearch && matchesAction && matchesDate;
        });
    }, [logs, searchTerm, actionFilter, dateRange]);

    const handleExportExcel = async () => {
        if (filteredLogs.length === 0) return toast.error('No logs to export');

        const dateStr = new Date().toISOString().split('T')[0];
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Audit Logs');

        sheet.columns = [
            { header: 'Timestamp', key: 'timestamp', width: 22 },
            { header: 'User', key: 'user', width: 20 },
            { header: 'Action', key: 'action', width: 15 },
            { header: 'Entity Type', key: 'targetType', width: 15 },
            { header: 'Entity ID', key: 'targetId', width: 25 },
            { header: 'Details/Changes', key: 'details', width: 50 },
        ];

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

        filteredLogs.forEach(log => {
            const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);

            let changesText = log.details || '';
            if (log.oldData && log.newData) {
                const changes = [];
                for (const key in log.newData) {
                    if (JSON.stringify(log.oldData[key]) !== JSON.stringify(log.newData[key])) {
                        changes.push(`${key}: ${JSON.stringify(log.oldData[key])} -> ${JSON.stringify(log.newData[key])}`);
                    }
                }
                if (changes.length > 0) changesText += ` | Changes: ${changes.join(', ')}`;
            }

            sheet.addRow({
                timestamp: format(logDate, 'yyyy-MM-dd HH:mm:ss'),
                user: log.userName || log.adminName || log.performedBy || 'System',
                action: log.action,
                targetType: log.targetType || log.entityType || 'Unknown',
                targetId: log.targetId || log.entityId || 'N/A',
                details: changesText
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RSA_AuditLogs_${dateStr}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Audit logs exported successfully');
    };

    const canViewLogs = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
    if (!canViewLogs) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-[rgba(224,112,122,0.1)] text-[var(--color-danger)]">
                    <ShieldAlert size={24} />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-heading)] mb-1">Access Denied</h2>
                <p className="text-xs text-[var(--text-muted)]">You do not have permission to view the audit log.</p>
            </div>
        );
    }

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'text-[var(--color-success)] bg-[rgba(79,178,134,0.1)] border-[rgba(79,178,134,0.25)]';
        if (action.includes('DELETE')) return 'text-[var(--color-danger)] bg-[rgba(224,112,122,0.1)] border-[rgba(224,112,122,0.25)]';
        return 'text-[var(--color-warning)] bg-[rgba(217,164,65,0.1)] border-[rgba(217,164,65,0.25)]';
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
            {/* Header */}
            <header className="flex-none bg-[var(--bg-surface)] border-b border-[var(--border)] p-5 relative z-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                            <Activity size={18} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[var(--text-heading)]">Audit Log</h1>
                            <p className="text-xs text-[var(--text-muted)]">Track all system actions and modifications</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-heading)] rounded-lg border border-[var(--border)] flex items-center gap-2 text-xs font-medium transition-colors"
                        >
                            <FileSpreadsheet size={15} style={{ color: 'var(--accent)' }} /> Export Excel
                        </button>
                    </div>
                </div>

                {/* Filters Toolbar */}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-2.5 text-[var(--text-muted)]" size={14} />
                        <input
                            type="text"
                            placeholder="Search by details, user, or entity ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Filter className="text-[var(--text-muted)]" size={14} />
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
                        >
                            <option value="ALL">All actions</option>
                            <option value="CREATE">Creates</option>
                            <option value="UPDATE">Updates</option>
                            <option value="DELETE">Deletes</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-main)] rounded-lg border border-[var(--border)]">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-transparent text-xs text-[var(--text-heading)] outline-none"
                        />
                        <span className="text-[var(--text-muted)] text-xs">to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="bg-transparent text-xs text-[var(--text-heading)] outline-none"
                        />
                        {(dateRange.start || dateRange.end) && (
                            <button onClick={() => setDateRange({ start: '', end: '' })} className="text-[var(--text-muted)] hover:text-[var(--color-danger)] p-0.5" title="Clear date range">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* List */}
            <main className="flex-1 min-h-0 flex flex-col p-4 md:p-6 overflow-hidden">
                <div className="bg-[var(--bg-surface)] flex-1 rounded-xl border border-[var(--border)] overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead className="sticky top-0 z-10 bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                                <tr className="text-xs text-[var(--text-muted)] font-medium">
                                    <th className="p-3 pl-4">Timestamp</th>
                                    <th className="p-3">User</th>
                                    <th className="p-3">Action</th>
                                    <th className="p-3">Entity</th>
                                    <th className="p-3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center">
                                            <div className="inline-block w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
                                            <p className="text-xs text-[var(--text-muted)] mt-2">Loading audit entries...</p>
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-16 text-center text-[var(--text-muted)]">
                                            <ListIcon size={28} className="mx-auto mb-2 opacity-40" />
                                            <p className="text-xs font-medium">No audit logs found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => {
                                        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                                        return (
                                            <tr key={log.id} className="hover:bg-[var(--bg-elevated)]/50 transition-colors">
                                                <td className="p-3 pl-4 text-xs text-[var(--text-muted)] whitespace-nowrap tabular-nums">
                                                    <div>{format(logDate, 'MMM d, yyyy')}</div>
                                                    <div className="text-[11px] text-[var(--text-muted)] opacity-70">{format(logDate, 'HH:mm:ss')}</div>
                                                </td>
                                                <td className="p-3 text-xs font-medium text-[var(--text-heading)]">
                                                    {log.userName || log.adminName || log.performedBy || 'System'}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium inline-block ${getActionColor(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-xs text-[var(--text-heading)]">
                                                    <div>{log.targetType || log.entityType || 'Unknown'}</div>
                                                    <div className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5 tabular-nums" title={log.targetId || log.entityId}>
                                                        ID: {(log.targetId || log.entityId || 'N/A').substring(0, 8)}...
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <p className="text-xs text-[var(--text-body)] mb-1">
                                                        {typeof log.details === 'string' ? log.details : (log.targetName ? `Action on ${log.targetName}` : '')}
                                                    </p>

                                                    {log.oldData && log.newData && (
                                                        <div className="mt-1.5 bg-[var(--bg-main)] rounded-md border border-[var(--border)] p-2 overflow-x-auto">
                                                            {Object.keys(log.newData).map(key => {
                                                                const oldV = JSON.stringify(log.oldData[key]);
                                                                const newV = JSON.stringify(log.newData[key]);
                                                                if (oldV !== newV && key !== 'updatedAt') {
                                                                    return (
                                                                        <div key={key} className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono mb-1 last:mb-0">
                                                                            <span className="text-[var(--text-heading)] font-semibold">{key}:</span>
                                                                            <span className="text-[var(--color-danger)] line-through bg-[rgba(224,112,122,0.1)] px-1 rounded">{oldV || 'null'}</span>
                                                                            <ArrowRight size={10} className="text-[var(--text-muted)]" />
                                                                            <span className="text-[var(--color-success)] bg-[rgba(79,178,134,0.1)] px-1 rounded">{newV || 'null'}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AuditLogPage;
