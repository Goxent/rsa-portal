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
import ReviewRequestsModal from '../components/attendance/ReviewRequestsModal';
import { 
    FileText, Download, Filter, Search, Calendar as CalendarIcon, 
    Users, CheckCircle, XCircle, Clock, AlertTriangle, Briefcase, 
    ChevronRight, User, Edit2, Plus,
    ExternalLink, MapPin, TrendingUp, UserCheck, UserPlus, CalendarDays
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';

// ── Components ──

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <div 
        className="flex items-start justify-between p-4 transition-all duration-200 group rounded-xl border border-[var(--border)] hover:border-[var(--border-accent)] hover:-translate-y-[1px]"
        style={{ background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-card)' }}
    >
        <div>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="uppercase mb-1 flex items-center gap-1.5">
                <Icon size={12} className={color} /> {title}
            </p>
            <h3 style={{ fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-heading)' }} className="leading-tight">{value}</h3>
            {trend && (
                <div className="flex items-center gap-1 mt-1">
                    <TrendingUp size={10} className="text-[var(--accent)]" />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--accent)' }}>{trend}</span>
                </div>
            )}
        </div>
        <div 
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)]"
            style={{ background: 'var(--accent-dim)' }}
        >
            <Icon size={18} style={{ color: 'var(--accent)' }} />
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
        <div 
            className="flex flex-col items-center justify-center p-5 relative overflow-hidden group shadow-xl border border-[var(--border)]"
            style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[var(--accent)]/10 transition-all duration-700" />
            <div 
                style={{ fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.2em', color: 'var(--accent)' }}
                className="uppercase mb-1.5 flex items-center gap-2"
            >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" /> Live Tracker
            </div>
            <div 
                style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}
                className="tracking-tighter mb-1"
            >
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }} className="flex items-center gap-3">
                <span className="flex items-center gap-1"><CalendarIcon size={11} /> {time.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
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
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    // Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [selectedDateForEdit, setSelectedDateForEdit] = useState<string>('');
    const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    // Filtering State
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterStaffId, setFilterStaffId] = useState<string>('ALL');
    const [filterStartDate, setFilterStartDate] = useState<string>('');
    const [filterEndDate, setFilterEndDate] = useState<string>('');
    const [useNepaliFrom, setUseNepaliFrom] = useState(false);
    const [useNepaliTo, setUseNepaliTo] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'ALL' | 'MY' | 'ADMIN'>('ALL');

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER;

    useEffect(() => {
        const today = new Date();
        const npNow = new NepaliDate();

        // Start of Nepali (BS) Month
        const npFirstDay = new NepaliDate(npNow.getYear(), npNow.getMonth(), 1);
        const jsDate = npFirstDay.toJsDate();
        const startOfMonthAd = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;

        // End Date (Today)
        const todayAd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        if (!filterStartDate) setFilterStartDate(startOfMonthAd);
        if (!filterEndDate) setFilterEndDate(todayAd);
        
        // Default to Nepali view
        setUseNepaliFrom(true);
        setUseNepaliTo(true);

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

            setUsersList(uList); 
            setHistory(attHistory);
            setLeavesList(lList.filter(l => l.status === 'APPROVED'));
            setHolidays(allEvents.filter(e => e.type === 'HOLIDAY'));
            setClients(fetchedClients);

            if (isAdmin) {
                fetchPendingCount();
            }
        } catch (err) {
            console.error("Error loading attendance data:", err);
            toast.error("Failed to load attendance records");
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingCount = async () => {
        try {
            const requests = await AuthService.getPendingAttendanceRequests();
            setPendingRequestsCount(requests.length);
        } catch (error) {
            console.error("Failed to fetch pending attendance count:", error);
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

                const holiday = holidays.find(h => h.date === dateStr);
                if (holiday) {
                    report.push({
                        id: `h_${u.uid}_${dateStr}`,
                        userId: u.uid,
                        userName: u.displayName,
                        date: dateStr,
                        status: 'OFFICE CLOSED',
                        clientName: holiday.title || 'Holiday',
                        notes: 'Public Holiday',
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

        // ── Generated timestamp & Staff Info ────────────────────────────────
        doc.setFontSize(7);
        doc.setTextColor(120, 140, 160);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 55);

        // ── Table ───────────────────────────────────────────────────────
        const uniqueStaffNames = [...new Set(reportData.map(r => r.userName))];
        const isSingleStaff = uniqueStaffNames.length === 1;
        const staffNameStr = isSingleStaff ? uniqueStaffNames[0] : '';

        if (isSingleStaff) {
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(`Staff Member: ${staffNameStr}`, pageW - 14, 55, { align: 'right' });
            doc.setFont('helvetica', 'normal');
        }

        const rows = reportData.map((r, idx) => {
            const rowData: any[] = [
                idx + 1,
                formatDateAD(r.date),
                formatDateBS(r.date),
                getDayOfWeek(r.date)
            ];
            
            if (!isSingleStaff) {
                rowData.push(r.userName);
            }
            
            rowData.push(
                r.status,
                r.clockIn || '-',
                r.clockOut || '-',
                r.workHours ? `${r.workHours}h` : '-',
                r.workLogs?.length > 0
                    ? [...new Set(r.workLogs.map((l: any) => l.natureOfAssignment).filter(Boolean))].join(', ')
                    : '-',
                r.workLogs?.length > 0
                    ? r.workLogs.map((l: any) => `${l.clientName} (${l.locationTag || 'Office'}): ${l.description}`).join('; ')
                    : (r.clientName || '-')
            );
            return rowData;
        });

        const getStatusColor = (status: string): [number, number, number] => {
            if (status === 'PRESENT') return [220, 252, 231];
            if (status === 'LATE') return [254, 243, 199];
            if (status === 'ABSENT') return [254, 226, 226];
            if (status === 'ON LEAVE') return [219, 234, 254];
            return [245, 245, 250];
        };

        const headRow = ['SN', 'Date (AD)', 'Date (BS)', 'Day'];
        if (!isSingleStaff) headRow.push('Staff');
        headRow.push('Status', 'In', 'Out', 'Hrs', 'Nature of Assignment', 'Client & Work Description');

        const statusIdx = isSingleStaff ? 4 : 5;
        const colStyles: any = {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 24 },
            2: { cellWidth: 24 },
            3: { cellWidth: 12 },
        };
        colStyles[statusIdx] = { cellWidth: 16, halign: 'center' };
        colStyles[statusIdx + 1] = { cellWidth: 12 };
        colStyles[statusIdx + 2] = { cellWidth: 12 };
        colStyles[statusIdx + 3] = { cellWidth: 10, halign: 'center' };
        colStyles[statusIdx + 5] = { cellWidth: 'auto' };

        autoTable(doc, {
            head: [headRow],
            body: rows,
            startY: 60,
            styles: { fontSize: 7, cellPadding: 2.5, lineColor: [220, 225, 235], lineWidth: 0.2 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            columnStyles: colStyles,
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === statusIdx) {
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

        const uniqueStaffNames = [...new Set(reportData.map(r => r.userName))];
        const isSingleStaff = uniqueStaffNames.length === 1;
        const staffNameStr = isSingleStaff ? uniqueStaffNames[0] : '';
        
        const TOTAL_COLS = isSingleStaff ? 11 : 12; // SN + Date(AD) + Date(BS) + Day + [Staff] + Status + In + Out + Hrs + Client + Nature + Description
        const lastColLetter = isSingleStaff ? 'K' : 'L';

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
        let headerText = `Period: ${formatDateAD(filterStartDate)} to ${formatDateAD(filterEndDate)}  |  ${bsPeriod}  |  Generated: ${new Date().toLocaleString()}`;
        if (isSingleStaff) {
             headerText = `Staff Member: ${staffNameStr}  |  ` + headerText;
        }
        periodCell.value = headerText;
        periodCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
        periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
        periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        sheet.getRow(4).height = 16;

        // Blank spacer
        sheet.getRow(5).height = 6;

        // ── Column Headers ──────────────────────────────────────────────
        const COLS: any[] = [
            { header: 'SN', key: 'sn', width: 6 },
            { header: 'Date (AD)', key: 'dateAD', width: 16 },
            { header: 'Date (BS)', key: 'dateBS', width: 16 },
            { header: 'Day', key: 'day', width: 10 },
        ];
        
        if (!isSingleStaff) {
            COLS.push({ header: 'Staff Name', key: 'name', width: 22 });
        }
        
        COLS.push(
            { header: 'Status', key: 'status', width: 13 },
            { header: 'Clock In', key: 'in', width: 11 },
            { header: 'Clock Out', key: 'out', width: 11 },
            { header: 'Hours', key: 'hours', width: 9 },
            { header: 'Client Name', key: 'client', width: 25 },
            { header: 'Nature of Assignment', key: 'nature', width: 22 },
            { header: 'Work Description', key: 'description', width: 45 },
        );
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
                ? r.workLogs.map((l: any) => `[${l.locationTag || 'Office'}] ${l.description}`).filter(Boolean).join('\n')
                : (r.notes && r.notes !== '-' ? r.notes : '-');

            const rowData: any = {
                sn: idx + 1,
                dateAD: formatDateAD(r.date),
                dateBS: formatDateBS(r.date),
                day: getDayOfWeek(r.date),
                status: r.status,
                in: r.clockIn || '-',
                out: r.clockOut || '-',
                hours: r.workHours ? `${r.workHours}h` : '-',
                client: clientName,
                nature: natureOfAssignment,
                description: description,
            };
            
            if (!isSingleStaff) {
                rowData.name = r.userName;
            }

            const row = sheet.addRow(rowData);

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
        <div className="h-full overflow-y-auto custom-scrollbar relative pb-20" style={{ background: 'var(--bg-main)', color: 'var(--text-body)' }}>
            <div className="max-w-[1600px] mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6 animate-in fade-in duration-500">
                
                {/* ── Top Bar (Navigation & Actions) ── */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div 
                            className="w-12 h-12 flex items-center justify-center shadow-lg"
                            style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-lg)' }}
                        >
                            <Users style={{ color: 'var(--accent)' }} size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2" style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                <span className="hover:text-[var(--accent)] cursor-pointer transition-colors">Operations</span>
                                <ChevronRight size={10} />
                                <span style={{ color: 'var(--text-muted)' }}>Attendance</span>
                            </div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.025em' }} className="mt-0.5">Firm Attendance</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <div className="h-8 w-px" style={{ background: 'var(--border)' }} />
                        <button 
                            onClick={handleExportPDF} 
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 transition-all text-sm font-bold shadow-md border"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-mid)', color: 'var(--text-heading)', borderRadius: 'var(--radius-md)' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                        >
                            <FileText size={16} className="text-rose-400" /> PDF
                        </button>
                        <button 
                            onClick={handleExportExcel} 
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 transition-all text-sm font-bold shadow-md border"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-mid)', color: 'var(--text-heading)', borderRadius: 'var(--radius-md)' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                        >
                            <Download size={16} style={{ color: 'var(--accent)' }} /> Excel
                        </button>
                    </div>
                </div>

                {/* ── Dashboard Stats Row ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2">
                        <ClockWidget />
                    </div>
                    {isAdmin && (
                        <>
                            <StatCard title="Total Present" value={stats.present} icon={UserCheck} color="text-brand-400" trend={`${stats.late} delayed`} />
                            <StatCard title="Absentees" value={stats.absent} icon={XCircle} color="text-rose-400" />
                            <StatCard title="Personal Leave" value={stats.onLeave} icon={UserPlus} color="text-sky-400" />
                        </>
                    )}
                </div>

                {/* ── Filter & Search Bar ── */}
                <div 
                    className="p-4 flex flex-col gap-4 shadow-xl border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-lg)' }}
                >
                    
                    {/* Top Row: Search & Manual Log */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} size={16} />
                            <input 
                                type="text"
                                placeholder="Search team member or status..."
                                className="w-full border outline-none transition-all py-2.5 pl-10 pr-4"
                                style={{ 
                                    background: 'var(--bg-main)', 
                                    borderColor: 'var(--border)', 
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-heading)',
                                    fontSize: '0.875rem'
                                }}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            {isAdmin && (
                                <button 
                                    onClick={() => setIsReviewModalOpen(true)}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 transition-all font-bold uppercase tracking-widest shadow-lg border relative group"
                                    style={{ 
                                        background: 'var(--accent-dim)', 
                                        color: 'var(--accent)', 
                                        borderColor: 'var(--border-accent)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.6875rem'
                                    }}
                                >
                                    <Clock size={16} className="group-hover:rotate-12 transition-transform" /> 
                                    <span>Review Requests</span>
                                    {pendingRequestsCount > 0 && (
                                        <span 
                                            className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center font-bold text-[10px] animate-in zoom-in-50 duration-300"
                                            style={{ background: 'var(--color-danger)', color: 'white', borderRadius: '50%', boxShadow: '0 0 0 2px var(--bg-surface)' }}
                                        >
                                            {pendingRequestsCount}
                                        </span>
                                    )}
                                </button>
                            )}

                            <button 
                                onClick={() => {
                                    const currentUserProfile = !isAdmin ? usersList.find(u => u.uid === user?.uid) : null;
                                    setSelectedUserForEdit(currentUserProfile || null);
                                    setSelectedDateForEdit(getCurrentDateUTC());
                                    setSelectedRecord(null);
                                    setIsEditModalOpen(true);
                                }}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 transition-all font-bold uppercase tracking-widest shadow-lg border group shrink-0"
                                style={{ 
                                    background: 'var(--bg-surface)', 
                                    color: 'var(--text-heading)', 
                                    borderColor: 'var(--border-mid)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.6875rem'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                            >
                                <Plus size={16} style={{ color: 'var(--accent)' }} className="group-hover:scale-110 transition-transform" /> 
                                <span>{isAdmin ? 'Manual Log' : 'Request Manual Log'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Filters */}
                    <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 w-full border-t pt-4" style={{ borderColor: 'var(--border)' }}>
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
                            className="px-4 py-2 text-sm outline-none transition-all w-full xl:w-48 shrink-0 h-[48px] appearance-none border"
                            style={{ 
                                background: 'var(--bg-main)', 
                                borderColor: 'var(--border)', 
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-body)'
                            }}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PRESENT">Present Only</option>
                            <option value="ABSENT">Absent Only</option>
                            <option value="ON LEAVE">On Leave</option>
                            <option value="HOLIDAY">Firm Holidays</option>
                        </select>

                        <div 
                            className="flex-1 w-full border px-4 py-2 group transition-all h-[48px]"
                            style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
                        >
                            <div className="flex items-center gap-4 h-full">
                                <div className="flex-1 w-1/2 relative flex items-center h-full">
                                    <span className="absolute -top-4 left-0 px-1 text-[8px] font-bold transition-colors z-10" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>FROM</span>
                                    {useNepaliFrom ? (
                                        <NepaliDatePicker 
                                            value={filterStartDate} 
                                            onChange={setFilterStartDate} 
                                            className="!bg-transparent !border-0 !p-0 !min-h-0 !h-full !text-xs !static w-full !text-[var(--text-heading)]" 
                                            placeholder="Start Date"
                                            showADDate={false}
                                        />
                                    ) : (
                                        <input 
                                            type="date" 
                                            value={filterStartDate} 
                                            onChange={(e) => setFilterStartDate(e.target.value)} 
                                            style={{ color: 'var(--text-heading)' }}
                                            className="w-full bg-transparent border-0 p-0 h-full text-xs outline-none [&::-webkit-calendar-picker-indicator]:invert-[0.6] [&::-webkit-calendar-picker-indicator]:opacity-60 cursor-pointer" 
                                        />
                                    )}
                                </div>
                                <div className="w-px h-5" style={{ background: 'var(--border)' }} />
                                <div className="flex-1 w-1/2 relative flex items-center h-full">
                                    <span className="absolute -top-4 left-0 px-1 text-[8px] font-bold transition-colors z-10" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>TO</span>
                                    {useNepaliFrom ? (
                                        <NepaliDatePicker 
                                            value={filterEndDate} 
                                            onChange={setFilterEndDate} 
                                            className="!bg-transparent !border-0 !p-0 !min-h-0 !h-full !text-xs !static w-full !text-[var(--text-heading)]" 
                                            placeholder="End Date"
                                            showADDate={false}
                                        />
                                    ) : (
                                        <input 
                                            type="date" 
                                            value={filterEndDate} 
                                            onChange={(e) => setFilterEndDate(e.target.value)} 
                                            style={{ color: 'var(--text-heading)' }}
                                            className="w-full bg-transparent border-0 p-0 h-full text-xs outline-none [&::-webkit-calendar-picker-indicator]:invert-[0.6] [&::-webkit-calendar-picker-indicator]:opacity-60 cursor-pointer" 
                                        />
                                    )}
                                </div>
                                <div className="hidden xl:flex items-center">
                                    <button 
                                        onClick={() => setUseNepaliFrom(!useNepaliFrom)} 
                                        className={`text-[9px] px-2 py-0.5 rounded font-black transition-all ${useNepaliFrom ? 'shadow-lg' : ''}`}
                                        style={{ 
                                            background: useNepaliFrom ? 'var(--accent)' : 'var(--accent-dim)',
                                            color: useNepaliFrom ? 'white' : 'var(--accent)'
                                        }}
                                    >
                                        BS
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={loadData} 
                            style={{ background: 'var(--accent)', color: 'white', borderRadius: 'var(--radius-md)' }}
                            className="w-full xl:w-auto h-[48px] flex items-center justify-center px-6 hover:opacity-90 transition-all font-bold text-xs uppercase tracking-widest shadow-lg shrink-0"
                        >
                            Apply Filter
                        </button>
                    </div>
                </div>

                {/* ── Tab Bar (Categories) ── */}
                <div 
                    className="p-1 flex p-1 w-full max-w-lg mx-auto"
                    style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}
                >
                    {(['ALL', 'MY', 'ADMIN'] as const)
                        .filter(tab => {
                            if (tab === 'MY') return true;
                            return isAdmin;
                        })
                        .map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab);
                                    if (tab === 'MY') setFilterStaffId(user?.uid || 'ALL');
                                    else setFilterStaffId('ALL');
                                }}
                                className="flex-1 py-2 text-xs transition-all duration-200"
                                style={{ 
                                    background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                                    color: activeTab === tab ? 'var(--text-heading)' : 'var(--text-muted)',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: activeTab === tab ? 600 : 500,
                                    boxShadow: activeTab === tab ? 'var(--shadow-card)' : 'none'
                                }}
                            >
                                {tab === 'ALL' ? 'All Attendance' : tab === 'MY' ? 'My Attendance' : 'Admin View'}
                            </button>
                        ))}
                </div>

                {/* ── Main Records Section (List View) ── */}
                <div 
                    className="border overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 duration-500"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 'var(--radius-xl)' }}
                >
                            <div className="overflow-x-auto overflow-y-hidden">
                                <table className="w-full text-left border-collapse min-w-[1000px]">
                                    <thead>
                                        <tr className="border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                            <th style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="px-4 py-4 uppercase w-12 text-center">SN</th>
                                            <th style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="px-4 py-4 uppercase">Date & Staff</th>
                                            <th style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="px-4 py-4 uppercase w-20">Day</th>
                                            <th style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="px-4 py-4 uppercase">Timing</th>
                                            <th style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="px-4 py-4 uppercase">Status</th>
                                            <th style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="px-4 py-4 uppercase">Nature of Assignment</th>
                                            <th style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="px-4 py-4 uppercase">Clients & Work Logs</th>
                                            {isAdmin && <th style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="px-4 py-4 uppercase text-right">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                        {loading ? (
                                            <tr><td colSpan={isAdmin ? 8 : 7} className="p-32 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-10 h-10 border-4 border-t-[var(--accent)] rounded-full animate-spin" style={{ borderColor: 'var(--accent-dim)' }} />
                                                    <span style={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.6875rem' }} className="uppercase">Synchronizing Records...</span>
                                                </div>
                                            </td></tr>
                                        ) : reportData.length === 0 ? (
                                            <tr><td colSpan={isAdmin ? 8 : 7} className="p-32 text-center text-gray-500 font-bold italic tracking-wide">No attendance records found for the selected criteria.</td></tr>
                                        ) : (
                                            reportData.map((record, idx) => (
                                                <tr key={record.id} className="hover:bg-[var(--bg-surface)] transition-all group/row">
                                                    <td className="px-4 py-4 text-center">
                                                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div 
                                                                className="w-9 h-9 flex items-center justify-center font-bold shadow-inner border"
                                                                style={{ background: 'var(--bg-main)', borderColor: 'var(--border-mid)', borderRadius: '99px', color: 'var(--text-muted)', fontSize: '0.625rem' }}
                                                            >
                                                                {record.userName.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-heading)' }} className="leading-tight">{record.userName}</div>
                                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                    <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                    <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border)' }} />
                                                                    <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--accent)' }}>{(() => { try { return new NepaliDate(new Date(record.date + 'T00:00:00')).format('DD MMM, YYYY'); } catch { return '-'; } })()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>{(() => { try { return new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }); } catch { return '-'; } })()}</span>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        {record.clockIn ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-2 tabular-nums" style={{ fontSize: '0.6875rem', color: 'var(--text-body)', fontWeight: 600 }}>
                                                                    <Clock size={12} style={{ color: 'var(--accent)' }} /> {record.clockIn}
                                                                    {record.clockOut && <span style={{ color: 'var(--text-muted)' }}>→</span>}
                                                                    {record.clockOut && <span>{record.clockOut}</span>}
                                                                </div>
                                                                {record.workHours > 0 && (
                                                                    <div 
                                                                        className="px-2 py-0.5"
                                                                        style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', fontSize: '0.5625rem', fontWeight: 800, color: 'var(--accent)', width: 'fit-content' }}
                                                                    >
                                                                        {record.workHours}H TOTAL
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.1em', fontSize: '0.625rem' }}>UNTRACKED</div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <span 
                                                            className="px-2.5 py-1 uppercase tracking-widest shadow-sm border"
                                                            style={{ 
                                                                borderRadius: '99px',
                                                                fontSize: '0.6875rem',
                                                                fontWeight: 600,
                                                                background: 
                                                                    record.status === 'PRESENT' ? 'rgba(101,154,43,0.15)' :
                                                                    record.status === 'LATE' ? 'rgba(201,138,42,0.12)' :
                                                                    record.status === 'ABSENT' ? 'rgba(196,68,90,0.12)' :
                                                                    record.status === 'ON LEAVE' ? 'rgba(61,130,201,0.12)' :
                                                                    'var(--bg-main)',
                                                                color:
                                                                    record.status === 'PRESENT' ? 'var(--accent)' :
                                                                    record.status === 'LATE' ? 'var(--color-warning)' :
                                                                    record.status === 'ABSENT' ? 'var(--color-danger)' :
                                                                    record.status === 'ON LEAVE' ? 'var(--color-info)' :
                                                                    'var(--text-muted)',
                                                                borderColor:
                                                                    record.status === 'PRESENT' ? 'rgba(101,154,43,0.25)' :
                                                                    record.status === 'LATE' ? 'rgba(201,138,42,0.2)' :
                                                                    record.status === 'ABSENT' ? 'rgba(196,68,90,0.2)' :
                                                                    record.status === 'ON LEAVE' ? 'rgba(61,130,201,0.2)' :
                                                                    'var(--border)'
                                                            }}
                                                        >
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        {record.workLogs?.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {[...new Set(record.workLogs.map((l: any) => l.natureOfAssignment).filter(Boolean))].map((nature: string, i: number) => (
                                                                    <span key={i} className="inline-block px-2 py-0.5 border rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--border-accent)', fontSize: '0.5625rem', fontWeight: 800, textTransform: 'uppercase' }}>{nature}</span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }} className="italic">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        {record.workLogs?.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {record.workLogs.slice(0, 3).map((log: any, i: number) => (
                                                                    <div key={i} className="px-2 py-1 transition-colors max-w-[140px] border shadow-sm" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}>
                                                                        <div style={{ fontSize: '0.5625rem', fontWeight: 800, color: 'var(--accent)' }} className="truncate uppercase">{log.clientName || 'TASK'}</div>
                                                                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }} className="truncate mt-0.5">{log.description}</div>
                                                                    </div>
                                                                ))}
                                                                {record.workLogs.length > 3 && (
                                                                    <div style={{ fontSize: '0.5625rem', fontWeight: 800, color: 'var(--text-muted)' }} className="mt-2 text-center">+{record.workLogs.length - 3} MORE</div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="italic leading-relaxed">
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
                                                                className="p-2 transition-all shadow-sm border"
                                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}
                                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
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

                {/* ── Period Summary Bar ── */}
                {!loading && reportData.length > 0 && (() => {
                    const pStats = getPeriodStats();
                    return (
                        <div 
                            className="p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl border"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 'var(--radius-xl)' }}
                        >
                            <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)' }} className="uppercase">Period Summary</div>
                            <div className="flex flex-wrap items-center gap-8">
                                <div className="text-center">
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{pStats.totalPresent}</div>
                                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }} className="uppercase">Present</div>
                                </div>
                                <div className="text-center">
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-danger)', fontVariantNumeric: 'tabular-nums' }}>{pStats.totalAbsent}</div>
                                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }} className="uppercase">Absent</div>
                                </div>
                                <div className="text-center">
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-info)', fontVariantNumeric: 'tabular-nums' }}>{pStats.totalLeave}</div>
                                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }} className="uppercase">Leave</div>
                                </div>
                                <div className="text-center">
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>{pStats.totalHoliday}</div>
                                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }} className="uppercase">Holidays</div>
                                </div>
                                <div className="h-8 w-px" style={{ background: 'var(--border)' }} />
                                <div className="text-center">
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>{pStats.totalHours}h</div>
                                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }} className="uppercase">Total Hours</div>
                                </div>
                                <div className="text-center">
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>{reportData.length}</div>
                                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }} className="uppercase">Records</div>
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

            <ReviewRequestsModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                adminId={user?.uid || ''}
                adminName={user?.displayName || 'Admin'}
                onDataChange={() => {
                    loadData();
                    fetchPendingCount();
                }}
            />
        </div>
    );
};

export default AttendancePage;
