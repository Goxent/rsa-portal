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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-main)]">
                    <div>
                        <h3 className="text-base font-semibold text-[var(--text-heading)]">Reassign task</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[260px]">{task.title}</p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                        <input
                            type="text"
                            placeholder="Find staff..."
                            className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--text-heading)] placeholder-[var(--text-subtle)] focus:border-[var(--border-accent)] outline-none transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Staff List */}
                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {filteredUsers.length === 0 ? (
                            <div className="text-center py-8 text-[var(--text-muted)]">
                                <Users size={22} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs">No available staff found</p>
                            </div>
                        ) : (
                            filteredUsers.map(user => (
                                <button
                                    key={user.uid}
                                    type="button"
                                    onClick={() => setSelectedUserId(user.uid)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                        selectedUserId === user.uid 
                                        ? 'bg-[var(--accent-dim)] border-[var(--border-accent)] ring-1 ring-[var(--accent)] text-[var(--text-heading)]' 
                                        : 'bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-heading)] hover:border-[var(--border-mid)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--text-heading)]">
                                            {user.displayName?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs font-semibold text-[var(--text-heading)]">{user.displayName}</div>
                                            <div className="text-[11px] text-[var(--text-muted)]">{user.department} • {user.position}</div>
                                        </div>
                                    </div>
                                    {selectedUserId === user.uid && <Check size={16} className="text-[var(--accent)]" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-4 bg-[var(--bg-main)] border-t border-[var(--border)] flex gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] text-xs font-medium hover:bg-[var(--accent-dim)] hover:text-[var(--text-heading)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedUserId || isSubmitting}
                        className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                    >
                        {isSubmitting ? 'Reassigning...' : (
                            <>Confirm reassign <ArrowRight size={13} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReassignModal;
