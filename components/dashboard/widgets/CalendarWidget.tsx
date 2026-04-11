import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, AlertTriangle } from 'lucide-react';

interface ScheduleItem {
    id: string;
    title: string;
    date: string;
    type: 'EVENT' | 'DEADLINE';
    subType?: string;
    description?: string;
}

interface CalendarWidgetProps {
    upcomingSchedule?: ScheduleItem[];
    isLoading?: boolean;
}

const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getUrgencyStyle = (daysUntil: number, type: string) => {
    if (daysUntil === 0) return { dot: 'bg-accent shadow-[0_0_8px_var(--accent-glow)] animate-pulse', badge: 'bg-accent text-white border-transparent' };
    if (type === 'EVENT') return { dot: 'bg-sky-400', badge: 'bg-sky-500/10 text-sky-500 border-sky-500/20' };
    if (daysUntil < 0)  return { dot: 'bg-status-halted animate-pulse', badge: 'bg-status-halted text-white border-transparent' };
    if (daysUntil <= 2) return { dot: 'bg-status-halted', badge: 'bg-status-halted-dim text-status-halted border-status-halted-dim' };
    if (daysUntil <= 7) return { dot: 'bg-brand-500', badge: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20' };
    return { dot: 'bg-slate-300 dark:bg-slate-700', badge: 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-white/10' };
};

// Skeleton loader for this widget
const CalendarSkeleton: React.FC = () => (
    <div className="space-y-2.5 animate-pulse p-2">
        {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-border flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded bg-border w-3/4" />
                    <div className="h-2.5 rounded bg-border w-1/2 opacity-50" />
                </div>
                <div className="h-5 w-14 rounded-md bg-border" />
            </div>
        ))}
    </div>
);

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ upcomingSchedule = [], isLoading = false }) => {
    const navigate = useNavigate();

    const handleDateClick = (dateStr: string) => {
        navigate(`/calendar?date=${dateStr}`);
    };

    if (isLoading) return <CalendarSkeleton />;

    if (upcomingSchedule.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[160px] text-muted">
                <Calendar size={24} className="mb-2 opacity-20" />
                <p className="text-[11px] font-medium uppercase tracking-widest">No Events</p>
                <button onClick={() => navigate('/calendar')} className="text-[10px] text-accent hover:underline mt-2 transition-all font-bold uppercase tracking-widest">
                    Open Planner
                </button>
            </div>
        );
    }

    const items = upcomingSchedule.slice(0, 5); // Kept compact
    const overdueCount = items.filter(i => i.type === 'DEADLINE' && getDaysUntil(i.date) < 0).length;

    return (
        <div className="space-y-1 py-1">
            {overdueCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-status-halted-dim border border-status-halted-dim rounded-lg text-[10px] text-status-halted font-black uppercase tracking-wider mb-2">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    <span>{overdueCount} {overdueCount > 1 ? 'deadlines' : 'deadline'} past due</span>
                </div>
            )}

            {items.map((item) => {
                const daysUntil = getDaysUntil(item.date);
                const style = getUrgencyStyle(daysUntil, item.type);
                const dateLabel = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                let daysLabel = '';
                if (daysUntil < 0)       daysLabel = `${Math.abs(daysUntil)}d past`;
                else if (daysUntil === 0) daysLabel = 'Today';
                else if (daysUntil === 1) daysLabel = 'Tmrw';
                else                      daysLabel = `${daysUntil}d left`;

                return (
                    <button
                        key={item.id}
                        onClick={() => handleDateClick(item.date)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-surface group text-left border border-transparent hover:border-border"
                    >
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot} shadow-sm`} />

                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-heading group-hover:text-accent truncate leading-tight transition-colors">{item.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] font-bold text-muted uppercase tracking-widest">{dateLabel}</span>
                                {item.description && (
                                    <>
                                        <span className="text-muted/30 text-[10px]">·</span>
                                        <span className="text-[9px] text-muted truncate italic">"{item.description}"</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={`flex-shrink-0 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${style.badge}`}>
                            {daysLabel}
                        </div>
                    </button>
                );
            })}

            <button
                onClick={() => navigate('/calendar')}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-2 text-[10px] text-muted hover:text-accent transition-all font-black uppercase tracking-[0.1em] border-t border-border/50"
            >
                Full Schedule <ArrowRight size={12} />
            </button>
        </div>
    );
};

export default CalendarWidget;
