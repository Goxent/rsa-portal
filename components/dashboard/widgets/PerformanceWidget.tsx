import React from 'react';
import { Target, Clock, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PerformanceWidgetProps {
    staffPerformance?: {
        completed: number;
        pending: number;
        lateCount: number;
    };
}

const PerformanceWidget: React.FC<PerformanceWidgetProps> = ({
    staffPerformance = { completed: 0, pending: 0, lateCount: 0 }
}) => {
    const total = staffPerformance.completed + staffPerformance.pending;
    const completionRate = total > 0 ? Math.round((staffPerformance.completed / total) * 100) : 0;
    const onTimeCount = Math.max(staffPerformance.completed - staffPerformance.lateCount, 0);
    const onTimeRate = staffPerformance.completed > 0
        ? Math.round((onTimeCount / staffPerformance.completed) * 100)
        : 100;

    const getScoreColor = (score: number) => {
        if (score >= 80) return { text: 'var(--accent)', ring: 'var(--accent)', label: 'Excellent' };
        if (score >= 60) return { text: 'var(--color-warning)', ring: 'var(--color-warning)', label: 'Good' };
        if (score >= 40) return { text: 'var(--color-warning)', ring: 'var(--color-warning)', label: 'Fair' };
        return { text: 'var(--color-danger)', ring: 'var(--color-danger)', label: 'Needs work' };
    };

    const compStyle = getScoreColor(completionRate);
    const onTimeStyle = getScoreColor(onTimeRate);

    // SVG ring helper
    const Ring = ({ rate, color, size = 52 }: { rate: number; color: string; size?: number }) => {
        const r = size / 2 - 6;
        const circ = 2 * Math.PI * r;
        const dash = (rate / 100) * circ;
        return (
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke={color} strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    className="transition-all duration-700"
                />
            </svg>
        );
    };

    const TrendIcon = ({ rate }: { rate: number }) => {
        if (rate >= 70) return <TrendingUp size={12} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />;
        if (rate >= 40) return <Minus size={12} strokeWidth={1.75} style={{ color: 'var(--color-warning)' }} />;
        return <TrendingDown size={12} strokeWidth={1.75} style={{ color: 'var(--color-danger)' }} />;
    };

    return (
        <div className="space-y-4">
            {/* Dual rings */}
            <div className="grid grid-cols-2 gap-3">
                {/* Completion Rate */}
                <div className="rounded-[var(--radius-md)] border p-3 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <div className="relative inline-flex items-center justify-center mb-1">
                        <Ring rate={completionRate} color={compStyle.ring} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-display text-sm font-medium tabular-nums" style={{ color: compStyle.text }}>{completionRate}%</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                        <Target size={11} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Completion</span>
                    </div>
                    <div className="text-[11px] font-medium mt-0.5" style={{ color: compStyle.text }}>{compStyle.label}</div>
                </div>

                {/* On-Time Rate */}
                <div className="rounded-[var(--radius-md)] border p-3 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <div className="relative inline-flex items-center justify-center mb-1">
                        <Ring rate={onTimeRate} color={onTimeStyle.ring} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-display text-sm font-medium tabular-nums" style={{ color: onTimeStyle.text }}>{onTimeRate}%</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                        <Clock size={11} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>On-time</span>
                    </div>
                    <div className="text-[11px] font-medium mt-0.5" style={{ color: onTimeStyle.text }}>{onTimeStyle.label}</div>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-[var(--radius-sm)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Award size={12} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
                        <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{staffPerformance.completed}</span>
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Completed</span>
                </div>
                <div className="text-center p-2 rounded-[var(--radius-sm)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <TrendIcon rate={completionRate} />
                        <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{staffPerformance.pending}</span>
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pending</span>
                </div>
                <div className="text-center p-2 rounded-[var(--radius-sm)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Clock size={12} strokeWidth={1.75} style={{ color: staffPerformance.lateCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }} />
                        <span className="text-base font-semibold tabular-nums" style={{ color: staffPerformance.lateCount > 0 ? 'var(--color-danger)' : 'var(--text-heading)' }}>
                            {staffPerformance.lateCount}
                        </span>
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Late (30d)</span>
                </div>
            </div>

            {/* Overall score bar */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Overall score</span>
                    <span className="font-display text-xs font-medium tabular-nums" style={{ color: compStyle.text }}>
                        {Math.round((completionRate + onTimeRate) / 2)}%
                    </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                            width: `${Math.round((completionRate + onTimeRate) / 2)}%`,
                            background: 'var(--accent)'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default PerformanceWidget;
