import React, { useState, useEffect, useRef } from 'react';
import { 
    MapPin, Clock, Calendar, ChevronRight, 
    Play, Square, Plus, Trash2, Save, 
    Cloud, CheckCircle2, AlertTriangle, 
    ListFilter, Activity, Timer, Minimize2, 
    Maximize2, Briefcase, Building2, Loader2, 
    ChevronUp, Home, CheckSquare, Send, X, WifiOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClockIn, useClockOut, useAttendanceHistory, useTodayAttendance, useCurrentBSMonthLateCount, attendanceKeys } from '../../hooks/useAttendance';
import { useClients } from '../../hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';
import { Client, WorkLog, AttendanceRecord } from '../../types';
import { AuthService } from '../../services/firebase';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableSelect from '../common/SearchableSelect';
import ActionDetailEditor from '../common/ActionDetailEditor';
import { NATURE_OF_ASSIGNMENTS } from '../../constants/firmData';

// Timer Component to prevent full AttendanceWidget re-renders
const SessionTimer = React.memo(({ initialSeconds, isRunning, className }: { initialSeconds: number, isRunning: boolean, className?: string }) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const lastInitialSeconds = useRef(initialSeconds);

    useEffect(() => {
        if (Math.abs(initialSeconds - seconds) > 2) {
            setSeconds(initialSeconds);
        }
        lastInitialSeconds.current = initialSeconds;
    }, [initialSeconds]);

    useEffect(() => {
        let interval: any;
        if (isRunning) {
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning]);

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <p className={className || "text-xl font-mono font-bold text-brand-600 dark:text-brand-400 leading-none drop-shadow-sm transition-all duration-300"}>
            {formatTime(seconds)}
        </p>
    );
});

const AttendanceWidget: React.FC = () => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [status, setStatus] = useState<'CLOCKED_OUT' | 'CLOCKED_IN' | 'COMPLETED'>('CLOCKED_OUT');
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [lateReason, setLateReason] = useState('');
    const [isLate, setIsLate] = useState(false);
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
    const [isFloating, setIsFloating] = useState(false);
    const [clockInTime, setClockInTime] = useState<string | null>(null);
    const [clockOutTime, setClockOutTime] = useState<string | null>(null);
    const [totalWorkHours, setTotalWorkHours] = useState<number | null>(null);

    // A3: Check-in type
    const [checkInType, setCheckInType] = useState<'OFFICE' | 'CLIENT_SITE' | 'REMOTE'>('OFFICE');
    const [selectedSiteClientId, setSelectedSiteClientId] = useState<string>('');

    // A4: Daily Report modal on checkout
    const [showDailyReportModal, setShowDailyReportModal] = useState(false);
    const [dailyReport, setDailyReport] = useState({
        done: '',
        pending: '',
        blockers: '',
        tomorrow: ''
    });

    // Offline status (M3)
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const formatToAMPM = (timeStr: string | null) => {
        if (!timeStr) return '--:-- --';
        try {
            const [h, m] = timeStr.split(':').map(Number);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hours = h % 12 || 12;
            const formattedHrs = hours.toString().padStart(2, '0');
            const formattedMins = m.toString().padStart(2, '0');
            return `${formattedHrs}:${formattedMins} ${ampm}`;
        } catch {
            return timeStr;
        }
    };

    // React Query Hooks (D4 Fix: useTodayAttendance for immediate, live sync across devices)
    const { data: clientsList = [] } = useClients();
    const { data: todayRecord, isLoading: todayLoading } = useTodayAttendance(user?.uid);
    const { data: lateStats } = useCurrentBSMonthLateCount(user?.uid);
    const clockInMutation = useClockIn();
    const clockOutMutation = useClockOut();
    const queryClient = useQueryClient();

    const loading = todayLoading || clockInMutation.isPending || clockOutMutation.isPending;

    // Derived State for Clients
    const clients = React.useMemo(() => {
        const internalClient: Client = {
            id: 'INTERNAL',
            name: 'Internal Work / Office',
            code: 'INT',
            serviceType: 'Internal' as any,
            status: 'Active' as any,
            category: 'A' as any,
            industry: 'Internal' as any
        };
        return [internalClient, ...clientsList.filter(c => c.status === 'Active')];
    }, [clientsList]);

    // Work Logs
    const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
    const [isSyncingLogs, setIsSyncingLogs] = useState(false);
    const hasInitializedLogs = useRef(false);

    // Initial log setup (D1 Fix: Use localStorage to prevent database write storm)
    useEffect(() => {
        if (hasInitializedLogs.current || !user?.uid) return;

        const storageKey = `rsa_draft_worklogs_${user.uid}`;
        const savedDraft = localStorage.getItem(storageKey);
        
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setWorkLogs(parsed);
                    hasInitializedLogs.current = true;
                    return;
                }
            } catch (e) {
                console.warn("Could not parse draft worklogs", e);
            }
        }

        // Default initial log
        setWorkLogs([
            {
                id: Math.random().toString(36).substr(2, 9),
                clientId: 'INTERNAL',
                clientName: 'Internal Work / Office',
                natureOfAssignment: NATURE_OF_ASSIGNMENTS[0],
                description: '',
                duration: 0,
                billable: true,
                locationTag: 'Office'
            }
        ]);
        hasInitializedLogs.current = true;
    }, [user?.uid]);

    // Sync state with today's live record (D4 Fix)
    useEffect(() => {
        if (todayLoading) return;

        if (todayRecord) {
            if (todayRecord.status === 'ON LEAVE' || !todayRecord.clockIn) {
                setStatus('COMPLETED');
                setCurrentRecordId(todayRecord.id);
                setClockInTime(null);
                setClockOutTime(null);
                setTotalWorkHours(0);
                if (todayRecord.workLogs && todayRecord.workLogs.length > 0) {
                    setWorkLogs(todayRecord.workLogs);
                }
                return;
            }

            if (!todayRecord.clockOut) {
                setStatus('CLOCKED_IN');
                setCurrentRecordId(todayRecord.id);
                setClockInTime(todayRecord.clockIn);
                setClockOutTime(null);
                setTotalWorkHours(null);

                // Recover session timer
                if (todayRecord.clockInISO) {
                    const startMs = new Date(todayRecord.clockInISO).getTime();
                    setSessionSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
                } else if (todayRecord.clockIn) {
                    const [h, m, s] = todayRecord.clockIn.split(':').map(Number);
                    const start = new Date();
                    start.setHours(h, m, s || 0, 0);
                    setSessionSeconds(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
                }

                if (todayRecord.workLogs && todayRecord.workLogs.length > 0) {
                    setWorkLogs(todayRecord.workLogs);
                }
                if (todayRecord.checkInType) {
                    setCheckInType(todayRecord.checkInType);
                }
            } else {
                setStatus('COMPLETED');
                setCurrentRecordId(todayRecord.id);
                setClockInTime(todayRecord.clockIn);
                setClockOutTime(todayRecord.clockOut);
                setTotalWorkHours(todayRecord.workHours);
                if (todayRecord.workLogs && todayRecord.workLogs.length > 0) {
                    setWorkLogs(todayRecord.workLogs);
                }
            }
        } else {
            setStatus('CLOCKED_OUT');
            setCurrentRecordId(null);
            setSessionSeconds(0);
        }
    }, [todayRecord, todayLoading]);

    // Snapshot refs for unmount save
    const workLogsRef = useRef(workLogs);
    const statusRef = useRef(status);
    const currentRecordIdRef = useRef(currentRecordId);

    useEffect(() => {
        workLogsRef.current = workLogs;
        statusRef.current = status;
        currentRecordIdRef.current = currentRecordId;
    }, [workLogs, status, currentRecordId]);

    // Save on Unmount if clocked in
    useEffect(() => {
        return () => {
            if (statusRef.current === 'CLOCKED_IN' && currentRecordIdRef.current) {
                AuthService.updateAttendance(currentRecordIdRef.current, { workLogs: workLogsRef.current }).catch(console.error);
            }
        };
    }, []);

    // Timer & Late Check (10:15 AM Nepal time)
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            // A1 / Nepal timezone calculation: 10:15 AM
            const nepalOffsetMs = (5 * 60 + 45) * 60 * 1000;
            const nepalTime = new Date(now.getTime() + nepalOffsetMs);
            const nepalHour = nepalTime.getUTCHours();
            const nepalMinute = nepalTime.getUTCMinutes();
            const isAfterLateCutoff = nepalHour > 10 || (nepalHour === 10 && nepalMinute > 15);
            setIsLate(isAfterLateCutoff);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Auto-save Work Logs (D1 & S6 Fix: Store drafts in localStorage; debounce only to active record without audit log)
    useEffect(() => {
        if (!user?.uid) return;

        const timeoutId = setTimeout(async () => {
            if (status === 'CLOCKED_IN' && currentRecordId) {
                setIsSyncingLogs(true);
                try {
                    await AuthService.updateAttendance(currentRecordId, { workLogs });
                } catch (err) {
                    console.error("Auto-save to record failed", err);
                } finally {
                    setIsSyncingLogs(false);
                }
            } else if (status === 'CLOCKED_OUT') {
                // Save locally to browser only - NO Firestore user profile writes or audit storm!
                try {
                    localStorage.setItem(`rsa_draft_worklogs_${user.uid}`, JSON.stringify(workLogs));
                } catch (e) {
                    console.warn("Could not save worklogs draft locally", e);
                }
            }
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [workLogs, status, currentRecordId, user?.uid]);

    const handleClockIn = async () => {
        if (!user || loading) return;
        if (isLate && !lateReason.trim()) {
            toast.error("Please provide a reason for late arrival");
            return;
        }

        if (checkInType === 'CLIENT_SITE' && !selectedSiteClientId) {
            toast.error("Please select the client for your site visit");
            return;
        }

        // Guard: block clock-in if today's record is ON LEAVE
        if (todayRecord && todayRecord.status === 'ON LEAVE') {
            toast.error("You have approved leave for today. Contact admin to override.");
            return;
        }

        try {
            await clockInMutation.mutateAsync({
                userId: user.uid,
                method: 'WEB',
                notes: isLate ? `Late: ${lateReason.trim()}` : '',
                workLogs,
                checkInType,
                clientAtCheckIn: checkInType === 'CLIENT_SITE' ? selectedSiteClientId : undefined,
                clientIds: checkInType === 'CLIENT_SITE' && selectedSiteClientId ? [selectedSiteClientId] : []
            });

            // Clear draft from localStorage
            try {
                localStorage.removeItem(`rsa_draft_worklogs_${user.uid}`);
            } catch (e) {
                // ignore
            }
        } catch (error) {
            console.error("Clock in failed", error);
        }
    };

    const handleOpenClockOutModal = () => {
        setShowDailyReportModal(true);
    };

    const handleConfirmClockOut = async () => {
        if (!user || !currentRecordId || loading) return;

        // A4: Validate timesheet / work logs
        const hasWorkLogs = workLogs.some(l => l.description.trim().length > 0 || l.duration > 0);
        if (!hasWorkLogs && !dailyReport.done.trim()) {
            toast.error("Please provide either your work log details or Daily Report summary before clocking out.");
            return;
        }

        try {
            await clockOutMutation.mutateAsync({
                userId: user.uid,
                recordId: currentRecordId,
                workLogs,
                dailyReport: {
                    done: dailyReport.done.trim() || 'Completed daily assigned tasks.',
                    pending: dailyReport.pending.trim() || 'None',
                    blockers: dailyReport.blockers.trim() || 'None',
                    tomorrow: dailyReport.tomorrow.trim() || 'Continue active assignments.'
                }
            });
            setShowDailyReportModal(false);
            setSessionSeconds(0);
        } catch (error) {
            console.error("Clock out failed", error);
        }
    };

    const addLog = () => {
        setWorkLogs([...workLogs, {
            id: Math.random().toString(36).substr(2, 9),
            clientId: 'INTERNAL',
            clientName: 'Internal Work / Office',
            natureOfAssignment: NATURE_OF_ASSIGNMENTS[0],
            description: '',
            duration: 0,
            billable: true,
            locationTag: checkInType === 'CLIENT_SITE' ? 'Client Premises' : 'Office'
        }]);
    };

    const removeLog = (id: string) => {
        if (workLogs.length > 1) {
            setWorkLogs(workLogs.filter(l => l.id !== id));
        }
    };

    const updateLog = (id: string, field: string, value: any) => {
        setWorkLogs(workLogs.map(l => {
            if (l.id === id) {
                const updated = { ...l, [field]: value };
                if (field === 'clientId') {
                    const client = clients.find(c => c.id === value);
                    if (client) {
                        updated.clientName = client.name;
                        updated.locationTag = client.id === 'INTERNAL' ? 'Office' : 'Client Premises';
                    }
                }
                return updated;
            }
            return l;
        }));
    };

    // Floating Widget Render
    if (isFloating) {
        return (
            <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-md border border-brand-100 dark:border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4 w-auto min-w-[280px]">
                    <div className={`p-2 rounded-xl ${status === 'CLOCKED_IN' ? 'bg-green-500/20 text-green-600 dark:text-green-400 animate-pulse' :
                        status === 'COMPLETED' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                        <Clock size={20} />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-slate-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                                {status === 'CLOCKED_IN' ? 'Active Session' : 'Attendance'}
                            </p>
                            <button onClick={() => setIsFloating(false)} className="text-slate-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-white transition-colors">
                                <Maximize2 size={14} />
                            </button>
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                                {status === 'CLOCKED_IN' ? (
                                    <SessionTimer initialSeconds={sessionSeconds} isRunning={true} />
                                ) : (
                                    <p>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {status === 'CLOCKED_IN' && (
                        <button
                            onClick={() => setIsFloating(false)}
                            className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-gray-300 transition-colors"
                            title="Expand to manage"
                        >
                            <ChevronUp size={18} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full rounded-2xl z-[20] border transition-all duration-200 shadow-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            {/* Left accent stripe */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ background: 'var(--accent)', opacity: 0.9 }}></div>
            
            {/* Top Bar */}
            <div className="p-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 border-b border-[var(--border)]">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Clock className="text-brand-500 dark:text-brand-400" size={20} />
                            Attendance Center
                        </h2>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
                            status === 'CLOCKED_IN' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400' :
                            status === 'COMPLETED' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400' :
                            'bg-slate-100 border-slate-200 text-slate-600 dark:bg-gray-500/10 dark:border-gray-500/20 dark:text-gray-400'
                        }`}>
                            {isSyncingLogs && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse mr-1.5" />}
                            {status === 'CLOCKED_IN' ? 'Active Session' : status === 'COMPLETED' ? 'Shift Completed' : 'Not Started'}
                        </span>

                        {!isOnline && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                                <WifiOff size={11} /> Offline — Saved Locally
                            </span>
                        )}
                    </div>

                    {/* A1: Late marks indicator for current Bikram Sambat month */}
                    {lateStats && (
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Late marks this BS month:
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                lateStats.count >= 6 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' :
                                lateStats.count >= 4 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
                                'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                            }`}>
                                {lateStats.count} of 6 {lateStats.justifiedCount > 0 && `(${lateStats.justifiedCount} justified)`}
                            </span>
                            {lateStats.count >= 6 && (
                                <span className="text-[10px] text-rose-500 font-bold">
                                    • 1 leave deduction threshold reached
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Side: Timer & Controls */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <button
                        onClick={() => setIsFloating(true)}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-brand-700 dark:hover:text-white transition-all border border-slate-200 dark:border-transparent cursor-pointer"
                        title="Minimize to floating widget"
                    >
                        <Minimize2 size={16} />
                    </button>

                    {status === 'CLOCKED_IN' && (
                        <div className="bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 rounded-xl px-4 py-2 text-center min-w-[130px]">
                            <p className="text-[9px] text-brand-600 dark:text-brand-400 uppercase tracking-widest font-black">Session Timer</p>
                            <SessionTimer initialSeconds={sessionSeconds} isRunning={true} />
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-6">
                {/* Time Stats Bar */}
                {(status === 'CLOCKED_IN' || status === 'COMPLETED') && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Clocked In Card */}
                        <div className="bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                                <Timer size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400 font-black uppercase tracking-widest">Clocked In</p>
                                <p className="text-base font-black text-slate-900 dark:text-white">
                                    {formatToAMPM(clockInTime)}
                                </p>
                            </div>
                        </div>

                        {/* Clocked Out / Status Card */}
                        <div className={`bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 flex items-center gap-3.5 shadow-sm ${status === 'CLOCKED_IN' ? 'border-l-4 border-l-brand-500/60' : 'border-l-4 border-l-rose-500/60'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status === 'CLOCKED_IN' ? 'bg-brand-500/10 text-brand-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {status === 'CLOCKED_IN' ? <Activity size={18} className="animate-pulse" /> : <Square size={16} className="fill-current" />}
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400 font-black uppercase tracking-widest">
                                    {status === 'CLOCKED_IN' ? 'Status' : 'Clocked Out'}
                                </p>
                                <p className="text-base font-black text-slate-900 dark:text-white">
                                    {status === 'CLOCKED_IN' ? <span className="text-brand-600 dark:text-brand-400">On Duty</span> : formatToAMPM(clockOutTime)}
                                </p>
                            </div>
                        </div>

                        {/* Duration Card */}
                        <div className="bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                <Clock size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400 font-black uppercase tracking-widest">
                                    {status === 'CLOCKED_IN' ? 'Live Progress' : 'Total Duration'}
                                </p>
                                <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                                    {status === 'CLOCKED_IN' ? (
                                        <SessionTimer initialSeconds={sessionSeconds} isRunning={true} className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400" />
                                    ) : (
                                        <span className="text-indigo-600 dark:text-indigo-400">{totalWorkHours ? `${Math.floor(totalWorkHours)}h ${Math.round((totalWorkHours % 1) * 60)}m` : '--'}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pre-Clock-In Controls: Check-In Type & Site Client Selection (A3) */}
                {status === 'CLOCKED_OUT' && (
                    <div className="mb-6 space-y-4 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-5">
                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2.5">
                                Select Today's Work Location
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setCheckInType('OFFICE')}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                        checkInType === 'OFFICE'
                                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-md shadow-[var(--accent-dim)]'
                                            : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[var(--accent)]'
                                    }`}
                                >
                                    <Building2 size={16} /> Office Base
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCheckInType('CLIENT_SITE')}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                        checkInType === 'CLIENT_SITE'
                                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-md shadow-[var(--accent-dim)]'
                                            : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[var(--accent)]'
                                    }`}
                                >
                                    <Briefcase size={16} /> Client Site Visit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCheckInType('REMOTE')}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                        checkInType === 'REMOTE'
                                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-md shadow-[var(--accent-dim)]'
                                            : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[var(--accent)]'
                                    }`}
                                >
                                    <Home size={16} /> Remote / Home
                                </button>
                            </div>
                        </div>

                        {checkInType === 'CLIENT_SITE' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-1.5 pt-2">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    Which Client Are You Visiting Today? *
                                </label>
                                <SearchableClientSelect
                                    clients={clients.filter(c => c.id !== 'INTERNAL')}
                                    value={selectedSiteClientId}
                                    onChange={(val) => setSelectedSiteClientId(val)}
                                    disabled={false}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Late Arrival Alert Card */}
                {isLate && status === 'CLOCKED_OUT' && (
                    <div className="mb-6 bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent border border-amber-200 dark:border-amber-500/30 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                                    Late Arrival Notice (After 10:15 AM)
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                                    As per the RSA Employee Handbook, arrivals after 10:15 AM require a justification note. 6 unjustified late marks in a Bikram Sambat month result in 1 day leave deduction.
                                </p>
                                <input
                                    type="text"
                                    placeholder="Type your late arrival reason..."
                                    value={lateReason}
                                    onChange={(e) => setLateReason(e.target.value)}
                                    className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Clock In Action */}
                {status === 'CLOCKED_OUT' ? (
                    <button
                        onClick={handleClockIn}
                        disabled={loading || (isLate && !lateReason.trim()) || (checkInType === 'CLIENT_SITE' && !selectedSiteClientId)}
                        className="w-full py-4 bg-[var(--accent)] hover:opacity-95 text-white rounded-2xl font-bold shadow-lg shadow-[var(--accent-dim)] transition-all transform active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 min-h-[56px] cursor-pointer"
                    >
                        <div className="flex items-center gap-2.5 uppercase tracking-widest text-sm font-black">
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} className="fill-current" />}
                            Start Work Day
                        </div>
                        <span className="text-[10px] opacity-75 font-medium lowercase">
                            {checkInType === 'CLIENT_SITE' ? 'Checking in at client premises' : checkInType === 'REMOTE' ? 'Checking in remotely' : 'Checking in at Kathmandu office'}
                        </span>
                    </button>
                ) : (
                    <div className="space-y-6">
                        {/* Work Logs Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-slate-800 dark:text-white text-sm font-bold flex items-center gap-2">
                                    <Briefcase size={16} className="text-brand-600 dark:text-brand-400" />
                                    Today's Work Breakdown
                                </h3>
                                {status !== 'COMPLETED' && (
                                    <button 
                                        onClick={addLog} 
                                        className="text-xs text-brand-700 dark:text-brand-400 hover:text-brand-800 flex items-center gap-1 font-bold bg-brand-50 dark:bg-brand-500/10 px-3 py-1.5 rounded-lg border border-brand-200 dark:border-brand-500/20 cursor-pointer"
                                    >
                                        <Plus size={13} /> Add Assignment
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {workLogs.map((log, index) => (
                                    <div key={log.id} style={{ zIndex: 50 - index }} className="relative bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Client / Engagement</label>
                                                <SearchableClientSelect
                                                    clients={clients}
                                                    value={log.clientId}
                                                    onChange={(val) => updateLog(log.id, 'clientId', val)}
                                                    disabled={status === 'COMPLETED'}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Nature of Engagement</label>
                                                <SearchableSelect
                                                    items={NATURE_OF_ASSIGNMENTS.map(n => ({ id: n, name: n, icon: <Briefcase size={12}/> }))}
                                                    value={log.natureOfAssignment || NATURE_OF_ASSIGNMENTS[0]}
                                                    onChange={(val) => updateLog(log.id, 'natureOfAssignment', val)}
                                                    disabled={status === 'COMPLETED'}
                                                    placeholder="Select Assignment..."
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-3">
                                            <div className="w-full md:w-1/4 space-y-1">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Location</label>
                                                <SearchableSelect
                                                    items={[
                                                        { id: 'Office', name: 'Office', icon: <Building2 size={12}/> },
                                                        { id: 'Client Premises', name: 'Client Premises', icon: <MapPin size={12}/> }
                                                    ]}
                                                    value={log.locationTag || 'Office'}
                                                    onChange={(val) => updateLog(log.id, 'locationTag', val)}
                                                    disabled={status === 'COMPLETED'}
                                                    placeholder="Select Location"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between pl-1">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                        Work Description & Deliverables
                                                    </label>
                                                    {status !== 'COMPLETED' && workLogs.length > 1 && (
                                                        <button
                                                            onClick={() => removeLog(log.id)}
                                                            className="text-rose-500 hover:text-rose-600 font-bold transition-all flex items-center gap-1 text-[10px] cursor-pointer"
                                                            title="Remove Row"
                                                        >
                                                            <Trash2 size={12} /> Delete
                                                        </button>
                                                    )}
                                                </div>
                                                <ActionDetailEditor
                                                    value={log.description}
                                                    onChange={(val) => updateLog(log.id, 'description', val)}
                                                    disabled={status === 'COMPLETED'}
                                                    placeholder="Describe tasks completed, audit areas tested, or client matters addressed..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Clock Out Trigger */}
                        {status === 'CLOCKED_IN' && (
                            <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                                <button
                                    onClick={handleOpenClockOutModal}
                                    disabled={loading}
                                    className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[50px]"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Square className="fill-current" size={16} />}
                                    Clock Out & Submit Daily Report
                                </button>
                            </div>
                        )}

                        {status === 'COMPLETED' && (
                            <div className="mt-4 bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center text-white mb-3 shadow-md">
                                    <CheckCircle2 size={24} />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Shift Completed</h3>
                                <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">
                                    Your work logs and arrival/departure times have been saved.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* A4: Mandatory Handbook Daily Report Modal on Clock Out */}
            {showDailyReportModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-white/[0.02]">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Send size={16} className="text-[var(--accent)]" />
                                    Daily Checkout & EOD Report
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    RSA Employee Handbook requirement before clocking out
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDailyReportModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    1. Work Done Today *
                                </label>
                                <textarea
                                    value={dailyReport.done}
                                    onChange={e => setDailyReport({ ...dailyReport, done: e.target.value })}
                                    placeholder="Summary of completed tasks, vouchers checked, reports drafted..."
                                    className="w-full h-20 p-3 text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[var(--accent)] transition-all resize-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    2. Pending / In Progress
                                </label>
                                <textarea
                                    value={dailyReport.pending}
                                    onChange={e => setDailyReport({ ...dailyReport, pending: e.target.value })}
                                    placeholder="Tasks currently open or pending client feedback..."
                                    className="w-full h-16 p-3 text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[var(--accent)] transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        3. Blockers / Issues
                                    </label>
                                    <input
                                        type="text"
                                        value={dailyReport.blockers}
                                        onChange={e => setDailyReport({ ...dailyReport, blockers: e.target.value })}
                                        placeholder="Any client or technical delays..."
                                        className="w-full p-2.5 text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[var(--accent)]"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        4. Tomorrow's Plan
                                    </label>
                                    <input
                                        type="text"
                                        value={dailyReport.tomorrow}
                                        onChange={e => setDailyReport({ ...dailyReport, tomorrow: e.target.value })}
                                        placeholder="Main priorities for tomorrow..."
                                        className="w-full p-2.5 text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-[var(--accent)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                            <button
                                type="button"
                                onClick={() => setShowDailyReportModal(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
                            >
                                Back to Editing
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmClockOut}
                                disabled={loading}
                                className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={14} /> : <Square size={14} className="fill-current" />}
                                Confirm Clock Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceWidget;
