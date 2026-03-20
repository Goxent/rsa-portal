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
    if (type === 'EVENT') return { dot: 'bg-blue-400', bar: '', text: 'text-amber-500' };
    if (daysUntil < 0) return { dot: 'bg-red-500 animate-pulse', bar: '', text: 'text-red-500' };
    if (daysUntil <= 2) return { dot: 'bg-red-500', bar: '', text: 'text-red-500' };
    if (daysUntil <= 7) return { dot: 'bg-amber-500', bar: '', text: 'text-amber-500' };
    return { dot: 'bg-slate-300 dark:bg-slate-600', bar: '', text: 'text-slate-400' };
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
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 dark:bg-red-500/10 border border-red-500/10 dark:border-red-500/20 rounded-xl text-[11px] text-red-600 dark:text-red-300 font-bold mb-1">
                    <AlertTriangle size={11} className="flex-shrink-0" />
                    <span>{overdueCount} {overdueCount > 1 ? 'deadlines' : 'deadline'} past due</span>
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
                        className="flex items-center gap-4 px-2 py-2.5 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/[0.03] group"
                    >
                        {/* Status Dot */}
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-slate-700 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white truncate leading-tight transition-colors">{item.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-600 uppercase tracking-tight">{dateLabel}</span>
                                {item.description && (
                                    <>
                                        <span className="text-slate-200 dark:text-gray-800 text-[10px]">·</span>
                                        <span className="text-[10px] text-slate-400 dark:text-gray-500 truncate">{item.description}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Days badge */}
                        <div className={`flex-shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${daysUntil < 0 ? 'bg-red-500/10 text-red-600 border-red-500/10' :
                                daysUntil <= 2 ? 'bg-red-500/5 text-red-500 border-red-500/10' :
                                    daysUntil <= 7 ? 'bg-amber-500/5 text-amber-500 border-amber-500/10' :
                                        'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 border-transparent'
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
