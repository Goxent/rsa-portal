
import React, { useState, useEffect } from 'react';
import { Play, Square, Timer, AlertTriangle, AlertOctagon, Check, X, Clock, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AttendanceRecord, Client, UserRole } from '../../types';
import { AuthService } from '../../services/firebase';
import NepaliDate from 'nepali-date-converter';

interface AttendanceWidgetProps {
    // Add props if needed, but it self-manages mostly
}

const AttendanceWidget: React.FC<AttendanceWidgetProps> = () => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [status, setStatus] = useState<'CLOCKED_OUT' | 'CLOCKED_IN'>('CLOCKED_OUT');
    const [sessionTime, setSessionTime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [clientsList, setClientsList] = useState<Client[]>([]);

    // Late Logic
    const [lateCount, setLateCount] = useState(0);
    const [lateReason, setLateReason] = useState('');
    const [isLateEntry, setIsLateEntry] = useState(false);

    // Work Log State
    const [workLogs, setWorkLogs] = useState<{ id: string; clientId: string; clientName: string; description: string; duration: number; billable: boolean }[]>([
        { id: '1', clientId: 'INTERNAL', clientName: 'Internal / Office', description: '', duration: 0, billable: false }
    ]);
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);
            // Check Late Condition: After 10:15 AM
            const officeLimit = new Date();
            officeLimit.setHours(10, 15, 0);
            if (now > officeLimit && status === 'CLOCKED_OUT') {
                setIsLateEntry(true);
            } else {
                setIsLateEntry(false);
            }
        }, 1000);

        if (user) {
            loadData();
        }

        return () => clearInterval(timer);
    }, [user]);

    useEffect(() => {
        let sessionTimer: any;
        if (status === 'CLOCKED_IN') {
            sessionTimer = setInterval(() => setSessionTime(prev => prev + 1), 1000);
        }
        return () => clearInterval(sessionTimer);
    }, [status]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const fetchId = user.uid;

            const [cList, attHistory, lCount] = await Promise.all([
                AuthService.getAllClients(),
                AuthService.getAttendanceHistory(fetchId),
                AuthService.getLateCountLast30Days(user.uid)
            ]);

            // Inject Internal
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

            // Check Today
            const todayStr = new Date().toLocaleDateString('en-CA');
            const todayRecord = attHistory.find(r => r.userId === user?.uid && r.date === todayStr);

            if (todayRecord) {
                if (!todayRecord.clockOut) {
                    setStatus('CLOCKED_IN');
                    setCurrentRecordId(todayRecord.id);
                    const [h, m, s] = todayRecord.clockIn.split(':').map(Number);
                    const startTime = new Date();
                    startTime.setHours(h, m, s || 0, 0);
                    const diff = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
                    setSessionTime(diff > 0 ? diff : 0);

                    // Restore logs if any (optional, but good UX)
                    if (todayRecord.workLogs && todayRecord.workLogs.length > 0) {
                        setWorkLogs(todayRecord.workLogs);
                    }
                } else {
                    setStatus('CLOCKED_OUT');
                    setCurrentRecordId(todayRecord.id);
                }
            } else {
                setStatus('CLOCKED_OUT');
                setCurrentRecordId(null);
                setSessionTime(0);
            }

        } catch (error) {
            console.error(error);
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
        if (loading) return;
        const todayStr = new Date().toLocaleDateString('en-CA');
        const existingRec = history.find(r => r.userId === user?.uid && r.date === todayStr);

        if (existingRec) {
            if (existingRec.clockOut) {
                alert("⛔ Access Denied: You have already completed your attendance for today.");
                return;
            } else {
                alert("⚠️ Session Restored: You are already clocked in.");
                loadData();
                return;
            }
        }

        if (isLateEntry && !lateReason.trim()) {
            alert("Please provide a reason for being late.");
            return;
        }

        setLoading(true);
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

            const newRecord: AttendanceRecord = {
                id: 'temp_id',
                userId: user?.uid || '',
                userName: user?.displayName || 'User',
                date: todayStr,
                clockIn: timeStr,
                status: isLateEntry ? 'LATE' : 'PRESENT',
                notes: isLateEntry ? `Late Reason: ${lateReason}` : '',
                workHours: 0
            };

            await AuthService.recordAttendance(newRecord);
            // Success
        } catch (error: any) {
            // If error occurred (even if we suppressed it in service, net errors might exist)
            // But specifically if it was "already recorded", we just need to reload.
            console.error("Clock In Error (Recoverable):", error);
        } finally {
            await loadData(); // Always reload to ensure state sync
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (loading) return;

        // Simplify Log Validation: Must have at least one valid
        const validLogs = workLogs.filter(l => l.clientId && l.description);
        if (validLogs.length === 0) {
            alert("⚠️ Please add at least one valid Work Log before clocking out.");
            return;
        }

        setLoading(true);
        try {
            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA');
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

            const clientIds = Array.from(new Set(validLogs.map(l => l.clientId)));
            const clientNames = validLogs.map(l => {
                const c = clientsList.find(cl => cl.id === l.clientId);
                return c ? c.name : 'Unknown';
            }).join(', ');

            const combinedDesc = validLogs.map(l => `${l.clientId ? clientsList.find(c => c.id === l.clientId)?.name : '?'}: ${l.description}`).join('\n');

            const record: AttendanceRecord = {
                id: currentRecordId || '',
                userId: user?.uid || '',
                userName: user?.displayName || 'User',
                date: todayStr,
                clockIn: 'KEEP_EXISTING',
                clockOut: timeStr,
                workHours: Number((sessionTime / 3600).toFixed(2)),
                status: isLateEntry ? 'LATE' : 'PRESENT',
                clientIds: clientIds,
                clientName: clientNames || 'Internal',
                workDescription: combinedDesc,
                workLogs: validLogs,
                notes: lateReason ? `Late Reason: ${lateReason}` : ''
            };

            // Re-find original clockIn to prevent overwrite safety
            const originalRec = history.find(r => r.id === currentRecordId || (r.userId === user?.uid && r.date === todayStr));
            if (originalRec) {
                record.clockIn = originalRec.clockIn;
            } else {
                record.clockIn = new Date(now.getTime() - sessionTime * 1000).toLocaleTimeString('en-US', { hour12: false });
            }

            await AuthService.recordAttendance(record);
            setStatus('CLOCKED_OUT');
            setCurrentRecordId(null);
            setWorkLogs([{ id: '1', clientId: 'INTERNAL', description: '', duration: 0, billable: false }]);
            setLateReason('');
            await loadData();

        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    // UI Helpers
    const addLog = () => {
        setWorkLogs([...workLogs, { id: Date.now().toString(), clientId: '', clientName: '', description: '', duration: 0, billable: true }]);
    };

    const removeLog = (id: string) => {
        if (workLogs.length > 1) {
            setWorkLogs(workLogs.filter(l => l.id !== id));
        }
    };

    const updateLog = (id: string, field: string, value: any) => {
        setWorkLogs(workLogs.map(l => {
            if (l.id !== id) return l;
            const updated = { ...l, [field]: value };
            if (field === 'clientId') {
                const client = clientsList.find(c => c.id === value);
                updated.clientName = client ? client.name : 'Unknown';
            }
            return updated;
        }));
    };

    return (
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group shadow-2xl border border-white/10 bg-gradient-to-br from-navy-900/90 to-navy-800/90 hover:border-brand-500/30 transition-all duration-500 animate-in fade-in zoom-in-95 duration-500">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-center">

                {/* Left Side: Clock & Status */}
                <div className="flex-1 space-y-6 w-full">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <div className="p-2.5 bg-brand-500/20 rounded-xl border border-brand-500/20 shadow-inner">
                                <Clock className="text-brand-400" size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Time Tracker</h2>
                                <p className="text-xs text-brand-200/60 font-mono tracking-wider uppercase">
                                    {new NepaliDate().format('DD MMMM YYYY')}
                                </p>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center shadow-lg backdrop-blur-md transition-colors duration-500 ${status === 'CLOCKED_IN'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
                            : 'bg-gray-700/30 border-gray-600/30 text-gray-400'
                            }`}>
                            <span className={`w-2 h-2 rounded-full mr-2 ${status === 'CLOCKED_IN' ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-gray-500'}`}></span>
                            {status === 'CLOCKED_IN' ? 'ACTIVE' : 'OFFLINE'}
                        </div>
                    </div>

                    {/* Main Clock */}
                    <div className="text-center py-4 relative group-hover:scale-[1.02] transition-transform duration-500">
                        <div className="text-6xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-brand-200 drop-shadow-2xl">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {isLateEntry && status === 'CLOCKED_OUT' && (
                            <div className="absolute top-0 right-0 left-0 flex justify-center -mt-4 animate-bounce">
                                <span className="text-orange-400 text-[10px] font-bold tracking-widest bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full flex items-center shadow-lg shadow-orange-500/10">
                                    <AlertTriangle size={12} className="mr-1.5" /> LATE ARRIVAL
                                </span>
                            </div>
                        )}
                        <div className="text-sm font-medium text-brand-300/40 mt-1 flex items-center justify-center gap-2">
                            <Timer size={14} />
                            <span>Session: <span className={`font-mono ${status === 'CLOCKED_IN' ? 'text-emerald-400' : 'text-gray-500'}`}>{formatDuration(sessionTime)}</span></span>
                        </div>
                    </div>

                    {/* Late Reason Input */}
                    {isLateEntry && status === 'CLOCKED_OUT' && (
                        <div className="animate-in fade-in slide-in-from-top-2 bg-orange-500/5 p-3 rounded-xl border border-orange-500/20">
                            <label className="text-xs text-orange-300/80 mb-1.5 block ml-1 font-semibold">Reason for Late Arrival</label>
                            <input
                                type="text"
                                value={lateReason}
                                onChange={(e) => setLateReason(e.target.value)}
                                placeholder="e.g., Heavy Traffic, Weather..."
                                className="w-full bg-black/20 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-orange-100 placeholder-orange-500/30 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
                            />
                        </div>
                    )}
                </div>

                {/* Right Side: Actions & Logs */}
                <div className="flex-1 flex flex-col justify-center space-y-4 w-full border-t lg:border-t-0 lg:border-l border-white/5 pt-6 lg:pt-0 lg:pl-8">

                    {status === 'CLOCKED_OUT' ? (
                        <button
                            onClick={handleClockIn}
                            disabled={loading || (isLateEntry && !lateReason)}
                            className={`
                                relative overflow-hidden w-full p-6 rounded-2xl shadow-xl transition-all duration-300 group
                                ${isLateEntry && !lateReason ? 'bg-gray-800 opacity-50 cursor-not-allowed' : 'bg-gradient-to-br from-emerald-600 to-teal-800 hover:shadow-emerald-500/20 hover:-translate-y-1 active:scale-95 border border-emerald-500/30'}
                            `}
                        >
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                            <div className="relative z-10 flex items-center justify-center">
                                <div className="p-3 bg-white/20 rounded-full mr-4 group-hover:scale-110 transition-transform duration-300 backdrop-blur-sm">
                                    <Play className="fill-white text-white" size={24} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-xl text-white tracking-wide">Clock In</div>
                                    <div className="text-xs text-emerald-100/80 font-medium">Start Session</div>
                                </div>
                            </div>
                        </button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 w-full">
                            {/* Work Log Form */}
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5 shadow-inner">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-bold text-brand-200 uppercase tracking-wider flex items-center gap-2">
                                        <Briefcase size={12} />
                                        Current Activity
                                    </h3>
                                    <button onClick={addLog} className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-1 rounded hover:bg-brand-500/30 transition-colors border border-brand-500/10">+ Add</button>
                                </div>

                                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                                    {workLogs.map((log, index) => (
                                        <div key={log.id} className="space-y-2 bg-white/5 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <select
                                                        value={log.clientId}
                                                        onChange={(e) => updateLog(log.id, 'clientId', e.target.value)}
                                                        className="w-full bg-black/40 text-xs text-white px-2 py-1.5 rounded border border-white/10 focus:border-brand-500/50 outline-none appearance-none"
                                                    >
                                                        <option value="" disabled>Select Client...</option>
                                                        {clientsList.map(client => (
                                                            <option key={client.id} value={client.id}>{client.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {workLogs.length > 1 && (
                                                    <button onClick={() => removeLog(log.id)} className="text-gray-500 hover:text-red-400 px-1">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                value={log.description}
                                                onChange={(e) => updateLog(log.id, 'description', e.target.value)}
                                                placeholder="Task description..."
                                                className="w-full bg-black/20 text-xs text-white px-2 py-1.5 rounded border border-white/10 focus:border-brand-500/50 outline-none placeholder-gray-600"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleClockOut}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-rose-600 to-red-800 hover:from-rose-500 hover:to-red-700 text-white p-4 rounded-xl shadow-lg shadow-rose-900/20 transform transition-all active:scale-95 border border-rose-500/30 flex items-center justify-center group"
                            >
                                <Square className="mr-3 fill-white/80 group-hover:fill-white transition-colors" size={20} />
                                <span className="font-bold text-lg tracking-wide">Clock Out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceWidget;
