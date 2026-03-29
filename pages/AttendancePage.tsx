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
import { 
    FileText, Download, Filter, Search, Calendar as CalendarIcon, 
    Users, CheckCircle, XCircle, Clock, AlertTriangle, Briefcase, 
    ChevronRight, User, Edit2, Plus, LayoutGrid, List as ListIcon, 
    ExternalLink, MapPin, TrendingUp, UserCheck, UserPlus, CalendarDays
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';

// ── Components ──

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex items-start justify-between hover:border-[#8b949e] transition-all group">
        <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Icon size={12} className={color} /> {title}
            </p>
            <h3 className="text-2xl font-black text-white tracking-tight">{value}</h3>
            {trend && (
                <div className="flex items-center gap-1 mt-1">
                    <TrendingUp size={10} className="text-emerald-500" />
                    <span className="text-[10px] text-emerald-500 font-bold">{trend}</span>
                </div>
            )}
        </div>
        <div className={`p-2.5 rounded-lg bg-opacity-10 ${color.replace('text-', 'bg-')} border border-white/[0.03]`}>
            <Icon size={18} className={color} />
        </div>
    </div>
);

const ClockWidget = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const np = new NepaliDate(time);

    return (
        <div className="bg-gradient-to-br from-[#161b22] to-[#0d1117] border border-[#30363d] rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-all duration-700" />
            <div className="text-[10px] font-black text-amber-500/70 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Live Tracker
            </div>
            <div className="text-4xl font-black text-white tracking-tighter tabular-nums mb-1">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div className="flex items-center gap-3 text-gray-500 font-bold text-[11px]">
                <span className="flex items-center gap-1"><CalendarIcon size={11} /> {time.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="w-1 h-1 rounded-full bg-gray-800" />
                <span>{np.format('DD MMMM, YYYY')} BS</span>
            </div>
        </div>
    );
};

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
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchQuery, setSearchQuery] = useState('');

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

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                r.userName.toLowerCase().includes(q) || 
                r.clientName?.toLowerCase().includes(q) ||
                r.notes?.toLowerCase().includes(q)
            );
        }

        return filtered.sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName));
    }, [history, leavesList, holidays, usersList, filterStartDate, filterEndDate, filterStaffId, user, filterStatus, searchQuery]);

    // Compute Stats
    const stats = useMemo(() => {
        const today = getCurrentDateUTC();
        const todaysRecords = reportData.filter(r => r.date === today);
        return {
            present: todaysRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length,
            absent: todaysRecords.filter(r => r.status === 'ABSENT').length,
            onLeave: todaysRecords.filter(r => r.status === 'ON LEAVE').length,
            late: todaysRecords.filter(r => r.status === 'LATE').length,
        };
    }, [reportData]);

    // ── Helper Functions for Exports ─────────────────────────────────
    const formatDateAD = (dateStr: string) => {
        try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
        catch { return dateStr; }
    };
    const formatDateBS = (dateStr: string) => {
        try { return new NepaliDate(new Date(dateStr + 'T00:00:00')).format('DD MMM, YYYY'); }
        catch { return '-'; }
    };
    const getDayOfWeek = (dateStr: string) => {
        try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }); }
        catch { return '-'; }
    };
    const getPeriodStats = () => {
        const totalPresent = reportData.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
        const totalAbsent = reportData.filter(r => r.status === 'ABSENT').length;
        const totalLeave = reportData.filter(r => r.status === 'ON LEAVE').length;
        const totalHoliday = reportData.filter(r => r.status === 'HOLIDAY' || r.status === 'WEEKEND').length;
        const totalHours = reportData.reduce((sum, r) => sum + (r.workHours || 0), 0);
        return { totalPresent, totalAbsent, totalLeave, totalHoliday, totalHours: totalHours.toFixed(1) };
    };

    // EXPORT
    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const pageW = doc.internal.pageSize.width;

        // ── Header Banner ──────────────────────────────────────────────
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageW, 48, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('R. Sapkota & Associates', pageW / 2, 14, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 200, 230);
        doc.text('Chartered Accountants  |  Kathmandu, Nepal', pageW / 2, 22, { align: 'center' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Attendance & Work Log Report', pageW / 2, 32, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 200, 230);
        const periodBs = `${formatDateBS(filterStartDate)} - ${formatDateBS(filterEndDate)} BS`;
        doc.text(`Period: ${formatDateAD(filterStartDate)} to ${formatDateAD(filterEndDate)}  |  ${periodBs}`, pageW / 2, 40, { align: 'center' });

        // ── Generated timestamp ─────────────────────────────────────────
        doc.setFontSize(7);
        doc.setTextColor(120, 140, 160);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 55);

        // ── Table ───────────────────────────────────────────────────────
        const rows = reportData.map((r, idx) => [
            idx + 1,
            formatDateAD(r.date),
            formatDateBS(r.date),
            getDayOfWeek(r.date),
            r.userName,
            r.status,
            r.clockIn || '-',
            r.clockOut || '-',
            r.workHours ? `${r.workHours}h` : '-',
            r.workLogs?.length > 0
                ? [...new Set(r.workLogs.map((l: any) => l.natureOfAssignment).filter(Boolean))].join(', ')
                : '-',
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
            head: [['SN', 'Date (AD)', 'Date (BS)', 'Day', 'Staff', 'Status', 'In', 'Out', 'Hrs', 'Nature of Assignment', 'Client & Work Description']],
            body: rows,
            startY: 60,
            styles: { fontSize: 7, cellPadding: 2.5, lineColor: [220, 225, 235], lineWidth: 0.2 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 24 },
                2: { cellWidth: 24 },
                3: { cellWidth: 12 },
                5: { cellWidth: 16, halign: 'center' },
                6: { cellWidth: 12 },
                7: { cellWidth: 12 },
                8: { cellWidth: 10, halign: 'center' },
                10: { cellWidth: 'auto' },
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                    const status = data.cell.raw as string;
                    data.cell.styles.fillColor = getStatusColor(status);
                    data.cell.styles.textColor = [30, 41, 59];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        // ── Summary Stats ───────────────────────────────────────────────
        const pStats = getPeriodStats();
        const finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(14, finalY, pageW - 28, 22, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('PERIOD SUMMARY', 20, finalY + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`Present: ${pStats.totalPresent}   |   Absent: ${pStats.totalAbsent}   |   On Leave: ${pStats.totalLeave}   |   Holidays/Weekends: ${pStats.totalHoliday}   |   Total Hours: ${pStats.totalHours}h   |   Total Records: ${reportData.length}`, 20, finalY + 15);

        // ── Signature Block ─────────────────────────────────────────────
        const sigY = finalY + 35;
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.line(20, sigY, 80, sigY);
        doc.text('Staff Signature', 35, sigY + 5);
        doc.line(110, sigY, 170, sigY);
        doc.text('Supervisor / Manager', 125, sigY + 5);
        doc.line(200, sigY, 260, sigY);
        doc.text('Date', 225, sigY + 5);

        // ── Footer ──────────────────────────────────────────────────────
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(150, 160, 175);
            doc.text('R. Sapkota & Associates — Confidential', 14, doc.internal.pageSize.height - 8);
            doc.text(`Page ${i} of ${pageCount}`, pageW - 14, doc.internal.pageSize.height - 8, { align: 'right' });
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

        const TOTAL_COLS = 12; // SN + Date(AD) + Date(BS) + Day + Staff + Status + In + Out + Hrs + Client + Nature + Description
        const lastColLetter = 'L';

        // ── Company Header Block ────────────────────────────────────────
        sheet.mergeCells(`A1:${lastColLetter}1`);
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'R. Sapkota & Associates';
        titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        sheet.getRow(1).height = 32;

        sheet.mergeCells(`A2:${lastColLetter}2`);
        const addrCell = sheet.getCell('A2');
        addrCell.value = 'Chartered Accountants  |  Kathmandu, Nepal';
        addrCell.font = { name: 'Calibri', size: 10, color: { argb: 'FFB4C8E6' } };
        addrCell.alignment = { horizontal: 'center', vertical: 'middle' };
        addrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        sheet.getRow(2).height = 18;

        sheet.mergeCells(`A3:${lastColLetter}3`);
        const reportTitleCell = sheet.getCell('A3');
        reportTitleCell.value = 'Attendance & Work Log Report';
        reportTitleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E293B' } };
        reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        reportTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        sheet.getRow(3).height = 22;

        sheet.mergeCells(`A4:${lastColLetter}4`);
        const periodCell = sheet.getCell('A4');
        const bsPeriod = `${formatDateBS(filterStartDate)} - ${formatDateBS(filterEndDate)} BS`;
        periodCell.value = `Period: ${formatDateAD(filterStartDate)} to ${formatDateAD(filterEndDate)}  |  ${bsPeriod}  |  Generated: ${new Date().toLocaleString()}`;
        periodCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
        periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
        periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        sheet.getRow(4).height = 16;

        // Blank spacer
        sheet.getRow(5).height = 6;

        // ── Column Headers ──────────────────────────────────────────────
        const COLS = [
            { header: 'SN', key: 'sn', width: 6 },
            { header: 'Date (AD)', key: 'dateAD', width: 16 },
            { header: 'Date (BS)', key: 'dateBS', width: 16 },
            { header: 'Day', key: 'day', width: 10 },
            { header: 'Staff Name', key: 'name', width: 22 },
            { header: 'Status', key: 'status', width: 13 },
            { header: 'Clock In', key: 'in', width: 11 },
            { header: 'Clock Out', key: 'out', width: 11 },
            { header: 'Hours', key: 'hours', width: 9 },
            { header: 'Client Name', key: 'client', width: 25 },
            { header: 'Nature of Assignment', key: 'nature', width: 22 },
            { header: 'Work Description', key: 'description', width: 45 },
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
            const clientName = r.workLogs?.length > 0
                ? [...new Set(r.workLogs.map((l: any) => l.clientName).filter(Boolean))].join('\n')
                : (r.clientName || '-');
            const natureOfAssignment = r.workLogs?.length > 0
                ? [...new Set(r.workLogs.map((l: any) => l.natureOfAssignment).filter(Boolean))].join('\n')
                : '-';
            const description = r.workLogs?.length > 0
                ? r.workLogs.map((l: any) => l.description).filter(Boolean).join('\n')
                : (r.notes && r.notes !== '-' ? r.notes : '-');

            const row = sheet.addRow({
                sn: idx + 1,
                dateAD: formatDateAD(r.date),
                dateBS: formatDateBS(r.date),
                day: getDayOfWeek(r.date),
                name: r.userName,
                status: r.status,
                in: r.clockIn || '-',
                out: r.clockOut || '-',
                hours: r.workHours ? `${r.workHours}h` : '-',
                client: clientName,
                nature: natureOfAssignment,
                description: description,
            });

            const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
            const statusBg = statusFill[r.status] || rowBg;

            row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                cell.font = { name: 'Calibri', size: 9 };
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.fill = {
                    type: 'pattern', pattern: 'solid',
                    fgColor: { argb: colNum === 6 ? statusBg : rowBg }
                };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };
            });

            // SN cell - centered
            const snCell = row.getCell(1);
            snCell.alignment = { horizontal: 'center', vertical: 'top' };

            // Bold + centered status cell
            const statusCell = row.getCell(6);
            statusCell.font = { name: 'Calibri', size: 9, bold: true };
            statusCell.alignment = { horizontal: 'center', vertical: 'top' };

            // Client name styling
            const clientCell = row.getCell(10);
            clientCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F4C75' } };

            // Nature cell styling
            const natureCell = row.getCell(11);
            natureCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF475569' } };

            row.height = r.workLogs?.length > 1 ? Math.min(r.workLogs.length * 16, 80) : 18;
        });

        // ── Summary Statistics ───────────────────────────────────────────
        const pStats = getPeriodStats();
        const blankRow = sheet.addRow({});
        blankRow.height = 8;

        const summaryHeaderRow = sheet.addRow({});
        sheet.mergeCells(`A${summaryHeaderRow.number}:${lastColLetter}${summaryHeaderRow.number}`);
        const summaryHeaderCell = summaryHeaderRow.getCell(1);
        summaryHeaderCell.value = 'PERIOD SUMMARY';
        summaryHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
        summaryHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        summaryHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
        summaryHeaderRow.height = 24;

        const statsData = [
            ['Total Present', pStats.totalPresent, 'Total Absent', pStats.totalAbsent, 'On Leave', pStats.totalLeave],
            ['Holidays/Weekends', pStats.totalHoliday, 'Total Hours', `${pStats.totalHours}h`, 'Total Records', reportData.length],
        ];

        statsData.forEach(rowData => {
            const sRow = sheet.addRow({});
            [1, 3, 5].forEach((colIdx, i) => {
                const labelCell = sRow.getCell(colIdx);
                labelCell.value = rowData[i * 2] as string;
                labelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF475569' } };
                labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
                const valCell = sRow.getCell(colIdx + 1);
                valCell.value = rowData[i * 2 + 1];
                valCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
                valCell.alignment = { horizontal: 'left', vertical: 'middle' };
            });
            sRow.height = 20;
        });

        // ── Signature Block ──────────────────────────────────────────────
        const sigBlankRow = sheet.addRow({});
        sigBlankRow.height = 30;

        const sigRow = sheet.addRow({});
        const sigLabels = [
            { col: 2, text: '________________________' },
            { col: 5, text: '________________________' },
            { col: 8, text: '________________________' },
        ];
        sigLabels.forEach(s => {
            const c = sigRow.getCell(s.col);
            c.value = s.text;
            c.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
            c.alignment = { horizontal: 'center' };
        });

        const sigLabelRow = sheet.addRow({});
        const sigTexts = [
            { col: 2, text: 'Staff Signature' },
            { col: 5, text: 'Supervisor / Manager' },
            { col: 8, text: 'Date' },
        ];
        sigTexts.forEach(s => {
            const c = sigLabelRow.getCell(s.col);
            c.value = s.text;
            c.font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
            c.alignment = { horizontal: 'center' };
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
        <div className="bg-[#0d1117] min-h-screen text-[#c9d1d9] pb-12">
            <div className="max-w-[1600px] mx-auto space-y-8 px-4 sm:px-6 lg:px-8 pt-6">
                
                {/* ── Top Bar (Navigation & Actions) ── */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/5">
                            <Users className="text-amber-500" size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                                <span className="hover:text-amber-500 cursor-pointer transition-colors">Operations</span>
                                <ChevronRight size={10} />
                                <span className="text-gray-400">Attendance</span>
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">Firm Attendance</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <div className="flex bg-[#161b22] border border-[#30363d] p-1 rounded-xl shadow-inner">
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#21262d] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <ListIcon size={18} />
                            </button>
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#21262d] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <LayoutGrid size={18} />
                            </button>
                        </div>
                        <div className="h-8 w-px bg-[#30363d]" />
                        <button onClick={handleExportPDF} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-xl border border-[#30363d] transition-all text-sm font-bold shadow-md">
                            <FileText size={16} className="text-rose-400" /> PDF
                        </button>
                        <button onClick={handleExportExcel} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-xl border border-[#30363d] transition-all text-sm font-bold shadow-md">
                            <Download size={16} className="text-emerald-400" /> Excel
                        </button>
                    </div>
                </div>

                {/* ── Dashboard Stats Row ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2">
                        <ClockWidget />
                    </div>
                    <StatCard title="Total Present" value={stats.present} icon={UserCheck} color="text-emerald-400" trend={`${stats.late} delayed`} />
                    <StatCard title="Absentees" value={stats.absent} icon={XCircle} color="text-rose-400" />
                    <StatCard title="Personal Leave" value={stats.onLeave} icon={UserPlus} color="text-sky-400" />
                </div>

                {/* ── Filter & Search Bar ── */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-col gap-4 shadow-xl">
                    
                    {/* Top Row: Search & Manual Log */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <input 
                                type="text"
                                placeholder="Search team member or status..."
                                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-amber-500/50 transition-all placeholder:text-gray-600"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <button 
                            onClick={() => {
                                setSelectedUserForEdit(null);
                                setSelectedDateForEdit(getCurrentDateUTC());
                                setSelectedRecord(null);
                                setIsEditModalOpen(true);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#21262d] hover:bg-[#30363d] text-white rounded-xl border border-[#30363d] hover:border-[#484f58] transition-all font-black text-[11px] uppercase tracking-widest shadow-lg shadow-black/20 group shrink-0"
                        >
                            <Plus size={16} className="text-amber-500 group-hover:scale-110 transition-transform" /> 
                            <span>Manual Log</span>
                        </button>
                    </div>

                    {/* Bottom Row: Filters */}
                    <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 w-full border-t border-[#30363d] pt-4">
                        {isAdmin && (
                            <div className="w-full xl:w-56 shrink-0 z-20">
                                <StaffSelect
                                    value={filterStaffId}
                                    onChange={(val) => setFilterStaffId(Array.isArray(val) ? val[0] : val)}
                                    users={usersList}
                                    showAllOption
                                />
                            </div>
                        )}

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-[#21262d] border border-[#30363d] rounded-xl px-4 py-2 text-sm text-gray-300 outline-none hover:border-gray-600 transition-all w-full xl:w-48 shrink-0 h-[56px] appearance-none"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PRESENT">Present Only</option>
                            <option value="ABSENT">Absent Only</option>
                            <option value="ON LEAVE">On Leave</option>
                            <option value="HOLIDAY">Firm Holidays</option>
                        </select>

                        <div className="flex-1 w-full bg-[#21262d] border border-[#30363d] rounded-xl px-4 py-2 group hover:border-[#484f58] transition-all h-[56px]">
                            <div className="flex items-center justify-between xl:mb-0 mb-1">
                                <div className="flex items-center gap-2 xl:hidden">
                                    <CalendarDays size={14} className="text-amber-500" />
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Date Range</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 h-full">
                                <div className="flex-1 w-1/2 relative flex items-center h-full">
                                    <span className="absolute -top-4 left-0 bg-[#21262d] px-1 text-[8px] font-bold text-gray-500 z-10 group-hover:text-gray-400 transition-colors">FROM</span>
                                    {useNepaliFrom ? (
                                        <NepaliDatePicker 
                                            value={filterStartDate} 
                                            onChange={setFilterStartDate} 
                                            className="!bg-transparent !border-0 !p-0 !min-h-0 !h-full !text-white !text-xs !static w-full" 
                                            placeholder="Start Date"
                                            showADDate={false}
                                        />
                                    ) : (
                                        <input 
                                            type="date" 
                                            value={filterStartDate} 
                                            onChange={(e) => setFilterStartDate(e.target.value)} 
                                            className="w-full bg-transparent border-0 p-0 h-full text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:invert-[0.6] [&::-webkit-calendar-picker-indicator]:opacity-60 cursor-pointer" 
                                        />
                                    )}
                                </div>
                                <div className="w-px h-5 bg-[#30363d]" />
                                <div className="flex-1 w-1/2 relative flex items-center h-full">
                                    <span className="absolute -top-4 left-0 bg-[#21262d] px-1 text-[8px] font-bold text-gray-500 z-10 group-hover:text-gray-400 transition-colors">TO</span>
                                    {useNepaliFrom ? (
                                        <NepaliDatePicker 
                                            value={filterEndDate} 
                                            onChange={setFilterEndDate} 
                                            className="!bg-transparent !border-0 !p-0 !min-h-0 !h-full !text-white !text-xs !static w-full" 
                                            placeholder="End Date"
                                            showADDate={false}
                                        />
                                    ) : (
                                        <input 
                                            type="date" 
                                            value={filterEndDate} 
                                            onChange={(e) => setFilterEndDate(e.target.value)} 
                                            className="w-full bg-transparent border-0 p-0 h-full text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:invert-[0.6] [&::-webkit-calendar-picker-indicator]:opacity-60 cursor-pointer" 
                                        />
                                    )}
                                </div>
                                <div className="hidden xl:flex items-center">
                                    <button 
                                        onClick={() => setUseNepaliFrom(!useNepaliFrom)} 
                                        className={`text-[9px] px-2 py-0.5 rounded font-black transition-all ${useNepaliFrom ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 bg-white/5 hover:text-gray-300'}`}
                                    >
                                        BS
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button onClick={loadData} className="w-full xl:w-auto h-[56px] flex items-center justify-center px-6 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-600/20 shrink-0">
                            Apply Filter
                        </button>
                    </div>
                </div>

                {/* ── Main Records Section ── */}
                <AnimatePresence mode="wait">
                    {viewMode === 'list' ? (
                        <motion.div 
                            key="list"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xl relative"
                        >
                            <div className="overflow-x-auto overflow-y-hidden">
                                <table className="w-full text-left border-collapse min-w-[1000px]">
                                    <thead>
                                        <tr className="border-b border-[#30363d] bg-[#0d1117]/50">
                                            <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest w-12">SN</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date & Staff</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest w-20">Day</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Timing</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Nature of Assignment</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Clients & Work Logs</th>
                                            {isAdmin && <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#30363d]">
                                        {loading ? (
                                            <tr><td colSpan={isAdmin ? 8 : 7} className="p-32 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                                    <span className="text-gray-500 font-bold uppercase tracking-widest text-[11px]">Synchronizing Records...</span>
                                                </div>
                                            </td></tr>
                                        ) : reportData.length === 0 ? (
                                            <tr><td colSpan={isAdmin ? 8 : 7} className="p-32 text-center text-gray-600 font-bold italic tracking-wide">No attendance records found for the selected criteria.</td></tr>
                                        ) : (
                                            reportData.map((record, idx) => (
                                                <tr key={record.id} className="hover:bg-[#21262d]/40 transition-all group/row">
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="text-[11px] font-bold text-gray-600 tabular-nums">{idx + 1}</span>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-[#30363d] border border-[#484f58] flex items-center justify-center text-gray-300 font-black text-[10px] shadow-inner">
                                                                {record.userName.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-[13px] font-bold text-white leading-tight">{record.userName}</div>
                                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                    <span className="text-[10px] font-black text-gray-500 uppercase">{new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                    <span className="w-1 h-1 rounded-full bg-gray-700" />
                                                                    <span className="text-[10px] font-bold text-amber-500/80">{(() => { try { return new NepaliDate(new Date(record.date + 'T00:00:00')).format('DD MMM, YYYY'); } catch { return '-'; } })()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-[11px] font-bold text-gray-400">{(() => { try { return new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }); } catch { return '-'; } })()}</span>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        {record.clockIn ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-2 text-[11px] text-gray-300 font-bold tabular-nums">
                                                                    <Clock size={12} className="text-emerald-500" /> {record.clockIn}
                                                                    {record.clockOut && <span className="text-gray-600">→</span>}
                                                                    {record.clockOut && <span>{record.clockOut}</span>}
                                                                </div>
                                                                {record.workHours > 0 && (
                                                                    <div className="bg-white/5 border border-white/5 px-2 py-0.5 rounded text-[9px] font-black text-gray-500 w-fit">
                                                                        {record.workHours}H TOTAL
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-700 font-black tracking-widest text-[10px]">UNTRACKED</div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-widest shadow-sm ${
                                                            record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                            record.status === 'LATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                            record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                            record.status === 'ON LEAVE' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                                            'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                        }`}>
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        {record.workLogs?.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {[...new Set(record.workLogs.map((l: any) => l.natureOfAssignment).filter(Boolean))].map((nature: string, i: number) => (
                                                                    <span key={i} className="inline-block px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded text-[9px] font-bold mr-1 mb-1">{nature}</span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-700 text-[10px] italic">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        {record.workLogs?.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {record.workLogs.slice(0, 3).map((log: any, i: number) => (
                                                                    <div key={i} className="px-2 py-1 bg-white/[0.03] border border-white/5 rounded-md group/log cursor-default hover:bg-white/5 transition-colors max-w-[140px]">
                                                                        <div className="text-[9px] font-black text-amber-500 truncate">{log.clientName || 'TASK'}</div>
                                                                        <div className="text-[10px] text-gray-400 truncate mt-0.5">{log.description}</div>
                                                                    </div>
                                                                ))}
                                                                {record.workLogs.length > 3 && (
                                                                    <div className="text-[9px] font-black text-gray-600 mt-2">+{record.workLogs.length - 3} MORE</div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-600 italic text-[11px] leading-relaxed">
                                                                {record.clientName || record.notes || '—'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    {isAdmin && (
                                                        <td className="px-4 py-5 text-right">
                                                            <button
                                                                onClick={() => {
                                                                    const userProfile = usersList.find(u => u.uid === record.userId);
                                                                    if (userProfile) {
                                                                        setSelectedUserForEdit(userProfile);
                                                                        setSelectedDateForEdit(record.date);
                                                                        const realRecord = history.find(h => h.userId === record.userId && h.date === record.date);
                                                                        setSelectedRecord(realRecord || null);
                                                                        setIsEditModalOpen(true);
                                                                    }
                                                                }}
                                                                className="p-2 hover:bg-[#30363d] rounded-lg text-gray-500 hover:text-amber-500 transition-all shadow-sm"
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
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="grid"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                        >
                            {reportData.map((record) => (
                                <div key={record.id} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 hover:border-amber-500/30 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                            record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            record.status === 'LATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                            'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                        }`}>
                                            {record.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-[#0d1117] border border-[#30363d] flex items-center justify-center text-amber-500 font-black text-sm shadow-xl group-hover:scale-110 transition-transform">
                                            {record.userName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white tracking-tight">{record.userName}</div>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">{new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 flex justify-between items-center group-hover:bg-[#1c2128] transition-colors">
                                            <div className="text-[10px] font-black text-gray-600 uppercase">Timing</div>
                                            <div className="text-[11px] font-bold text-gray-300 tabular-nums">
                                                {record.clockIn || '--:--'} <span className="mx-1 text-gray-700">/</span> {record.clockOut || '--:--'}
                                            </div>
                                        </div>
                                        
                                        <div className="min-h-[60px]">
                                            <div className="text-[10px] font-black text-gray-600 uppercase mb-2">Activities</div>
                                            {record.workLogs?.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {record.workLogs.slice(0, 2).map((log: any, i: number) => (
                                                        <div key={i} className="text-[11px] text-gray-400 italic line-clamp-1 border-l-2 border-amber-500/30 pl-2">
                                                            {log.natureOfAssignment && <span className="text-[9px] font-black text-amber-500/70 not-italic mr-1">[{log.natureOfAssignment}]</span>}
                                                            {log.description}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-gray-700 italic">{record.notes || 'No activities logged.'}</div>
                                            )}
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <button 
                                            onClick={() => {
                                                const userProfile = usersList.find(u => u.uid === record.userId);
                                                if (userProfile) {
                                                    setSelectedUserForEdit(userProfile);
                                                    setSelectedDateForEdit(record.date);
                                                    const realRecord = history.find(h => h.userId === record.userId && h.date === record.date);
                                                    setSelectedRecord(realRecord || null);
                                                    setIsEditModalOpen(true);
                                                }
                                            }}
                                            className="mt-4 w-full py-2 bg-[#21262d] hover:bg-[#30363d] text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-[#30363d]"
                                        >
                                            Modify Record
                                        </button>
                                    )}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Period Summary Bar ── */}
                {!loading && reportData.length > 0 && (() => {
                    const pStats = getPeriodStats();
                    return (
                        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Period Summary</div>
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="text-center">
                                    <div className="text-lg font-black text-emerald-400 tabular-nums">{pStats.totalPresent}</div>
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Present</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-black text-rose-400 tabular-nums">{pStats.totalAbsent}</div>
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Absent</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-black text-sky-400 tabular-nums">{pStats.totalLeave}</div>
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Leave</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-black text-purple-400 tabular-nums">{pStats.totalHoliday}</div>
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Holidays</div>
                                </div>
                                <div className="h-8 w-px bg-[#30363d]" />
                                <div className="text-center">
                                    <div className="text-lg font-black text-amber-400 tabular-nums">{pStats.totalHours}h</div>
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Total Hours</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-black text-gray-300 tabular-nums">{reportData.length}</div>
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Records</div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <ManualAttendanceModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                record={selectedRecord}
                selectedDate={selectedDateForEdit}
                selectedUser={selectedUserForEdit}
                clients={clients}
                users={usersList}
                isAdmin={isAdmin}
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
