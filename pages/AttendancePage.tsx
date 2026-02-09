
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, MapPin, AlertTriangle, FileText, Download, UserCog, Check, X, Filter, FileDown, CalendarRange, Users, Briefcase, AlertOctagon, CalendarOff, Palmtree, Plus, Save, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, UserRole, UserProfile, Client, LeaveRequest } from '../types';
import { AuthService } from '../services/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { useLocation } from 'react-router-dom';
import ClientSelect from '../components/ClientSelect';
import StaffSelect from '../components/StaffSelect';
import { getCurrentBSDate, formatBSDate, convertADToBS } from '../utils/nepaliDate';
import NepaliDate from 'nepali-date-converter';

const AttendancePage: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation(); // Hook to access navigation state
    const [currentTime, setCurrentTime] = useState(new Date());
    const [status, setStatus] = useState<'CLOCKED_OUT' | 'CLOCKED_IN'>('CLOCKED_OUT');
    const [sessionTime, setSessionTime] = useState(0);
    const [loading, setLoading] = useState(false);

    // Late Logic
    const [lateCount, setLateCount] = useState(0);
    const [lateReason, setLateReason] = useState('');
    const [isLateEntry, setIsLateEntry] = useState(false);

    // Daily Reporting State
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const clientDropdownRef = useRef<HTMLDivElement>(null);
    const [workDescription, setWorkDescription] = useState('');

    // Data State
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [clientsList, setClientsList] = useState<Client[]>([]);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [leavesList, setLeavesList] = useState<LeaveRequest[]>([]);

    // Filtering State
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterStaffId, setFilterStaffId] = useState<string>('ALL');
    const [filterStartDate, setFilterStartDate] = useState<string>('');
    const [filterEndDate, setFilterEndDate] = useState<string>('');

    // Manual Entry Modal State (Admin Only)
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [manualForm, setManualForm] = useState({
        userId: '',
        date: new Date().toLocaleDateString('en-CA'),
        clockIn: '10:00',
        clockOut: '17:00',
        clientId: '',
        description: '',
        reason: ''
    });

    useEffect(() => {
        // Set default filter to current month on mount
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

        if (!filterStartDate) setFilterStartDate(firstDay);
        if (!filterEndDate) setFilterEndDate(lastDay);

        // Check for navigation state from Dashboard (Deep linking)
        if (location.state && location.state.filterUserId) {
            setFilterStaffId(location.state.filterUserId);
        }

        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);
            // Check Late Condition: After 10:15 AM
            const officeLimit = new Date();
            officeLimit.setHours(10, 15, 0); // 10:15 AM
            if (now > officeLimit && status === 'CLOCKED_OUT') {
                setIsLateEntry(true);
            } else {
                setIsLateEntry(false);
            }
        }, 1000);

        // Initial Data Load
        if (user) {
            loadData();
        }

        return () => clearInterval(timer);
    }, [user]);

    // Separate effect for session timer
    useEffect(() => {
        let sessionTimer: any;
        if (status === 'CLOCKED_IN') {
            sessionTimer = setInterval(() => setSessionTime(prev => prev + 1), 1000);
        }
        return () => clearInterval(sessionTimer);
    }, [status]);

    // Close client dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
                setIsClientDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [clientDropdownRef]);

    const loadData = async () => {
        if (!user) return; // Guard against unauthenticated calls
        setLoading(true);
        try {
            // Parallel Fetch
            // Filter History: ADMIN gets all, STAFF gets only theirs.
            const fetchId = user.role === UserRole.ADMIN ? undefined : user.uid;

            const [uList, cList, attHistory, lCount, lList] = await Promise.all([
                AuthService.getAllUsers(),
                AuthService.getAllClients(),
                AuthService.getAttendanceHistory(fetchId),
                user ? AuthService.getLateCountLast30Days(user.uid) : Promise.resolve(0),
                AuthService.getAllLeaves(fetchId)
            ]);

            setUsersList(uList);
            setClientsList(cList);
            setHistory(attHistory);
            setLateCount(lCount);
            setLeavesList(lList);

            // Check if already clocked in today (Local Time check)
            const today = new Date().toLocaleDateString('en-CA');
            const todayRecord = attHistory.find(r => r.userId === user?.uid && r.date === today && !r.clockOut);

            if (todayRecord) {
                setStatus('CLOCKED_IN');
                // Calculate session time
                const startTime = new Date(`${today}T${todayRecord.clockIn}`);
                const diff = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
                setSessionTime(diff > 0 ? diff : 0);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleClockAction = async () => {
        // 0. Single Clock-In Check
        if (status === 'CLOCKED_OUT') {
            const todayStr = new Date().toLocaleDateString('en-CA');
            // Search local history state (which should be up to date) for a record today
            const hasRecordToday = history.some(r => r.userId === user?.uid && r.date === todayStr);
            if (hasRecordToday) {
                alert("⛔ Access Denied: You have already clocked in and out for today. Multiple daily entries are not permitted.");
                return;
            }
        }

        // 1. Late Validation
        if (status === 'CLOCKED_OUT' && isLateEntry && !lateReason.trim()) {
            alert("You are arriving after 10:15 AM. You must provide a reason for being late.");
            return;
        }

        // 2. Clock Out Validation
        if (status === 'CLOCKED_IN') {
            if (selectedClientIds.length === 0) {
                alert("⚠️ Please select at least one Client or Site you worked on before clocking out.");
                return;
            }
            if (!workDescription.trim()) {
                alert("⚠️ Please provide a description of the work completed today before clocking out.");
                return;
            }
        }

        setLoading(true);
        proceedClockAction(undefined);
    };

    const proceedClockAction = async (coords: any) => {
        try {
            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA');
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

            if (status === 'CLOCKED_OUT') {
                // Clocking IN
                const newRecord: AttendanceRecord = {
                    id: 'temp_id',
                    userId: user?.uid || '',
                    userName: user?.displayName || 'User',
                    date: todayStr,
                    clockIn: timeStr,
                    status: isLateEntry ? 'LATE' : 'PRESENT',
                    notes: isLateEntry ? `Late Reason: ${lateReason}` : '',
                    workHours: 0,
                    ...(coords ? { location: { lat: coords.latitude, lng: coords.longitude } } : {})
                };

                await AuthService.recordAttendance(newRecord);
                setStatus('CLOCKED_IN');
                setSessionTime(0);

                // Refresh history
                loadData();
            } else {
                // Clocking OUT
                const selectedClients = clientsList.filter(c => selectedClientIds.includes(c.id));
                const clientNames = selectedClients.map(c => c.name).join(', ');

                const record: AttendanceRecord = {
                    id: '', // Auto
                    userId: user?.uid || '',
                    userName: user?.displayName || 'User',
                    date: todayStr,
                    clockIn: new Date(now.getTime() - sessionTime * 1000).toLocaleTimeString('en-US', { hour12: false }),
                    clockOut: timeStr,
                    workHours: Number((sessionTime / 3600).toFixed(2)),
                    status: isLateEntry ? 'LATE' : 'PRESENT',
                    clientIds: selectedClientIds,
                    clientName: clientNames || 'Internal',
                    workDescription: workDescription,
                    notes: lateReason ? `Late Reason: ${lateReason}` : ''
                };

                await AuthService.recordAttendance(record);
                setStatus('CLOCKED_OUT');
                setWorkDescription('');
                setSelectedClientIds([]);
                setLateReason('');
                loadData();
            }
        } catch (error: any) {
            console.error(error);
            alert(error.message || "Error processing attendance.");
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualForm.userId || !manualForm.clockIn || !manualForm.clockOut) {
            alert("Please fill in all required fields.");
            return;
        }

        setLoading(true);
        try {
            const selectedUser = usersList.find(u => u.uid === manualForm.userId);
            const clientObj = clientsList.find(c => c.id === manualForm.clientId);

            // Calculate Duration roughly
            const start = new Date(`${manualForm.date}  ${manualForm.clockIn}`);
            const end = new Date(`${manualForm.date}  ${manualForm.clockOut}`);
            const hours = (end.getTime() - start.getTime()) / (1000 * 3600);

            const record: AttendanceRecord = {
                id: '', // Generated by service
                userId: manualForm.userId,
                userName: selectedUser?.displayName || 'Unknown',
                date: manualForm.date,
                clockIn: manualForm.clockIn + ':00',
                clockOut: manualForm.clockOut + ':00',
                workHours: Math.max(0, parseFloat(hours.toFixed(2))),
                status: 'CORRECTED', // Use CORRECTED for manual entries
                clientId: manualForm.clientId || 'INTERNAL',
                clientName: clientObj ? clientObj.name : 'Admin Correction',
                workDescription: manualForm.description || 'Manual Entry by Admin',
                notes: manualForm.reason ? `Admin Correction: ${manualForm.reason}` : 'Manual Entry'
            };

            await AuthService.recordAttendance(record);
            await loadData(); // Refresh history
            setIsManualModalOpen(false);
            setManualForm({
                userId: '',
                date: new Date().toLocaleDateString('en-CA'),
                clockIn: '10:00',
                clockOut: '17:00',
                clientId: '',
                description: '',
                reason: ''
            });
        } catch (error: any) {
            alert("Error adding record: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- GENERATE FULL REPORT LOGIC ---
    const reportData = useMemo(() => {
        // If dates are not set yet, return empty or just history
        if (!filterStartDate || !filterEndDate) return history;

        // 1. Identify Target Users
        let targetUsers: UserProfile[] = [];
        if (user?.role === UserRole.ADMIN) {
            if (filterStaffId === 'ALL') targetUsers = usersList;
            else targetUsers = usersList.filter(u => u.uid === filterStaffId);
        } else if (user) {
            targetUsers = [user]; // Staff sees only themselves
        }

        // 2. Generate Date Range Array
        const dates: string[] = [];
        const start = new Date(filterStartDate);
        const end = new Date(filterEndDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // normalize today

        // Limit range to prevent browser crash if dates are wild (e.g. 10 years)
        // Max 60 days for this view is reasonable
        const MAX_DAYS = 62;
        let dayCount = 0;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
            dayCount++;
            if (dayCount > MAX_DAYS) break;
        }

        const fullRecords: any[] = [];

        // 3. Merge Data
        targetUsers.forEach(u => {
            dates.forEach(dateStr => {
                const dateObj = new Date(dateStr);
                const isFuture = dateObj > today;

                // A. Check for Attendance Record
                const attRecord = history.find(r => r.userId === u.uid && r.date === dateStr);

                if (attRecord) {
                    fullRecords.push(attRecord);
                } else {
                    // No Attendance Record found
                    if (!isFuture) {
                        // B. Check for APPROVED Leave
                        const leave = leavesList.find(l =>
                            l.userId === u.uid &&
                            l.status === 'APPROVED' &&
                            l.startDate <= dateStr &&
                            l.endDate >= dateStr
                        );

                        if (leave) {
                            fullRecords.push({
                                id: `leave_${u.uid}_${dateStr}`,
                                userId: u.uid,
                                userName: u.displayName,
                                date: dateStr,
                                clockIn: '-',
                                clockOut: '-',
                                status: 'ON LEAVE', // Special status
                                notes: `Reason: ${leave.reason}`, // Explicit reason in notes
                                clientName: `ON LEAVE (${leave.type})`,
                                workHours: 0
                            });
                        } else {
                            // C. Absent
                            // (Includes cases where leave is PENDING or REJECTED)
                            fullRecords.push({
                                id: `absent_${u.uid}_${dateStr}`,
                                userId: u.uid,
                                userName: u.displayName,
                                date: dateStr,
                                clockIn: '-',
                                clockOut: '-',
                                status: 'ABSENT',
                                notes: '-',
                                clientName: '-',
                                workHours: 0
                            });
                        }
                    }
                }
            });
        });

        // 4. Apply Status Filter if needed
        if (filterStatus !== 'ALL') {
            return fullRecords.filter(r => r.status === filterStatus);
        }

        // Sort by Date Descending, then Name
        return fullRecords.sort((a, b) => {
            const dateComp = b.date.localeCompare(a.date);
            if (dateComp !== 0) return dateComp;
            return a.userName.localeCompare(b.userName);
        });

    }, [history, leavesList, usersList, filterStartDate, filterEndDate, filterStaffId, user, filterStatus]);

    const exportPDF = () => {
        const doc = new jsPDF();

        // -- Enhanced Letterhead with navy gradient --
        doc.setFillColor(15, 23, 42); // Navy-950 (slate-900)
        doc.rect(0, 0, 210, 40, 'F');

        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("R. Sapkota & Associates", 105, 15, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.setFont("helvetica", "normal");
        doc.text("Chartered Accountants | Mid-Baneshwor, Kathmandu", 105, 23, { align: "center" });

        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Attendance & Activity Report", 105, 34, { align: "center" });

        // Report info
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.setFont("helvetica", "normal");
        doc.text(`Period: ${filterStartDate} to ${filterEndDate}`, 14, 50);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 56);

        // -- Table with violet styling --
        const tableColumn = ["Date", "Name", "Client / Activity", "In", "Out", "Hr", "Status"];
        const tableRows = reportData.map(r => [
            r.date,
            r.userName,
            r.clientName || '-',
            r.clockIn,
            r.clockOut || '-',
            r.workHours.toString(),
            r.status
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 62,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 41, 59],    // Slate-800
                textColor: [255, 255, 255], // White
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                overflow: 'linebreak',
                fillColor: [248, 250, 252], // Slate-50
                textColor: [30, 41, 59]     // Slate-800
            },
            alternateRowStyles: {
                fillColor: [241, 245, 249]  // Slate-100
            },
            columnStyles: {
                0: { cellWidth: 20 },
                2: { cellWidth: 35 },
                5: { halign: 'center' },
                6: { fontStyle: 'bold', halign: 'center' }
            }
        });

        // Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85); // Slate-700
            doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
            doc.text("Confidential System Report - RSA Portal", 14, 285);
        }

        doc.save("RSA_Attendance_Report.pdf");
    };

    const exportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Report');

        // Set column widths
        worksheet.columns = [
            { width: 12 },  // Date
            { width: 22 },  // Staff Name
            { width: 28 },  // Client/Activity
            { width: 10 },  // Clock In
            { width: 10 },  // Clock Out
            { width: 12 },  // Duration
            { width: 12 },  // Status
            { width: 35 },  // Notes
        ];

        // Navy/Slate color scheme
        const navyBg = '1E293B';      // Slate-800
        const lightNavy = 'F1F5F9';   // Slate-100
        const darkNavy = '0F172A';    // Slate-900

        // Company Name (Row 1)
        worksheet.mergeCells('A1:H1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'R. Sapkota & Associates';
        companyCell.font = { bold: true, size: 18, color: { argb: 'FFFFFF' } };
        companyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyBg } };
        companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 30;

        // Address (Row 2)
        worksheet.mergeCells('A2:H2');
        const addressCell = worksheet.getCell('A2');
        addressCell.value = 'Chartered Accountants | Mid-Baneshwor, Kathmandu';
        addressCell.font = { size: 10, color: { argb: 'CBD5E1' } }; // Slate-300
        addressCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyBg } };
        addressCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Empty row 3
        worksheet.mergeCells('A3:H3');

        // Report Title (Row 4)
        worksheet.mergeCells('A4:H4');
        const titleCell = worksheet.getCell('A4');
        titleCell.value = 'Attendance & Activity Report';
        titleCell.font = { bold: true, size: 14, color: { argb: darkNavy } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(4).height = 25;

        // Period (Row 5)
        worksheet.mergeCells('A5:H5');
        const periodCell = worksheet.getCell('A5');
        periodCell.value = `Period: ${filterStartDate} to ${filterEndDate}`;
        periodCell.font = { size: 10, color: { argb: '64748B' } };
        periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Generated (Row 6)
        worksheet.mergeCells('A6:H6');
        const generatedCell = worksheet.getCell('A6');
        generatedCell.value = `Generated: ${new Date().toLocaleDateString()}`;
        generatedCell.font = { size: 10, color: { argb: '64748B' } };
        generatedCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Empty row 7
        worksheet.addRow([]);

        // Table Header (Row 8)
        const headers = ['Date', 'Staff Name', 'Client/Activity', 'Clock In', 'Clock Out', 'Duration', 'Status', 'Notes'];
        const headerRow = worksheet.addRow(headers);
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyBg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: navyBg } },
                bottom: { style: 'thin', color: { argb: navyBg } },
            };
        });

        // Data rows
        reportData.forEach((r, index) => {
            const row = worksheet.addRow([
                r.date,
                r.userName,
                r.clientName || '-',
                r.clockIn,
                r.clockOut || '-',
                r.workHours,
                r.status,
                r.workDescription || r.notes || '-'
            ]);

            const bgColor = index % 2 === 0 ? 'F8FAFC' : lightNavy; // Slate-50 and Slate-100
            row.eachCell((cell) => {
                cell.font = { size: 9, color: { argb: darkNavy } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.alignment = { vertical: 'middle' };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, // Slate-200
                };
            });
        });

        // Generate and download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RSA_Attendance_Report_${filterStartDate}_to_${filterEndDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Late Warning Banner */}
            {lateCount > 5 && (
                <div className="bg-red-500/10 border border-red-500/40 p-4 rounded-xl flex items-start space-x-3 animate-pulse">
                    <AlertOctagon className="text-red-500 shrink-0 mt-1" size={24} />
                    <div>
                        <h3 className="font-bold text-red-400">Attendance Warning</h3>
                        <p className="text-sm text-red-200">
                            Notice: You have arrived late more than <span className="font-bold text-white">5 times</span> in the last 30 days.
                            Please ensure you arrive by 10:15 AM to avoid disciplinary action.
                        </p>
                    </div>
                </div>
            )}

            {/* Clock In/Out Section */}
            <div className="glass-panel p-8 rounded-xl flex flex-col lg:flex-row items-start justify-between shadow-xl gap-8">
                <div className="flex-1 w-full">
                    <h2 className="text-2xl font-bold text-white mb-2">Today's Attendance</h2>
                    <div className="flex items-center space-x-2 mb-4">
                        <p className="text-gray-300 font-medium">Office Time: 10:00 AM - 5:00 PM</p>
                        {isLateEntry && status === 'CLOCKED_OUT' && (
                            <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded border border-orange-500/30">LATE ENTRY</span>
                        )}
                    </div>
                    <div className="text-5xl font-mono font-bold text-blue-400 tracking-wider drop-shadow-lg mb-2">
                        {currentTime.toLocaleTimeString()}
                    </div>
                    <div className="text-lg font-medium text-violet-400 mb-4">
                        📅 {new NepaliDate().format('DD MMMM YYYY')} <span className="text-gray-500 text-sm">(BS)</span>
                    </div>

                    {status === 'CLOCKED_IN' ? (
                        <div className="mt-2 text-green-400 font-medium flex items-center bg-green-500/10 p-4 rounded-xl border border-green-500/20 max-w-md">
                            <span className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></span>
                            <div>
                                <p className="text-sm text-green-200">Session Active</p>
                                <p className="text-xl font-bold">Duration: {formatDuration(sessionTime)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Late Reason Input */}
                            {isLateEntry && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className="block text-sm font-bold text-orange-400 mb-2 flex items-center">
                                        <AlertTriangle size={16} className="mr-2" />
                                        Late Reason Required (&gt; 10:15 AM)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full glass-input rounded-xl px-4 py-3 text-sm border-orange-500/50 focus:border-orange-500"
                                        placeholder="Why are you late today?"
                                        value={lateReason}
                                        onChange={(e) => setLateReason(e.target.value)}
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleClockAction}
                                disabled={loading}
                                className={`
                            w-full lg:w-auto flex items-center justify-center space-x-2 py-4 px-8 rounded-xl text-lg font-bold shadow-lg transition-all active:scale-95
                            ${loading ? 'opacity-70 cursor-not-allowed' : ''}
                            bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30
                        `}
                            >
                                <Clock size={20} />
                                <span>{loading ? 'Processing...' : 'Clock In'}</span>
                            </button>
                            <p className="text-xs text-gray-500 italic mt-2">* Note: You can only clock in once per day.</p>
                        </div>
                    )}
                </div>

                {/* Daily Reporting Form */}
                <div className={`w-full lg:w-[450px] bg-white/5 rounded-xl p-6 border border-white/10 transition-opacity duration-300 ${status === 'CLOCKED_OUT' ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                    <div className="mb-4 flex items-center text-blue-300">
                        <Briefcase size={20} className="mr-2" />
                        <h3 className="font-bold">Daily Activity Reporting</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Client / Site (Select Multiple)</label>
                            <ClientSelect
                                clients={clientsList}
                                value={selectedClientIds}
                                onChange={(val) => setSelectedClientIds(val as string[])}
                                multi={true}
                                placeholder="Select Clients..."
                                disabled={status === 'CLOCKED_OUT'}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Work Description / Report</label>
                            <textarea
                                className="w-full text-sm rounded-lg p-3 bg-black/20 border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none text-white resize-none"
                                placeholder="Describe the work done today..."
                                rows={3}
                                value={workDescription}
                                onChange={(e) => setWorkDescription(e.target.value)}
                                disabled={status === 'CLOCKED_OUT'}
                            />
                        </div>

                        {status === 'CLOCKED_IN' && (
                            <button
                                onClick={handleClockAction}
                                disabled={loading}
                                className="w-full flex items-center justify-center space-x-2 py-4 rounded-xl text-lg font-bold shadow-lg transition-all active:scale-95 bg-gradient-to-r from-red-600 to-rose-600 text-white hover:shadow-red-500/30 mt-2"
                            >
                                <Clock size={20} />
                                <span>{loading ? 'Processing...' : 'Clock Out'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter and Export Bar */}
            <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-black/20 rounded-lg p-2 border border-white/5">
                        <CalendarRange size={16} className="text-gray-400 mr-2" />
                        <input type="date" className="bg-transparent text-sm text-white outline-none w-32" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                        <span className="text-gray-500 mx-2">-</span>
                        <input type="date" className="bg-transparent text-sm text-white outline-none w-32" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                    </div>
                    {user?.role === UserRole.ADMIN && (
                        <select className="bg-black/20 text-sm text-white rounded-lg p-2 border border-white/5 outline-none" value={filterStaffId} onChange={e => setFilterStaffId(e.target.value)}>
                            <option value="ALL">All Staff</option>
                            {usersList.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                        </select>
                    )}
                    <select className="bg-black/20 text-sm text-white rounded-lg p-2 border border-white/5 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="ALL">All Status</option>
                        <option value="PRESENT">Present</option>
                        <option value="LATE">Late</option>
                        <option value="ABSENT">Absent</option>
                        <option value="ON LEAVE">On Leave</option>
                        <option value="CORRECTED">Admin Corrected</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    {user?.role === UserRole.ADMIN && (
                        <button
                            onClick={() => setIsManualModalOpen(true)}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm flex items-center border border-brand-500/30 font-medium shadow-lg"
                        >
                            <Plus size={16} className="mr-2" /> Manual Entry
                        </button>
                    )}
                    <div className="h-6 w-px bg-white/10 mx-2"></div>
                    <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm flex items-center border border-emerald-500/30 transition-all shadow-lg hover:-translate-y-0.5"><FileText size={16} className="mr-2" /> Excel</button>
                    <button onClick={exportPDF} className="bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 px-3 py-2 rounded-lg text-sm flex items-center border border-brand-500/20 transition-all"><FileDown size={16} className="mr-2" /> PDF</button>
                </div>
            </div>

            {/* History Section */}
            <div className="glass-panel rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead>
                            <tr className="bg-white/5 text-gray-400 uppercase tracking-wider text-xs border-b border-white/10">
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Client / Type</th>
                                <th className="px-6 py-4">Work Description / Notes</th>
                                <th className="px-6 py-4">Timing</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {reportData.map((record) => (
                                <tr key={record.id || Math.random()} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium">{record.date}</td>
                                    <td className="px-6 py-4">{record.userName}</td>
                                    <td className="px-6 py-4 text-blue-300">{record.clientName || 'Internal'}</td>
                                    <td className="px-6 py-4 text-gray-400 truncate max-w-xs">{record.workDescription || record.notes}</td>
                                    <td className="px-6 py-4 text-xs">
                                        <div>In: {record.clockIn}</div>
                                        {record.clockOut && <div>Out: {record.clockOut}</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {record.status === 'ABSENT' && (
                                            <span className="flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 w-fit">
                                                <CalendarOff size={12} className="mr-1" /> Absent
                                            </span>
                                        )}
                                        {record.status === 'ON LEAVE' && (
                                            <span className="flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 w-fit">
                                                <Palmtree size={12} className="mr-1" /> On Leave
                                            </span>
                                        )}
                                        {record.status === 'LATE' && (
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 w-fit">
                                                Late
                                            </span>
                                        )}
                                        {record.status === 'PRESENT' && (
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 w-fit">
                                                Present
                                            </span>
                                        )}
                                        {record.status === 'CORRECTED' && (
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit">
                                                Corrected
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {reportData.length === 0 && (
                                <tr><td colSpan={6} className="p-6 text-center text-gray-500">No records found for selection.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual Entry Modal (Admin Only) */}
            {isManualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white font-heading">Manual Attendance Entry</h3>
                            <button onClick={() => setIsManualModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleManualSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Staff Member</label>
                                    <StaffSelect
                                        users={usersList}
                                        value={manualForm.userId}
                                        onChange={(val) => setManualForm({ ...manualForm, userId: val as string })}
                                        placeholder="Select Staff..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={manualForm.date}
                                        onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Clock In</label>
                                        <input
                                            required
                                            type="time"
                                            className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                            value={manualForm.clockIn}
                                            onChange={(e) => setManualForm({ ...manualForm, clockIn: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Clock Out</label>
                                        <input
                                            required
                                            type="time"
                                            className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                            value={manualForm.clockOut}
                                            onChange={(e) => setManualForm({ ...manualForm, clockOut: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Client / Site</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={manualForm.clientId}
                                        onChange={(e) => setManualForm({ ...manualForm, clientId: e.target.value })}
                                    >
                                        <option value="">Select Client (Optional)...</option>
                                        <option value="INTERNAL">Internal Office Work</option>
                                        {clientsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Work Description</label>
                                    <textarea
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm resize-none"
                                        rows={2}
                                        value={manualForm.description}
                                        onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                                        placeholder="Describe work done..."
                                    />
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Reason for Manual Entry</label>
                                    <input
                                        required
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={manualForm.reason}
                                        onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })}
                                        placeholder="e.g. Forgot to clock in, System Issue"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-2 border-t border-white/10">
                                <button type="button" onClick={() => setIsManualModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors text-sm">Cancel</button>
                                <button type="submit" className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center">
                                    <Save size={16} className="mr-2" /> Save Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendancePage;
