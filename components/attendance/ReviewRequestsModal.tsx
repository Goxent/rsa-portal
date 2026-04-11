import React, { useState, useEffect } from 'react';
import { AttendanceLogRequest, UserRole } from '../../types';
import { AuthService } from '../../services/firebase';
import { X, Check, AlertCircle, Clock, User, Calendar, MessageSquare, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ReviewRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
    adminId: string;
    adminName: string;
    onDataChange: () => void;
}

const ReviewRequestsModal: React.FC<ReviewRequestsModalProps> = ({
    isOpen,
    onClose,
    adminId,
    adminName,
    onDataChange
}) => {
    const [requests, setRequests] = useState<AttendanceLogRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchRequests();
        }
    }, [isOpen]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await AuthService.getPendingAttendanceRequests();
            setRequests(data);
        } catch (error) {
            console.error("Failed to fetch requests:", error);
            toast.error("Failed to load pending requests");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            await AuthService.approveAttendanceRequest(requestId, adminId, adminName);
            toast.success("Request approved successfully");
            setRequests(prev => prev.filter(r => r.id !== requestId));
            onDataChange();
        } catch (error) {
            console.error("Approval failed:", error);
            toast.error("Failed to approve request");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (requestId: string) => {
        if (!rejectReason.trim()) {
            toast.error("Please provide a reason for rejection");
            return;
        }
        setProcessingId(requestId);
        try {
            await AuthService.rejectAttendanceRequest(requestId, adminId, adminName, rejectReason);
            toast.success("Request rejected");
            setRequests(prev => prev.filter(r => r.id !== requestId));
            setRejectingId(null);
            setRejectReason('');
            onDataChange();
        } catch (error) {
            console.error("Rejection failed:", error);
            toast.error("Failed to reject request");
        } finally {
            setProcessingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            style={{ 
                background: 'var(--modal-backdrop, rgba(0,0,0,0.6))',
                backdropFilter: 'blur(4px)'
            }}
        >
            <div 
                className="w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] border animate-in slide-in-from-bottom-2 duration-300"
                style={{ 
                    background: 'var(--bg-secondary)', 
                    borderColor: 'var(--border-mid)', 
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-modal)'
                }}
            >
                <div className="px-6 py-5 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight" style={{ color: 'var(--text-heading)' }}>
                            <Clock style={{ color: 'var(--accent)' }} size={22} />
                            Pending Manual Log Requests
                        </h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
                            Review and approve staff attendance changes
                        </p>
                    </div>
                    <button onClick={onClose} style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }} className="p-2 hover:bg-[var(--bg-surface)] transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar" style={{ background: 'var(--bg-main)' }}>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-4 border-t-[var(--accent)] rounded-full animate-spin" style={{ borderColor: 'var(--accent-dim)' }} />
                            <span style={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.6875rem' }} className="uppercase">Loading requests...</span>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-[#161b22] rounded-full flex items-center justify-center border border-[#30363d] mb-4">
                                <Check className="text-brand-500/50" size={32} />
                            </div>
                            <h3 className="text-white font-bold text-lg mb-1">Queue Empty</h3>
                            <p className="text-gray-500 text-sm italic">All manual log requests have been processed.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((req) => (
                                <div key={req.id} className="p-5 transition-all group relative border" 
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 'var(--radius-xl)' }}
                                >
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        {/* User & Date Info */}
                                        <div className="lg:col-span-3 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-10 h-10 flex items-center justify-center font-bold text-xs border shadow-sm"
                                                    style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)', borderRadius: '99px' }}
                                                >
                                                    {req.userName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-heading)' }} className="text-sm font-bold">{req.userName}</div>
                                                    <div style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold uppercase tracking-tighter">Staff Member</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-gray-400 font-bold">
                                                <Calendar size={12} className="text-amber-500/50" />
                                                {new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>

                                        {/* Attendance Details */}
                                        <div className="lg:col-span-5 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-2.5 border" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}>
                                                    <div style={{ color: 'var(--text-muted)' }} className="text-[9px] font-black uppercase mb-1">Status</div>
                                                    <span 
                                                        className="px-2 py-0.5 border uppercase tracking-widest"
                                                        style={{ 
                                                            fontSize: '9px',
                                                            fontWeight: 600,
                                                            borderRadius: 'var(--radius-sm)',
                                                            background: req.status === 'PRESENT' ? 'rgba(101,154,43,0.1)' : 'rgba(196,68,90,0.1)',
                                                            color: req.status === 'PRESENT' ? 'var(--accent)' : 'var(--color-danger)',
                                                            borderColor: req.status === 'PRESENT' ? 'rgba(101,154,43,0.2)' : 'rgba(196,68,90,0.2)'
                                                        }}
                                                    >
                                                        {req.status}
                                                    </span>
                                                </div>
                                                <div className="p-2.5 border" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}>
                                                    <div style={{ color: 'var(--text-muted)' }} className="text-[9px] font-black uppercase mb-1">Hours / Timing</div>
                                                    <div style={{ color: 'var(--text-body)' }} className="text-[11px] font-bold tabular-nums lowercase">
                                                        {req.clockIn} - {req.clockOut} <span style={{ color: 'var(--text-muted)' }} className="text-[10px] ml-1">({req.workHours}h)</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {req.notes && (
                                                <div className="p-3 border border-l-4" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', borderLeftColor: 'var(--accent)', borderRadius: 'var(--radius-md)' }}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <MessageSquare size={10} style={{ color: 'var(--accent)', opacity: 0.7 }} />
                                                        <span style={{ color: 'var(--text-muted)' }} className="text-[9px] font-black uppercase">Staff Notes</span>
                                                    </div>
                                                    <p style={{ color: 'var(--text-body)' }} className="text-[12px] italic leading-relaxed">"{req.notes}"</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="lg:col-span-4 flex flex-col justify-center gap-2">
                                            {rejectingId === req.id ? (
                                                <div className="space-y-2 animate-in slide-in-from-right-2 duration-200">
                                                    <textarea 
                                                        className="w-full border p-3 text-xs outline-none resize-none h-20"
                                                        style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-heading)' }}
                                                        placeholder="Reason for rejection..."
                                                        value={rejectReason}
                                                        onChange={(e) => setRejectReason(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleReject(req.id)}
                                                            disabled={processingId === req.id}
                                                            className="flex-1 py-2 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                                                            style={{ background: 'var(--color-danger)', borderRadius: 'var(--radius-md)' }}
                                                        >
                                                            {processingId === req.id ? '...' : 'Confirm Reject'}
                                                        </button>
                                                        <button 
                                                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                                            className="px-4 py-2 border text-[10px] font-black uppercase tracking-widest"
                                                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    <button 
                                                        onClick={() => handleApprove(req.id)}
                                                        disabled={processingId === req.id}
                                                        className="w-full py-3 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 group"
                                                        style={{ background: 'var(--accent)', borderRadius: 'var(--radius-xl)' }}
                                                    >
                                                        {processingId === req.id ? (
                                                            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                        ) : (
                                                            <Check size={16} className="group-hover:scale-110 transition-transform" />
                                                        )}
                                                        Approve Record
                                                    </button>
                                                    <button 
                                                        onClick={() => setRejectingId(req.id)}
                                                        className="w-full py-2 border transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-xl)', color: 'var(--text-muted)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-danger)'; e.currentTarget.style.color = 'var(--color-danger)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                    >
                                                        <AlertCircle size={14} />
                                                        Reject Request
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="absolute top-4 right-4 text-[9px] font-bold text-gray-700 tabular-nums">
                                        SUBMITTED {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t flex justify-between items-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                        <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-black uppercase tracking-[0.1em]">Total {requests.length} Pending Actions</span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 transition-all border shadow-sm text-xs font-black uppercase tracking-widest"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 'var(--radius-xl)', color: 'var(--text-heading)' }}
                    >
                        Close Portal
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReviewRequestsModal;
