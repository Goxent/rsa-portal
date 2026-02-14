
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Timer, AlertTriangle, Check, X, Clock, Briefcase, Plus, Trash2, Calendar, Coffee, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AttendanceRecord, Client, UserRole } from '../../types';
import { AuthService } from '../../services/firebase';
import NepaliDate from 'nepali-date-converter';
import { toast } from 'react-hot-toast';

// Internal Searchable Select Component
const SearchableClientSelect = ({
    clients,
    value,
    onChange,
    disabled,
    placeholder = "Select Client"
}: {
    clients: Client[],
    value: string,
    onChange: (val: string) => void,
    disabled: boolean,
    placeholder?: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedClient = clients.find(c => c.id === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="relative flex-1" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-left transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-500/50'}`}
            >
                <span className={selectedClient ? 'text-white' : 'text-gray-500'}>
                    {selectedClient ? selectedClient.name : placeholder}
                </span>
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f172a] border border-white/10 rounded-lg shadow-xl z-50 max-h-60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-white/5 sticky top-0 bg-[#0f172a]">
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full bg-white/5 border border-white/10 rounded-md pl-7 pr-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-brand-500/50 placeholder-gray-600"
                                placeholder="Search clients..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
                        {filteredClients.length > 0 ? (
                            filteredClients.map(client => (
                                <button
                                    key={client.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(client.id);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`w-full text-left px-3 py-2 text-[11px] rounded-md transition-colors flex items-center justify-between group ${value === client.id ? 'bg-brand-600/20 text-brand-300' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span>{client.name}</span>
                                    {value === client.id && <Check size={12} className="text-brand-400" />}
                                </button>
                            ))
                        ) : (
                            <div className="p-3 text-center text-gray-500 text-[10px]">No clients found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const AttendanceWidget: React.FC = () => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [status, setStatus] = useState<'CLOCKED_OUT' | 'CLOCKED_IN' | 'COMPLETED'>('CLOCKED_OUT');
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [lateReason, setLateReason] = useState('');
    const [isLate, setIsLate] = useState(false);
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

    // Modernized Work Logs
    const [workLogs, setWorkLogs] = useState<{ id: string; clientId: string; clientName: string; description: string; duration: number; billable: boolean }[]>([
        { id: Math.random().toString(36).substr(2, 9), clientId: 'INTERNAL', clientName: 'Internal Work / Office', description: '', duration: 0, billable: true }
    ]);

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [cList, history] = await Promise.all([
                AuthService.getAllClients(),
                AuthService.getAttendanceHistory(user.uid)
            ]);

            // Add Internal Option
            const internalClient: Client = {
                id: 'INTERNAL',
                name: 'Internal Work / Office',
                code: 'INT',
                serviceType: 'Internal' as any,
                status: 'Active' as any,
                category: 'A' as any,
                industry: 'Internal' as any
            };
            setClients([internalClient, ...cList.filter(c => c.status === 'Active')]);

            // Find today's record
            const todayStr = new Date().toLocaleDateString('en-CA');
            const todayRecord = history.find(r => r.date === todayStr);

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
                    // Load logs for viewing even if completed
                    if (todayRecord.workLogs) setWorkLogs(todayRecord.workLogs);
                }
            } else {
                setStatus('CLOCKED_OUT');
                setCurrentRecordId(null);
                setSessionSeconds(0);
            }
        } catch (error) {
            console.error("Failed to load attendance data", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
        const timer = setInterval(() => {
            setCurrentTime(new Date());

            // Late check (after 10:15 AM)
            const now = new Date();
            const limit = new Date();
            limit.setHours(10, 15, 0, 0);
            setIsLate(now > limit);

        }, 1000);
        return () => clearInterval(timer);
    }, [loadData]);

    useEffect(() => {
        let interval: any;
        if (status === 'CLOCKED_IN') {
            interval = setInterval(() => setSessionSeconds(s => s + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [status]);

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

        setLoading(true);
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
            const dateStr = now.toLocaleDateString('en-CA');

            const newRecord: AttendanceRecord = {
                id: '', // Generated by Firebase
                userId: user.uid,
                userName: user.displayName || 'Staff',
                date: dateStr,
                clockIn: timeStr,
                status: isLate ? 'LATE' : 'PRESENT',
                notes: isLate ? `Late: ${lateReason}` : '',
                workHours: 0,
                workLogs: []
            };

            await AuthService.recordAttendance(newRecord);
            toast.success("Clocked in successfully!");
            loadData();
        } catch (error: any) {
            toast.error(error.message || "Clock-in failed");
        } finally {
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (!currentRecordId || loading) return;

        // Validation
        const validLogs = workLogs.filter(l => l.clientId && l.description.trim());
        if (validLogs.length === 0) {
            toast.error("Please add at least one work description");
            return;
        }

        setLoading(true);
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
            const hours = Number((sessionSeconds / 3600).toFixed(2));

            const names = validLogs.map(l => clients.find(c => c.id === l.clientId)?.name || 'Unknown').join(', ');
            const desc = validLogs.map(l => `${clients.find(c => c.id === l.clientId)?.name}: ${l.description}`).join('; ');

            const record: AttendanceRecord = {
                id: currentRecordId,
                userId: user?.uid || '',
                userName: user?.displayName || '',
                date: new Date().toLocaleDateString('en-CA'),
                clockIn: 'KEEP_EXISTING',
                clockOut: timeStr,
                workHours: hours,
                status: isLate ? 'LATE' : 'PRESENT',
                clientIds: validLogs.map(l => l.clientId),
                clientName: names,
                workDescription: desc,
                workLogs: validLogs,
                notes: lateReason ? `Late: ${lateReason}` : ''
            };

            await AuthService.recordAttendance(record);
            toast.success("Clocked out successfully!");
            setStatus('CLOCKED_OUT');
            setWorkLogs([{ id: Math.random().toString(36).substr(2, 9), clientId: 'INTERNAL', clientName: 'Internal Work / Office', description: '', duration: 0, billable: true }]);
            setLateReason('');
            loadData();
        } catch (error: any) {
            toast.error(error.message || "Clock-out failed");
        } finally {
            setLoading(false);
        }
    };

    const addLog = () => {
        setWorkLogs([...workLogs, {
            id: Math.random().toString(36).substr(2, 9),
            clientId: '',
            clientName: '',
            description: '',
            duration: 0,
            billable: true
        }]);
    };
    const removeLog = (id: string) => setWorkLogs(workLogs.filter(l => l.id !== id));
    const updateLog = (id: string, field: string, val: any) => {
        setWorkLogs(workLogs.map(l => {
            if (l.id === id) {
                const updated = { ...l, [field]: val };
                if (field === 'clientId') {
                    updated.clientName = clients.find(c => c.id === val)?.name || '';
                }
                return updated;
            }
            return l;
        }));
    };

    return (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-navy-900/80 to-navy-800/80 shadow-2xl relative overflow-hidden group hover:border-brand-500/20 transition-all duration-500">
            {/* Design Elements */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-colors"></div>

            <div className="relative z-10 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-brand-500/20 rounded-lg">
                                <Clock size={20} className="text-brand-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Daily Attendance</h2>
                        </div>
                        <p className="text-xs text-gray-400 font-medium ml-10">
                            {new NepaliDate().format('DD MMMM YYYY')} (BS)
                        </p>
                    </div>

                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 transition-all ${status === 'CLOCKED_IN' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        status === 'COMPLETED' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                            'bg-white/5 border-white/10 text-gray-500'
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${status === 'CLOCKED_IN' ? 'bg-emerald-400 animate-pulse' :
                            status === 'COMPLETED' ? 'bg-blue-400' :
                                'bg-gray-600'
                            }`}></div>
                        {status === 'CLOCKED_IN' ? 'ACTIVE SESSION' : status === 'COMPLETED' ? 'DAILY COMPLETE' : 'NOT STARTED'}
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    {/* Left: Timer & Actions */}
                    <div className="space-y-6">
                        <div className="text-center p-8 bg-black/20 rounded-3xl border border-white/5 shadow-inner relative overflow-hidden">
                            <div className="text-5xl font-mono font-bold text-white mb-2 tracking-tighter">
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex items-center justify-center gap-2 text-brand-300/60 text-xs font-mono">
                                <Timer size={14} />
                                <span>Duration: <span className={status === 'CLOCKED_IN' ? 'text-emerald-400' : ''}>{formatTime(sessionSeconds)}</span></span>
                            </div>

                            {isLate && status === 'CLOCKED_OUT' && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                        <AlertTriangle size={14} className="text-amber-500" />
                                        <input
                                            type="text"
                                            placeholder="Reason for late arrival..."
                                            className="bg-transparent border-none text-[11px] text-amber-200 placeholder-amber-500/50 w-full focus:ring-0"
                                            value={lateReason}
                                            onChange={(e) => setLateReason(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {status === 'COMPLETED' && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl justify-center">
                                        <Check size={14} className="text-emerald-500" />
                                        <span className="text-[11px] text-emerald-200 font-bold">Attendance recorded for today</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {status === 'CLOCKED_OUT' ? (
                            <button
                                onClick={handleClockIn}
                                disabled={loading}
                                className="w-full group/btn relative py-4 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                                <Play size={20} className="fill-white" />
                                <span>Start Working Today</span>
                            </button>
                        ) : status === 'CLOCKED_IN' ? (
                            <button
                                onClick={handleClockOut}
                                disabled={loading}
                                className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
                            >
                                <Square size={20} className="fill-white" />
                                <span>End Work Session</span>
                            </button>
                        ) : (
                            <button
                                disabled
                                className="w-full py-4 bg-gray-600/20 text-gray-500 rounded-2xl font-bold transition-all border border-white/5 flex items-center justify-center gap-3 cursor-not-allowed"
                            >
                                <Check size={20} />
                                <span>Session Finished</span>
                            </button>
                        )}
                    </div>

                    {/* Right: Work Logs */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-xs font-bold text-brand-300 uppercase tracking-widest flex items-center gap-2">
                                <Briefcase size={12} /> Work Activities
                            </h3>
                            {(status === 'CLOCKED_IN' || status === 'CLOCKED_OUT') && (
                                <button
                                    onClick={addLog}
                                    className="p-1 px-2 rounded-lg bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors text-[10px] font-bold border border-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    + ADD TASK
                                </button>
                            )}
                        </div>

                        <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                            {workLogs.map((log) => (
                                <div key={log.id} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2 hover:bg-white/10 transition-colors group/card">
                                    <div className="flex gap-2 items-center">
                                        <SearchableClientSelect
                                            clients={clients}
                                            value={log.clientId}
                                            onChange={(val) => updateLog(log.id, 'clientId', val)}
                                            disabled={status === 'COMPLETED' || (status === 'CLOCKED_OUT' && !currentRecordId)}
                                        />

                                        {workLogs.length > 1 && status !== 'COMPLETED' && (
                                            <button
                                                onClick={() => removeLog(log.id)}
                                                className="p-2 text-gray-500 hover:text-rose-400 transition-colors bg-white/5 rounded-lg border border-white/5"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <textarea
                                        placeholder="What did you work on?"
                                        value={log.description}
                                        onChange={(e) => updateLog(log.id, 'description', e.target.value)}
                                        disabled={status === 'COMPLETED' || (status === 'CLOCKED_OUT' && !currentRecordId)}
                                        rows={2}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-brand-500 outline-none resize-none disabled:opacity-50"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="pt-4 border-t border-white/5 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Coffee size={14} className="text-brand-300" />
                            <span className="text-[10px] text-white/40">Office: 10:00 AM - 5:00 PM</span>
                        </div>
                    </div>
                    {status === 'CLOCKED_IN' && (
                        <div className="text-[10px] text-brand-400 font-medium animate-pulse flex items-center gap-1.5">
                            <Plus size={10} /> Syncing session data...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceWidget;
