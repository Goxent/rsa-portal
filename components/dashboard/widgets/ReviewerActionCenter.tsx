import React, { useMemo } from 'react';
import { ShieldCheck, UserCheck, ArrowRight, ShieldAlert, Clock, AlertCircle } from 'lucide-react';
import { Task, UserProfile, TaskStatus } from '../../../types';
import { motion } from 'framer-motion';

interface ReviewerActionCenterProps {
    tasks: Task[];
    currentUser?: UserProfile | null;
    onViewTask: (task: Task) => void;
}

const ReviewerActionCenter: React.FC<ReviewerActionCenterProps> = ({ tasks, currentUser, onViewTask }) => {
    const pendingReviews = useMemo(() => {
        if (!currentUser) return [];

        return tasks.filter(t => {
            // Only tasks in Review phase
            if (t.status !== TaskStatus.UNDER_REVIEW) return false;

            const isER = t.engagementReviewerId === currentUser.uid && !t.engagementReviewerApprovedAt;
            const isPartner = t.signingPartnerId === currentUser.uid && !t.signingPartnerApprovedAt;
            
            return isER || isPartner;
        }).map(t => ({
            ...t,
            reviewRole: t.signingPartnerId === currentUser.uid ? 'SIGNING PARTNER' : 'ENGAGEMENT REVIEWER',
            priorityStyle: t.signingPartnerId === currentUser.uid ? 'text-accent border-accent/20 bg-accent/5' : 'text-status-pending border-status-pending-dim bg-status-pending-dim'
        }));
    }, [tasks, currentUser]);

    if (pendingReviews.length === 0) return null;

    return (
        <div className="bg-secondary border border-border rounded-xl overflow-hidden shadow-card mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            {/* Header Banner */}
            <div className="px-6 py-4 border-b border-border bg-accent/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-accent text-white rounded-lg shadow-accent-glow">
                        <ShieldAlert size={18} />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black text-heading uppercase tracking-[0.1em]">Reviewer's Action Center</h3>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-tight">Required Digital Sign-Offs Found</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-surface rounded-full border border-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-halted animate-pulse" />
                    <span className="text-[10px] font-black text-heading uppercase tracking-widest">{pendingReviews.length} ACTION{pendingReviews.length !== 1 ? 'S' : ''}</span>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingReviews.map((task, idx) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        key={task.id}
                        onClick={() => onViewTask(task)}
                        className="group relative p-5 rounded-lg bg-surface border border-border hover:border-accent/40 hover:bg-secondary/40 transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-card"
                    >
                        {/* Background pattern */}
                        <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-accent group-hover:scale-110 transition-transform">
                            {task.reviewRole === 'SIGNING PARTNER' ? <ShieldAlert size={80} /> : <UserCheck size={80} />}
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${task.priorityStyle}`}>
                                    {task.reviewRole}
                                </div>
                                <div className="flex items-center gap-1.5 text-muted">
                                    <Clock size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-tight">Review Phase</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[13px] font-bold text-heading group-hover:text-accent transition-colors line-clamp-1 truncate uppercase tracking-tight">
                                    {task.title}
                                </h4>
                                <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1 truncate">
                                    {task.clientName || 'Direct Engagement'}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                                <div className="flex -space-x-1.5">
                                    {task.assignedTo.slice(0, 3).map((uid, i) => (
                                        <div key={uid} className="w-6 h-6 rounded-md border border-border bg-secondary flex items-center justify-center text-[9px] font-black text-muted">
                                            {uid.substring(0, 1).toUpperCase()}
                                        </div>
                                    ))}
                                    {task.assignedTo.length > 3 && (
                                        <div className="w-6 h-6 rounded-md border border-border bg-secondary flex items-center justify-center text-[9px] font-black text-muted">
                                            +{task.assignedTo.length - 3}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[9px] font-black uppercase tracking-widest">Sign-off</span>
                                    <ArrowRight size={14} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default ReviewerActionCenter;
