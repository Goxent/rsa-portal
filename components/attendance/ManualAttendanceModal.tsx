import React, { useState, useEffect } from 'react';
import { AttendanceRecord, Client, UserProfile, WorkLog } from '../../types';
import ClientSelect from '../ClientSelect';
import StaffSelect from '../StaffSelect';
import { NATURE_OF_ASSIGNMENTS } from '../../constants/firmData';
import { Trash2, Plus, Briefcase, User, FileText, Clock, Save, X, CheckCircle2, Users, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import NepaliDatePicker from '../NepaliDatePicker';

interface ManualAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: Partial<AttendanceRecord> | null;
    selectedDate: string;
    selectedUser: UserProfile | null;
    clients: Client[];
    users?: UserProfile[];
    isAdmin?: boolean;
    onSave: (record: AttendanceRecord) => Promise<void>;
}

const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
    isOpen,
    onClose,
    record,
    selectedDate,
    selectedUser,
    clients,
    users = [],
    isAdmin = false,
    onSave
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [localUser, setLocalUser] = useState<UserProfile | null>(selectedUser);
    const [localDate, setLocalDate] = useState<string>(selectedDate);
    const [useNepali, setUseNepali] = useState(false);
    const [formData, setFormData] = useState<Partial<AttendanceRecord>>({
        status: 'PRESENT',
        clockIn: '09:00',
        clockOut: '17:00',
        clientIds: [],
        workLogs: [],
        notes: ''
    });

    useEffect(() => {
        if (isOpen) {
            setLocalUser(selectedUser);
            setLocalDate(selectedDate);
            if (record) {
                setFormData({
                    ...record,
                    status: record.status || 'PRESENT',
                    clockIn: record.clockIn || '09:00',
                    clockOut: record.clockOut || '',
                    clientIds: record.clientIds || (record.clientId ? [record.clientId] : []),
                    notes: record.notes || ''
                });
            } else {
                setFormData({
                    status: 'PRESENT',
                    clockIn: '10:00',
                    clockOut: '17:00',
                    clientIds: [],
                    workLogs: [
                        { id: Math.random().toString(36).substr(2, 9), clientId: 'INTERNAL', clientName: 'Internal Work / Office', natureOfAssignment: 'Internal Audit', description: '', duration: 0, billable: true }
                    ],
                    notes: ''
                });
            }
        }
    }, [isOpen, record, selectedUser]);

    if (!isOpen) return null;

    const activeUser = localUser;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeUser) {
            return;
        }
        setIsSaving(true);
        try {
            const baseRecord = {
                userId: activeUser.uid,
                userName: activeUser.displayName,
                date: localDate,
                status: formData.status as any,
                clockIn: formData.status === 'ABSENT' || formData.status === 'ON LEAVE' ? '' : formData.clockIn!,
                clockOut: formData.status === 'ABSENT' || formData.status === 'ON LEAVE' ? '' : formData.clockOut,
                workHours: calculateWorkHours(formData.clockIn, formData.clockOut, formData.status as any) || 0,
                notes: formData.notes || '',
                clientIds: formData.clientIds || [],
                clientId: (formData.clientIds && formData.clientIds.length > 0) ? formData.clientIds[0] : '',
                clientName: (formData.clientIds && formData.clientIds.length > 0)
                    ? clients.find(c => c.id === formData.clientIds![0])?.name || ''
                    : '',
                workLogs: formData.workLogs || []
            };

            if (isAdmin) {
                const finalRecord: AttendanceRecord = {
                    ...baseRecord,
                    id: record?.id || `manual_${Date.now()}`
                };
                await onSave(finalRecord);
            } else {
                // Submit Request
                const { id, ...requestData } = baseRecord as any;
                await import('../../services/firebase').then(async ({ AuthService }) => {
                    await AuthService.requestManualAttendance(requestData);
                });
                toast.success("Manual log request submitted for approval");
            }
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("An error occurred. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const calculateWorkHours = (inTime: string | undefined, outTime: string | undefined, status: string) => {
        if (status === 'ABSENT' || status === 'ON LEAVE') return 0;
        if (!inTime || !outTime) return 0;

        const [h, m] = inTime.split(':').map(Number);
        const [oh, om] = outTime.split(':').map(Number);
        const diff = (oh + om / 60) - (h + m / 60);
        return Math.max(0, Number(diff.toFixed(2)));
    };

    const addWorkLog = () => {
        const newLog: WorkLog = {
            id: Math.random().toString(36).substr(2, 9),
            clientId: 'INTERNAL',
            clientName: 'Internal Work / Office',
            natureOfAssignment: 'Internal Audit',
            description: '',
            duration: 0,
            billable: true
        };
        setFormData({ ...formData, workLogs: [...(formData.workLogs || []), newLog] });
    };

    const removeWorkLog = (id: string) => {
        setFormData({ ...formData, workLogs: (formData.workLogs || []).filter(l => l.id !== id) });
    };

    const updateWorkLog = (id: string, field: string, value: any) => {
        const updatedLogs = (formData.workLogs || []).map(l => {
            if (l.id === id) {
                const updated = { ...l, [field]: value };
                if (field === 'clientId') {
                    const client = clients.find(c => c.id === value);
                    if (client) updated.clientName = client.name;
                }
                return updated;
            }
            return l;
        });
        setFormData({ ...formData, workLogs: updatedLogs });
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ 
                background: 'var(--modal-backdrop, rgba(0,0,0,0.6))',
                backdropFilter: 'blur(4px)'
            }}
        >
            <div 
                className="w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border animate-in slide-in-from-bottom-3 duration-300"
                style={{ 
                    background: 'var(--bg-secondary)', 
                    borderColor: 'var(--border-mid)', 
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-modal)'
                }}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                    <div>
                        <h2 className="text-base font-bold flex items-center gap-2 tracking-tight" style={{ color: 'var(--text-heading)' }}>
                            <CheckCircle2 style={{ color: 'var(--accent)' }} size={18} />
                            {isAdmin ? 'Log Attendance' : 'Request Attendance Log'}
                        </h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
                            {activeUser ? activeUser.displayName : 'Select Staff Member'}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }} className="p-2 hover:bg-[var(--bg-surface)] transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                <Calendar size={12} style={{ color: 'var(--accent)', opacity: 0.7 }} /> Log Date
                            </label>
                            <button
                                type="button"
                                onClick={() => setUseNepali(!useNepali)}
                                className="text-[9px] font-black px-2 py-0.5 rounded transition-all uppercase tracking-widest"
                                style={{ 
                                    background: useNepali ? 'var(--accent)' : 'var(--accent-dim)',
                                    color: useNepali ? 'white' : 'var(--accent)'
                                }}
                            >
                                {useNepali ? 'AD' : 'BS'}
                            </button>
                        </div>
                        {useNepali ? (
                            <NepaliDatePicker
                                value={localDate}
                                onChange={(ad) => setLocalDate(ad)}
                                className="w-full"
                            />
                        ) : (
                            <input
                                type="date"
                                required
                                className="w-full border px-4 py-2.5 text-sm outline-none transition-all tabular-nums"
                                style={{ 
                                    background: 'var(--bg-main)', 
                                    borderColor: 'var(--border)', 
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-heading)' 
                                }}
                                value={localDate}
                                onChange={(e) => setLocalDate(e.target.value)}
                            />
                        )}
                    </div>

                    {!selectedUser && isAdmin && users.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                                <Users size={12} style={{ color: 'var(--accent)', opacity: 0.7 }} /> Select Staff Member
                            </label>
                            <StaffSelect
                                value={localUser?.uid || ''}
                                onChange={(val) => {
                                    const uid = Array.isArray(val) ? val[0] : val;
                                    const found = users.find(u => u.uid === uid);
                                    setLocalUser(found || null);
                                }}
                                users={users}
                            />
                            {!localUser && (
                                <p className="text-[10px] mt-2 font-bold" style={{ color: 'var(--color-danger)' }}>⚠ Please select a staff member to continue</p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                            Attendance Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON LEAVE'].map(status => (
                                <label key={status} className="cursor-pointer px-4 py-2 rounded-lg text-[11px] font-bold border transition-all uppercase tracking-wider relative"
                                    style={{ 
                                        background: formData.status === status ? 'var(--accent)' : 'var(--bg-main)',
                                        borderColor: formData.status === status ? 'var(--accent)' : 'var(--border)',
                                        color: formData.status === status ? 'white' : 'var(--text-body)'
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="status"
                                        className="hidden"
                                        value={status}
                                        checked={formData.status === status}
                                        onChange={() => setFormData({ ...formData, status: status as any })}
                                    />
                                    {status.replace('_', ' ')}
                                </label>
                            ))}
                        </div>
                    </div>

                    {formData.status !== 'ABSENT' && formData.status !== 'ON LEAVE' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    <Clock size={12} style={{ color: 'var(--accent)', opacity: 0.7 }} /> Clock In
                                </label>
                                <input
                                    type="time"
                                    required
                                    className="w-full border px-4 py-2.5 text-sm outline-none transition-all tabular-nums"
                                    style={{ 
                                        background: 'var(--bg-main)', 
                                        borderColor: 'var(--border)', 
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-heading)' 
                                    }}
                                    value={formData.clockIn}
                                    onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    <Clock size={12} style={{ color: 'var(--accent)', opacity: 0.7 }} /> Clock Out
                                </label>
                                <input
                                    type="time"
                                    className="w-full border px-4 py-2.5 text-sm outline-none transition-all tabular-nums"
                                    style={{ 
                                        background: 'var(--bg-main)', 
                                        borderColor: 'var(--border)', 
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-heading)' 
                                    }}
                                    value={formData.clockOut}
                                    onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {formData.status !== 'ABSENT' && formData.status !== 'ON LEAVE' && (
                        <div className="animate-in fade-in slide-in-from-top-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    <Briefcase size={12} style={{ color: 'var(--accent)', opacity: 0.7 }} /> Work Logs
                                </label>
                                <button 
                                    type="button"
                                    onClick={addWorkLog} 
                                    className="text-[9px] font-black uppercase tracking-widest px-2 py-1 transition-all border shadow-sm"
                                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--accent)' }}
                                >
                                    + Add Item
                                </button>
                            </div>
                            
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                {(formData.workLogs || []).map((log) => (
                                    <div key={log.id} className="p-3 space-y-3 relative group border"
                                        style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', borderRadius: 'var(--radius-lg)' }}
                                    >
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Client</span>
                                                <ClientSelect
                                                    clients={clients}
                                                    value={log.clientId}
                                                    onChange={(val) => updateWorkLog(log.id, 'clientId', val as string)}
                                                    placeholder="Select Client..."
                                                    className="!h-9"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Nature of Assignment</span>
                                                <select
                                                    value={log.natureOfAssignment || NATURE_OF_ASSIGNMENTS[0]}
                                                    onChange={(e) => updateWorkLog(log.id, 'natureOfAssignment', e.target.value)}
                                                    className="w-full border px-3 py-1.5 text-xs outline-none transition-all h-9"
                                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-heading)' }}
                                                >
                                                    {NATURE_OF_ASSIGNMENTS.map(n => (
                                                        <option key={n} value={n}>{n}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Work Description</span>
                                            <input
                                                type="text"
                                                value={log.description}
                                                onChange={(e) => updateWorkLog(log.id, 'description', e.target.value)}
                                                placeholder="What did you do today?"
                                                className="w-full border px-3 py-2 text-xs outline-none transition-all h-9"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-heading)' }}
                                            />
                                        </div>
                                        {(formData.workLogs || []).length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeWorkLog(log.id)}
                                                className="absolute -top-2 -right-2 p-1.5 shadow-md transition-all opacity-0 group-hover:opacity-100 border"
                                                style={{ background: 'var(--bg-secondary)', color: 'var(--color-danger)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                            <FileText size={12} style={{ color: 'var(--accent)', opacity: 0.7 }} /> Notes / Reason
                        </label>
                        <textarea
                            className="w-full border px-4 py-3 outline-none text-[13px] min-h-[100px] resize-none transition-all"
                            style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-heading)' }}
                            placeholder="Reason for manual adjustment..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !activeUser}
                            className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg"
                            style={{ background: 'var(--accent)', color: 'white', borderRadius: 'var(--radius-md)' }}
                        >
                            {isSaving ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                            {isAdmin ? 'Confirm Log' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualAttendanceModal;
