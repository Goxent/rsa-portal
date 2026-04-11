import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Search, Filter, FileSpreadsheet, Activity, ListIcon, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { UserRole } from '../types';
import * as ExcelJS from 'exceljs';
import { toast } from 'react-hot-toast';

interface AuditLogEntry {
    id?: string;
    action: string;
    // New fields
    userName?: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    // Old fields (for compatibility if any existing data)
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
                // Fetch up to 1000 logs for the viewer
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

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

        filteredLogs.forEach(log => {
            const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);

            // Format changes if oldData/newData exist
            let changesText = log.details || '';
            if (log.oldData && log.newData) {
                // simple diff extraction
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
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-transparent">
                <ShieldAlert size={48} className="text-red-500/50 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-gray-400">You do not have permission to view the audit log.</p>
            </div>
        );
    }

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'text-brand-400 bg-brand-500/10 border-brand-500/20';
        if (action.includes('DELETE')) return 'text-red-400 bg-red-500/10 border-red-500/20';
        if (action.includes('UPDATE')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-transparent">
            {/* Header */}
            <header className="flex-none glass-panel border-b border-white/[0.05] p-6 pb-5 relative z-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 border-r border-white/10 pr-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
                            <Activity className="text-white" size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white tracking-tight">Audit Log</h1>
                            <p className="text-[10px] font-medium text-gray-400">Track all system actions and modifications</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.08] text-brand-400 rounded-xl border border-white/[0.05] flex items-center gap-2 text-xs font-bold transition-all shadow-lg"
                        >
                            <FileSpreadsheet size={16} /> Export Excel
                        </button>
                    </div>
                </div>

                {/* Filters Toolbar */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search by details, user, or entity ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:border-amber-500 focus:bg-white/10 transition-all outline-none placeholder:text-gray-500"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="text-gray-500" size={14} />
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 transition-all outline-none"
                        >
                            <option value="ALL">All Actions</option>
                            <option value="CREATE">Creates</option>
                            <option value="UPDATE">Updates</option>
                            <option value="DELETE">Deletes</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-xl border border-white/10">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-transparent text-xs text-gray-300 outline-none w-24"
                        />
                        <span className="text-gray-500 text-xs">to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="bg-transparent text-xs text-gray-300 outline-none w-24"
                        />
                        {(dateRange.start || dateRange.end) && (
                            <button onClick={() => setDateRange({ start: '', end: '' })} className="text-rose-400 hover:text-rose-300 p-1">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* List */}
            <main className="flex-1 min-h-0 bg-transparent flex flex-col p-6 overflow-hidden">
                <div className="glass-panel flex-1 rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-2xl">
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead className="sticky top-0 z-10 bg-[#09090b] shadow-xl">
                                <tr className="border-b border-white/10 text-[10px] text-gray-400 uppercase font-bold tracking-widest bg-white/5 backdrop-blur-md">
                                    <th className="p-4">Timestamp</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Action</th>
                                    <th className="p-4">Entity Type</th>
                                    <th className="p-4">Changes & Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center">
                                            <div className="flex items-center justify-center space-x-2 text-amber-400">
                                                <div className="w-2 h-2 rounded-full bg-current animate-bounce" />
                                                <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0.2s' }} />
                                                <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0.4s' }} />
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-16 text-center text-gray-500">
                                            <ListIcon size={32} className="mx-auto mb-4 opacity-50" />
                                            <p className="font-medium">No audit logs found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => {
                                        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                                        return (
                                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-4 text-[11px] text-gray-400 font-mono whitespace-nowrap">
                                                    {format(logDate, 'MMM d, yyyy')} <br />
                                                    <span className="text-gray-500">{format(logDate, 'HH:mm:ss')}</span>
                                                </td>
                                                <td className="p-4 text-xs font-bold text-gray-300">
                                                    {log.userName || log.adminName || log.performedBy || 'System'}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide inline-block ${getActionColor(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs text-gray-400 uppercase tracking-widest font-bold">
                                                    {log.targetType || log.entityType || 'Unknown'}
                                                    <div className="font-mono text-[9px] text-gray-600 normal-case mt-0.5" title={log.targetId || log.entityId}>
                                                        ID: {(log.targetId || log.entityId || 'N/A').substring(0, 8)}...
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-xs text-gray-300 mb-1">
                                                        {typeof log.details === 'string' ? log.details : (log.targetName ? `Action on ${log.targetName}` : '')}
                                                    </p>

                                                    {log.oldData && log.newData && (
                                                        <div className="mt-2 bg-black/20 rounded border border-white/5 p-2 overflow-x-auto">
                                                            {Object.keys(log.newData).map(key => {
                                                                const oldV = JSON.stringify(log.oldData[key]);
                                                                const newV = JSON.stringify(log.newData[key]);
                                                                if (oldV !== newV && key !== 'updatedAt') {
                                                                    return (
                                                                        <div key={key} className="flex flex-wrap items-center gap-2 text-[10px] font-mono mb-1 last:mb-0">
                                                                            <span className="text-amber-400 font-bold">{key}:</span>
                                                                            <span className="text-rose-400 line-through bg-rose-500/10 px-1 rounded">{oldV || 'null'}</span>
                                                                            <ArrowRight size={10} className="text-gray-500" />
                                                                            <span className="text-brand-400 bg-brand-500/10 px-1 rounded">{newV || 'null'}</span>
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
