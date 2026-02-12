import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, UserRole, UserProfile, Client, LeaveRequest, CalendarEvent } from '../types';
import { AuthService } from '../services/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { useLocation } from 'react-router-dom';
import StaffSelect from '../components/StaffSelect';
import { FileText, Download, Filter, Search, Calendar as CalendarIcon, Users, CheckCircle, XCircle, Clock, AlertTriangle, Briefcase } from 'lucide-react';

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

    useEffect(() => {
        // Defaults
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

        if (!filterStartDate) setFilterStartDate(firstDay);
        if (!filterEndDate) setFilterEndDate(lastDay);

        // Deep Linking
        if (location.state && location.state.filterUserId) {
            setFilterStaffId(location.state.filterUserId);
        }

        if (user) loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const isAdmin = user.role === UserRole.ADMIN;
            const fetchId = isAdmin ? undefined : user.uid;

            const [uList, attHistory, lList, allEvents] = await Promise.all([
                AuthService.getAllUsers(),
                AuthService.getAttendanceHistory(fetchId),
                AuthService.getAllLeaves(fetchId),
                AuthService.getAllEvents()
            ]);

            setUsersList(uList);
            setHistory(attHistory);
            setLeavesList(lList);
            // Filter events for Holidays
            setHolidays(allEvents.filter(e => e.type === 'HOLIDAY'));

        } catch (err) {
            console.error("Error loading attendance data:", err);
        } finally {
            setLoading(false);
        }
    };

    // --- REPORT GENERATION LOGIC ---
    const reportData = useMemo(() => {
        if (!filterStartDate || !filterEndDate) return [];

        let targetUsers = [];
        if (user?.role === UserRole.ADMIN) {
            if (filterStaffId === 'ALL') {
                targetUsers = usersList.filter(u => u.status !== 'Inactive');
            } else {
                targetUsers = usersList.filter(u => u.uid === filterStaffId);
            }
        } else if (user) {
            targetUsers = [user];
        }

        const report: any[] = [];
        const start = new Date(filterStartDate);
        const end = new Date(filterEndDate);
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Safety cap
        const MAX_DAYS = 62;
        let dayCount = 0;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (dayCount++ > MAX_DAYS) break;
            const dateStr = d.toISOString().split('T')[0];
            const isFuture = dateStr > todayStr;
            const dateObj = new Date(dateStr);
            const isSaturday = dateObj.getDay() === 6;

            targetUsers.forEach(u => {
                // Priority 1: Actual Attendance Record
                const record = history.find(r => r.userId === u.uid && r.date === dateStr);
                if (record) {
                    report.push(record);
                    return;
                }

                if (isFuture) return; // Don't generate absent/holiday for future

                // Priority 2: Approved Leave
                const leave = leavesList.find(l =>
                    l.userId === u.uid &&
                    l.status === 'APPROVED' &&
                    l.startDate <= dateStr &&
                    l.endDate >= dateStr
                );
                if (leave) {
                    report.push({
                        id: `leave_${u.uid}_${dateStr}`,
                        userId: u.uid,
                        userName: u.displayName,
                        date: dateStr,
                        clockIn: '-',
                        clockOut: '-',
                        status: 'ON LEAVE',
                        workHours: 0,
                        clientName: `ON LEAVE (${leave.type})`,
                        notes: leave.reason
                    });
                    return;
                }

                // Priority 3: Firm Holiday
                const holiday = holidays.find(h => h.date === dateStr);
                if (holiday) {
                    report.push({
                        id: `holiday_${u.uid}_${dateStr}`,
                        userId: u.uid,
                        userName: u.displayName,
                        date: dateStr,
                        clockIn: '-',
                        clockOut: '-',
                        status: 'HOLIDAY',
                        workHours: 0,
                        clientName: 'HOLIDAY',
                        notes: holiday.title
                    });
                    return;
                }

                // Priority 4: Saturday
                if (isSaturday) {
                    report.push({
                        id: `sat_${u.uid}_${dateStr}`,
                        userId: u.uid,
                        userName: u.displayName,
                        date: dateStr,
                        clockIn: '-',
                        clockOut: '-',
                        status: 'HOLIDAY',
                        workHours: 0,
                        clientName: 'WEEKEND',
                        notes: 'Saturday'
                    });
                    return;
                }

                // Priority 5: Absent
                report.push({
                    id: `absent_${u.uid}_${dateStr}`,
                    userId: u.uid,
                    userName: u.displayName,
                    date: dateStr,
                    clockIn: '-',
                    clockOut: '-',
                    status: 'ABSENT',
                    workHours: 0,
                    clientName: '-',
                    notes: 'Absent'
                });
            });
        }

        // Apply Status Filter
        if (filterStatus !== 'ALL') {
            return report.filter(r => r.status === filterStatus);
        }

        // Sort by Date Desc
        return report.sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName));

    }, [history, leavesList, holidays, usersList, filterStartDate, filterEndDate, filterStaffId, user, filterStatus]);


    // --- EXPORT FUNCTIONS (Optimized) ---
    const exportPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFillColor(15, 23, 42); // Navy
        doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("R. Sapkota & Associates", 105, 15, { align: "center" });
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "normal");
        doc.text("Chartered Accountants | Attendance Report", 105, 25, { align: "center" });
        doc.text(`Period: ${filterStartDate} to ${filterEndDate}`, 105, 32, { align: "center" });

        const tableColumn = ["Date", "Name", "Activity / Client", "In", "Out", "Hr", "Status"];
        const tableRows = reportData.map(r => {
            let activity = r.clientName || '-';
            if (r.workLogs?.length > 0) {
                activity = r.workLogs.map((l: any) => `${l.clientName} (${l.duration}h)`).join(', ');
            } else if (r.workDescription) {
                activity += ` - ${r.workDescription.substring(0, 50)}`;
            }
            return [
                r.date,
                r.userName,
                activity,
                r.clockIn,
                r.clockOut || '-',
                r.workHours,
                r.status
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: 255 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 2: { cellWidth: 60 } }
        });

        doc.save("Attendance_Report.pdf");
    };

    const exportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Clock In', key: 'in', width: 10 },
            { header: 'Clock Out', key: 'out', width: 10 },
            { header: 'Hours', key: 'hours', width: 10 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Client/Activity', key: 'activity', width: 40 },
            { header: 'Notes', key: 'notes', width: 30 },
        ];

        // Style Header
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };

        reportData.forEach(r => {
            let activity = r.clientName || '';
            if (r.workLogs?.length > 0) {
                activity = r.workLogs.map((l: any) => `${l.clientName}: ${l.description} (${l.duration}h)`).join('\n');
            } else if (r.workDescription) {
                activity += `\n${r.workDescription}`;
            }

            worksheet.addRow({
                date: r.date,
                name: r.userName,
                in: r.clockIn,
                out: r.clockOut,
                hours: r.workHours,
                status: r.status,
                activity: activity,
                notes: r.notes
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "Attendance_Report.xlsx";
        a.click();
    };


    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="glass-panel p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Briefcase className="text-brand-400" />
                        Attendance Reports
                    </h1>
                    <p className="text-gray-400 text-sm">View attendance history, holidays, and generate reports.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportPDF} className="btn-secondary flex items-center gap-2">
                        <FileText size={16} /> PDF
                    </button>
                    <button onClick={exportExcel} className="btn-secondary flex items-center gap-2">
                        <Download size={16} /> Excel
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {user?.role === UserRole.ADMIN && (
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400">Staff Member</label>
                        <StaffSelect
                            value={filterStaffId}
                            onChange={setFilterStaffId}
                            users={usersList} // Pass filtered list logic inside if needed, here passing all
                            showAllOption
                        />
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-xs text-gray-400">Status</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full bg-navy-900/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-brand-500 appearance-none"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                            <option value="LATE">Late</option>
                            <option value="ON LEAVE">On Leave</option>
                            <option value="HOLIDAY">Holiday</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs text-gray-400">Start Date</label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="w-full bg-navy-900/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-brand-500"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs text-gray-400">End Date</label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="w-full bg-navy-900/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-brand-500"
                        />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="glass-panel rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-gray-400 text-sm uppercase">
                                <th className="p-4 font-semibold">Date</th>
                                <th className="p-4 font-semibold">Staff</th>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold">Time</th>
                                <th className="p-4 font-semibold">Work Log / Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">Loading records...</td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">No records found for selected period.</td>
                                </tr>
                            ) : (
                                reportData.map((record) => (
                                    <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 text-white align-top whitespace-nowrap">
                                            {record.date}
                                            <div className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
                                        </td>
                                        <td className="p-4 text-white align-top">
                                            <span className="font-medium">{record.userName}</span>
                                        </td>
                                        <td className="p-4 align-top">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border ${record.status === 'PRESENT' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                record.status === 'LATE' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                    record.status === 'ABSENT' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                        record.status === 'HOLIDAY' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                }`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-300 align-top whitespace-nowrap text-sm">
                                            {record.clockIn !== '-' ? (
                                                <div className="flex flex-col">
                                                    <span className="flex items-center text-green-400"><Clock size={12} className="mr-1" /> In: {record.clockIn}</span>
                                                    {record.clockOut && <span className="flex items-center text-red-400"><Clock size={12} className="mr-1" /> Out: {record.clockOut}</span>}
                                                    {record.workHours > 0 && <span className="text-gray-500 mt-1">{record.workHours} hrs</span>}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4 text-gray-300 align-top text-sm">
                                            {record.workLogs && record.workLogs.length > 0 ? (
                                                <div className="space-y-1">
                                                    {record.workLogs.map((log: any, i: number) => (
                                                        <div key={i} className="flex flex-col">
                                                            <span className="text-brand-300 font-medium">{log.clientName || 'Unknown Site'}</span>
                                                            <span className="text-gray-400 pl-2 border-l-2 border-white/10">{log.description}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="font-medium text-brand-300">{record.clientName}</p>
                                                    {record.notes && <p className="text-gray-400 text-xs mt-1 italic">{record.notes}</p>}
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
