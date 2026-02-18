import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Flag, Clock, ArrowRight, AlertTriangle } from 'lucide-react';

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
}

const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getUrgencyStyle = (daysUntil: number, type: string) => {
    if (type === 'EVENT') return { dot: 'bg-brand-400', bar: 'bg-brand-500/20 border-brand-500/15', text: 'text-brand-400' };
    if (daysUntil < 0) return { dot: 'bg-red-400 animate-pulse', bar: 'bg-red-500/15 border-red-500/20', text: 'text-red-400' };
    if (daysUntil <= 2) return { dot: 'bg-red-400', bar: 'bg-red-500/10 border-red-500/15', text: 'text-red-400' };
    if (daysUntil <= 7) return { dot: 'bg-amber-400', bar: 'bg-amber-500/10 border-amber-500/15', text: 'text-amber-400' };
    return { dot: 'bg-gray-500', bar: 'bg-white/3 border-white/8', text: 'text-gray-400' };
};

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ upcomingSchedule = [] }) => {
    const navigate = useNavigate();

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
        <div className="space-y-2">
            {/* Overdue alert */}
            {overdueCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 mb-1">
                    <AlertTriangle size={11} className="flex-shrink-0" />
                    <span>{overdueCount} deadline{overdueCount > 1 ? 's' : ''} past due</span>
                </div>
            )}

            {items.map((item) => {
                const daysUntil = getDaysUntil(item.date);
                const style = getUrgencyStyle(daysUntil, item.type);
                const dateLabel = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                let daysLabel = '';
                if (daysUntil < 0) daysLabel = `${Math.abs(daysUntil)}d overdue`;
                else if (daysUntil === 0) daysLabel = 'Today';
                else if (daysUntil === 1) daysLabel = 'Tomorrow';
                else daysLabel = `${daysUntil}d left`;

                return (
                    <div
                        key={item.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-150 hover:scale-[1.01] ${style.bar}`}
                    >
                        {/* Type icon */}
                        <div className="flex-shrink-0">
                            {item.type === 'EVENT'
                                ? <Calendar size={14} className="text-brand-400" />
                                : <Flag size={14} className={style.text} />
                            }
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-white truncate leading-tight">{item.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-gray-500">{dateLabel}</span>
                                {item.description && (
                                    <>
                                        <span className="text-[10px] text-gray-700">·</span>
                                        <span className="text-[10px] text-gray-500 truncate">{item.description}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Days badge */}
                        <div className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${daysUntil < 0 ? 'bg-red-500/20 text-red-300' :
                                daysUntil <= 2 ? 'bg-red-500/15 text-red-400' :
                                    daysUntil <= 7 ? 'bg-amber-500/15 text-amber-400' :
                                        'bg-white/5 text-gray-500'
                            }`}>
                            {daysLabel}
                        </div>
                    </div>
                );
            })}

            <button
                onClick={() => navigate('/calendar')}
                className="flex items-center justify-center gap-1.5 w-full py-2 text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
            >
                View full calendar <ArrowRight size={12} />
            </button>
        </div>
    );
};

export default CalendarWidget;
