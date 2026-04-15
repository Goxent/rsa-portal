import React, { useState, useEffect, useRef } from 'react';
import { 
    MapPin, Clock, Calendar, ChevronRight, 
    Play, Square, Plus, Trash2, Save, 
    Cloud, CheckCircle2, AlertTriangle, 
    ListFilter, Activity, Timer, Minimize2, 
    Maximize2, Briefcase, Building2, Loader2, 
    ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClockIn, useClockOut, useAttendanceHistory } from '../../hooks/useAttendance';
import { useClients } from '../../hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';
import { Client, WorkLog } from '../../types';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import NepaliDate from 'nepali-date-converter';
import { toBS } from '../../utils/dates';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableSelect from '../common/SearchableSelect';
import ActionDetailEditor from '../common/ActionDetailEditor';

// Timer Component to prevent full AttendanceWidget re-renders
const SessionTimer = React.memo(({ initialSeconds, isRunning }: { initialSeconds: number, isRunning: boolean }) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const lastInitialSeconds = useRef(initialSeconds);

    // Sync if initialSeconds changes significantly (e.g. on mount/sync)
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
        <p className="text-xl font-mono font-bold text-brand-600 dark:text-brand-400 leading-none drop-shadow-sm transition-all duration-300">
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

    // React Query Hooks
    const { data: clientsList = [] } = useClients();
    const { data: attendanceHistory = [], isLoading: historyLoading } = useAttendanceHistory(user?.uid);
    const clockInMutation = useClockIn();
    const clockOutMutation = useClockOut();
    const queryClient = useQueryClient();

    const loading = historyLoading || clockInMutation.isPending || clockOutMutation.isPending;

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

    // Modernized Work Logs
    const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
    const [isSyncingLogs, setIsSyncingLogs] = useState(false);
    const hasInitializedLogs = useRef(false);

    // Initial log setup from pending OR default
    useEffect(() => {
        if (hasInitializedLogs.current) return;
        
        if (user?.pendingWorkLogs && user.pendingWorkLogs.length > 0) {
            setWorkLogs(user.pendingWorkLogs);
            hasInitializedLogs.current = true;
        } else if (user) {
            setWorkLogs([
                { id: Math.random().toString(36).substr(2, 9), clientId: 'INTERNAL', clientName: 'Internal Work / Office', natureOfAssignment: 'Internal Audit', description: '', duration: 0, billable: true, locationTag: 'Office' }
            ]);
            hasInitializedLogs.current = true;
        }
    }, [user]);

    // Effect: Sync state with fetched history
    useEffect(() => {
        if (!attendanceHistory) return;

        const todayStr = new Date().toLocaleDateString('en-CA');
        const todayRecord = attendanceHistory.find(r => r.date === todayStr);

        if (todayRecord) {
            if (!todayRecord.clockOut) {
                setStatus('CLOCKED_IN');
                setCurrentRecordId(todayRecord.id);

                // Recover session time
                const [h, m, s] = todayRecord.clockIn.split(':').map(Number);
                const start = new Date();
                start.setHours(h, m, s || 0, 0);
                setSessionSeconds(Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / 1000)));

                if (todayRecord.workLogs) setWorkLogs(todayRecord.workLogs);
            } else {
                setStatus('COMPLETED');
                setCurrentRecordId(todayRecord.id);
                if (todayRecord.workLogs) setWorkLogs(todayRecord.workLogs);
            }
        } else {
            setStatus('CLOCKED_OUT');
            setCurrentRecordId(null);
            setSessionSeconds(0);
        }
    }, [attendanceHistory]);

    // Snapshot refs for unmount-save
    const workLogsRef = useRef(workLogs);
    const statusRef = useRef(status);
    const currentRecordIdRef = useRef(currentRecordId);

    useEffect(() => {
        workLogsRef.current = workLogs;
        statusRef.current = status;
        currentRecordIdRef.current = currentRecordId;
    }, [workLogs, status, currentRecordId]);

    // Save on Unmount to prevent data loss if navigating away before debounce fires
    useEffect(() => {
        return () => {
            if (statusRef.current === 'CLOCKED_IN' && currentRecordIdRef.current) {
                AuthService.updateAttendance(currentRecordIdRef.current, { workLogs: workLogsRef.current }).catch(console.error);
                // Invalidate so next time it mounts, it fetches fresh from DB just in case
                queryClient.invalidateQueries({ queryKey: attendanceKeys.history(user?.uid || '') });
            }
        };
    }, [queryClient, user?.uid]);

    // Timer & Late Check
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());

            // Late check (after 10:15 AM)
            const now = new Date();
            const limit = new Date();
            limit.setHours(10, 15, 0, 0);
            setIsLate(now > limit);

        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Auto-save Work Logs (Persistent cross-device)
    useEffect(() => {
        if (!user) return;

        const timeoutId = setTimeout(async () => {
            if (status === 'CLOCKED_IN' && currentRecordId) {
                // Case 1: Active session -> Save to daily record
                try {
                    await AuthService.updateAttendance(currentRecordId, { workLogs });
                    queryClient.setQueryData(attendanceKeys.history(user.uid), (oldData: AttendanceRecord[] | undefined) => {
                        if (!oldData) return oldData;
                        return oldData.map(record => record.id === currentRecordId ? { ...record, workLogs } : record);
                    });
                } catch (err) {
                    console.error("Auto-save to record failed", err);
                }
            } else if (status === 'CLOCKED_OUT') {
                // Case 2: Not clocked in yet -> Save to User Profile
                setIsSyncingLogs(true);
                try {
                    await AuthService.updateUserProfile(user.uid, {
                        pendingWorkLogs: workLogs
                    });
                } catch (err) {
                    console.error("Auto-save to profile failed", err);
                } finally {
                    setIsSyncingLogs(false);
                }
            }
        }, 1500); // 1.5s debounce

        return () => clearTimeout(timeoutId);
    }, [workLogs, status, currentRecordId, queryClient, user]);

    const handleClockIn = async () => {
        if (!user || loading) return;
        if (isLate && !lateReason.trim()) {
            toast.error("Please provide a reason for late arrival");
            return;
        }

        try {
            await clockInMutation.mutateAsync({
                userId: user.uid,
                method: 'WEB',
                notes: isLate ? `Late: ${lateReason}` : '',
                workLogs: workLogs // Migrate current work logs to the record
            });
            // Clear pending logs in profile
            await AuthService.updateUserProfile(user.uid, {
                pendingWorkLogs: []
            });
            // State update handled by useEffect syncing with invalidated query
        } catch (error) {
            console.error("Clock in failed", error);
        }
    };

    const handleClockOut = async () => {
        if (!user || !currentRecordId || loading) return;

        try {
            await clockOutMutation.mutateAsync({
                userId: user.uid,
                recordId: currentRecordId,
                workLogs
            });
            // State update handled by useEffect
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
            natureOfAssignment: 'Internal Audit',
            description: '',
            duration: 0,
            billable: true,
            locationTag: 'Office'
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
                        // Auto-set location based on internal vs client
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
                <div className="bg-white/90 dark:bg-navy-800/90 backdrop-blur-md border border-brand-100 dark:border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4 w-auto min-w-[280px]">
                    {/* Drag Handle / Status Icon */}
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
                            {status === 'CLOCKED_IN' && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Recorded</span>
                            )}
                        </div>
                    </div>

                    {/* Quick Action */}
                    {status === 'CLOCKED_IN' && (
                        <button
                            onClick={() => setIsFloating(false)} // Expand to clock out effectively or add quick clock out here
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
        <div className="relative w-full rounded-2xl glass-panel hover-lift z-[20] border border-brand-100 dark:border-transparent bg-white/50 dark:bg-transparent">
            {/* Subtle top glow line for premium feel */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-200 dark:via-white/10 to-transparent"></div>
            
            {/* Subtle Accent Glow */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-[80px] pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
            </div>
            {/* Header / Top Bar */}
            <div className="p-6 pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Clock className="text-brand-500 dark:text-brand-400" size={20} />
                            Attendance Center
                        </h2>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status === 'CLOCKED_IN' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400' :
                            status === 'COMPLETED' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400' :
                                'bg-slate-100 border-slate-200 text-slate-600 dark:bg-gray-500/10 dark:border-gray-500/20 dark:text-gray-400'
                            }`}>
                             {isSyncingLogs && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse mr-2" title="Saving logs..." />}
                            {status === 'CLOCKED_IN' ? 'Active Session' : status === 'COMPLETED' ? 'Shift Completed' : 'Not Started'}
                        </span>
                    </div>
                </div>

                {/* Right Side: Timer & Controls */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Minimize Button */}
                    <button
                        onClick={() => setIsFloating(true)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-brand-700 dark:hover:text-white transition-all order-last md:order-first border border-slate-200 dark:border-transparent"
                        title="Minimize to floating widget"
                    >
                        <Minimize2 size={18} />
                    </button>



                    {status === 'CLOCKED_IN' && (
                        <div className="bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 rounded-xl p-3 min-w-[140px] text-center animate-pulse-slow shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                            <p className="text-[10px] text-brand-600 dark:text-brand-400/80 uppercase tracking-widest font-bold mb-1">Session Timer</p>
                            <SessionTimer initialSeconds={sessionSeconds} isRunning={true} />
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-6 relative z-10">
                {/* Late Arrival Input */}
                {/* Late Arrival Alert Card */}
                {isLate && status === 'CLOCKED_OUT' && (
                    <div className="mb-6 bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent border border-amber-200 dark:border-amber-500/30 rounded-2xl p-5 shadow-sm overflow-hidden relative group">
                        {/* Decorative glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
                        
                        <div className="flex items-start gap-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <h3 className="text-[14px] font-bold text-slate-900 dark:text-white mb-1">
                                    Late Arrival Detected
                                </h3>
                                <p className="text-[12px] text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                                    You are checking in after 10:15 AM. Please provide a reason to proceed.
                                </p>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Type your reason for late arrival..."
                                        value={lateReason}
                                        onChange={(e) => setLateReason(e.target.value)}
                                        className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all shadow-inner"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clock In / Out Actions */}
                {status === 'CLOCKED_OUT' ? (
                    <button
                        onClick={handleClockIn}
                        disabled={loading || (isLate && !lateReason)}
                        className="w-full py-6 md:py-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-2xl font-black shadow-xl shadow-[var(--accent-dim)] transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 disabled:grayscale disabled:scale-100 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 group relative overflow-hidden"
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                        
                        <div className="flex items-center gap-3 relative z-10 uppercase tracking-[0.2em] text-[15px] md:text-[13px]">
                            {loading ? <Loader2 className="animate-spin" size={24} /> : <Play size={24} className="fill-current group-hover:scale-110 transition-transform md:w-5 md:h-5" />}
                            Start Work Day
                        </div>
                        <span className="text-[10px] md:text-[9px] opacity-60 font-medium lowercase tracking-normal relative z-10 group-disabled:hidden">
                            Click to log your arrival time
                        </span>
                    </button>
                ) : (
                    <div className="space-y-6">
                        {/* Work Logs Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-slate-800 dark:text-white text-sm font-bold flex items-center gap-2">
                                    <Briefcase size={16} className="text-brand-600 dark:text-brand-400" />
                                    Work Logs
                                </h3>
                                {status !== 'COMPLETED' && (
                                    <button onClick={addLog} className="text-xs text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 flex items-center gap-1 font-medium bg-brand-50 dark:bg-brand-500/10 px-2 py-1 rounded-lg border border-brand-200 dark:border-brand-500/20">
                                        <Plus size={12} /> Add Task
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {workLogs.map((log, index) => (
                                    <div key={log.id} style={{ zIndex: 50 - index }} className="relative bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-4 md:p-3 flex flex-col gap-5 md:gap-4 group hover:border-brand-300 dark:hover:border-white/10 transition-colors shadow-sm md:shadow-none">
                                        
                                        {/* Top Row: Client & Assignment */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
                                            <div className="space-y-1.5 md:space-y-1">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Client / Project</label>
                                                <SearchableClientSelect
                                                    clients={clients}
                                                    value={log.clientId}
                                                    onChange={(val) => updateLog(log.id, 'clientId', val)}
                                                    disabled={status === 'COMPLETED'}
                                                />
                                            </div>
                                            <div className="space-y-1.5 md:space-y-1">
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

                                        {/* Bottom Row: Location & Description */}
                                        <div className="flex flex-col md:flex-row gap-4 md:gap-3">
                                            <div className="w-full md:w-1/4 space-y-1.5 md:space-y-1">
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
                                            <div className="flex-1 space-y-1.5 md:space-y-1">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1 flex items-center justify-between">
                                                    Work Description
                                                    {status !== 'COMPLETED' && workLogs.length > 1 && (
                                                        <button
                                                            onClick={() => removeLog(log.id)}
                                                            className="text-rose-500 hover:text-rose-600 font-bold transition-all flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 pr-1"
                                                            title="Remove Task"
                                                        >
                                                            <Trash2 size={12} className="md:w-3 md:h-3" /> <span className="text-[10px] md:text-[8px]">Delete Row</span>
                                                        </button>
                                                    )}
                                                </label>
                                                <ActionDetailEditor
                                                    value={log.description}
                                                    onChange={(val) => updateLog(log.id, 'description', val)}
                                                    disabled={status === 'COMPLETED'}
                                                    placeholder="Describe your work. Use **bold** or bullet points (•)..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>

                         {/* Clock Out Button */}
                        {status === 'CLOCKED_IN' && (
                            <div className="pt-6 md:pt-4 border-t border-slate-200/50 dark:border-white/[0.05]">
                                <button
                                    onClick={handleClockOut}
                                    disabled={loading}
                                    className="w-full py-5 md:py-3.5 glass-panel hover-lift border border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50 text-rose-600 dark:text-rose-400 rounded-2xl md:rounded-xl font-bold transition-all flex items-center justify-center gap-2 group shadow-sm text-base md:text-sm"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Square className="fill-current w-5 h-5 md:w-4.5 md:h-4.5" size={20} />}
                                    Clock Out & Save Logs
                                </button>
                            </div>
                        )}

                        {status === 'COMPLETED' && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                                <p className="text-green-400 font-bold mb-1">Work Day Completed</p>
                                <p className="text-green-400/60 text-xs">Great job! See you tomorrow.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
};

export default AttendanceWidget;

