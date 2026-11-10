import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, AlertCircle, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
// @ts-ignore
import NepaliDate from 'nepali-date-converter';
import { ComplianceEvent } from '../../../types/advanced';

interface FirmDeadlinesStripProps {
    complianceEvents: ComplianceEvent[];
    isLoading?: boolean;
}

const toBSString = (dateStr: string): string => {
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const nd = new NepaliDate(d);
            return nd.format('DD MMMM');
        }
        return '';
    } catch {
        return '';
    }
};

const getDaysDiff = (dateStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const FirmDeadlinesStrip: React.FC<FirmDeadlinesStripProps> = ({ complianceEvents, isLoading }) => {
    const navigate = useNavigate();

    // Filter for upcoming statutory / compliance events (next 30 days or overdue)
    const activeDeadlines = React.useMemo(() => {
        if (!complianceEvents) return [];
        return complianceEvents
            .filter(e => e.status !== 'COMPLETED')
            .map(e => ({
                ...e,
                daysRemaining: getDaysDiff(e.dueDate),
                bsDate: toBSString(e.dueDate)
            }))
            .filter(e => e.daysRemaining >= -7 && e.daysRemaining <= 45) // recent overdue up to 45 days ahead
            .sort((a, b) => a.daysRemaining - b.daysRemaining)
            .slice(0, 4);
    }, [complianceEvents]);

    if (isLoading) {
        return (
            <div className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }} />
        );
    }

    if (activeDeadlines.length === 0) {
        return null; // Don't take space if no statutory deadlines are in window
    }

    return (
        <div
            className="rounded-xl border p-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 shadow-xs transition-all"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-mid)',
            }}
            role="region"
            aria-label="Firm compliance deadlines"
        >
            {/* Header label */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <div className="p-1.5 rounded-lg text-amber-500 bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle size={15} />
                </div>
                <div>
                    <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-heading)' }}>
                        Firm & Statutory Deadlines
                    </h4>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        Compliance calendar
                    </p>
                </div>
            </div>

            {/* Deadline pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto custom-scrollbar pb-1 lg:pb-0">
                {activeDeadlines.map((item) => {
                    const isOverdue = item.daysRemaining < 0;
                    const isDueToday = item.daysRemaining === 0;
                    const isUrgent = item.daysRemaining > 0 && item.daysRemaining <= 5;

                    let badgeColor = 'text-muted bg-white/[0.03] border-border';
                    if (isOverdue) badgeColor = 'text-rose-500 bg-rose-500/10 border-rose-500/30';
                    else if (isDueToday) badgeColor = 'text-accent bg-accent/15 border-accent/40 animate-pulse';
                    else if (isUrgent) badgeColor = 'text-amber-500 bg-amber-500/10 border-amber-500/30';

                    return (
                        <div
                            key={item.id}
                            onClick={() => navigate('/compliance')}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer hover:scale-[1.02] transition-all flex-shrink-0 ${badgeColor}`}
                            title={`${item.title} — Due ${item.dueDate} (${item.bsDate ? item.bsDate + ' BS' : ''})`}
                        >
                            <span className="text-xs font-bold leading-tight max-w-[140px] truncate" style={{ color: 'var(--text-heading)' }}>
                                {item.title}
                            </span>
                            {item.bsDate && (
                                <span className="text-[10px] font-semibold text-muted hidden sm:inline">
                                    {item.bsDate} BS
                                </span>
                            )}
                            <span className={`text-[10px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded ${
                                isOverdue ? 'bg-rose-500 text-white' :
                                isDueToday ? 'bg-accent text-white' :
                                isUrgent ? 'bg-amber-500/20 text-amber-400' :
                                'bg-white/10 text-muted'
                            }`}>
                                {isOverdue ? `${Math.abs(item.daysRemaining)}d late` :
                                 isDueToday ? 'Today' :
                                 `in ${item.daysRemaining}d`}
                            </span>
                        </div>
                    );
                })}

                <button
                    onClick={() => navigate('/compliance')}
                    className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-lg hover:underline transition-colors flex-shrink-0"
                    style={{ color: 'var(--accent)' }}
                    aria-label="View all compliance events"
                >
                    All <ArrowRight size={11} />
                </button>
            </div>
        </div>
    );
};

export default FirmDeadlinesStrip;
