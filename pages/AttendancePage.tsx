
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, UserRole, UserProfile, Client, LeaveRequest, CalendarEvent } from '../types';
import { AuthService } from '../services/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import NepaliDate from 'nepali-date-converter';
import ExcelJS from 'exceljs';
import { useLocation } from 'react-router-dom';
import { getCurrentDateUTC } from '../utils/dates';
import StaffSelect from '../components/StaffSelect';
import ManualAttendanceModal from '../components/attendance/ManualAttendanceModal';
import { FileText, Download, Filter, Search, Calendar as CalendarIcon, Users, CheckCircle, XCircle, Clock, AlertTriangle, Briefcase, ChevronRight, User, Edit2, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import NepaliDatePicker from '../components/NepaliDatePicker';

const AttendancePage: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();

    // Data State
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [leavesList, setLeavesList] = useState<LeaveRequest[]>([]);
    const [holidays, setHolidays] = useState<CalendarEvent[]>([]);
    const [clients, setClients] = useState<Client[]>([]); // Added Clients
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [selectedDateForEdit, setSelectedDateForEdit] = useState<string>('');
    const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);

    // Filtering State
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterStaffId, setFilterStaffId] = useState<string>('ALL');
    const [filterStartDate, setFilterStartDate] = useState<string>('');
    const [filterEndDate, setFilterEndDate] = useState<string>('');
    const [useNepaliFrom, setUseNepaliFrom] = useState(false);
    const [useNepaliTo, setUseNepaliTo] = useState(false);

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER;

    useEffect(() => {
        const today = new Date();
        const np = new NepaliDate(today);
        const currentYear = np.getYear();
        const currentMonth = np.getMonth();

        // Start of Nepali Month
        const startOfMonthNp = new NepaliDate(currentYear, currentMonth, 1);
        const startOfMonthAd = startOfMonthNp.toJsDate().toISOString().split('T')[0];

        // End Date (Today)
        const todayAd = today.toISOString().split('T')[0];

        if (!filterStartDate) setFilterStartDate(startOfMonthAd);
        if (!filterEndDate) setFilterEndDate(todayAd);

        if (location.state?.filterUserId) {
            setFilterStaffId(location.state.filterUserId);
        }

        loadData();
    }, [user, location.state]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [uList, attHistory, lList, allEvents, fetchedClients] = await Promise.all([
                AuthService.getAllUsers(),
                AuthService.getAttendanceHistory(isAdmin ? undefined : user.uid),
                AuthService.getAllLeaves(isAdmin ? undefined : user.uid),
                AuthService.getAllEvents(),
                AuthService.getAllClients()
            ]);

            setUsersList(uList); // Removed Inactive filter to ensure all directory users are visible
            setHistory(attHistory);
            setLeavesList(lList.filter(l => l.status === 'APPROVED'));
            setHolidays(allEvents.filter(e => e.type === 'HOLIDAY'));
            setClients(fetchedClients);
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
                    report.push({ ...record, userName: record.userName || u.displayName, type: 'RECORD' });
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

        // ── Header Banner ──────────────────────────────────────────────
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 48, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('R. Sapkota & Associates', 105, 14, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 200, 230);
        doc.text('Chartered Accountants  |  Kathmandu, Nepal', 105, 22, { align: 'center' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Attendance & Work Log Report', 105, 32, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 200, 230);
        doc.text(`Period: ${filterStartDate}  to  ${filterEndDate}`, 105, 40, { align: 'center' });

        // ── Generated timestamp ─────────────────────────────────────────
        doc.setFontSize(7);
        doc.setTextColor(120, 140, 160);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 55);

        // ── Table ───────────────────────────────────────────────────────
        const rows = reportData.map(r => [
            r.date,
            r.userName,
            r.status,
            r.clockIn || '-',
            r.clockOut || '-',
            r.workHours ? `${r.workHours}h` : '-',
            r.workLogs?.length > 0
                ? r.workLogs.map((l: any) => `${l.clientName}: ${l.description}`).join('; ')
                : (r.clientName || '-')
        ]);

        const getStatusColor = (status: string): [number, number, number] => {
            if (status === 'PRESENT') return [220, 252, 231];
            if (status === 'LATE') return [254, 243, 199];
            if (status === 'ABSENT') return [254, 226, 226];
            if (status === 'ON LEAVE') return [219, 234, 254];
            return [245, 245, 250];
        };

        autoTable(doc, {
            head: [['Date', 'Staff', 'Status', 'Clock In', 'Clock Out', 'Hrs', 'Work Description']],
            body: rows,
            startY: 60,
            styles: { fontSize: 7.5, cellPadding: 3, lineColor: [220, 225, 235], lineWidth: 0.2 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            columnStyles: { 6: { cellWidth: 70 } },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 2) {
                    const status = data.cell.raw as string;
                    data.cell.styles.fillColor = getStatusColor(status);
                    data.cell.styles.textColor = [30, 41, 59];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        // ── Footer ──────────────────────────────────────────────────────
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(150, 160, 175);
            doc.text('R. Sapkota & Associates — Confidential', 14, doc.internal.pageSize.height - 8);
            doc.text(`Page ${i} of ${pageCount}`, 196, doc.internal.pageSize.height - 8, { align: 'right' });
        }

        doc.save(`RSA_Attendance_${filterStartDate}_to_${filterEndDate}.pdf`);
    };

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'R. Sapkota & Associates';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Attendance Report', {
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
        });

        // ── Company Header Block ────────────────────────────────────────
        sheet.mergeCells('A1:H1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'R. Sapkota & Associates';
        titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        sheet.getRow(1).height = 32;

        sheet.mergeCells('A2:H2');
        const addrCell = sheet.getCell('A2');
        addrCell.value = 'Chartered Accountants  |  Kathmandu, Nepal';
        addrCell.font = { name: 'Calibri', size: 10, color: { argb: 'FFB4C8E6' } };
        addrCell.alignment = { horizontal: 'center', vertical: 'middle' };
        addrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        sheet.getRow(2).height = 18;

        sheet.mergeCells('A3:H3');
        const reportTitleCell = sheet.getCell('A3');
        reportTitleCell.value = 'Attendance & Work Log Report';
        reportTitleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E293B' } };
        reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        reportTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        sheet.getRow(3).height = 22;

        sheet.mergeCells('A4:H4');
        const periodCell = sheet.getCell('A4');
        periodCell.value = `Period: ${filterStartDate}  to  ${filterEndDate}   |   Generated: ${new Date().toLocaleString()}`;
        periodCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
        periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
        periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        sheet.getRow(4).height = 16;

        // Blank spacer
        sheet.getRow(5).height = 6;

        // ── Column Headers ──────────────────────────────────────────────
        const COLS = [
            { header: 'Date', key: 'date', width: 13 },
            { header: 'Staff Name', key: 'name', width: 22 },
            { header: 'Status', key: 'status', width: 13 },
            { header: 'Clock In', key: 'in', width: 11 },
            { header: 'Clock Out', key: 'out', width: 11 },
            { header: 'Hours', key: 'hours', width: 9 },
            { header: 'Client Name', key: 'client', width: 28 },
            { header: 'Work Description', key: 'description', width: 50 },
        ];
        sheet.columns = COLS;

        const headerRow = sheet.getRow(6);
        COLS.forEach((col, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = col.header;
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FF6366F1' } }
            };
        });
        headerRow.height = 22;

        // ── Data Rows ───────────────────────────────────────────────────
        const statusFill: Record<string, string> = {
            'PRESENT': 'FFD1FAE5',
            'LATE': 'FFFEF3C7',
            'ABSENT': 'FFFEE2E2',
            'ON LEAVE': 'FFDBEAFE',
            'HOLIDAY': 'FFEDE9FE',
            'WEEKEND': 'FFF1F5F9',
        };

        reportData.forEach((r, idx) => {
            // Build client name and description from workLogs if available
            const clientName = r.workLogs?.length > 0
                ? [...new Set(r.workLogs.map((l: any) => l.clientName).filter(Boolean))].join('\n')
                : (r.clientName || '-');
            const description = r.workLogs?.length > 0
                ? r.workLogs.map((l: any) => l.description).filter(Boolean).join('\n')
                : (r.notes && r.notes !== '-' ? r.notes : '-');

            const row = sheet.addRow({
                date: r.date,
                name: r.userName,
                status: r.status,
                in: r.clockIn || '-',
                out: r.clockOut || '-',
                hours: r.workHours ? `${r.workHours}h` : '-',
                client: clientName,
                description: description,
            });

            const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
            const statusBg = statusFill[r.status] || rowBg;

            row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                cell.font = { name: 'Calibri', size: 9 };
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.fill = {
                    type: 'pattern', pattern: 'solid',
                    fgColor: { argb: colNum === 3 ? statusBg : rowBg }
                };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };
            });

            // Bold + centered status cell
            const statusCell = row.getCell(3);
            statusCell.font = { name: 'Calibri', size: 9, bold: true };
            statusCell.alignment = { horizontal: 'center', vertical: 'top' };

            // Light teal tint for client name column for easy scanning
            const clientCell = row.getCell(7);
            clientCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F4C75' } };

            row.height = r.workLogs?.length > 1 ? Math.min(r.workLogs.length * 16, 80) : 18;
        });

        // ── Freeze header rows ──────────────────────────────────────────
        sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 6, activeCell: 'A7' }];

        // ── Download ────────────────────────────────────────────────────
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RSA_Attendance_${filterStartDate}_to_${filterEndDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            {/* Header Section */}
            <div className="glass-panel p-4 md:p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl -mr-24 -mt-24"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="p-3 bg-brand-600/20 rounded-xl border border-brand-500/20">
                        <Users className="text-brand-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">Attendance Center</h1>
                        <p className="text-gray-400 text-xs font-medium mt-0.5">Track punctuality, work logs, and team availability.</p>
                    </div>
                </div>
                <div className="relative z-10 flex gap-2">
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all text-sm font-bold shadow-lg">
                        <FileText size={16} className="text-rose-400" />
                        PDF Export
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all text-sm font-bold shadow-lg">
                        <Download size={16} className="text-emerald-400" />
                        Excel
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="glass-panel p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end border border-white/10 shadow-xl bg-navy-900/40 relative z-20">
                {isAdmin && (
                    <div className="space-y-1.5 lg:col-span-1">
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

                <div className="space-y-2 relative z-50">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                            <CalendarIcon size={10} /> From Date
                        </label>
                        <button
                            onClick={() => setUseNepaliFrom(!useNepaliFrom)}
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-all ${useNepaliFrom ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-500'}`}
                        >
                            {useNepaliFrom ? 'BS' : 'AD'}
                        </button>
                    </div>
                    {useNepaliFrom ? (
                        <NepaliDatePicker
                            value={filterStartDate || ''}
                            onChange={(ad) => setFilterStartDate(ad)}
                            className="w-full"
                        />
                    ) : (
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none hover:bg-black/40 transition-all h-[42px]"
                        />
                    )}
                </div>

                <div className="space-y-2 relative z-50">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                            <CalendarIcon size={10} /> To Date
                        </label>
                        <button
                            onClick={() => setUseNepaliTo(!useNepaliTo)}
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-all ${useNepaliTo ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-500'}`}
                        >
                            {useNepaliTo ? 'BS' : 'AD'}
                        </button>
                    </div>
                    {useNepaliTo ? (
                        <NepaliDatePicker
                            value={filterEndDate || ''}
                            onChange={(ad) => setFilterEndDate(ad)}
                            className="w-full"
                        />
                    ) : (
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none hover:bg-black/40 transition-all h-[42px]"
                        />
                    )}
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
                                {isAdmin && <th className="p-6">Actions</th>}
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
                                        {isAdmin && (
                                            <td className="p-6 align-top">
                                                <button
                                                    onClick={() => {
                                                        const userProfile = usersList.find(u => u.uid === record.userId);
                                                        if (userProfile) {
                                                            setSelectedUserForEdit(userProfile);
                                                            setSelectedDateForEdit(record.date);
                                                            // Provide the full record if it exists (status is not missing/absent placeholder)
                                                            // BUT: reportData generates placeholder "ABSENT" records which are not real DB records
                                                            // So check if 'type' is 'RECORD'
                                                            const realRecord = history.find(h => h.userId === record.userId && h.date === record.date);
                                                            setSelectedRecord(realRecord || null);
                                                            setIsEditModalOpen(true);
                                                        }
                                                    }}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-brand-400 transition-colors"
                                                    title="Adjust Attendance"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ManualAttendanceModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                record={selectedRecord}
                selectedDate={selectedDateForEdit}
                selectedUser={selectedUserForEdit}
                clients={clients}
                onSave={async (newRecord) => {
                    await AuthService.recordAttendance(newRecord);
                    toast.success('Attendance updated successfully');
                    loadData();
                }}
            />
        </div>
    );
};

export default AttendancePage;
