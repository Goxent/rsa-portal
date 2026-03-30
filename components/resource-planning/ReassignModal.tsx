import React, { useState } from 'react';
import { UserProfile, Task } from '../../types';
import { X, Search, Users, Check, ArrowRight } from 'lucide-react';

interface ReassignModalProps {
    task: Task;
    users: UserProfile[];
    onClose: () => void;
    onReassign: (targetUserId: string) => Promise<void>;
}

const ReassignModal: React.FC<ReassignModalProps> = ({ task, users, onClose, onReassign }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const filteredUsers = users.filter(u => 
        (u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         u.department?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        !task.assignedTo?.includes(u.uid)
    );

    const handleConfirm = async () => {
        if (!selectedUserId) return;
        setIsSubmitting(true);
        try {
            await onReassign(selectedUserId);
            onClose();
        } catch (error) {
            console.error("Reassign failed:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-md border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h3 className="text-lg font-bold text-white font-heading">Reassign Task</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[250px]">{task.title}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Find staff..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:border-brand-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Staff List */}
                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {filteredUsers.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Users size={24} className="mx-auto mb-2 opacity-20" />
                                <p className="text-xs">No available staff found</p>
                            </div>
                        ) : (
                            filteredUsers.map(user => (
                                <button
                                    key={user.uid}
                                    onClick={() => setSelectedUserId(user.uid)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                        selectedUserId === user.uid 
                                        ? 'bg-brand-500/20 border-brand-500/50 text-white' 
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center text-[10px] font-bold">
                                            {user.displayName?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs font-bold">{user.displayName}</div>
                                            <div className="text-[10px] opacity-60">{user.department} • {user.position}</div>
                                        </div>
                                    </div>
                                    {selectedUserId === user.uid && <Check size={16} className="text-brand-400" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-6 bg-white/5 border-t border-white/10 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/5 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedUserId || isSubmitting}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? 'Reassigning...' : (
                            <>Confirm Reassign <ArrowRight size={14} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReassignModal;
