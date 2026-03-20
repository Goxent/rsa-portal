import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar, FileText, CheckCircle2, User } from 'lucide-react';
import { AttendanceRecord, Client, UserProfile } from '../../types';
import ClientSelect from '../ClientSelect';
import StaffSelect from '../StaffSelect'; // Assuming this exists, or we might not need it if we pass the user

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

        const start = new Date(`2000-01-01T${inTime}`);
        const end = new Date(`2000-01-01T${outTime}`);
        const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return diff > 0 ? Number(diff.toFixed(1)) : 0;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="glass-modal rounded-xl w-full max-w-lg border border-white/10 shadow-2xl flex flex-col bg-[#09090b]">
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <CheckCircle2 className="text-brand-400" size={20} />
                            Adjust Attendance
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">
                            {selectedUser.displayName} • {new Date(selectedDate).toDateString()}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Status Selection */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Attendance Status
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON LEAVE'].map(status => (
                                <label key={status} className={`
                                    cursor-pointer border rounded-lg p-2 text-center text-xs font-bold transition-all
                                    ${formData.status === status
                                        ? 'bg-brand-500/20 border-brand-500 text-brand-300 ring-1 ring-brand-500/50'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}
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
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Clock size={12} /> Clock In
                                </label>
                                <input
                                    type="time"
                                    required
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-brand-500 outline-none"
                                    value={formData.clockIn}
                                    onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Clock size={12} /> Clock Out
                                </label>
                                <input
                                    type="time"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-brand-500 outline-none"
                                    value={formData.clockOut}
                                    onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Client Selection */}
                    {formData.status !== 'ABSENT' && formData.status !== 'ON LEAVE' && (
                        <div className="animate-in fade-in slide-in-from-top-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <User size={12} /> Assigned Client(s)
                            </label>
                            <ClientSelect
                                clients={clients}
                                value={formData.clientIds || []}
                                onChange={(val) => setFormData({ ...formData, clientIds: Array.isArray(val) ? val : [val] })}
                                multi={true}
                                placeholder="Select Worked Clients..."
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <FileText size={12} /> Notes / Reason
                        </label>
                        <textarea
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600 focus:ring-1 focus:ring-brand-500 outline-none text-sm min-h-[80px]"
                            placeholder="Reason for manual adjustment..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
                        >
                            {isSaving ? <span className="animate-spin">⏳</span> : <Save size={16} />}
                            Save Adjustment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualAttendanceModal;
