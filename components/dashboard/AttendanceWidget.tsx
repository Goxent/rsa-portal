
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Timer, AlertTriangle, Check, X, Clock, Briefcase, Plus, Trash2, Calendar, Coffee, Search, ChevronDown, Minimize2, Maximize2, ChevronUp, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AttendanceRecord, Client, UserRole } from '../../types';
import { AuthService } from '../../services/firebase';
import NepaliDate from 'nepali-date-converter';
import { toast } from 'react-hot-toast';
import EmptyState from '../common/EmptyState';
import { useAttendanceHistory, useClockIn, useClockOut } from '../../hooks/useAttendance';
import { useClients } from '../../hooks/useClients';

// Internal Searchable Select Component
// Uses simple absolute positioning — works because the parent container does NOT have overflow:hidden/auto
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

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-focus search when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className={`relative w-full ${isOpen ? 'z-[100]' : 'z-10'}`} ref={wrapperRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between
                    bg-black/30 border rounded-xl px-4 py-2.5
                    text-[12px] text-left transition-all duration-200
                    ${isOpen
                        ? 'border-brand-500/60 bg-brand-500/5 shadow-[0_0_0_3px_rgba(99,102,241,0.1)]'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                    }
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedClient ? 'bg-brand-400' : 'bg-gray-600'}`} />
                    <span className={`truncate font-medium ${selectedClient ? 'text-white' : 'text-gray-500'}`}>
                        {selectedClient ? selectedClient.name : placeholder}
                    </span>
                </div>
                <ChevronDown
                    size={14}
                    className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-400' : ''}`}
                />
            </button>

            {/* Dropdown Panel — absolute, anchored to button, no overflow clipping */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="bg-[#0d1526] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                        {/* Search Bar */}
                        <div className="p-2.5 border-b border-white/5">
                            <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50 focus:bg-brand-500/5 transition-all"
                                    placeholder="Search clients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    >
                                        <X size={11} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Client List */}
                        <div className="max-h-52 overflow-y-auto custom-scrollbar py-1">
                            {filteredClients.length > 0 ? (
                                filteredClients.map(client => {
                                    const isSelected = value === client.id;
                                    return (
                                        <button
                                            key={client.id}
                                            type="button"
                                            onClick={() => {
                                                onChange(client.id);
                                                setIsOpen(false);
                                                setSearchTerm('');
                                            }}
                                            className={`
                                                w-full text-left px-3 py-2.5 text-[11px] mx-1 rounded-lg
                                                transition-all duration-100 flex items-center justify-between gap-2
                                                ${isSelected
                                                    ? 'bg-brand-600/25 text-brand-200'
                                                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                                }
                                            `}
                                            style={{ width: 'calc(100% - 8px)' }}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-brand-400' : 'bg-gray-600'}`} />
                                                <span className="truncate">{client.name}</span>
                                            </div>
                                            {isSelected && (
                                                <Check size={12} className="text-brand-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            ) : (
                                <EmptyState
                                    icon={Search}
                                    title="No clients found"
                                    description="Try a different search term"
                                    className="!p-4"
                                    iconSize={24}
                                />
                            )}
                        </div>

                        {/* Footer count */}
                        {filteredClients.length > 0 && (
                            <div className="px-3 py-1.5 border-t border-white/5 text-[10px] text-gray-600">
                                {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
                                {searchTerm ? ` matching "${searchTerm}"` : ' available'}
                            </div>
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
    const [workLogs, setWorkLogs] = useState<{ id: string; clientId: string; clientName: string; description: string; duration: number; billable: boolean }[]>([
        { id: Math.random().toString(36).substr(2, 9), clientId: 'INTERNAL', clientName: 'Internal Work / Office', description: '', duration: 0, billable: true }
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
                <div className="bg-navy-800/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4 w-auto min-w-[280px]">
                    {/* Drag Handle / Status Icon */}
                    <div className={`p-2 rounded-xl ${status === 'CLOCKED_IN' ? 'bg-green-500/20 text-green-400 animate-pulse' :
                        status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                        <Clock size={20} />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                                {status === 'CLOCKED_IN' ? 'Active Session' : 'Attendance'}
                            </p>
                            <button onClick={() => setIsFloating(false)} className="text-gray-500 hover:text-white transition-colors">
                                <Maximize2 size={14} />
                            </button>
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <p className="text-xl font-bold text-white font-mono">
                                {status === 'CLOCKED_IN' ? formatTime(sessionSeconds) : currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {status === 'CLOCKED_IN' && (
                                <span className="text-xs text-green-400 font-medium">Recorded</span>
                            )}
                        </div>
                    </div>

                    {/* Quick Action */}
                    {status === 'CLOCKED_IN' && (
                        <button
                            onClick={() => setIsFloating(false)} // Expand to clock out effectively or add quick clock out here
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors"
                            title="Expand to manage"
                        >
                            <ChevronUp size={18} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Default Full Widget Render
    return (
        <div className="glass-panel border-white/5 relative group rounded-2xl hover:z-40 focus-within:z-50">
            {/* Background Decoration wrapper to clip blur without clipping the dropdown */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
            </div>
            {/* Header / Top Bar */}
            <div className="p-6 pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Clock className="text-brand-400" size={20} />
                            Attendance Center
                        </h2>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status === 'CLOCKED_IN' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                            status === 'COMPLETED' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                'bg-gray-500/10 border-gray-500/20 text-gray-400'
                            }`}>
                            {status === 'CLOCKED_IN' ? 'Active Session' : status === 'COMPLETED' ? 'Shift Completed' : 'Not Started'}
                        </span>
                    </div>
                    <p className="text-gray-400 text-xs">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • <span className="text-brand-200">{new NepaliDate(new Date()).format('YYYY MMMM DD')} BS</span>
                    </p>
                </div>

                {/* Right Side: Timer & Controls */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Minimize Button */}
                    <button
                        onClick={() => setIsFloating(true)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all order-last md:order-first"
                        title="Minimize to floating widget"
                    >
                        <Minimize2 size={18} />
                    </button>

                    <div className="bg-black/30 rounded-xl p-3 border border-white/5 min-w-[140px] text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Current Time</p>
                        <p className="text-xl font-mono font-bold text-white leading-none">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    </div>

                    {status === 'CLOCKED_IN' && (
                        <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20 min-w-[140px] text-center animate-pulse-slow">
                            <p className="text-[10px] text-green-400/80 uppercase tracking-widest font-bold mb-0.5">Session Timer</p>
                            <p className="text-xl font-mono font-bold text-green-400 leading-none">
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
                        <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <h3 className="text-amber-400 font-bold text-sm mb-1">Late Arrival Detected</h3>
                            <p className="text-amber-200/70 text-xs mb-3">You are checking in after 10:15 AM. Please provide a reason.</p>
                            <input
                                type="text"
                                placeholder="Reason for late arrival..."
                                value={lateReason}
                                onChange={(e) => setLateReason(e.target.value)}
                                className="w-full bg-black/20 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-amber-500/40 focus:outline-none focus:border-amber-400"
                            />
                        </div>
                    </div>
                )}

                {/* Clock In / Out Actions */}
                {status === 'CLOCKED_OUT' ? (
                    <button
                        onClick={handleClockIn}
                        disabled={loading || (isLate && !lateReason)}
                        className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />}
                        Start Work Day
                    </button>
                ) : (
                    <div className="space-y-6">
                        {/* Work Logs Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white text-sm font-bold flex items-center gap-2">
                                    <Briefcase size={16} className="text-brand-400" />
                                    Work Logs
                                </h3>
                                {status !== 'COMPLETED' && (
                                    <button onClick={addLog} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium bg-brand-500/10 px-2 py-1 rounded-lg border border-brand-500/20">
                                        <Plus size={12} /> Add Task
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {workLogs.map((log, index) => (
                                    <div key={log.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex gap-3 group hover:border-white/10 transition-colors">
                                        {/* Client Select */}
                                        <div className="w-1/3 min-w-[180px]">
                                            <SearchableClientSelect
                                                clients={clients}
                                                value={log.clientId}
                                                onChange={(val) => updateLog(log.id, 'clientId', val)}
                                                disabled={status === 'COMPLETED'}
                                            />
                                        </div>

                                        {/* Description */}
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={log.description}
                                                onChange={(e) => updateLog(log.id, 'description', e.target.value)}
                                                placeholder="What are you working on?"
                                                disabled={status === 'COMPLETED'}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-[12px] text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50 focus:bg-brand-500/5 transition-all h-[38px]"
                                            />
                                        </div>

                                        {/* Actions */}
                                        {status !== 'COMPLETED' && workLogs.length > 1 && (
                                            <button
                                                onClick={() => removeLog(log.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all h-[38px] w-[38px] flex items-center justify-center opacity-0 group-hover:opacity-100"
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
                            <div className="pt-4 border-t border-white/5">
                                <button
                                    onClick={handleClockOut}
                                    disabled={loading}
                                    className="w-full py-3 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group"
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
