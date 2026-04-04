
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Square, Timer, AlertTriangle, Check, X, Clock, Briefcase, Plus, Trash2, Calendar, Coffee, Search, ChevronDown, Minimize2, Maximize2, ChevronUp, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AttendanceRecord, Client, UserRole, WorkLog } from '../../types';
import { AuthService } from '../../services/firebase';
import { NATURE_OF_ASSIGNMENTS } from '../../constants/firmData';
import NepaliDate from 'nepali-date-converter';
import { toast } from 'react-hot-toast';
import SearchableClientSelect from './SearchableClientSelect';
import EmptyState from '../common/EmptyState';
import { useAttendanceHistory, useClockIn, useClockOut } from '../../hooks/useAttendance';
import { useClients } from '../../hooks/useClients';

// SearchableClientSelect moved to standalone component file

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
    const [workLogs, setWorkLogs] = useState<WorkLog[]>([
        { id: Math.random().toString(36).substr(2, 9), clientId: 'INTERNAL', clientName: 'Internal Work / Office', natureOfAssignment: 'Internal Audit', description: '', duration: 0, billable: true }
    ]);

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

    // Session Timer
    useEffect(() => {
        let interval: any;
        if (status === 'CLOCKED_IN') {
            interval = setInterval(() => setSessionSeconds(s => s + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [status]);

    // Auto-save Work Logs when clocked in
    useEffect(() => {
        if (status === 'CLOCKED_IN' && currentRecordId) {
            const timeoutId = setTimeout(() => {
                AuthService.updateAttendance(currentRecordId, { workLogs }).catch(err => {
                    console.error("Auto-save failed", err);
                });
            }, 1000); // 1s debounce
            return () => clearTimeout(timeoutId);
        }
    }, [workLogs, status, currentRecordId]);

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

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
                notes: isLate ? `Late: ${lateReason}` : ''
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
            billable: true
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
                    if (client) updated.clientName = client.name;
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
                            <p className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                                {status === 'CLOCKED_IN' ? formatTime(sessionSeconds) : currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
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
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3 min-w-[140px] text-center animate-pulse-slow shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400/80 uppercase tracking-widest font-bold mb-1">Session Timer</p>
                            <p className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400 leading-none drop-shadow-sm">
                                {formatTime(sessionSeconds)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-6 relative z-10">
                {/* Late Arrival Input */}
                {isLate && status === 'CLOCKED_OUT' && (
                    <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <h3 className="text-amber-700 dark:text-amber-400 font-bold text-sm mb-1">Late Arrival Detected</h3>
                            <p className="text-amber-600/70 dark:text-amber-200/70 text-xs mb-3">You are checking in after 10:15 AM. Please provide a reason.</p>
                            <input
                                type="text"
                                placeholder="Reason for late arrival..."
                                value={lateReason}
                                onChange={(e) => setLateReason(e.target.value)}
                                className="w-full bg-amber-50 dark:bg-black/20 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white placeholder-amber-500/40 focus:outline-none focus:border-amber-400"
                            />
                        </div>
                    </div>
                )}

                {/* Clock In / Out Actions */}
                {status === 'CLOCKED_OUT' ? (
                    <button
                        onClick={handleClockIn}
                        disabled={loading || (isLate && !lateReason)}
                        className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-xl font-bold shadow-lg shadow-black/10 dark:shadow-white/10 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                        {loading ? <Loader2 className="animate-spin text-brand-500" /> : <Play size={18} className="fill-current text-brand-500 dark:text-brand-600" />}
                        Start Work Day
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

                            <div className="space-y-2">
                                {workLogs.map((log, index) => (
                                    <div key={log.id} style={{ zIndex: 50 - index }} className="relative bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl p-3 flex flex-col xl:flex-row gap-3 group hover:border-brand-300 dark:hover:border-white/10 transition-colors">
                                        {/* Client Select */}
                                        <div className="w-full xl:w-1/4 min-w-[140px]">
                                            <SearchableClientSelect
                                                clients={clients}
                                                value={log.clientId}
                                                onChange={(val) => updateLog(log.id, 'clientId', val)}
                                                disabled={status === 'COMPLETED'}
                                            />
                                        </div>

                                        {/* Nature of Assignment */}
                                        <div className="w-full xl:w-1/4">
                                            <select
                                                value={log.natureOfAssignment || NATURE_OF_ASSIGNMENTS[0]}
                                                onChange={(e) => updateLog(log.id, 'natureOfAssignment', e.target.value)}
                                                disabled={status === 'COMPLETED'}
                                                className="w-full bg-white dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-[11px] text-slate-800 dark:text-white focus:outline-none focus:border-brand-400 dark:focus:border-brand-500/50 focus:bg-brand-50 dark:focus:bg-brand-500/5 transition-all h-[38px] appearance-none"
                                            >
                                                {NATURE_OF_ASSIGNMENTS.map(n => (
                                                    <option key={n} value={n} className="dark:bg-[#0d1526]">{n}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Description */}
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={log.description}
                                                onChange={(e) => updateLog(log.id, 'description', e.target.value)}
                                                placeholder="What did you do?"
                                                disabled={status === 'COMPLETED'}
                                                className="w-full bg-white dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-[11px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-brand-400 dark:focus:border-brand-500/50 focus:bg-brand-50 dark:focus:bg-brand-500/5 transition-all h-[38px]"
                                            />
                                        </div>

                                        {/* Actions */}
                                        {status !== 'COMPLETED' && workLogs.length > 1 && (
                                            <button
                                                onClick={() => removeLog(log.id)}
                                                className="p-2 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all h-[38px] w-[38px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Clock Out Button */}
                        {status === 'CLOCKED_IN' && (
                            <div className="pt-4 border-t border-slate-200/50 dark:border-white/[0.05]">
                                <button
                                    onClick={handleClockOut}
                                    disabled={loading}
                                    className="w-full py-3.5 glass-panel hover-lift border border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50 text-rose-600 dark:text-rose-400 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group shadow-sm text-sm"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Square className="fill-current" size={18} />}
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
