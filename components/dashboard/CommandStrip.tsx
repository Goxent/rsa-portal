import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckSquare, CalendarDays, AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';
// @ts-ignore
import NepaliDate from 'nepali-date-converter';

interface CommandStripProps {
    pendingTasksCount: number;
    overdueCount?: number;
    inReviewCount?: number;
    attendanceStatus?: 'Not Clocked In' | 'Clocked In' | 'Shift Completed';
    /** UID of the current user — used to build deep links (D6 fix) */
    currentUserUid?: string;
    onAttendanceClick?: () => void;
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
    overdueCount = 0,
    inReviewCount = 0,
    attendanceStatus = 'Not Clocked In',
    currentUserUid,
    onAttendanceClick,
}) => {
    const navigate = useNavigate();
    // D13: CommandStrip owns the minute-level clock; seconds displayed clearly
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const adDate = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const bsDate = toBS(now);
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // D6: Deep links into smart views
    const myTasksHref = '/tasks?quick=MINE';
    const overdueHref = '/tasks?quick=OVERDUE';
    const inReviewHref = '/tasks?quick=REVIEW';

    const getAttendanceConfig = () => {
        switch (attendanceStatus) {
            case 'Clocked In':
                return {
                    dot: 'bg-emerald-500 animate-pulse',
                    label: 'Clocked In',
                    text: 'text-emerald-500',
                    border: 'border-emerald-500/30',
                    bg: 'bg-emerald-500/10'
                };
            case 'Shift Completed':
                return {
                    dot: 'bg-sky-500',
                    label: 'Shift Complete',
                    text: 'text-sky-400',
                    border: 'border-sky-500/30',
                    bg: 'bg-sky-500/10'
                };
            default:
                return {
                    dot: 'bg-amber-500',
                    label: 'Not Clocked In',
                    text: 'text-amber-500',
                    border: 'border-amber-500/30',
                    bg: 'bg-amber-500/10'
                };
        }
    };

    const attConfig = getAttendanceConfig();

    return (
        <div
            className="sticky top-0 z-30 flex items-center gap-1.5 flex-wrap px-3 py-2 rounded-xl border backdrop-blur-xl transition-all duration-300"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-mid)',
                boxShadow: 'var(--shadow-card)',
            }}
            role="region"
            aria-label="Today summary and quick links"
        >
            {/* 1. Date chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg select-none flex-shrink-0">
                <CalendarDays size={13} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-medium hidden md:inline" style={{ color: 'var(--text-muted)' }}>Today:</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                    {adDate}{bsDate ? ` · ${bsDate} BS` : ''}
                </span>
            </div>

            <div className="w-px h-4 flex-shrink-0 hidden sm:block" style={{ background: 'var(--border-mid)' }} />

            {/* 2. Clock chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg select-none flex-shrink-0">
                <Clock size={13} style={{ color: 'var(--color-info)' }} />
                <span className="text-xs font-medium hidden md:inline" style={{ color: 'var(--text-muted)' }}>Time:</span>
                <span className="text-xs font-bold tabular-nums font-mono" style={{ color: 'var(--text-heading)' }}>{timeStr}</span>
            </div>

            <div className="w-px h-4 flex-shrink-0 hidden sm:block" style={{ background: 'var(--border-mid)' }} />

            {/* 3. Attendance Status chip */}
            <button
                onClick={onAttendanceClick || (() => navigate('/attendance'))}
                title="View attendance details"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer active:scale-95 flex-shrink-0 ${attConfig.bg} ${attConfig.border}`}
                aria-label={`Attendance status: ${attConfig.label}`}
            >
                <span className={`w-1.5 h-1.5 rounded-full ${attConfig.dot}`} />
                <span className={`text-[11px] font-bold ${attConfig.text}`}>{attConfig.label}</span>
            </button>

            <div className="w-px h-4 flex-shrink-0 hidden sm:block" style={{ background: 'var(--border-mid)' }} />

            {/* 4. Overdue Badge chip (D6) - only shown when > 0 */}
            {overdueCount > 0 && (
                <button
                    onClick={() => navigate(overdueHref)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 hover:bg-rose-500/20 transition-all cursor-pointer active:scale-95 flex-shrink-0"
                    title="View overdue tasks"
                    aria-label={`${overdueCount} overdue tasks`}
                >
                    <AlertTriangle size={12} className="animate-pulse" />
                    <span className="text-[11px] font-bold">Overdue:</span>
                    <span className="text-xs font-black tabular-nums">{overdueCount}</span>
                </button>
            )}

            {/* 5. In Review Badge chip (D6) - only shown when > 0 */}
            {inReviewCount > 0 && (
                <button
                    onClick={() => navigate(inReviewHref)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer active:scale-95 flex-shrink-0"
                    title="View tasks in review"
                    aria-label={`${inReviewCount} tasks in review`}
                >
                    <ShieldCheck size={12} />
                    <span className="text-[11px] font-bold">In Review:</span>
                    <span className="text-xs font-black tabular-nums">{inReviewCount}</span>
                </button>
            )}

            {/* 6. My Tasks chip (D6) — clickable to /tasks?quick=MINE */}
            <button
                onClick={() => navigate(myTasksHref)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 flex-shrink-0"
                style={{ color: pendingTasksCount > 5 ? 'var(--color-danger)' : 'var(--accent)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="View my active tasks"
                aria-label={`${pendingTasksCount} tasks assigned to you`}
            >
                <CheckSquare size={13} />
                <span className="text-xs font-medium hidden md:inline" style={{ color: 'var(--text-muted)' }}>My Tasks:</span>
                <span className="text-xs font-bold tabular-nums">{pendingTasksCount}</span>
            </button>
        </div>
    );
};

export default CommandStrip;
