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
            priorityColor: t.signingPartnerId === currentUser.uid ? 'text-brand-400' : 'text-amber-400'
        }));
    }, [tasks, currentUser]);

    if (pendingReviews.length === 0) return null;

    return (
        <div className="bg-gradient-to-br from-brand-50/50 to-white dark:from-navy-950/40 dark:to-navy-950/40 border border-brand-200 dark:border-brand-500/20 rounded-[32px] overflow-hidden shadow-sm dark:shadow-2xl dark:shadow-brand-500/10 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="px-8 py-5 border-b border-brand-200 dark:border-white/5 bg-brand-500/10 dark:bg-brand-500/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-500 text-white rounded-xl shadow-md dark:shadow-lg shadow-brand-500/20">
                        <ShieldAlert size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-brand-900 dark:text-white uppercase tracking-widest">Reviewer's Action Center</h3>
                        <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-tight">Requires your digital sign-off</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/50 dark:bg-brand-500/10 rounded-full border border-brand-200 dark:border-brand-500/20 shadow-sm dark:shadow-none">
                    <span className="w-2 h-2 rounded-full bg-brand-500 dark:bg-brand-400 animate-pulse" />
                    <span className="text-[10px] font-black text-brand-700 dark:text-brand-400 uppercase tracking-widest">{pendingReviews.length} Pending</span>
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
                        className="group relative p-5 rounded-2xl bg-white dark:bg-white/[0.02] border border-brand-100 dark:border-white/5 hover:border-brand-300 dark:hover:border-brand-500/30 hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-md dark:shadow-none"
                    >
                        {/* Background pattern */}
                        <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-5 text-brand-500 group-hover:scale-110 transition-transform">
                            {task.reviewRole === 'SIGNING PARTNER' ? <ShieldAlert size={80} /> : <UserCheck size={80} />}
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 ${task.priorityColor === 'text-brand-400' ? 'text-brand-600 dark:text-brand-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {task.reviewRole}
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-500">
                                    <Clock size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">Drafted</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-black text-slate-800 dark:text-gray-200 group-hover:text-brand-800 dark:group-hover:text-white transition-colors line-clamp-1 truncate uppercase tracking-tight">
                                    {task.title}
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest mt-1 truncate">
                                    {task.clientName || 'Direct Engagement'}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                                <div className="flex -space-x-2">
                                    {task.assignedTo.slice(0, 3).map((uid, i) => (
                                        <div key={uid} className="w-6 h-6 rounded-full border-2 border-white dark:border-navy-950 bg-slate-100 dark:bg-navy-900 flex items-center justify-center text-[8px] font-black text-slate-500 dark:text-gray-400">
                                            {uid.substring(0, 1).toUpperCase()}
                                        </div>
                                    ))}
                                    {task.assignedTo.length > 3 && (
                                        <div className="w-6 h-6 rounded-full border-2 border-white dark:border-navy-950 bg-slate-100 dark:bg-navy-900 flex items-center justify-center text-[8px] font-black text-slate-500 dark:text-gray-400">
                                            +{task.assignedTo.length - 3}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
