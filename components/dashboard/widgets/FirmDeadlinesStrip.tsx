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
            className="rounded-[var(--radius-lg)] border p-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 transition-colors duration-150"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
            }}
            role="region"
            aria-label="Firm compliance deadlines"
        >
            {/* Header label */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <div className="p-1.5 rounded-[var(--radius-sm)]" style={{ background: 'rgba(217,164,65,0.1)', color: 'var(--color-warning)' }}>
                    <AlertCircle size={15} strokeWidth={1.75} />
                </div>
                <div>
                    <h4 className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
                        Firm & statutory deadlines
                    </h4>
                    <p className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
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

                    let pillStyle = {
                        background: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-body)'
                    };
                    let badgeStyle = {
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-muted)'
                    };

                    if (isOverdue) {
                        pillStyle = {
                            background: 'rgba(224,112,122,0.08)',
                            borderColor: 'rgba(224,112,122,0.25)',
                            color: 'var(--color-danger)'
                        };
                        badgeStyle = {
                            background: 'var(--color-danger)',
                            color: '#ffffff'
                        };
                    } else if (isDueToday) {
                        pillStyle = {
                            background: 'var(--accent-dim)',
                            borderColor: 'var(--border-accent)',
                            color: 'var(--accent)'
                        };
                        badgeStyle = {
                            background: 'var(--accent)',
                            color: 'var(--on-accent)'
                        };
                    } else if (isUrgent) {
                        pillStyle = {
                            background: 'rgba(217,164,65,0.08)',
                            borderColor: 'rgba(217,164,65,0.25)',
                            color: 'var(--color-warning)'
                        };
                        badgeStyle = {
                            background: 'rgba(217,164,65,0.2)',
                            color: 'var(--color-warning)'
                        };
                    }

                    return (
                        <div
                            key={item.id}
                            onClick={() => navigate('/compliance')}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-md)] border cursor-pointer transition-colors duration-150 flex-shrink-0 hover:border-[var(--border-mid)]"
                            style={pillStyle}
                            title={`${item.title} — Due ${item.dueDate} (${item.bsDate ? item.bsDate + ' BS' : ''})`}
                        >
                            <span className="text-xs font-medium leading-tight max-w-[140px] truncate" style={{ color: 'var(--text-heading)' }}>
                                {item.title}
                            </span>
                            {item.bsDate && (
                                <span className="text-[11px] tabular-nums hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                                    {item.bsDate} BS
                                </span>
                            )}
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[var(--radius-sm)] tabular-nums" style={badgeStyle}>
                                {isOverdue ? `${Math.abs(item.daysRemaining)}d late` :
                                 isDueToday ? 'Today' :
                                 `in ${item.daysRemaining}d`}
                            </span>
                        </div>
                    );
                })}

                <button
                    onClick={() => navigate('/compliance')}
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-[var(--radius-md)] hover:underline transition-colors flex-shrink-0"
                    style={{ color: 'var(--accent)' }}
                    aria-label="View all compliance events"
                >
                    All <ArrowRight size={12} strokeWidth={1.75} />
                </button>
            </div>
        </div>
    );
};

export default FirmDeadlinesStrip;
