
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, MapPin, AlertTriangle, FileText, Download, UserCog, Check, X, Filter, FileDown, CalendarRange, Users, Briefcase, AlertOctagon, CalendarOff, Palmtree, Plus, Save, Search, ChevronDown, Play, Square, Timer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, UserRole, UserProfile, Client, LeaveRequest } from '../types';
import { AuthService } from '../services/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Link, useLocation } from 'react-router-dom';
import StaffSelect from '../components/StaffSelect';
import ClientSelect from '../components/ClientSelect';
import { getCurrentBSDate, formatBSDate, convertADToBS } from '../utils/nepaliDate';
import NepaliDate from 'nepali-date-converter';

const AttendancePage: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation(); // Hook to access navigation state
    const [currentTime, setCurrentTime] = useState(new Date());
    const [status, setStatus] = useState<'CLOCKED_OUT' | 'CLOCKED_IN'>('CLOCKED_OUT');
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null); // Track the Active Doc ID
    const [sessionTime, setSessionTime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Late Logic
    const [lateCount, setLateCount] = useState(0);
    const [lateReason, setLateReason] = useState('');
    const [isLateEntry, setIsLateEntry] = useState(false);

    // Work Log State (Replaces simple description)
    const [workLogs, setWorkLogs] = useState<any[]>([{ id: '1', clientId: '', description: '', duration: 0, billable: true }]);
    const [dailyDescription, setDailyDescription] = useState(''); // General day summary if needed, or derived

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
    const [groupByStaff, setGroupByStaff] = useState(false); // New grouping toggle

    // Manual Entry Modal State (Admin Only)
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [manualForm, setManualForm] = useState({
        userId: '',
        date: new Date().toLocaleDateString('en-CA'),
        clockIn: '10:00',
        clockOut: '17:00',
        workLogs: [] as any[], // manual entry logs
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



    const loadData = async () => {
        if (!user) return; // Guard against unauthenticated calls
        setLoading(true);
        try {
            // Parallel Fetch
            const fetchId = user.role === UserRole.ADMIN ? undefined : user.uid;

            const [uList, cList, attHistory, lCount, lList] = await Promise.all([
                AuthService.getAllUsers(),
                AuthService.getAllClients(),
                AuthService.getAttendanceHistory(fetchId),
                user ? AuthService.getLateCountLast30Days(user.uid) : Promise.resolve(0),
                AuthService.getAllLeaves(fetchId)
            ]);

            setUsersList(uList);

            // Inject "Internal / Office" client
            const internalClient: Client = {
                id: 'INTERNAL',
                name: 'Internal / Office',
                code: 'INT',
                serviceType: 'Internal' as any,
                status: 'Active' as any,
                category: 'A' as any,
                industry: 'Others' as any
            };
            setClientsList([internalClient, ...cList]);

            setHistory(attHistory);
            setLateCount(lCount);
            setLeavesList(lList);

            // Check if already clocked in today (Local Time check)
            const todayStr = new Date().toLocaleDateString('en-CA');

            // Robust check: Look for ANY record for today for this user
            // We prioritize finding an "Open" session (no clockOut), but if there is a closed one, we know they are done.
            const todayRecord = attHistory.find(r => r.userId === user?.uid && r.date === todayStr);

            if (todayRecord) {
                if (!todayRecord.clockOut) {
                    // Active Session
                    setStatus('CLOCKED_IN');
                    setCurrentRecordId(todayRecord.id);

                    // Calculate session time
                    // Handle "HH:MM:SS" or "HH:MM"
                    const [h, m, s] = todayRecord.clockIn.split(':').map(Number);
                    const startTime = new Date();
                    startTime.setHours(h, m, s || 0, 0);

                    const diff = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
                    setSessionTime(diff > 0 ? diff : 0);
                } else {
                    // Completed Session
                    setStatus('CLOCKED_OUT');
                    setCurrentRecordId(todayRecord.id); // Valid record exists, but session closed
                    // Optionally disable Clock In button if duplicates not allowed?
                }
            } else {
                setStatus('CLOCKED_OUT');
                setCurrentRecordId(null);
                setSessionTime(0);
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

    const handleClockIn = async () => {
        if (isSaving || loading) return;

        // Validation
        const todayStr = new Date().toLocaleDateString('en-CA');
        const hasRecordToday = history.some(r => r.userId === user?.uid && r.date === todayStr);

        // Allow Clock In if NO record exists.
        // If record exists and has clockOut -> Block (already done)
        // If record exists and NO clockOut -> Resume (should have been caught by loadData)

        const existingRec = history.find(r => r.userId === user?.uid && r.date === todayStr);
        if (existingRec) {
            if (existingRec.clockOut) {
                alert("⛔ Access Denied: You have already completed your attendance for today.");
                return;
            } else {
                // Determine if we should just resume state locally or alert
                alert("⚠️ Session Restored: You are already clocked in.");
                loadData(); // Reload to sync state
                return;
            }
        }

        if (isLateEntry && !lateReason.trim()) {
            alert("You are arriving after 10:15 AM. You must provide a reason for being late.");
            return;
        }

        setIsSaving(true);
        setLoading(true);

        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

            const newRecord: AttendanceRecord = {
                id: 'temp_id', // Service will handle ID or we can generate one if using addDoc directly in service
                userId: user?.uid || '',
                userName: user?.displayName || 'User',
                date: todayStr,
                clockIn: timeStr,
                status: isLateEntry ? 'LATE' : 'PRESENT',
                notes: isLateEntry ? `Late Reason: ${lateReason}` : '',
                workHours: 0
            };

            await AuthService.recordAttendance(newRecord);
            // Reload to get the ID and update state
            await loadData();

        } catch (error: any) {
            console.error(error);
            alert(error.message);
            // If error says "already recorded", force reload
            if (error.message.includes('already recorded')) {
                await loadData();
            }
        } finally {
            setIsSaving(false);
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (isSaving || loading) return;

        // Validation
        const validLogs = workLogs.filter(l => l.clientId && l.description);
        if (validLogs.length === 0) {
            alert("⚠️ Please add at least one valid Work Log (Client + Description) before clocking out.");
            return;
        }

        setIsSaving(true);
        setLoading(true);

        try {
            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA');
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

            // Filter empty logs
            const finalLogs = workLogs.filter(l => l.clientId && l.description);

            const clientIds = Array.from(new Set(finalLogs.map(l => l.clientId)));
            const clientNames = finalLogs.map(l => {
                const c = clientsList.find(cl => cl.id === l.clientId);
                return c ? c.name : 'Unknown';
            }).join(', ');

            const combinedDesc = finalLogs.map(l => `${l.clientId ? clientsList.find(c => c.id === l.clientId)?.name : '?'}: ${l.description} (${l.duration}h)`).join('\n');

            // We need to update the EXISTING record, avoiding "No Permission" on create
            // The service 'recordAttendance' handles the "Update if exists" logic based on Date + User.
            // But we must be careful with permissions.
            // Since we updated rules to allow user to update their own, this should work.

            const record: AttendanceRecord = {
                id: currentRecordId || '', // Pass ID if known, otherwise service finds it by date
                userId: user?.uid || '',
                userName: user?.displayName || 'User',
                date: todayStr,
                clockIn: '00:00:00', // Service won't overwrite existing clockIn if we don't pass it? 
                // Wait, AuthService.recordAttendance overwrites everything if we pass it.
                // We need to fetch the existing clockIn to calculate hours correctly, OR trust the Service checks.
                // Service logic: "if (!record.clockOut && existing.clockIn ...)"
                // It does: "await updateDoc(doc(db, 'attendance', docId), updateData);"
                // So we should construct the full object or partial. 
                // Let's pass the FULL object but we need the original ClockIn time.

                // We can rely on `sessionTime` to calculate approximate clockIn, OR just pass current time as clockOut.
                // Better: Let's assume the service handles the merge? 
                // Looking at `firebase.ts`: 
                // It does `const { id, ...updateData } = record; await updateDoc(..., updateData);`
                // So it WILL overwrite clockIn if we pass it.
                // We MUST pass the correct original ClockIn.

                clockIn: 'KEEP_EXISTING', // Hack: We'll need to check firebase.ts if it filters this. 
                // Actually, looking at firebase.ts: "const { id, ...updateData } = record; await updateDoc(..., updateData);"
                // This WILL overwrite clockIn.
                // We MUST use the original clockIn.

                // FIX: use sessionTime to derive approx, OR finding the record from history again.
                // We have 'history' in state.

                clockOut: timeStr,
                workHours: Number((sessionTime / 3600).toFixed(2)),
                status: isLateEntry ? 'LATE' : 'PRESENT',
                clientIds: clientIds,
                clientName: clientNames || 'Internal',
                workDescription: dailyDescription || combinedDesc,
                workLogs: finalLogs,
                notes: lateReason ? `Late Reason: ${lateReason}` : ''
            };

            // Re-find original clockIn to prevent overwrite
            const originalRec = history.find(r => r.id === currentRecordId || (r.userId === user?.uid && r.date === todayStr));
            if (originalRec) {
                record.clockIn = originalRec.clockIn;
            } else {
                // Fallback if state is weird
                record.clockIn = new Date(now.getTime() - sessionTime * 1000).toLocaleTimeString('en-US', { hour12: false });
            }

            await AuthService.recordAttendance(record);
            setStatus('CLOCKED_OUT');
            setCurrentRecordId(null);
            setWorkLogs([{ id: '1', clientId: '', description: '', duration: 0, billable: true }]);
            setDailyDescription('');
            setLateReason('');
            await loadData();

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            setIsSaving(false);
            setLoading(false);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualForm.userId || !manualForm.clockIn || !manualForm.clockOut) {
            alert("Please fill in all required fields.");
            return;
        }

        if (isSaving) return; // Prevent duplicate submissions

        setLoading(true);
        setIsSaving(true);
        try {
            const selectedUser = usersList.find(u => u.uid === manualForm.userId);

            if (!selectedUser) throw new Error("User not found");

            // Calculate Duration roughly
            const start = new Date(`${manualForm.date}  ${manualForm.clockIn}`);
            const end = new Date(`${manualForm.date}  ${manualForm.clockOut}`);
            const hours = (end.getTime() - start.getTime()) / (1000 * 3600);

            // Manual logs or basic note
            const finalLogs = manualForm.workLogs || [];
            const clientIds = Array.from(new Set(finalLogs.map(l => l.clientId)));
            const clientNames = finalLogs.map(l => {
                const c = clientsList.find(cl => cl.id === l.clientId);
                return c ? c.name : 'Unknown';
            }).join(', ');

            const record: AttendanceRecord = {
                id: '', // Generated by service
                userId: manualForm.userId,
                userName: selectedUser.displayName || 'Unknown',
                date: manualForm.date,
                clockIn: manualForm.clockIn + ':00',
                clockOut: manualForm.clockOut + ':00',
                workHours: Math.max(0, parseFloat(hours.toFixed(2))),
                status: 'CORRECTED', // Use CORRECTED for manual entries
                clientId: clientIds[0] || 'INTERNAL',
                clientIds: clientIds,
                clientName: clientNames || 'Admin Correction',
                workDescription: 'Manual Entry by Admin',
                workLogs: finalLogs,
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
                workLogs: [],
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
            if (filterStaffId === 'ALL') {
                targetUsers = usersList
                    .filter(u => u.status !== 'Inactive')
                    .sort((a, b) => a.displayName.localeCompare(b.displayName));
            } else {
                targetUsers = usersList.filter(u => u.uid === filterStaffId);
            }
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
                            // C. Absent or Holiday
                            // Check for Saturday
                            const isSaturday = new Date(dateStr).getDay() === 6;

                            if (isSaturday) {
                                fullRecords.push({
                                    id: `holiday_${u.uid}_${dateStr}`,
                                    userId: u.uid,
                                    userName: u.displayName,
                                    date: dateStr,
                                    clockIn: '-',
                                    clockOut: '-',
                                    status: 'HOLIDAY',
                                    notes: 'Weekend (Saturday)',
                                    clientName: 'HOLIDAY',
                                    workHours: 0
                                });
                            } else {
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
                }
            });
        });

        // 4. Apply Status Filter if needed
        if (filterStatus !== 'ALL') {
            return fullRecords.filter(r => r.status === filterStatus);
        }

        // Sort: Group By Staff OR Date Descending
        if (groupByStaff) {
            return fullRecords.sort((a, b) => {
                const nameComp = a.userName.localeCompare(b.userName);
                if (nameComp !== 0) return nameComp;
                return b.date.localeCompare(a.date);
            });
        }

        // Default: Sort by Date Descending, then Name
        return fullRecords.sort((a, b) => {
            const dateComp = b.date.localeCompare(a.date);
            if (dateComp !== 0) return dateComp;
            return a.userName.localeCompare(b.userName);
        });

    }, [history, leavesList, usersList, filterStartDate, filterEndDate, filterStaffId, user, filterStatus, groupByStaff]);

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
        const tableRows = reportData.map(r => {
            // Construct details string
            let details = '';
            if (r.workLogs && r.workLogs.length > 0) {
                details = r.workLogs.map((l: any) => `${l.clientName || 'Unknown'} (${l.duration}h): ${l.description}`).join('\n');
            } else {
                details = `${r.clientName || '-'}\n${r.workDescription || ''}`;
            }

            return [
                r.date,
                r.userName,
                details,
                r.clockIn,
                r.clockOut || '-',
                r.workHours.toString(),
                r.status
            ];
        });

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
            // Construct detailed client/activity string from logs or fallback
            let activityDetails = '';
            if (r.workLogs && r.workLogs.length > 0) {
                activityDetails = r.workLogs.map((l: any) => {
                    const client = l.clientName || 'Unknown';
                    const duration = l.duration > 0 ? `(${l.duration}h)` : '';
                    const desc = l.description ? `- ${l.description}` : '';
                    return `${client} ${duration} ${desc}`;
                }).join('\n');
            } else {
                activityDetails = `${r.clientName || ''}\n${r.workDescription || r.notes || ''}`;
            }

            const row = worksheet.addRow([
                r.date,
                r.userName,
                activityDetails.trim(),
                r.clockIn,
                r.clockOut || '-',
                r.workHours,
                r.status,
                r.notes || '-'
            ]);

            const bgColor = index % 2 === 0 ? 'F8FAFC' : lightNavy; // Slate-50 and Slate-100
            row.eachCell((cell) => {
                cell.font = { size: 9, color: { argb: darkNavy } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.alignment = { vertical: 'middle', wrapText: true };
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
            <div className="glass-panel p-8 rounded-xl flex flex-col xl:flex-row items-center justify-between shadow-xl gap-8">

                {/* Status Column */}
                <div className="flex-1 w-full space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">Today's Attendance</h2>
                            <p className="text-gray-400 text-sm">Office Time: 10:00 - 17:00</p>
                        </div>
                        {isLateEntry && status === 'CLOCKED_OUT' && (
                            <div className="flex items-center text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                                <AlertTriangle size={14} className="mr-2" />
                                <span className="text-xs font-bold">LATE ENTRY</span>
                            </div>
                        )}
                    </div>

                    {/* Clock Display */}
                    <div className="bg-black/20 p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div>
                            <div className="text-5xl font-mono font-bold text-blue-400 tracking-wider drop-shadow-lg">
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-lg font-medium text-violet-400 mt-1">
                                {new NepaliDate().format('DD MMMM YYYY')} <span className="text-gray-500 text-sm">(BS)</span>
                            </div>
                        </div>
                        <div className="hidden sm:block">
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${status === 'CLOCKED_IN' ? 'border-green-500/30 bg-green-500/10' : 'border-gray-500/30 bg-gray-500/10'}`}>
                                <Timer size={40} className={status === 'CLOCKED_IN' ? 'text-green-400 animate-pulse' : 'text-gray-500'} />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleClockIn}
                            disabled={status === 'CLOCKED_IN' || loading}
                            className={`
                                flex flex-col items-center justify-center p-6 rounded-xl border border-white/10 transition-all
                                ${status === 'CLOCKED_IN'
                                    ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed opacity-50'
                                    : 'bg-gradient-to-br from-green-600 to-emerald-700 text-white hover:shadow-lg hover:shadow-green-500/20 active:scale-95'}
                            `}
                        >
                            <Play size={32} className="mb-2" fill={status !== 'CLOCKED_IN' ? "currentColor" : "none"} />
                            <span className="font-bold text-lg">Clock In</span>
                        </button>

                        <button
                            onClick={handleClockOut}
                            disabled={status === 'CLOCKED_OUT' || loading}
                            className={`
                                flex flex-col items-center justify-center p-6 rounded-xl border border-white/10 transition-all
                                ${status === 'CLOCKED_OUT'
                                    ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed opacity-50'
                                    : 'bg-gradient-to-br from-red-600 to-rose-700 text-white hover:shadow-lg hover:shadow-red-500/20 active:scale-95'}
                            `}
                        >
                            <Square size={32} className="mb-2" fill={status === 'CLOCKED_IN' ? "currentColor" : "none"} />
                            <span className="font-bold text-lg">Clock Out</span>
                        </button>
                    </div>

                    {/* Late Reason Input */}
                    {isLateEntry && status === 'CLOCKED_OUT' && (
                        <div className="animate-in slide-in-from-top-2 bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                            <label className="block text-xs font-bold text-orange-400 mb-1">
                                Late Reason Required
                            </label>
                            <input
                                type="text"
                                className="w-full bg-black/20 rounded-lg px-3 py-2 text-sm text-white outline-none border border-orange-500/30 focus:border-orange-500"
                                placeholder="Why are you late today?"
                                value={lateReason}
                                onChange={(e) => setLateReason(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Work Log / Session Panel */}
                <div className={`w-full xl:w-[500px] bg-white/5 rounded-xl p-6 border border-white/10 transition-all duration-300 relative overflow-hidden ${status === 'CLOCKED_OUT' ? 'opacity-50 grayscale' : 'opacity-100'}`}>

                    {/* Overlay for Clocked Out */}
                    {status === 'CLOCKED_OUT' && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                            <div className="text-center">
                                <Briefcase className="mx-auto text-gray-400 mb-2" size={32} />
                                <p className="text-gray-300 font-medium">Clock In to Start Work</p>
                            </div>
                        </div>
                    )}

                    <div className="mb-4 flex items-center justify-between text-blue-300">
                        <div className="flex items-center">
                            <Briefcase size={20} className="mr-2" />
                            <h3 className="font-bold">Today's Work Log</h3>
                        </div>
                        <div className="text-xs bg-blue-500/20 px-2 py-1 rounded text-blue-200 border border-blue-500/30">
                            Session: {formatDuration(sessionTime)}
                        </div>
                    </div>

                    <div className="space-y-3 max-h-[320px] overflow-y-auto px-1 custom-scrollbar">
                        {workLogs.map((log, index) => (
                            <div key={log.id} className="bg-black/20 p-3 rounded-lg border border-white/5 animate-in slide-in-from-right-2">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-gray-500">Entry #{index + 1}</span>
                                    {workLogs.length > 1 && (
                                        <button onClick={() => setWorkLogs(workLogs.filter(l => l.id !== log.id))} className="text-gray-600 hover:text-red-400">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex-1 min-w-[200px]">
                                        <ClientSelect
                                            clients={clientsList}
                                            value={log.clientId}
                                            onChange={(val) => {
                                                const newLogs = [...workLogs];
                                                newLogs[index].clientId = val as string;
                                                setWorkLogs(newLogs);
                                            }}
                                            placeholder="Select Client / Internal..."
                                            className="w-full"
                                        />
                                    </div>

                                    <textarea
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500 resize-none"
                                        rows={2}
                                        placeholder="What did you work on?"
                                        value={log.description}
                                        onChange={(e) => {
                                            const newLogs = [...workLogs];
                                            newLogs[index].description = e.target.value;
                                            setWorkLogs(newLogs);
                                        }}
                                    />

                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center bg-white/5 rounded-lg border border-white/10 px-2">
                                            <span className="text-gray-500 text-xs mr-2">Duration (Hrs):</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.5"
                                                className="w-full bg-transparent py-1.5 text-xs text-white outline-none"
                                                value={log.duration}
                                                onChange={(e) => {
                                                    const newLogs = [...workLogs];
                                                    newLogs[index].duration = parseFloat(e.target.value);
                                                    setWorkLogs(newLogs);
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-2 bg-white/5 rounded-lg border border-white/10 px-2 py-1.5 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => {
                                            const newLogs = [...workLogs];
                                            newLogs[index].billable = !newLogs[index].billable;
                                            setWorkLogs(newLogs);
                                        }}>
                                            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${log.billable ? 'bg-green-500 border-green-500' : 'border-gray-500'}`}>
                                                {log.billable && <Check size={10} className="text-white" />}
                                            </div>
                                            <span className="text-xs text-gray-400">Billable</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={() => setWorkLogs([...workLogs, { id: Date.now().toString(), clientId: '', description: '', duration: 0, billable: true }])}
                            className="flex-1 text-xs bg-white/10 hover:bg-white/20 py-2 rounded-lg flex items-center justify-center text-gray-300 transition-colors border border-white/5"
                        >
                            <Plus size={14} className="mr-1" /> Add Activity
                        </button>
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
                        <div className="w-48">
                            <StaffSelect
                                users={[{ uid: 'ALL', displayName: 'All Staff', email: '', role: 'STAFF' } as any, ...usersList]}
                                value={filterStaffId}
                                onChange={(val) => setFilterStaffId(val as string)}
                                placeholder="Filter by Staff..."
                            />
                        </div>
                    )}
                    <select className="bg-black/20 text-sm text-white rounded-lg p-2 border border-white/5 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="ALL" className="text-gray-900">All Status</option>
                        <option value="PRESENT" className="text-gray-900">Present</option>
                        <option value="LATE" className="text-gray-900">Late</option>
                        <option value="ABSENT" className="text-gray-900">Absent</option>
                        <option value="ON LEAVE" className="text-gray-900">On Leave</option>
                        <option value="CORRECTED" className="text-gray-900">Admin Corrected</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    {user?.role === UserRole.ADMIN && (
                        <div className="flex items-center space-x-2 mr-2">
                            <label className="text-white text-xs cursor-pointer flex items-center">
                                <input type="checkbox" checked={groupByStaff} onChange={e => setGroupByStaff(e.target.checked)} className="mr-1.5 rounded border-white/20 bg-white/5" />
                                Group by Staff
                            </label>
                        </div>
                    )}
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
                                <th className="px-6 py-4">Work Logs / Clients</th>
                                <th className="px-6 py-4">Timing</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {reportData.map((record) => (
                                <tr key={record.id || Math.random()} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium tabular-nums">{record.date}</td>
                                    <td className="px-6 py-4">
                                        <Link to={`/staff/${record.userId}`} className="hover:text-blue-400 hover:underline flex items-center">
                                            {record.userName}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4">
                                        {record.workLogs && record.workLogs.length > 0 ? (
                                            <div className="space-y-2">
                                                {record.workLogs.map((log: any, i: number) => (
                                                    <div key={i} className="text-xs bg-white/5 p-2 rounded border border-white/5 shadow-sm">
                                                        <div className="flex justify-between font-bold text-gray-400 mb-0.5">
                                                            <span>{log.clientName || 'Unknown'}</span>
                                                            {log.duration > 0 && <span>{log.duration}h</span>}
                                                        </div>
                                                        <div className="text-gray-300">{log.description}</div>
                                                        {log.billable && <div className="text-[10px] text-green-500 mt-0.5 flex items-center"><Check size={10} className="mr-1" /> Billable</div>}
                                                    </div>
                                                ))}
                                                {record.workDescription && <div className="text-xs text-gray-500 mt-1 italic border-t border-white/5 pt-1">{record.workDescription}</div>}
                                            </div>
                                        ) : (
                                            <div className="text-xs">
                                                <div className="text-blue-300 font-semibold mb-1">{record.clientName || 'Internal'}</div>
                                                <div className="text-gray-400 max-w-xs">{record.workDescription || record.notes}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs tabular-nums">
                                        <div className="text-gray-300">In: {record.clockIn}</div>
                                        {record.clockOut && <div className="text-gray-400">Out: {record.clockOut}</div>}
                                        {record.workHours > 0 && <div className="text-emerald-500 font-bold mt-1">Total: {record.workHours}h</div>}
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
                    <div className="glass-modal rounded-xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl border border-white/10 max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white font-heading">Manual Attendance Entry</h3>
                            <button onClick={() => setIsManualModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleManualSubmit} className="p-6 overflow-y-auto custom-scrollbar">
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

                                <div className="col-span-1 md:col-span-2 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase">Work Logs</label>
                                        <button
                                            type="button"
                                            onClick={() => setManualForm({ ...manualForm, workLogs: [...manualForm.workLogs, { id: Date.now().toString(), clientId: '', description: '', duration: 0, billable: true }] })}
                                            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded flex items-center text-gray-300"
                                        >
                                            <Plus size={12} className="mr-1" /> Add
                                        </button>
                                    </div>

                                    <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded-lg">
                                        {manualForm.workLogs.map((log, index) => (
                                            <div key={log.id} className="grid grid-cols-12 gap-2 items-start border-b border-white/5 pb-2 mb-2 last:border-0 last:mb-0">
                                                <div className="col-span-4">
                                                    <ClientSelect
                                                        clients={clientsList}
                                                        value={log.clientId}
                                                        onChange={(val) => {
                                                            const newLogs = [...manualForm.workLogs];
                                                            newLogs[index].clientId = val as string;
                                                            setManualForm({ ...manualForm, workLogs: newLogs });
                                                        }}
                                                        placeholder="Client..."
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="col-span-5">
                                                    <input
                                                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none"
                                                        placeholder="Description"
                                                        value={log.description}
                                                        onChange={(e) => {
                                                            const newLogs = [...manualForm.workLogs];
                                                            newLogs[index].description = e.target.value;
                                                            setManualForm({ ...manualForm, workLogs: newLogs });
                                                        }}
                                                        required
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        type="number" step="0.5"
                                                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none"
                                                        placeholder="Hrs"
                                                        value={log.duration}
                                                        onChange={(e) => {
                                                            const newLogs = [...manualForm.workLogs];
                                                            newLogs[index].duration = parseFloat(e.target.value);
                                                            setManualForm({ ...manualForm, workLogs: newLogs });
                                                        }}
                                                        required
                                                    />
                                                </div>
                                                <button type="button" onClick={() => {
                                                    const newLogs = manualForm.workLogs.filter(l => l.id !== log.id);
                                                    setManualForm({ ...manualForm, workLogs: newLogs });
                                                }} className="col-span-1 text-gray-500 hover:text-red-400 flex justify-center mt-1">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {manualForm.workLogs.length === 0 && <p className="text-xs text-gray-500 text-center py-2">No logs added yet.</p>}
                                    </div>
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
