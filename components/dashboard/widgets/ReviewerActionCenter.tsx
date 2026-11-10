import React, { useMemo } from 'react';
import { ShieldCheck, UserCheck, ArrowRight, ShieldAlert, Clock, AlertCircle, MessageSquare, Users } from 'lucide-react';
import { Task, UserProfile, TaskStatus, AuditPhase, UserRole } from '../../../types';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface ReviewerActionCenterProps {
    tasks: Task[];
    currentUser?: UserProfile | null;
    onViewTask: (task: Task) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const daysSince = (isoString: string | undefined): number => {
    if (!isoString) return 0;
    const diff = Date.now() - new Date(isoString).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};

/**
 * Returns the layer that is currently blocking the task.
 * Sequential chain: Team Leader → Engagement Reviewer → Signing Partner.
 */
const getBlockingLayer = (task: Task): 'TEAM_LEADER' | 'ENGAGEMENT_REVIEWER' | 'SIGNING_PARTNER' | null => {
    if (!task.teamLeaderId) return 'ENGAGEMENT_REVIEWER'; // no TL assigned — go straight to ER
    if (!task.teamLeadApprovedAt) return 'TEAM_LEADER';
    if (task.engagementReviewerId && !task.engagementReviewerApprovedAt) return 'ENGAGEMENT_REVIEWER';
    if (task.signingPartnerId && !task.signingPartnerApprovedAt) return 'SIGNING_PARTNER';
    return null; // all done
};

/** Returns the name of whoever is blocking *before* this user (for the "waiting on" label). */
const getBlockerName = (task: Task, myLayer: string): string | null => {
    if (myLayer === 'ENGAGEMENT_REVIEWER' && task.teamLeaderId && !task.teamLeadApprovedAt) {
        return 'Team Leader';
    }
    if (myLayer === 'SIGNING_PARTNER') {
        if (task.teamLeaderId && !task.teamLeadApprovedAt) return 'Team Leader';
        if (task.engagementReviewerId && !task.engagementReviewerApprovedAt) return 'Engagement Reviewer';
    }
    return null;
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface ReviewCard {
    task: Task;
    myLayer: string;
    myLabel: string;
    isReady: boolean;
    blockerName: string | null;
    daysWaiting: number;
    section: 'sign_off' | 'queries';
}

const ReviewTaskCard: React.FC<{ card: ReviewCard; onView: (t: Task) => void; idx: number }> = ({ card, onView, idx }) => {
    const { task, myLabel, isReady, blockerName, daysWaiting } = card;

    const statusColor = isReady ? 'text-brand-600 dark:text-brand-400 border-brand-500/30 bg-brand-500/10'
        : 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.08 }}
            onClick={() => onView(task)}
            className="group relative p-4 rounded-lg border transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-card"
            style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
            {/* Role badge */}
            <div className="flex justify-between items-start mb-3">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${statusColor}`}>
                    {myLabel}
                </span>
                {daysWaiting > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted font-bold">
                        <Clock size={10} />
                        {daysWaiting}d waiting
                    </span>
                )}
            </div>

            {/* Task info */}
            <h4 className="text-[13px] font-bold leading-snug truncate uppercase tracking-tight mb-1" style={{ color: 'var(--text-heading)' }}>
                {task.title}
            </h4>
            <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: 'var(--text-muted)' }}>
                {task.clientName || 'Direct Engagement'}
            </p>

            {/* Waiting-on notice (D3) */}
            {!isReady && blockerName && (
                <div className="mt-2 flex items-center gap-1.5 text-amber-500 text-[10px] font-bold">
                    <AlertCircle size={11} />
                    Waiting on {blockerName}
                </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <div className="flex -space-x-1.5">
                    {(task.assignedTo || []).slice(0, 3).map((uid) => (
                        <div key={uid} className="w-5 h-5 rounded-md border flex items-center justify-center text-[9px] font-black"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                            {uid.substring(0, 1).toUpperCase()}
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--accent)' }}>
                    <span className="text-[9px] font-black uppercase tracking-widest">
                        {isReady ? 'Sign-off' : 'View'}
                    </span>
                    <ArrowRight size={12} />
                </div>
            </div>
        </motion.div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

const ReviewerActionCenter: React.FC<ReviewerActionCenterProps> = ({ tasks, currentUser, onViewTask }) => {
    const { signOffCards, queryCards } = useMemo(() => {
        if (!currentUser) return { signOffCards: [] as ReviewCard[], queryCards: [] as ReviewCard[] };

        const uid = currentUser.uid;
        const isStaff = currentUser.role === UserRole.STAFF;

        const signOff: ReviewCard[] = [];
        const queries: ReviewCard[] = [];

        tasks.forEach(t => {
            if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.ARCHIVED) return;

            // ── D2: determine which review layer this user occupies ──────────
            let myLayer: string | null = null;
            let myLabel = '';

            if (t.teamLeaderId === uid) {
                myLayer = 'TEAM_LEADER';
                myLabel = 'Team Leader';
            } else if (t.engagementReviewerId === uid) {
                myLayer = 'ENGAGEMENT_REVIEWER';
                myLabel = 'Engagement Reviewer';
            } else if (t.signingPartnerId === uid) {
                myLayer = 'SIGNING_PARTNER';
                myLabel = 'Signing Partner';
            }

            // ── D4: Check for open queries the current user raised (staff reply awaited) ──
            if (t.subtasks && uid !== undefined) {
                const openQueriesRaisedByMe = t.subtasks.filter(s =>
                    s.queryStatus === 'OPEN' && s.queryRaisedBy === uid
                );
                if (openQueriesRaisedByMe.length > 0) {
                    queries.push({
                        task: t,
                        myLayer: myLayer || 'REVIEWER',
                        myLabel: myLabel || 'Reviewer',
                        isReady: false,
                        blockerName: null,
                        daysWaiting: openQueriesRaisedByMe.reduce((max, s) => {
                            const d = daysSince(s.queryRaisedAt);
                            return d > max ? d : max;
                        }, 0),
                        section: 'queries',
                    });
                }
            }

            if (!myLayer) return;

            // ── D2 + D3: Check if this layer needs to sign off ───────────────
            const alreadySigned =
                (myLayer === 'TEAM_LEADER' && !!t.teamLeadApprovedAt) ||
                (myLayer === 'ENGAGEMENT_REVIEWER' && !!t.engagementReviewerApprovedAt) ||
                (myLayer === 'SIGNING_PARTNER' && !!t.signingPartnerApprovedAt);

            if (alreadySigned) return;

            // Only tasks in UNDER_REVIEW status should appear in the action center
            if (t.status !== TaskStatus.UNDER_REVIEW) return;

            const blockingLayer = getBlockingLayer(t);
            const isMyTurn = blockingLayer === myLayer;
            // D3: Show "ready" only if it's truly my turn, "waiting" if someone before me hasn't signed
            const blockerName = isMyTurn ? null : getBlockerName(t, myLayer);

            // Compute days waiting since task last moved to UNDER_REVIEW (approximated by updatedAt)
            const daysWaiting = daysSince(t.updatedAt || t.createdAt);

            signOff.push({
                task: t,
                myLayer,
                myLabel,
                isReady: isMyTurn,
                blockerName,
                daysWaiting,
                section: 'sign_off',
            });
        });

        return { signOffCards: signOff, queryCards: queries };
    }, [tasks, currentUser]);

    const totalActions = signOffCards.length + queryCards.length;

    if (totalActions === 0) return null;

    const readyCards = signOffCards.filter(c => c.isReady);
    const waitingCards = signOffCards.filter(c => !c.isReady);

    return (
        <div className="rounded-xl overflow-hidden shadow-card mb-8 animate-in fade-in slide-in-from-top-4 duration-700 border"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>

            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg shadow-sm" style={{ background: 'var(--accent)' }}>
                        <ShieldAlert size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.1em]" style={{ color: 'var(--text-heading)' }}>
                            Reviewer's Action Center
                        </h3>
                        <p className="text-[10px] font-bold uppercase tracking-tight" style={{ color: 'var(--text-muted)' }}>
                            {readyCards.length > 0 && `${readyCards.length} ready for you`}
                            {readyCards.length > 0 && waitingCards.length > 0 && ' · '}
                            {waitingCards.length > 0 && `${waitingCards.length} waiting on others`}
                            {queryCards.length > 0 && ` · ${queryCards.length} query reply${queryCards.length !== 1 ? 's' : ''} pending`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-heading)' }}>
                        {totalActions} ACTION{totalActions !== 1 ? 'S' : ''}
                    </span>
                </div>
            </div>

            <div className="p-4 space-y-5">
                {/* D3: "Ready for you" section */}
                {readyCards.length > 0 && (
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                            <ShieldCheck size={11} /> Ready for your sign-off
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {readyCards.map((card, idx) => (
                                <ReviewTaskCard key={card.task.id + '-ready'} card={card} onView={onViewTask} idx={idx} />
                            ))}
                        </div>
                    </div>
                )}

                {/* D3: "Waiting on someone earlier" section */}
                {waitingCards.length > 0 && (
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                            <Clock size={11} /> Waiting on earlier reviewer
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {waitingCards.map((card, idx) => (
                                <ReviewTaskCard key={card.task.id + '-waiting'} card={card} onView={onViewTask} idx={idx} />
                            ))}
                        </div>
                    </div>
                )}

                {/* D4: Open queries awaiting staff reply */}
                {queryCards.length > 0 && (
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                            <MessageSquare size={11} /> Your open queries — awaiting reply
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {queryCards.map((card, idx) => (
                                <ReviewTaskCard key={card.task.id + '-query'} card={card} onView={onViewTask} idx={idx} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewerActionCenter;
