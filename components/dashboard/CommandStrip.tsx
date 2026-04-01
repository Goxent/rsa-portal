import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckSquare, Bell, CalendarDays, TrendingUp, Wifi } from 'lucide-react';
// @ts-ignore
import NepaliDate from 'nepali-date-converter';

interface CommandStripProps {
    pendingTasksCount: number;
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
            icon: <CheckSquare size={13} />,
            label: 'My Tasks',
            value: pendingTasksCount,
            accent: pendingTasksCount > 5 ? 'text-rose-400' : pendingTasksCount > 0 ? 'text-brand-400' : 'text-emerald-400',
            onClick: () => navigate('/tasks'),
        },
    ];

    return (
        <div
            className="sticky top-0 z-30 flex items-center gap-2 flex-wrap px-4 py-2.5 rounded-xl overflow-hidden"
            style={{
                background: 'rgba(10,10,12,0.8)',
                border: '1px solid rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
        >
            {/* Subtle top rule */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/20 to-transparent" />

            {chips.map((chip, i) => (
                <React.Fragment key={chip.label}>
                    {i > 0 && <div className="w-px h-5 bg-white/5 flex-shrink-0 hidden sm:block" />}
                    <button
                        onClick={chip.onClick}
                        disabled={!chip.onClick}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150 select-none flex-shrink-0
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
        </div>
    );
};

export default CommandStrip;
