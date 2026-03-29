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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[#161b22] rounded-2xl w-full max-w-4xl border border-[#30363d] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
                <div className="px-6 py-5 border-b border-[#30363d] flex justify-between items-center bg-[#0d1117]/50">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                            <Clock className="text-amber-500" size={22} />
                            Pending Manual Log Requests
                        </h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                            Review and approve staff attendance changes
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-all p-2 hover:bg-white/5 rounded-xl">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0d1117]/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                            <span className="text-gray-500 font-bold uppercase tracking-widest text-[11px]">Loading requests...</span>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-[#161b22] rounded-full flex items-center justify-center border border-[#30363d] mb-4">
                                <Check className="text-emerald-500/50" size={32} />
                            </div>
                            <h3 className="text-white font-bold text-lg mb-1">Queue Empty</h3>
                            <p className="text-gray-500 text-sm italic">All manual log requests have been processed.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((req) => (
                                <div key={req.id} className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 hover:border-[#484f58] transition-all group relative">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        {/* User & Date Info */}
                                        <div className="lg:col-span-3 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-black text-xs">
                                                    {req.userName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-white">{req.userName}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Staff Member</div>
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
                                                <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#30363d]">
                                                    <div className="text-[9px] font-black text-gray-600 uppercase mb-1">Status</div>
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-widest ${
                                                        req.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        req.status === 'LATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                    }`}>
                                                        {req.status}
                                                    </span>
                                                </div>
                                                <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#30363d]">
                                                    <div className="text-[9px] font-black text-gray-600 uppercase mb-1">Hours / Timing</div>
                                                    <div className="text-[11px] font-bold text-gray-300 tabular-nums lowercase">
                                                        {req.clockIn} - {req.clockOut} <span className="text-gray-600 text-[10px] ml-1">({req.workHours}h)</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {req.notes && (
                                                <div className="bg-[#0d1117] rounded-lg p-3 border border-amber-500/10 border-l-amber-500/50">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <MessageSquare size={10} className="text-amber-500/70" />
                                                        <span className="text-[9px] font-black text-gray-600 uppercase">Staff Notes</span>
                                                    </div>
                                                    <p className="text-[12px] text-gray-400 italic leading-relaxed">"{req.notes}"</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="lg:col-span-4 flex flex-col justify-center gap-2">
                                            {rejectingId === req.id ? (
                                                <div className="space-y-2 animate-in slide-in-from-right-2 duration-200">
                                                    <textarea 
                                                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl p-3 text-xs text-white placeholder:text-gray-700 focus:border-rose-500/50 outline-none resize-none h-20"
                                                        placeholder="Reason for rejection..."
                                                        value={rejectReason}
                                                        onChange={(e) => setRejectReason(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleReject(req.id)}
                                                            disabled={processingId === req.id}
                                                            className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-600/20"
                                                        >
                                                            {processingId === req.id ? '...' : 'Confirm Reject'}
                                                        </button>
                                                        <button 
                                                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                                            className="px-4 py-2 bg-[#21262d] text-gray-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest border border-[#30363d]"
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
                                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 group"
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
                                                        className="w-full py-2 bg-[#21262d] hover:bg-rose-900/20 text-gray-400 hover:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-[#30363d] hover:border-rose-500/30 flex items-center justify-center gap-2"
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

                <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117]/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.1em]">Total {requests.length} Pending Actions</span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-[#30363d]"
                    >
                        Close Portal
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReviewRequestsModal;
