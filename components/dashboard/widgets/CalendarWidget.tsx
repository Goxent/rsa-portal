import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Flag, Clock, ArrowRight } from 'lucide-react';

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

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ upcomingSchedule = [] }) => {
    const navigate = useNavigate();

    if (upcomingSchedule.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Calendar size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No upcoming events</p>
            </div>
        );
    }

    // Group by date
    const groupedSchedule = upcomingSchedule.slice(0, 6).reduce((acc, item) => {
        const dateKey = item.date;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(item);
        return acc;
    }, {} as Record<string, ScheduleItem[]>);

    return (
        <div className="space-y-3">
            {Object.entries(groupedSchedule).slice(0, 3).map(([date, items]) => (
                <div key={date} className="space-y-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {new Date(date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        })}
                    </div>
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            {item.type === 'EVENT' ? (
                                <Calendar size={14} className="text-brand-400" />
                            ) : (
                                <Flag size={14} className={
                                    item.subType === 'URGENT' ? 'text-red-400' :
                                        item.subType === 'HIGH' ? 'text-orange-400' : 'text-yellow-400'
                                } />
                            )}
                            <div className="flex-1 min-w-0">
                                <span className="text-sm text-white truncate block">{item.title}</span>
                                {item.description && (
                                    <span className="text-xs text-gray-400">{item.description}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            <button
                onClick={() => navigate('/calendar')}
                className="flex items-center justify-center gap-2 w-full py-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
                View calendar
                <ArrowRight size={14} />
            </button>
        </div>
    );
};

export default CalendarWidget;
