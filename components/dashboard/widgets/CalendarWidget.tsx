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
    if (type === 'EVENT') return { dot: 'bg-sky-400', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
    if (daysUntil < 0)  return { dot: 'bg-rose-500 animate-pulse', badge: 'bg-rose-500 text-white border-transparent' };
    if (daysUntil <= 2) return { dot: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    if (daysUntil <= 7) return { dot: 'bg-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { dot: 'bg-slate-500', badge: 'bg-white/5 text-gray-400 border-transparent' };
};

// Skeleton loader for this widget
const CalendarSkeleton: React.FC = () => (
    <div className="space-y-2.5 animate-pulse">
        {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded bg-white/10 w-3/4" />
                    <div className="h-2.5 rounded bg-white/[0.06] w-1/2" />
                </div>
                <div className="h-5 w-14 rounded-md bg-white/10" />
            </div>
        ))}
    </div>
);

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ upcomingSchedule = [], isLoading = false }) => {
    const navigate = useNavigate();

    const handleDateClick = (dateStr: string) => {
        // Deep-link to calendar page with the selected date as a query param
        navigate(`/calendar?date=${dateStr}`);
    };

    if (isLoading) return <CalendarSkeleton />;

    if (upcomingSchedule.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <Calendar size={28} className="mb-2 opacity-30" />
                <p className="text-sm">No upcoming events</p>
                <button onClick={() => navigate('/calendar')} className="text-xs text-brand-400 hover:text-brand-300 mt-2 transition-colors">
                    Open calendar →
                </button>
            </div>
        );
    }

    const items = upcomingSchedule.slice(0, 6);
    const overdueCount = items.filter(i => i.type === 'DEADLINE' && getDaysUntil(i.date) < 0).length;

    return (
        <div className="space-y-1">
            {overdueCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-300 font-bold mb-2">
                    <AlertTriangle size={11} className="flex-shrink-0" />
                    <span>{overdueCount} {overdueCount > 1 ? 'deadlines' : 'deadline'} past due</span>
                </div>
            )}

            {items.map((item) => {
                const daysUntil = getDaysUntil(item.date);
                const style = getUrgencyStyle(daysUntil, item.type);
                const dateLabel = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                let daysLabel = '';
                if (daysUntil < 0)       daysLabel = `${Math.abs(daysUntil)}d overdue`;
                else if (daysUntil === 0) daysLabel = 'Today';
                else if (daysUntil === 1) daysLabel = 'Tomorrow';
                else                      daysLabel = `${daysUntil}d left`;

                return (
                    <button
                        key={item.id}
                        onClick={() => handleDateClick(item.date)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-white/[0.05] hover:translate-x-1 group text-left"
                    >
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />

                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-200 group-hover:text-white truncate leading-tight transition-colors">{item.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{dateLabel}</span>
                                {item.description && (
                                    <>
                                        <span className="text-gray-700 text-[10px]">·</span>
                                        <span className="text-[10px] text-gray-600 truncate">{item.description}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={`flex-shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${style.badge}`}>
                            {daysLabel}
                        </div>
                    </button>
                );
            })}

            <button
                onClick={() => navigate('/calendar')}
                className="flex items-center justify-center gap-1.5 w-full py-2 mt-1 text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
            >
                View full calendar <ArrowRight size={12} />
            </button>
        </div>
    );
};

export default CalendarWidget;
