import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckSquare, Bell, CalendarDays, TrendingUp, Wifi } from 'lucide-react';
// @ts-ignore
import NepaliDate from 'nepali-date-converter';

interface CommandStripProps {
    pendingTasksCount: number;
    unreadNotifications: number;
    clockedIn?: boolean;
    onNotificationsClick?: () => void;
}

const toBS = (date: Date): string => {
    try {
        const nd = new NepaliDate(date);
        return nd.format('DD MMM YYYY');
    } catch {
        return '';
    }
};

const CommandStrip: React.FC<CommandStripProps> = ({
    pendingTasksCount,
    unreadNotifications,
    clockedIn = false,
    onNotificationsClick,
}) => {
    const navigate = useNavigate();
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const adDate = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const bsDate = toBS(now);
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const chips: { icon: React.ReactNode; label: string; value: string | number; accent: string; onClick?: () => void }[] = [
        {
            icon: <CalendarDays size={13} />,
            label: 'Today',
            value: `${adDate}${bsDate ? ` · ${bsDate} BS` : ''}`,
            accent: 'text-brand-400',
        },
        {
            icon: <Clock size={13} />,
            label: 'Time',
            value: timeStr,
            accent: 'text-sky-400',
        },
        {
            icon: <Wifi size={13} className={clockedIn ? 'text-emerald-400' : 'text-gray-600'} />,
            label: 'Status',
            value: clockedIn ? 'Clocked In' : 'Not Clocked In',
            accent: clockedIn ? 'text-emerald-400' : 'text-gray-500',
            onClick: () => navigate('/attendance'),
        },
        {
            icon: <CheckSquare size={13} />,
            label: 'Open Tasks',
            value: pendingTasksCount,
            accent: pendingTasksCount > 5 ? 'text-rose-400' : pendingTasksCount > 0 ? 'text-amber-400' : 'text-emerald-400',
            onClick: () => navigate('/tasks'),
        },
        {
            icon: <Bell size={13} />,
            label: 'Notifications',
            value: unreadNotifications > 0 ? unreadNotifications : '—',
            accent: unreadNotifications > 0 ? 'text-amber-400' : 'text-gray-500',
            onClick: onNotificationsClick,
        },
    ];

    return (
        <div
            className="sticky top-0 z-30 flex items-center gap-2 flex-wrap px-4 py-2.5 rounded-xl overflow-hidden"
            style={{
                background: 'rgba(17,17,19,0.85)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
        >
            {/* Subtle top rule */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

            {chips.map((chip, i) => (
                <React.Fragment key={chip.label}>
                    {i > 0 && <div className="w-px h-5 bg-white/10 flex-shrink-0 hidden sm:block" />}
                    <button
                        onClick={chip.onClick}
                        disabled={!chip.onClick}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-150 select-none flex-shrink-0
                            ${chip.onClick
                                ? 'hover:bg-white/5 cursor-pointer active:scale-95'
                                : 'cursor-default'
                            }`}
                    >
                        <span className={chip.accent}>{chip.icon}</span>
                        <span className="text-gray-500 font-medium hidden md:inline">{chip.label}:</span>
                        <span className={`font-bold tabular-nums ${chip.accent}`}>{chip.value}</span>
                    </button>
                </React.Fragment>
            ))}

            {/* Right spacer: workday progress dot */}
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                <TrendingUp size={12} className="text-gray-700" />
                <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                            width: `${Math.min(Math.max(((now.getHours() - 9) / 8) * 100, 0), 100)}%`,
                            background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                        }}
                    />
                </div>
                <span className="text-[10px] text-gray-600 font-mono hidden sm:inline">
                    {Math.min(Math.max(Math.round(((now.getHours() - 9) / 8) * 100), 0), 100)}%
                </span>
            </div>
        </div>
    );
};

export default CommandStrip;
