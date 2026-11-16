import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Clock, Building2, ChevronDown, CheckCircle2, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NoticeService } from '../services/NoticeService';
import { Notice } from '../types';
import { formatTimeAgo, formatDateLong } from '../utils/dates';

export default function NoticesPage() {
    const { user } = useAuth();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            loadNotices();
        }
    }, [user]);

    const loadNotices = async () => {
        setIsLoading(true);
        if (user) {
            // Fetch notices that include the user or are for ALL
            const data = await NoticeService.getNotices(user.uid);
            setNotices(data);
        }
        setIsLoading(false);
    };

    const handleExpand = async (notice: Notice) => {
        const isCurrentlyExpanded = expandedNotice === notice.id;
        setExpandedNotice(isCurrentlyExpanded ? null : notice.id);

        // Mark as read if not already read
        if (!isCurrentlyExpanded && user && !notice.readBy?.includes(user.uid)) {
            await NoticeService.markAsRead(notice.id, user.uid);
            // Optmistic update
            setNotices(prev => prev.map(n => {
                if (n.id === notice.id) {
                    return { ...n, readBy: [...(n.readBy || []), user.uid] };
                }
                return n;
            }));
        }
    };

    const getPriorityColor = (p: string) => {
        if (p === 'HIGH') return 'text-[var(--color-danger)] bg-[rgba(224,112,122,0.1)] border-[rgba(224,112,122,0.25)]';
        if (p === 'MEDIUM') return 'text-[var(--color-warning)] bg-[rgba(217,164,65,0.1)] border-[rgba(217,164,65,0.25)]';
        return 'text-[var(--accent)] bg-[var(--accent-dim)] border-[var(--border-accent)]';
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            
            <div className="mb-8 p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2 flex items-center gap-3">
                        <Bell className="text-[var(--accent)]" size={28} /> Team Notices
                    </h1>
                    <p className="text-[var(--text-muted)] text-[15px]">Stay updated with official communications from R. Sapkota & Associates.</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
                    <p className="text-[var(--text-muted)] font-medium">Checking for latest notices...</p>
                </div>
            ) : notices.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-6 bg-[var(--bg-surface)] rounded-full flex items-center justify-center border border-[var(--border)]">
                        <CheckCircle2 size={36} className="text-[var(--accent)] opacity-80" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-heading)] mb-2">You're All Caught Up!</h3>
                    <p className="text-[var(--text-muted)] max-w-sm mx-auto">
                        There are no new notices or broadcasts assigned to you at this time.
                    </p>
                </div>
            ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-[var(--border)]">
                    {notices.map((notice, index) => {
                        const isRead = user && notice.readBy?.includes(user.uid);
                        const isExpanded = expandedNotice === notice.id;

                        return (
                            <div key={notice.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                {/* Timeline Dot */}
                                <div className={`flex items-center justify-center w-9 h-9 rounded-full border-2 border-[var(--border)] bg-[var(--bg-surface)] text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 overflow-hidden ${!isRead ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                                    {notice.priority === 'HIGH' ? (
                                        <div className="w-full h-full bg-[var(--color-danger)] flex items-center justify-center text-white"><Megaphone size={15} /></div>
                                    ) : !isRead ? (
                                        <div className="w-full h-full bg-[var(--accent)] flex items-center justify-center text-white"><Bell size={15} className="animate-pulse" /></div>
                                    ) : (
                                        <Megaphone size={15} className="text-[var(--text-muted)]" />
                                    )}
                                </div>
                                
                                {/* Card */}
                                <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-mid)] transition-colors cursor-pointer" onClick={() => handleExpand(notice)}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex gap-2">
                                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${getPriorityColor(notice.priority)}`}>
                                                {notice.priority.toLowerCase()}
                                            </span>
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border bg-[var(--bg-surface)] text-[var(--text-body)] border-[var(--border)]">
                                                {notice.type.toLowerCase()}
                                            </span>
                                        </div>
                                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 font-medium bg-[var(--bg-main)] px-2 py-1 rounded border border-[var(--border)]">
                                            <Clock size={12} /> {formatTimeAgo(notice.createdAt)}
                                        </span>
                                    </div>
                                    
                                    <h3 className={`font-bold ${!isRead ? 'text-[var(--accent)]' : 'text-[var(--text-heading)]'} flex items-start justify-between gap-2`}>
                                        <span className={isExpanded ? '' : 'line-clamp-2'}>{notice.title}</span>
                                        <ChevronDown size={18} className={`shrink-0 text-[var(--text-muted)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </h3>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-4 mt-4 border-t border-[var(--border)]">
                                                    <div className="prose prose-sm max-w-none text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">
                                                        {notice.content}
                                                    </div>
                                                    
                                                    <div className="mt-5 pt-3 border-t border-dashed border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                                                        <div className="flex items-center gap-1.5">
                                                            <Building2 size={12} />
                                                            <span>Official Notice by <strong className="text-[var(--text-heading)]">{notice.createdByName}</strong></span>
                                                        </div>
                                                        <span>{formatDateLong(notice.createdAt)}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
