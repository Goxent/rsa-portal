
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, UserRole, UserProfile, Client, LeaveRequest, CalendarEvent } from '../types';
import { AuthService } from '../services/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { useLocation } from 'react-router-dom';
import { getCurrentDateUTC } from '../utils/dates';
import StaffSelect from '../components/StaffSelect';
import { FileText, Download, Filter, Search, Calendar as CalendarIcon, Users, CheckCircle, XCircle, Clock, AlertTriangle, Briefcase, ChevronRight, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

const AttendancePage: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();

    // Data State
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [leavesList, setLeavesList] = useState<LeaveRequest[]>([]);
    const [holidays, setHolidays] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtering State
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterStaffId, setFilterStaffId] = useState<string>('ALL');
    const [filterStartDate, setFilterStartDate] = useState<string>('');
    const [filterEndDate, setFilterEndDate] = useState<string>('');

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER;

    useEffect(() => {
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

        if (!filterStartDate) setFilterStartDate(firstDay);
        if (!filterEndDate) setFilterEndDate(lastDay);

        if (location.state?.filterUserId) {
            setFilterStaffId(location.state.filterUserId);
        }

        loadData();
    }, [user, location.state]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [uList, attHistory, lList, allEvents] = await Promise.all([
                AuthService.getAllUsers(),
                AuthService.getAttendanceHistory(isAdmin ? undefined : user.uid),
                AuthService.getAllLeaves(isAdmin ? undefined : user.uid),
                AuthService.getAllEvents()
            ]);

            setUsersList(uList); // Removed Inactive filter to ensure all directory users are visible
            setHistory(attHistory);
            setLeavesList(lList.filter(l => l.status === 'APPROVED'));
            setHolidays(allEvents.filter(e => e.type === 'HOLIDAY'));
        } catch (err) {
            console.error("Error loading attendance data:", err);
            toast.error("Failed to load attendance records");
        } finally {
            setLoading(false);
        }
    };

    const reportData = useMemo(() => {
        if (!filterStartDate || !filterEndDate) return [];

        let targetUsers: UserProfile[] = [];
        if (isAdmin) {
            targetUsers = filterStaffId === 'ALL' ? usersList : usersList.filter(u => u.uid === filterStaffId);
        } else if (user) {
            // Reconstruct a UserProfile-like object for the current user
            targetUsers = [{
                uid: user.uid,
                displayName: user.displayName || 'Staff Member',
                role: user.role,
                status: 'Active',
                email: user.email || ''
            } as UserProfile];
        }

        const report: any[] = [];
        const startDay = new Date(filterStartDate);
        const endDay = new Date(filterEndDate);
        const todayStr = getCurrentDateUTC();

        for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const isFuture = dateStr > todayStr;
            const isSaturday = d.getDay() === 6;

            targetUsers.forEach(u => {
                // 1. Check Attendance Record
                const record = history.find(r => r.userId === u.uid && r.date === dateStr);
                if (record) {
                    report.push({ ...record, type: 'RECORD' });
                    return;
                }

                if (isFuture) return;

                // 2. Check Leaves
                const leave = leavesList.find(l => l.userId === u.uid && l.startDate <= dateStr && l.endDate >= dateStr);
                if (leave) {
                    report.push({
                        id: `leave_${u.uid}_${dateStr}`,
                        userId: u.uid,
                        userName: u.displayName,
                        date: dateStr,
                        status: 'ON LEAVE',
                        clientName: `Leave (${leave.type})`,
                        notes: leave.reason,
                        type: 'LEAVE'
                    });
                    return;
                }

                // 3. Check Holidays
                const holiday = holidays.find(h => h.date === dateStr);
                if (holiday) {
                    report.push({
                        id: `h_${u.uid}_${dateStr}`,
                        userId: u.uid,
                        userName: u.displayName,
                        date: dateStr,
                        status: 'HOLIDAY',
                        clientName: 'Firm Holiday',
                        notes: holiday.title,
                        type: 'HOLIDAY'
                    });
                    return;
                }

                // 4. Check Saturday
                if (isSaturday) {
                    report.push({
                        id: `s_${u.uid}_${dateStr}`,
                        userId: u.uid,
                        userName: u.displayName,
                        date: dateStr,
                        status: 'WEEKEND',
                        clientName: 'Saturday',
                        notes: 'Firm Weekend',
                        type: 'WEEKEND'
                    });
                    return;
                }

                // 5. Absent
                report.push({
                    id: `abs_${u.uid}_${dateStr}`,
                    userId: u.uid,
                    userName: u.displayName,
                    date: dateStr,
                    status: 'ABSENT',
                    clientName: '-',
                    notes: '-',
                    type: 'ABSENT'
                });
            });
        }

        let filtered = report;
        if (filterStatus !== 'ALL') {
            filtered = report.filter(r => r.status === filterStatus || (filterStatus === 'PRESENT' && r.status === 'LATE'));
        }

        return filtered.sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName));
    }, [history, leavesList, holidays, usersList, filterStartDate, filterEndDate, filterStaffId, user, filterStatus]);

    // EXPORT
    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("R. Sapkota & Associates", 105, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.text("Attendance & Work Log Report", 105, 25, { align: 'center' });
        doc.text(`Period: ${filterStartDate} to ${filterEndDate}`, 105, 32, { align: 'center' });

        const rows = reportData.map(r => [
            r.date,
            r.userName,
            r.status,
            r.clockIn || '-',
            r.clockOut || '-',
            r.workHours || '0',
            (r.workLogs?.length > 0 ? r.workLogs.map((l: any) => `${l.clientName}: ${l.description}`).join('; ') : r.clientName)
        ]);

        autoTable(doc, {
            head: [['Date', 'Staff', 'Status', 'In', 'Out', 'Hrs', 'Work Description']],
            body: rows,
            startY: 45,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [30, 41, 59] }
        });

        doc.save(`Attendance_Report_${filterStartDate}.pdf`);
    };

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Attendance');
        sheet.columns = [
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Staff', key: 'name', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Clock In', key: 'in', width: 10 },
            { header: 'Clock Out', key: 'out', width: 10 },
            { header: 'Hours', key: 'hours', width: 8 },
            { header: 'Work Details', key: 'details', width: 50 }
        ];

        reportData.forEach(r => sheet.addRow({
            date: r.date,
            name: r.userName,
            status: r.status,
            in: r.clockIn,
            out: r.clockOut,
            hours: r.workHours,
            details: r.workLogs?.length > 0 ? r.workLogs.map((l: any) => `${l.clientName}: ${l.description}`).join('\n') : r.clientName
        }));

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Attendance_${filterStartDate}.xlsx`;
        a.click();
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            {/* Header Section */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="relative z-10 flex items-center gap-5">
                    <div className="p-4 bg-brand-600/20 rounded-2xl border border-brand-500/20">
                        <Users className="text-brand-400" size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">Attendance Center</h1>
                        <p className="text-gray-400 text-sm font-medium mt-1">Track punctuality, work logs, and team availability.</p>
                    </div>
                </div>
                <div className="relative z-10 flex gap-3">
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all font-bold shadow-lg">
                        <FileText size={18} className="text-rose-400" />
                        PDF Export
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all font-bold shadow-lg">
                        <Download size={18} className="text-emerald-400" />
                        Excel
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="glass-panel p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end border border-white/10 shadow-xl bg-navy-900/40 relative z-20">
                {isAdmin && (
                    <div className="space-y-2 lg:col-span-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                            <User size={10} /> Team Member
                        </label>
                        <StaffSelect
                            value={filterStaffId}
                            onChange={(val) => setFilterStaffId(Array.isArray(val) ? val[0] : val)}
                            users={usersList}
                            showAllOption
                        />
                    </div>
                )}

                <div className="space-y-2 lg:col-span-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <Filter size={10} /> Status Filter
                    </label>
                    <div className="relative group">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none appearance-none hover:bg-black/40 transition-all"
                        >
                            <option value="ALL">Total View</option>
                            <option value="PRESENT">Present / Late</option>
                            <option value="ABSENT">Absent</option>
                            <option value="ON LEAVE">On Leave</option>
                            <option value="HOLIDAY">Firm Holidays</option>
                        </select>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 group-hover:text-brand-400 transition-colors rotate-90" size={12} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <CalendarIcon size={10} /> From Date
                    </label>
                    <input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none hover:bg-black/40 transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <CalendarIcon size={10} /> To Date
                    </label>
                    <input
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none hover:bg-black/40 transition-all"
                    />
                </div>

                <button onClick={loadData} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20 hover:bg-brand-500/20 transition-all font-bold text-sm">
                    <Search size={16} /> Refresh Records
                </button>
            </div>

            {/* Results Table */}
            <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl bg-navy-900/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                <th className="p-6">Date & Punctuality</th>
                                <th className="p-6">Team Member</th>
                                <th className="p-6">Timeline</th>
                                <th className="p-6">Activities / Clients</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={4} className="p-20 text-center text-gray-500 font-medium">Scanning records...</td></tr>
                            ) : reportData.length === 0 ? (
                                <tr><td colSpan={4} className="p-20 text-center text-gray-500 font-medium">No results matched your filters.</td></tr>
                            ) : (
                                reportData.map((record) => (
                                    <tr key={record.id} className="hover:bg-white/5 transition-all group/row">
                                        <td className="p-6 align-top">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm tracking-tight">{record.date}</span>
                                                <span className="text-[10px] text-gray-600 font-bold uppercase mt-0.5">
                                                    {new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                                </span>
                                                <div className="mt-2 text-[10px]">
                                                    <span className={`px-2 py-0.5 rounded-full font-black border ${record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        record.status === 'LATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                            record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                                record.status === 'ON LEAVE' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                                                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                        }`}>
                                                        {record.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 align-top">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold">
                                                    {record.userName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-gray-200 font-semibold">{record.userName}</span>
                                            </div>
                                        </td>
                                        <td className="p-6 align-top">
                                            {record.clockIn ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                                                        <Clock size={12} /> IN: {record.clockIn}
                                                    </div>
                                                    {record.clockOut && (
                                                        <div className="flex items-center gap-2 text-xs text-rose-400 font-mono">
                                                            <Clock size={12} /> OUT: {record.clockOut}
                                                        </div>
                                                    )}
                                                    {record.workHours > 0 && (
                                                        <div className="text-[10px] text-gray-500 font-bold uppercase mt-2">
                                                            Total: {record.workHours} Hours
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-700 font-mono text-xs">-- : --</span>
                                            )}
                                        </td>
                                        <td className="p-6 align-top">
                                            {record.workLogs?.length > 0 ? (
                                                <div className="space-y-3">
                                                    {record.workLogs.map((log: any, i: number) => (
                                                        <div key={i} className="group/log">
                                                            <div className="text-[11px] font-black text-brand-400 tracking-wide uppercase">
                                                                {log.clientName || 'Internal'}
                                                            </div>
                                                            <div className="text-xs text-gray-400 leading-relaxed mt-0.5">
                                                                {log.description}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-500 italic">
                                                    {record.clientName || record.notes || 'No work log entry.'}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AttendancePage;
