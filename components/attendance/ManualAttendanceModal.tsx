import React, { useState, useEffect } from 'react';
import { AttendanceRecord, Client, UserProfile, WorkLog } from '../../types';
import ClientSelect from '../ClientSelect';
import { NATURE_OF_ASSIGNMENTS } from '../../constants/firmData';
import { Trash2, Plus, Briefcase, User, FileText, Clock, Save, X, CheckCircle2 } from 'lucide-react';

interface ManualAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: Partial<AttendanceRecord> | null; // null means new record
    selectedDate: string; // The date we are adding/editing for
    selectedUser: UserProfile | null; // The user we are acting upon
    clients: Client[];
    onSave: (record: AttendanceRecord) => Promise<void>;
}

const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
    isOpen,
    onClose,
    record,
    selectedDate,
    selectedUser,
    clients,
    onSave
}) => {
    const [isSaving, setIsSaving] = useState(false);
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
            if (record) {
                setFormData({
                    ...record,
                    // Ensure defaults for editing
                    status: record.status || 'PRESENT',
                    clockIn: record.clockIn || '09:00',
                    clockOut: record.clockOut || '',
                    clientIds: record.clientIds || (record.clientId ? [record.clientId] : []),
                    notes: record.notes || ''
                });
            } else {
                // New Record Default
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
    }, [isOpen, record]);

    if (!isOpen || !selectedUser) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Construct the payload
            const finalRecord: AttendanceRecord = {
                id: record?.id || `manual_${Date.now()}`, // Generate ID if new
                userId: selectedUser.uid,
                userName: selectedUser.displayName,
                date: selectedDate,
                status: formData.status as any,
                clockIn: formData.status === 'ABSENT' || formData.status === 'ON LEAVE' ? '' : formData.clockIn!,
                clockOut: formData.status === 'ABSENT' || formData.status === 'ON LEAVE' ? '' : formData.clockOut,
                workHours: calculateWorkHours(formData.clockIn, formData.clockOut, formData.status as any),
                notes: formData.notes,
                clientIds: formData.clientIds, // Array of IDs
                // Helper for legacy support if needed, or leave empty
                clientId: formData.clientIds && formData.clientIds.length > 0 ? formData.clientIds[0] : undefined,
                clientName: formData.clientIds && formData.clientIds.length > 0
                    ? clients.find(c => c.id === formData.clientIds![0])?.name
                    : undefined
            };

            await onSave(finalRecord);
            onClose();
        } catch (error) {
            console.error(error);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#161b22] rounded-2xl w-full max-w-lg border border-[#30363d] shadow-2xl flex flex-col overflow-hidden">
                <div className="px-6 py-5 border-b border-[#30363d] flex justify-between items-center bg-[#0d1117]/50">
                    <div>
                        <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-tight">
                            <CheckCircle2 className="text-amber-500" size={20} />
                            Log Attendance
                        </h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                            {selectedUser.displayName} <span className="mx-1 text-gray-700">•</span> {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-all p-1.5 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/5">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Status Selection */}
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">
                            Attendance Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON LEAVE'].map(status => (
                                <label key={status} className={`
                                    cursor-pointer px-4 py-2 rounded-xl text-[11px] font-black border transition-all uppercase tracking-wider
                                    ${formData.status === status
                                        ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20'
                                        : 'bg-[#0d1117] border-[#30363d] text-gray-500 hover:text-gray-300 hover:border-gray-600'}
                                `}>
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

                    {/* Time Inputs - Hide for Absent/Leave */}
                    {formData.status !== 'ABSENT' && formData.status !== 'ON LEAVE' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    <Clock size={12} className="text-amber-500/50" /> Clock In
                                </label>
                                <input
                                    type="time"
                                    required
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500/50 outline-none transition-all tabular-nums"
                                    value={formData.clockIn}
                                    onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    <Clock size={12} className="text-amber-500/50" /> Clock Out
                                </label>
                                <input
                                    type="time"
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500/50 outline-none transition-all tabular-nums"
                                    value={formData.clockOut}
                                    onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Work Logs Section */}
                    {formData.status !== 'ABSENT' && formData.status !== 'ON LEAVE' && (
                        <div className="animate-in fade-in slide-in-from-top-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    <Briefcase size={12} className="text-amber-500/50" /> Work Logs
                                </label>
                                <button 
                                    type="button"
                                    onClick={addWorkLog} 
                                    className="text-[9px] text-amber-500 hover:text-amber-400 font-black uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 transition-all"
                                >
                                    + Add Item
                                </button>
                            </div>
                            
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                {(formData.workLogs || []).map((log) => (
                                    <div key={log.id} className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 space-y-3 relative group">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Client</span>
                                                <ClientSelect
                                                    clients={clients}
                                                    value={log.clientId}
                                                    onChange={(val) => updateWorkLog(log.id, 'clientId', val as string)}
                                                    placeholder="Select Client..."
                                                    className="!h-9"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Nature of Assignment</span>
                                                <select
                                                    value={log.natureOfAssignment || NATURE_OF_ASSIGNMENTS[0]}
                                                    onChange={(e) => updateWorkLog(log.id, 'natureOfAssignment', e.target.value)}
                                                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500/50 outline-none transition-all appearance-none h-9"
                                                >
                                                    {NATURE_OF_ASSIGNMENTS.map(n => (
                                                        <option key={n} value={n}>{n}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Work Description</span>
                                            <input
                                                type="text"
                                                value={log.description}
                                                onChange={(e) => updateWorkLog(log.id, 'description', e.target.value)}
                                                placeholder="What did you do today?"
                                                className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-700 focus:border-amber-500/50 outline-none transition-all h-9"
                                            />
                                        </div>
                                        {(formData.workLogs || []).length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeWorkLog(log.id)}
                                                className="absolute -top-2 -right-2 p-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg border border-rose-500/20 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            <FileText size={12} className="text-amber-500/50" /> Notes / Reason
                        </label>
                        <textarea
                            className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-white placeholder:text-gray-700 focus:border-amber-500/50 outline-none text-[13px] min-h-[100px] resize-none transition-all"
                            placeholder="Reason for manual adjustment..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[#30363d]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? <span className="animate-spin italic font-serif">save</span> : <Save size={14} />}
                            Confirm Log
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualAttendanceModal;
