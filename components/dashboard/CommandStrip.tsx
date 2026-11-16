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
                    dotColor: 'var(--color-success)',
                    label: 'Clocked in',
                    textColor: 'var(--color-success)',
                    borderColor: 'rgba(79,178,134,0.3)',
                    bgColor: 'var(--accent-dim)'
                };
            case 'Shift Completed':
                return {
                    dotColor: 'var(--color-info)',
                    label: 'Shift complete',
                    textColor: 'var(--color-info)',
                    borderColor: 'rgba(106,163,217,0.3)',
                    bgColor: 'rgba(106,163,217,0.08)'
                };
            default:
                return {
                    dotColor: 'var(--color-warning)',
                    label: 'Not clocked in',
                    textColor: 'var(--color-warning)',
                    borderColor: 'rgba(217,164,65,0.3)',
                    bgColor: 'rgba(217,164,65,0.08)'
                };
        }
    };

    const attConfig = getAttendanceConfig();

    return (
        <div
            className="sticky top-0 z-30 flex items-center gap-2 flex-wrap px-3.5 py-2 rounded-[var(--radius-lg)] border transition-colors duration-150"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-card)',
            }}
            role="region"
            aria-label="Today summary and quick links"
        >
            {/* 1. Date chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] select-none flex-shrink-0">
                <CalendarDays size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-normal hidden md:inline" style={{ color: 'var(--text-muted)' }}>Today:</span>
                <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                    {adDate}{bsDate ? ` · ${bsDate} BS` : ''}
                </span>
            </div>

            <div className="w-px h-4 flex-shrink-0 hidden sm:block" style={{ background: 'var(--border)' }} />

            {/* 2. Clock chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] select-none flex-shrink-0">
                <Clock size={14} strokeWidth={1.75} style={{ color: 'var(--color-info)' }} />
                <span className="text-xs font-normal hidden md:inline" style={{ color: 'var(--text-muted)' }}>Time:</span>
                <span className="text-xs font-semibold tabular-nums font-mono" style={{ color: 'var(--text-heading)' }}>{timeStr}</span>
            </div>

            <div className="w-px h-4 flex-shrink-0 hidden sm:block" style={{ background: 'var(--border)' }} />

            {/* 3. Attendance Status chip */}
            <button
                onClick={onAttendanceClick || (() => navigate('/attendance'))}
                title="View attendance details"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] border transition-colors cursor-pointer flex-shrink-0"
                style={{
                    backgroundColor: attConfig.bgColor,
                    borderColor: attConfig.borderColor,
                    color: attConfig.textColor,
                }}
                aria-label={`Attendance status: ${attConfig.label}`}
            >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: attConfig.dotColor }} />
                <span className="text-xs font-medium">{attConfig.label}</span>
            </button>

            <div className="w-px h-4 flex-shrink-0 hidden sm:block" style={{ background: 'var(--border)' }} />

            {/* 4. Overdue Badge chip (D6) - only shown when > 0 */}
            {overdueCount > 0 && (
                <button
                    onClick={() => navigate(overdueHref)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] border transition-colors cursor-pointer flex-shrink-0"
                    style={{
                        backgroundColor: 'rgba(224,112,122,0.1)',
                        borderColor: 'rgba(224,112,122,0.3)',
                        color: 'var(--color-danger)'
                    }}
                    title="View overdue tasks"
                    aria-label={`${overdueCount} overdue tasks`}
                >
                    <AlertTriangle size={13} strokeWidth={1.75} />
                    <span className="text-xs font-medium">Overdue:</span>
                    <span className="text-xs font-semibold tabular-nums">{overdueCount}</span>
                </button>
            )}

            {/* 5. In Review Badge chip (D6) - only shown when > 0 */}
            {inReviewCount > 0 && (
                <button
                    onClick={() => navigate(inReviewHref)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] border transition-colors cursor-pointer flex-shrink-0"
                    style={{
                        backgroundColor: 'rgba(106,163,217,0.1)',
                        borderColor: 'rgba(106,163,217,0.3)',
                        color: 'var(--color-info)'
                    }}
                    title="View tasks in review"
                    aria-label={`${inReviewCount} tasks in review`}
                >
                    <ShieldCheck size={13} strokeWidth={1.75} />
                    <span className="text-xs font-medium">In review:</span>
                    <span className="text-xs font-semibold tabular-nums">{inReviewCount}</span>
                </button>
            )}

            {/* 6. My Tasks chip (D6) — clickable to /tasks?quick=MINE */}
            <button
                onClick={() => navigate(myTasksHref)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] transition-colors duration-150 cursor-pointer flex-shrink-0"
                style={{ color: pendingTasksCount > 5 ? 'var(--color-danger)' : 'var(--accent)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="View my active tasks"
                aria-label={`${pendingTasksCount} tasks assigned to you`}
            >
                <CheckSquare size={13} strokeWidth={1.75} />
                <span className="text-xs font-normal hidden md:inline" style={{ color: 'var(--text-muted)' }}>My tasks:</span>
                <span className="text-xs font-semibold tabular-nums">{pendingTasksCount}</span>
            </button>
        </div>
    );
};

export default CommandStrip;
