import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, UserRole, UserProfile, Client, LeaveRequest, CalendarEvent, WorkLog } from '../types';
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
    ChevronRight, User, Edit2, Plus, Home, MapPin, TrendingUp, 
    UserCheck, UserPlus, CalendarDays, CheckSquare, ShieldCheck, 
    ChevronDown, AlertCircle, Sparkles, Building2, Eye, HelpCircle,
    ArrowUpRight, RefreshCw, Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';

// ── Helpers ──

const formatDateAD = (dateStr: string) => {
    if (!dateStr) return '-';
    try { 
        const d = new Date(dateStr + 'T00:00:00');
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch { return dateStr; }
};

const formatDateBS = (dateStr: string) => {
    if (!dateStr) return '-';
    try { return new NepaliDate(new Date(dateStr + 'T00:00:00')).format('DD/MM/YYYY'); }
    catch { return '-'; }
};

const getDayOfWeek = (dateStr: string) => {
    try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }); }
    catch { return '-'; }
};

// ── Components ──

interface StatCardProps {
    title: string;
    value: number | string;
    denominator?: string;
    icon: any;
    color: string;
    trend?: string;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, denominator, icon: Icon, color, trend, onClick }) => (
    <div 
        onClick={onClick}
        className={`flex items-start justify-between p-4 transition-all duration-200 group rounded-2xl border border-[var(--border)] hover:border-[var(--border-accent)] hover:-translate-y-[1px] ${onClick ? 'cursor-pointer' : ''}`}
        style={{ background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-card)' }}
    >
        <div>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)' }} className="uppercase mb-1.5 flex items-center gap-1.5">
                <Icon size={12} className={color} /> {title}
            </p>
            <div className="flex items-baseline gap-1.5">
                <h3 style={{ fontSize: '1.625rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-heading)' }} className="leading-tight tabular-nums">
                    {value}
                </h3>
                {denominator && (
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                        {denominator}
                    </span>
                )}
            </div>
            {trend && (
                <div className="flex items-center gap-1 mt-1.5">
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--accent)' }}>{trend}</span>
                </div>
            )}
        </div>
        <div 
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--accent-dim)' }}
        >
            <Icon size={15} style={{ color: 'var(--accent)' }} />
        </div>
    </div>
);

const AttendancePage: React.FC = () => {
    React.useEffect(() => {
        document.title = 'Attendance — RSA';
        return () => { document.title = 'RSA'; };
    }, []);

    const { user } = useAuth();
    const location = useLocation();

    // Data State
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [leavesList, setLeavesList] = useState<LeaveRequest[]>([]);
    const [holidays, setHolidays] = useState<CalendarEvent[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    // Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [selectedDateForEdit, setSelectedDateForEdit] = useState<string>('');
    const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    // Cell Detail & Late Justification Modal
    const [cellDetailModalOpen, setCellDetailModalOpen] = useState(false);
    const [cellDetailData, setCellDetailData] = useState<{
        user: UserProfile;
        date: string;
        record?: AttendanceRecord;
        leave?: LeaveRequest;
        holiday?: CalendarEvent;
        status: string;
    } | null>(null);
    const [justificationReason, setJustificationReason] = useState('');
    const [isJustifying, setIsJustifying] = useState(false);

    // Navigation & View Tabs (P1, P2 Overhaul)
    type TabType = 'TODAY' | 'REGISTER' | 'LIST' | 'MY';
    const [activeTab, setActiveTab] = useState<TabType>('TODAY');

    // Filtering State for List View
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterStaffId, setFilterStaffId] = useState<string>('ALL');
    const [filterStartDate, setFilterStartDate] = useState<string>('');
    const [filterEndDate, setFilterEndDate] = useState<string>('');
    const [useNepaliFrom, setUseNepaliFrom] = useState(true);
    const [useNepaliTo, setUseNepaliTo] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Register Month Selector (BS Month)
    const [selectedBSMonthOffset, setSelectedBSMonthOffset] = useState<number>(0);

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER;
    const isMasterAdmin = user?.role === UserRole.MASTER_ADMIN;

    // Set initial date range (Bikram Sambat month start to today)
    useEffect(() => {
        const today = new Date();
        const npNow = new NepaliDate();

        // Start of Nepali (BS) Month
        const npFirstDay = new NepaliDate(npNow.getYear(), npNow.getMonth(), 1);
        const jsDate = npFirstDay.toJsDate();
        const startOfMonthAd = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;
        const todayAd = getCurrentDateUTC();

        if (!filterStartDate) setFilterStartDate(startOfMonthAd);
        if (!filterEndDate) setFilterEndDate(todayAd);

        if (location.state?.filterUserId) {
            setFilterStaffId(location.state.filterUserId);
            setActiveTab('LIST');
        }

        // Default tab selection based on role
        if (!isAdmin) {
            setActiveTab('MY');
        } else {
            setActiveTab('TODAY');
        }
    }, [isAdmin, location.state]);

    // D2 Fix: Depend on user ID and role only to prevent reloading on profile updates!
    useEffect(() => {
        if (user?.uid) {
            loadData();
        }
    }, [user?.uid, user?.role]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // S2 Fix: Regular staff fetch only their own records; Admins/Managers fetch full
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

    // Active staff members who must clock in (A2 Fix)
    const expectedStaffMembers = useMemo(() => {
        return usersList.filter(u => {
            if (u.status !== 'Active') return false;
            if (u.mustClockIn === false) return false;
            return true;
        });
    }, [usersList]);

    // D3 Fix: Build an O(1) Map for records keyed by `userId_date`
    const recordMap = useMemo(() => {
        const map = new Map<string, AttendanceRecord>();
        history.forEach(r => {
            map.set(`${r.userId}_${r.date}`, r);
        });
        return map;
    }, [history]);

    // Today's Date & Live Status
    const todayStr = getCurrentDateUTC();

    // ── TODAY'S METRICS & ATTENDANCE ───────────────────────────
    const todayData = useMemo(() => {
        const expectedCount = expectedStaffMembers.length;
        const clockedInRecords: { user: UserProfile; record: AttendanceRecord }[] = [];
        const onLeaveUsers: { user: UserProfile; leave: LeaveRequest }[] = [];
        const notClockedInUsers: UserProfile[] = [];
        let onSiteCount = 0;
        let lateCount = 0;

        expectedStaffMembers.forEach(staff => {
            const rec = recordMap.get(`${staff.uid}_${todayStr}`);
            const leave = leavesList.find(l => l.userId === staff.uid && l.startDate <= todayStr && l.endDate >= todayStr);

            if (rec && rec.clockIn) {
                clockedInRecords.push({ user: staff, record: rec });
                if (rec.checkInType === 'CLIENT_SITE' || rec.workLogs?.some(l => l.locationTag === 'Client Premises')) {
                    onSiteCount++;
                }
                if (rec.status === 'LATE' && !rec.lateJustified) {
                    lateCount++;
                }
            } else if (leave) {
                onLeaveUsers.push({ user: staff, leave });
            } else {
                notClockedInUsers.push(staff);
            }
        });

        return {
            expectedCount,
            clockedInRecords,
            onLeaveUsers,
            notClockedInUsers,
            presentCount: clockedInRecords.length,
            onSiteCount,
            lateCount,
        };
    }, [expectedStaffMembers, recordMap, leavesList, todayStr]);

    // Needs Attention Panel (P2 Overhaul)
    const needsAttentionItems = useMemo(() => {
        const items: {
            id: string;
            type: 'MISSED_CLOCKOUT' | 'LATE_THRESHOLD' | 'PENDING_REQUEST';
            title: string;
            description: string;
            user?: UserProfile;
            date?: string;
            recordId?: string;
        }[] = [];

        // 1. Forgotten clock-outs on past days (A6 Fix)
        history.forEach(r => {
            if (r.date < todayStr && r.clockIn && !r.clockOut) {
                const staff = usersList.find(u => u.uid === r.userId);
                items.push({
                    id: `missed_${r.id}`,
                    type: 'MISSED_CLOCKOUT',
                    title: `Missing Clock-Out: ${staff?.displayName || r.userName}`,
                    description: `Clocked in at ${r.clockIn} on ${formatDateAD(r.date)} (${formatDateBS(r.date)} BS) but shift was never closed.`,
                    user: staff,
                    date: r.date,
                    recordId: r.id
                });
            }
        });

        // 2. Staff near 6-late marks this BS month (A1 Fix)
        const npNow = new NepaliDate();
        const npStart = new NepaliDate(npNow.getYear(), npNow.getMonth(), 1);
        const startDateStr = npStart.toJsDate().toISOString().split('T')[0];

        usersList.forEach(staff => {
            const userMonthLates = history.filter(r => 
                r.userId === staff.uid && 
                r.date >= startDateStr && 
                r.date <= todayStr && 
                r.status === 'LATE' && 
                !r.lateJustified
            );
            if (userMonthLates.length >= 4) {
                items.push({
                    id: `late_${staff.uid}`,
                    type: 'LATE_THRESHOLD',
                    title: `Late Mark Alert: ${staff.displayName}`,
                    description: `Has ${userMonthLates.length} unjustified late marks this month (${6 - userMonthLates.length} left before 1 day leave deduction).`,
                    user: staff
                });
            }
        });

        return items;
    }, [history, usersList, todayStr]);

    // ── REGISTER GRID DATA (P1, A8 Overhaul) ─────────────────────
    const registerData = useMemo(() => {
        const npNow = new NepaliDate();
        let targetYear = npNow.getYear();
        let targetMonth = npNow.getMonth() + selectedBSMonthOffset;

        while (targetMonth < 0) {
            targetMonth += 12;
            targetYear -= 1;
        }
        while (targetMonth > 11) {
            targetMonth -= 12;
            targetYear += 1;
        }

        const npMonthStart = new NepaliDate(targetYear, targetMonth, 1);
        const jsStart = npMonthStart.toJsDate();

        // Calculate days in Nepali month
        let daysInMonth = 30;
        try {
            const nextMonth = targetMonth === 11 ? 0 : targetMonth + 1;
            const nextYear = targetMonth === 11 ? targetYear + 1 : targetYear;
            const npNextMonthStart = new NepaliDate(nextYear, nextMonth, 1);
            const diffDays = Math.round((npNextMonthStart.toJsDate().getTime() - jsStart.getTime()) / (1000 * 3600 * 24));
            daysInMonth = diffDays >= 28 && diffDays <= 32 ? diffDays : 30;
        } catch {
            daysInMonth = 30;
        }

        const monthName = npMonthStart.format('MMMM YYYY');

        // Build array of days
        const days = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const npDay = new NepaliDate(targetYear, targetMonth, i);
            const jsDate = npDay.toJsDate();
            const dateStr = jsDate.toISOString().split('T')[0];
            const isSaturday = jsDate.getDay() === 6;
            const holiday = holidays.find(h => h.date === dateStr);

            days.push({
                bsDay: i,
                dateStr,
                dayOfWeek: jsDate.toLocaleDateString('en-US', { weekday: 'narrow' }),
                isSaturday,
                holidayTitle: holiday?.title,
                isFuture: dateStr > todayStr
            });
        }

        // Staff rows
        const staffRows = expectedStaffMembers.map(staff => {
            let presentCount = 0;
            let lateCount = 0;
            let justifiedLateCount = 0;
            let leaveCount = 0;
            let absentCount = 0;
            let totalHours = 0;

            const dayCells = days.map(day => {
                const record = recordMap.get(`${staff.uid}_${day.dateStr}`);
                const leave = leavesList.find(l => l.userId === staff.uid && l.startDate <= day.dateStr && l.endDate >= day.dateStr);

                let cellStatus = 'EMPTY';
                let label = '-';
                let bg = 'transparent';
                let text = 'var(--text-muted)';

                if (day.holidayTitle) {
                    cellStatus = 'HOLIDAY';
                    label = 'H';
                    bg = 'rgba(139, 92, 246, 0.12)';
                    text = '#8b5cf6';
                } else if (day.isSaturday) {
                    cellStatus = 'WEEKEND';
                    label = 'OFF';
                    bg = 'rgba(100, 116, 139, 0.08)';
                    text = 'var(--text-muted)';
                } else if (leave) {
                    cellStatus = 'ON_LEAVE';
                    label = 'LV';
                    bg = 'rgba(61, 130, 201, 0.15)';
                    text = 'var(--color-info)';
                    leaveCount++;
                } else if (record && record.clockIn) {
                    totalHours += record.workHours || 0;
                    if (record.checkInType === 'CLIENT_SITE' || record.workLogs?.some(l => l.locationTag === 'Client Premises')) {
                        cellStatus = 'SITE';
                        label = 'S';
                        bg = 'rgba(99, 102, 241, 0.18)';
                        text = '#6366f1';
                        presentCount++;
                    } else if (record.status === 'LATE') {
                        if (record.lateJustified) {
                            cellStatus = 'LATE_JUSTIFIED';
                            label = 'LJ';
                            bg = 'rgba(201, 138, 42, 0.15)';
                            text = 'var(--color-warning)';
                            justifiedLateCount++;
                            presentCount++;
                        } else {
                            cellStatus = 'LATE';
                            label = 'L';
                            bg = 'rgba(201, 138, 42, 0.2)';
                            text = 'var(--color-warning)';
                            lateCount++;
                            presentCount++;
                        }
                    } else {
                        cellStatus = 'PRESENT';
                        label = 'P';
                        bg = 'rgba(101, 154, 43, 0.18)';
                        text = 'var(--accent)';
                        presentCount++;
                    }
                } else if (!day.isFuture) {
                    // A2 Fix: Skip days before joining
                    if (staff.dateOfJoining && day.dateStr < staff.dateOfJoining) {
                        cellStatus = 'PRE_JOINING';
                        label = '—';
                    } else {
                        cellStatus = 'ABSENT';
                        label = 'A';
                        bg = 'rgba(196, 68, 90, 0.15)';
                        text = 'var(--color-danger)';
                        absentCount++;
                    }
                }

                return {
                    day,
                    status: cellStatus,
                    label,
                    bg,
                    text,
                    record,
                    leave,
                    missedClockOut: record?.clockIn && !record?.clockOut && day.dateStr < todayStr
                };
            });

            return {
                staff,
                dayCells,
                stats: {
                    presentCount,
                    lateCount,
                    justifiedLateCount,
                    leaveCount,
                    absentCount,
                    totalHours: Number(totalHours.toFixed(1))
                }
            };
        });

        return {
            monthName,
            days,
            staffRows
        };
    }, [expectedStaffMembers, recordMap, leavesList, holidays, selectedBSMonthOffset, todayStr]);

    // ── REPORT DATA FOR DETAILED LIST VIEW (D3 & A2 Optimized) ─────────
    const reportData = useMemo(() => {
        if (!filterStartDate || !filterEndDate) return [];

        let targetUsers: UserProfile[] = [];
        if (isAdmin) {
            targetUsers = filterStaffId === 'ALL' ? usersList : usersList.filter(u => u.uid === filterStaffId);
        } else if (user) {
            targetUsers = usersList.filter(u => u.uid === user.uid);
            if (targetUsers.length === 0) {
                targetUsers = [{
                    uid: user.uid,
                    displayName: user.displayName || 'Staff Member',
                    role: user.role,
                    status: 'Active',
                    email: user.email || ''
                } as UserProfile];
            }
        }

        const report: any[] = [];
        const startDay = new Date(filterStartDate);
        const endDay = new Date(filterEndDate);

        for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const isFuture = dateStr > todayStr;
            const isSaturday = d.getDay() === 6;
            const holiday = holidays.find(h => h.date === dateStr);

            targetUsers.forEach(u => {
                // A2 Fix: Skip inactive staff or days prior to joining
                if (u.status !== 'Active') return;
                if (u.dateOfJoining && dateStr < u.dateOfJoining) return;
                if (u.mustClockIn === false && u.role === UserRole.MASTER_ADMIN) return;

                // 1. Check Attendance Record (O(1) Map Lookup)
                const record = recordMap.get(`${u.uid}_${dateStr}`);
                if (record) {
                    const isMissedClockOut = !!(record.clockIn && !record.clockOut && record.date < todayStr);
                    report.push({
                        ...record,
                        userName: record.userName || u.displayName,
                        missedClockOut: isMissedClockOut,
                        type: 'RECORD'
                    });
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
                        clientName: `Approved Leave (${leave.type})`,
                        notes: leave.reason || '-',
                        workHours: 0,
                        type: 'LEAVE'
                    });
                    return;
                }

                // 3. Check Holiday
                if (holiday) {
                    report.push({
                        id: `h_${u.uid}_${dateStr}`,
                        userId: u.uid,
                        userName: u.displayName,
                        date: dateStr,
                        status: 'HOLIDAY',
                        clientName: holiday.title || 'Public Holiday',
                        notes: 'Firm Public Holiday',
                        workHours: 0,
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
                        notes: 'Weekly Weekend',
                        workHours: 0,
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
                    notes: 'No check-in recorded',
                    workHours: 0,
                    type: 'ABSENT'
                });
            });
        }

        let filtered = report;
        if (filterStatus !== 'ALL') {
            filtered = report.filter(r => r.status === filterStatus || (filterStatus === 'PRESENT' && (r.status === 'LATE' || r.status === 'COMPLETED')));
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
    }, [recordMap, leavesList, holidays, usersList, filterStartDate, filterEndDate, filterStaffId, user, filterStatus, searchQuery, todayStr, isAdmin]);

    // Handle Late Justification (A1)
    const handleJustifyLateSubmit = async () => {
        if (!cellDetailData?.record?.id || !user) return;
        if (!justificationReason.trim()) {
            toast.error("Please enter a justification reason");
            return;
        }

        setIsJustifying(true);
        try {
            await AuthService.justifyLate(
                cellDetailData.record.id,
                user.uid,
                user.displayName || 'Admin',
                justificationReason.trim()
            );
            toast.success("Late mark has been justified successfully");
            setCellDetailModalOpen(false);
            setJustificationReason('');
            loadData();
        } catch (e) {
            console.error("Justification failed", e);
            toast.error("Failed to justify late mark");
        } finally {
            setIsJustifying(false);
        }
    };

    // Export PDF
    const handleExportPDF = () => {
        setShowExportMenu(false);
        const doc = new jsPDF({ orientation: 'landscape' });
        const pageW = doc.internal.pageSize.width;

        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageW, 44, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('R. SAPKOTA & ASSOCIATES', pageW / 2, 14, { align: 'center' });
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 200, 230);
        doc.text('Chartered Accountants  |  Kathmandu, Nepal', pageW / 2, 22, { align: 'center' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Attendance & Activity Register', pageW / 2, 32, { align: 'center' });

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
            r.clientName || '-',
            r.notes || '-'
        ]);

        autoTable(doc, {
            head: [['SN', 'Date (AD)', 'Date (BS)', 'Day', 'Staff', 'Status', 'In', 'Out', 'Hours', 'Client / Scope', 'Notes']],
            body: rows,
            startY: 50,
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' }
        });

        doc.save(`RSA_Attendance_${filterStartDate}_${filterEndDate}.pdf`);
    };

    // Export Excel
    const handleExportExcel = async () => {
        setShowExportMenu(false);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Attendance');

        sheet.addRow(['R. SAPKOTA & ASSOCIATES - Attendance Report']);
        sheet.addRow([`Period: ${filterStartDate} to ${filterEndDate}`]);
        sheet.addRow([]);

        sheet.addRow(['SN', 'Date (AD)', 'Date (BS)', 'Day', 'Staff Name', 'Status', 'Clock In', 'Clock Out', 'Hours', 'Client', 'Notes']);
        reportData.forEach((r, idx) => {
            sheet.addRow([
                idx + 1,
                formatDateAD(r.date),
                formatDateBS(r.date),
                getDayOfWeek(r.date),
                r.userName,
                r.status,
                r.clockIn || '-',
                r.clockOut || '-',
                r.workHours || 0,
                r.clientName || '-',
                r.notes || '-'
            ]);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RSA_Attendance_${filterStartDate}_${filterEndDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar relative pb-20" style={{ background: 'var(--bg-main)', color: 'var(--text-body)' }}>
            <div className="max-w-[1680px] mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-5 animate-in fade-in duration-500">
                
                {/* ── Top Header Bar (P3 Overhaul) ── */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div 
                            className="w-11 h-11 flex items-center justify-center shadow-lg"
                            style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-xl)' }}
                        >
                            <CalendarDays style={{ color: 'var(--accent)' }} size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2" style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                <span>Firm Operations</span>
                                <ChevronRight size={10} />
                                <span style={{ color: 'var(--accent)' }}>Attendance & Timesheets</span>
                            </div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.025em' }} className="mt-0.5">
                                Attendance Central
                            </h1>
                        </div>
                    </div>

                    {/* Actions & Export Menu */}
                    <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
                        {isAdmin && (
                            <button 
                                onClick={() => setIsReviewModalOpen(true)}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 transition-all font-bold text-xs uppercase tracking-wider shadow-sm border relative cursor-pointer"
                                style={{ 
                                    background: 'var(--accent-dim)', 
                                    color: 'var(--accent)', 
                                    borderColor: 'var(--border-accent)',
                                    borderRadius: 'var(--radius-xl)'
                                }}
                            >
                                <Clock size={14} /> 
                                <span>Requests Queue</span>
                                {pendingRequestsCount > 0 && (
                                    <span 
                                        className="w-5 h-5 flex items-center justify-center font-bold text-[10px] rounded-full text-white shadow-sm"
                                        style={{ background: 'var(--color-danger)' }}
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
                            className="flex items-center justify-center gap-2 px-5 py-2.5 transition-all font-bold text-xs uppercase tracking-wider shadow-lg text-white cursor-pointer"
                            style={{ 
                                background: 'var(--accent)', 
                                borderRadius: 'var(--radius-xl)'
                            }}
                        >
                            <Plus size={15} /> 
                            <span>{isAdmin ? 'Manual Log' : 'Request Correction'}</span>
                        </button>

                        {/* Export Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs font-bold transition-all cursor-pointer"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-mid)', color: 'var(--text-heading)' }}
                            >
                                <Download size={14} /> Export <ChevronDown size={12} />
                            </button>
                            {showExportMenu && (
                                <div 
                                    className="absolute right-0 mt-2 w-44 rounded-xl border shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2"
                                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                >
                                    <button
                                        onClick={handleExportPDF}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg hover:bg-[var(--bg-secondary)] transition-all text-left cursor-pointer"
                                    >
                                        <FileText size={14} className="text-rose-500" /> Download PDF
                                    </button>
                                    <button
                                        onClick={handleExportExcel}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg hover:bg-[var(--bg-secondary)] transition-all text-left cursor-pointer"
                                    >
                                        <Download size={14} className="text-emerald-500" /> Export to Excel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Navigation Tabs (P1, P2) ── */}
                <div 
                    className="p-1.5 flex gap-1.5 w-full max-w-xl mx-auto rounded-2xl border shadow-sm"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                    {(isAdmin ? [
                        { id: 'TODAY' as TabType, label: 'Today Live', icon: Clock },
                        { id: 'REGISTER' as TabType, label: 'Register (Grid)', icon: CalendarDays },
                        { id: 'LIST' as TabType, label: 'Full Log List', icon: CheckSquare }
                    ] : [
                        { id: 'MY' as TabType, label: 'My Attendance', icon: User },
                        { id: 'TODAY' as TabType, label: 'Who is In', icon: Clock },
                        { id: 'LIST' as TabType, label: 'History', icon: CalendarIcon }
                    ]).map(t => {
                        const Icon = t.icon;
                        const isCurrent = activeTab === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className="flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                                style={{
                                    background: isCurrent ? 'var(--accent)' : 'transparent',
                                    color: isCurrent ? 'white' : 'var(--text-muted)',
                                    boxShadow: isCurrent ? 'var(--shadow-card)' : 'none'
                                }}
                            >
                                <Icon size={14} />
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ── TAB 1: TODAY LIVE VIEW (P2 Overhaul) ── */}
                {activeTab === 'TODAY' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Denominator Stat Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard 
                                title="Present Today" 
                                value={todayData.presentCount}
                                denominator={`of ${todayData.expectedCount} expected`}
                                icon={UserCheck} 
                                color="text-emerald-500"
                                trend={`${todayData.expectedCount > 0 ? Math.round((todayData.presentCount / todayData.expectedCount) * 100) : 0}% attendance`}
                            />
                            <StatCard 
                                title="Client Site Visits" 
                                value={todayData.onSiteCount} 
                                denominator="on premise"
                                icon={Briefcase} 
                                color="text-indigo-500" 
                            />
                            <StatCard 
                                title="Late Check-Ins" 
                                value={todayData.lateCount} 
                                denominator="after 10:15 AM"
                                icon={AlertTriangle} 
                                color="text-amber-500" 
                            />
                            <StatCard 
                                title="Pending Arrival" 
                                value={todayData.notClockedInUsers.length} 
                                denominator="not yet logged"
                                icon={Clock} 
                                color="text-rose-500" 
                            />
                        </div>

                        {/* Needs Attention Panel */}
                        {isAdmin && needsAttentionItems.length > 0 && (
                            <div 
                                className="p-5 rounded-2xl border shadow-sm space-y-3"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-amber-500">
                                        <AlertCircle size={16} /> Needs Action & Attention ({needsAttentionItems.length})
                                    </h3>
                                    <span className="text-[10px] font-bold text-[var(--text-muted)]">
                                        Handbook rule triggers & unclosed shifts
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {needsAttentionItems.slice(0, 6).map(item => (
                                        <div 
                                            key={item.id}
                                            className="p-3.5 rounded-xl border bg-white dark:bg-white/[0.02] border-amber-500/20 flex flex-col justify-between gap-2"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="text-xs font-bold text-[var(--text-heading)]">{item.title}</span>
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">
                                                        {item.type === 'MISSED_CLOCKOUT' ? 'Shift Unclosed' : 'Late Rule'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-[var(--text-body)] opacity-80 leading-relaxed">
                                                    {item.description}
                                                </p>
                                            </div>
                                            {item.type === 'MISSED_CLOCKOUT' && item.user && item.date && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedUserForEdit(item.user!);
                                                        setSelectedDateForEdit(item.date!);
                                                        const realRecord = history.find(h => h.id === item.recordId);
                                                        setSelectedRecord(realRecord || null);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="text-[10px] font-bold text-[var(--accent)] hover:underline self-end cursor-pointer"
                                                >
                                                    Close Shift Now →
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Who is Where Directory */}
                        <div 
                            className="rounded-2xl border shadow-sm overflow-hidden"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                        >
                            <div className="p-4 px-6 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--text-heading)]">Today's Presence Directory</h3>
                                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Real-time status of RSA team members</p>
                                </div>
                                <div className="text-xs font-bold text-[var(--accent)] tabular-nums">
                                    {todayData.presentCount} of {todayData.expectedCount} Active On Duty
                                </div>
                            </div>

                            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                {expectedStaffMembers.map(staff => {
                                    const rec = recordMap.get(`${staff.uid}_${todayStr}`);
                                    const leave = leavesList.find(l => l.userId === staff.uid && l.startDate <= todayStr && l.endDate >= todayStr);

                                    return (
                                        <div key={staff.uid} className="p-4 px-6 flex items-center justify-between gap-4 hover:bg-[var(--bg-surface)] transition-all">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div 
                                                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border shrink-0"
                                                    style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}
                                                >
                                                    {staff.displayName?.substring(0, 2).toUpperCase() || 'ST'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-[var(--text-heading)] truncate">{staff.displayName}</div>
                                                    <div className="text-[10px] font-medium text-[var(--text-muted)]">{staff.designation || staff.position || staff.role}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {rec ? (
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-bold tabular-nums text-[var(--text-body)]">
                                                            {rec.clockIn} {rec.clockOut ? `→ ${rec.clockOut}` : ''}
                                                        </span>
                                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                                                            rec.checkInType === 'CLIENT_SITE' ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' :
                                                            rec.status === 'LATE' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                                            'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                        }`}>
                                                            {rec.checkInType === 'CLIENT_SITE' ? 'Client Site' : rec.status === 'LATE' ? 'Late Arrival' : 'In Office'}
                                                        </span>
                                                    </div>
                                                ) : leave ? (
                                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20">
                                                        On Leave ({leave.type})
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-[var(--text-muted)] italic">
                                                        Not Clocked In
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: REGISTER GRID VIEW (P1, A8 Overhaul) ── */}
                {activeTab === 'REGISTER' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* Month Selector Bar */}
                        <div 
                            className="p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Register Month:</span>
                                <h3 className="text-base font-black text-[var(--text-heading)]">
                                    {registerData.monthName} BS
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedBSMonthOffset(prev => prev - 1)}
                                    className="px-3 py-1.5 rounded-lg border text-xs font-bold text-[var(--text-heading)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    ← Previous Month
                                </button>
                                {selectedBSMonthOffset !== 0 && (
                                    <button
                                        onClick={() => setSelectedBSMonthOffset(0)}
                                        className="px-3 py-1.5 rounded-lg border text-xs font-bold text-[var(--accent)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        Current Month
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedBSMonthOffset(prev => prev + 1)}
                                    className="px-3 py-1.5 rounded-lg border text-xs font-bold text-[var(--text-heading)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    Next Month →
                                </button>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 flex-wrap text-[11px] font-bold text-[var(--text-muted)] px-2">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40 text-[9px] text-emerald-600 font-bold flex items-center justify-center">P</span> Present</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-500/40 text-[9px] text-indigo-600 font-bold flex items-center justify-center">S</span> Client Site</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40 text-[9px] text-amber-600 font-bold flex items-center justify-center">L</span> Late</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] text-amber-600 font-bold flex items-center justify-center">LJ</span> Justified Late</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500/20 border border-sky-500/40 text-[9px] text-sky-600 font-bold flex items-center justify-center">LV</span> Leave</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/40 text-[9px] text-rose-600 font-bold flex items-center justify-center">A</span> Absent</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-500/10 border border-slate-500/20 text-[9px] text-slate-500 font-bold flex items-center justify-center">OFF</span> Saturday</span>
                        </div>

                        {/* Register Grid Table */}
                        <div 
                            className="rounded-2xl border shadow-xl overflow-x-auto custom-scrollbar"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                        >
                            <table className="w-full text-center border-collapse">
                                <thead>
                                    <tr className="border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[var(--text-muted)] sticky left-0 z-20 min-w-[180px]" style={{ background: 'var(--bg-surface)' }}>
                                            Staff Member
                                        </th>
                                        {registerData.days.map(d => (
                                            <th 
                                                key={d.bsDay}
                                                className={`px-1.5 py-2 text-[10px] font-black border-l border-[var(--border)] min-w-[32px] ${d.isSaturday ? 'bg-slate-500/10 text-slate-400' : 'text-[var(--text-heading)]'}`}
                                                title={`${d.dateStr} (${d.bsDay} BS)`}
                                            >
                                                <div>{d.bsDay}</div>
                                                <div className="text-[8px] font-normal opacity-70">{d.dayOfWeek}</div>
                                            </th>
                                        ))}
                                        <th className="px-3 py-3 text-xs font-black uppercase text-[var(--accent)] border-l border-[var(--border)]">Pres</th>
                                        <th className="px-3 py-3 text-xs font-black uppercase text-[var(--color-warning)] border-l border-[var(--border)]">Late</th>
                                        <th className="px-3 py-3 text-xs font-black uppercase text-[var(--color-info)] border-l border-[var(--border)]">Leave</th>
                                        <th className="px-3 py-3 text-xs font-black uppercase text-[var(--text-heading)] border-l border-[var(--border)]">Hours</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                    {registerData.staffRows.map(row => (
                                        <tr key={row.staff.uid} className="hover:bg-[var(--bg-surface)] transition-all">
                                            <td className="px-4 py-2.5 text-left text-xs font-bold text-[var(--text-heading)] sticky left-0 z-10 truncate max-w-[200px]" style={{ background: 'var(--bg-secondary)' }}>
                                                {row.staff.displayName}
                                            </td>
                                            {row.dayCells.map(cell => (
                                                <td 
                                                    key={cell.day.bsDay}
                                                    onClick={() => {
                                                        setCellDetailData({
                                                            user: row.staff,
                                                            date: cell.day.dateStr,
                                                            record: cell.record,
                                                            leave: cell.leave,
                                                            holiday: holidays.find(h => h.date === cell.day.dateStr),
                                                            status: cell.status
                                                        });
                                                        setCellDetailModalOpen(true);
                                                    }}
                                                    className={`p-1 border-l border-[var(--border)] cursor-pointer hover:ring-2 hover:ring-[var(--accent)] transition-all ${cell.day.isSaturday ? 'bg-slate-500/5' : ''}`}
                                                >
                                                    <span 
                                                        className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black"
                                                        style={{ background: cell.bg, color: cell.text }}
                                                        title={`${row.staff.displayName} - ${cell.day.bsDay} BS: ${cell.status}`}
                                                    >
                                                        {cell.label}
                                                    </span>
                                                </td>
                                            ))}
                                            <td className="px-2 py-2 text-xs font-bold text-[var(--accent)] border-l border-[var(--border)] tabular-nums">{row.stats.presentCount}</td>
                                            <td className="px-2 py-2 text-xs font-bold text-[var(--color-warning)] border-l border-[var(--border)] tabular-nums">{row.stats.lateCount}</td>
                                            <td className="px-2 py-2 text-xs font-bold text-[var(--color-info)] border-l border-[var(--border)] tabular-nums">{row.stats.leaveCount}</td>
                                            <td className="px-2 py-2 text-xs font-bold text-[var(--text-heading)] border-l border-[var(--border)] tabular-nums">{row.stats.totalHours}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── TAB 3: DETAILED LIST VIEW (With Filters & Exports) ── */}
                {activeTab === 'LIST' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* Filter Bar */}
                        <div 
                            className="p-4 rounded-2xl border shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center gap-3"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                        >
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                                <input 
                                    type="text"
                                    placeholder="Search staff member, client, or notes..."
                                    className="w-full border outline-none py-2.5 pl-10 pr-4 text-xs rounded-xl"
                                    style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-heading)' }}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

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
                                className="px-3 py-2 text-xs outline-none rounded-xl border shrink-0 h-[42px]"
                                style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)' }}
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="PRESENT">Present Only</option>
                                <option value="LATE">Late Arrivals</option>
                                <option value="ABSENT">Absent Only</option>
                                <option value="ON LEAVE">On Leave</option>
                            </select>

                            <div 
                                className="flex items-center gap-2 border px-3 py-1.5 rounded-xl h-[42px]"
                                style={{ background: 'var(--bg-main)', borderColor: 'var(--border)' }}
                            >
                                <input 
                                    type="date" 
                                    value={filterStartDate} 
                                    onChange={(e) => setFilterStartDate(e.target.value)} 
                                    className="bg-transparent border-0 text-xs outline-none text-[var(--text-heading)] cursor-pointer" 
                                />
                                <span className="text-[var(--text-muted)]">to</span>
                                <input 
                                    type="date" 
                                    value={filterEndDate} 
                                    onChange={(e) => setFilterEndDate(e.target.value)} 
                                    className="bg-transparent border-0 text-xs outline-none text-[var(--text-heading)] cursor-pointer" 
                                />
                            </div>

                            <button 
                                onClick={loadData} 
                                className="px-5 h-[42px] rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md cursor-pointer shrink-0"
                                style={{ background: 'var(--accent)' }}
                            >
                                Apply
                            </button>
                        </div>

                        {/* List Table */}
                        <div 
                            className="rounded-2xl border shadow-xl overflow-hidden"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[1000px]">
                                    <thead>
                                        <tr className="border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] w-12 text-center">SN</th>
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Date & Staff</th>
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Day</th>
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Timing</th>
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Client / Assignment</th>
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Work Description</th>
                                            {isAdmin && <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] text-right w-20">Edit</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={isAdmin ? 8 : 7} className="py-20 text-center">
                                                    <div className="w-8 h-8 border-4 border-t-[var(--accent)] rounded-full animate-spin mx-auto" />
                                                </td>
                                            </tr>
                                        ) : reportData.length === 0 ? (
                                            <tr>
                                                <td colSpan={isAdmin ? 8 : 7} className="py-20 text-center text-xs font-bold text-gray-400">
                                                    No attendance records found.
                                                </td>
                                            </tr>
                                        ) : (
                                            reportData.map((record, idx) => (
                                                <tr key={record.id} className="hover:bg-[var(--bg-surface)] transition-all">
                                                    <td className="px-4 py-3 text-center text-xs font-bold text-[var(--text-muted)] tabular-nums">{idx + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-xs font-bold text-[var(--text-heading)]">{record.userName}</div>
                                                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                                            {formatDateAD(record.date)} · <span className="text-[var(--accent)]">{formatDateBS(record.date)} BS</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{getDayOfWeek(record.date)}</td>
                                                    <td className="px-4 py-3">
                                                        {record.clockIn ? (
                                                            <div>
                                                                <div className="text-xs font-bold text-[var(--text-body)] tabular-nums">
                                                                    {record.clockIn} {record.clockOut ? `→ ${record.clockOut}` : ''}
                                                                </div>
                                                                {record.workHours > 0 && (
                                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)]">
                                                                        {record.workHours}h
                                                                    </span>
                                                                )}
                                                                {record.missedClockOut && (
                                                                    <div className="text-[9px] font-black uppercase text-rose-500 mt-1">
                                                                        ⚠ Unclosed Shift
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Untracked</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                                                            record.status === 'PRESENT' || record.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                            record.status === 'LATE' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                                            record.status === 'ON LEAVE' ? 'bg-sky-500/10 text-sky-600 border-sky-500/20' :
                                                            record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                                                            'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                                        }`}>
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-medium text-[var(--text-heading)]">
                                                        {record.clientName || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-[var(--text-body)] max-w-xs truncate">
                                                        {record.workLogs?.length > 0 
                                                            ? record.workLogs.map((l: any) => l.description).join('; ')
                                                            : record.notes || '-'
                                                        }
                                                    </td>
                                                    {isAdmin && (
                                                        <td className="px-4 py-3 text-right">
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
                                                                className="p-1.5 rounded-lg border hover:bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-pointer"
                                                                style={{ borderColor: 'var(--border)' }}
                                                            >
                                                                <Edit2 size={13} />
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
                    </div>
                )}

                {/* ── TAB 4: MY ATTENDANCE VIEW (For regular staff) ── */}
                {activeTab === 'MY' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div 
                            className="p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                        >
                            <div>
                                <h3 className="text-base font-bold text-[var(--text-heading)]">My Month Overview</h3>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    Track your attendance status and ensure timesheets match assignments.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    const currentUserProfile = usersList.find(u => u.uid === user?.uid);
                                    setSelectedUserForEdit(currentUserProfile || null);
                                    setSelectedDateForEdit(getCurrentDateUTC());
                                    setSelectedRecord(null);
                                    setIsEditModalOpen(true);
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer"
                                style={{ background: 'var(--accent)' }}
                            >
                                + Request Manual Correction
                            </button>
                        </div>

                        {/* Recent History for Current User */}
                        <div 
                            className="rounded-2xl border shadow-sm overflow-hidden"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                        >
                            <div className="p-4 px-6 border-b" style={{ borderColor: 'var(--border)' }}>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Recent Workdays</h4>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                {history.slice(0, 15).map(rec => (
                                    <div key={rec.id} className="p-4 px-6 flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-xs font-bold text-[var(--text-heading)]">
                                                {formatDateAD(rec.date)} · <span className="text-[var(--accent)]">{formatDateBS(rec.date)} BS</span>
                                            </div>
                                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                                Timing: {rec.clockIn} → {rec.clockOut || 'Shift Active'} ({rec.workHours || 0} hrs)
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                                            rec.status === 'PRESENT' || rec.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                            rec.status === 'LATE' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                            'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                        }`}>
                                            {rec.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Cell Detail & Late Justification Modal ── */}
            {cellDetailModalOpen && cellDetailData && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                    >
                        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-heading)]">
                                    Day Details: {cellDetailData.user.displayName}
                                </h3>
                                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                    {formatDateAD(cellDetailData.date)} · {formatDateBS(cellDetailData.date)} BS
                                </p>
                            </div>
                            <button
                                onClick={() => setCellDetailModalOpen(false)}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                                <span className="text-xs font-bold text-[var(--text-muted)]">Attendance Status</span>
                                <span className="text-xs font-black uppercase text-[var(--accent)]">{cellDetailData.status}</span>
                            </div>

                            {cellDetailData.record && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                                            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Arrival Time</p>
                                            <p className="font-bold text-[var(--text-heading)] mt-1">{cellDetailData.record.clockIn || '-'}</p>
                                        </div>
                                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                                            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Departure Time</p>
                                            <p className="font-bold text-[var(--text-heading)] mt-1">{cellDetailData.record.clockOut || 'Shift Active'}</p>
                                        </div>
                                    </div>

                                    {cellDetailData.record.notes && (
                                        <div className="p-3 rounded-xl border text-xs" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                                            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Notes / Late Reason</p>
                                            <p className="mt-1 text-[var(--text-body)]">{cellDetailData.record.notes}</p>
                                        </div>
                                    )}

                                    {/* Late Justification (A1) */}
                                    {cellDetailData.record.status === 'LATE' && isAdmin && (
                                        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-amber-500">
                                                    {cellDetailData.record.lateJustified ? '✓ Late Mark Justified' : 'Justify Late Mark (HR Action)'}
                                                </span>
                                            </div>
                                            {!cellDetailData.record.lateJustified ? (
                                                <div className="space-y-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Reason for justifying (e.g., Client emergency, approved site work)..."
                                                        value={justificationReason}
                                                        onChange={(e) => setJustificationReason(e.target.value)}
                                                        className="w-full p-2 text-xs rounded-lg border outline-none bg-white dark:bg-black/20"
                                                        style={{ borderColor: 'var(--border)' }}
                                                    />
                                                    <button
                                                        onClick={handleJustifyLateSubmit}
                                                        disabled={isJustifying}
                                                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs uppercase tracking-wider cursor-pointer"
                                                    >
                                                        {isJustifying ? 'Saving...' : 'Confirm Justification'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-[var(--text-muted)]">
                                                    Reason: {cellDetailData.record.lateJustifiedReason || 'Approved by HR'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                            <button
                                onClick={() => setCellDetailModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold border text-[var(--text-heading)] cursor-pointer"
                                style={{ borderColor: 'var(--border)' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Attendance Modal */}
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

            {/* Review Requests Modal (S4) */}
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
