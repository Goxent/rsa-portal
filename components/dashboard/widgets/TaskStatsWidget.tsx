import React from 'react';
import { CheckCircle2, Loader, Eye, Pause, BarChart3, AlertOctagon } from 'lucide-react';

interface TaskStatsWidgetProps {
    taskData?: { name: string; value: number }[];
}

const STATUS_CONFIG = [
    { key: 'Completed', icon: CheckCircle2, color: 'text-brand-400', bar: 'bg-brand-500', ring: 'var(--accent)', bg: 'bg-brand-500/10' },
    { key: 'In Progress', icon: Loader, color: 'text-brand-500', bar: 'bg-brand-400', ring: 'var(--accent-glow)', bg: 'bg-brand-400/10' },
    { key: 'Review', icon: Eye, color: 'text-status-pending', bar: 'bg-status-pending', ring: 'var(--status-pending)', bg: 'bg-status-pending-dim' },
    { key: 'Pending', icon: Pause, color: 'text-brand-300 dark:text-brand-700/50', bar: 'bg-slate-300 dark:bg-brand-900/30', ring: 'var(--accent-dim)', bg: 'bg-brand-900/10' },
    { key: 'Halted', icon: AlertOctagon, color: 'text-status-halted', bar: 'bg-status-halted', ring: 'var(--status-halted)', bg: 'bg-status-halted-dim' },
];

const TaskStatsWidget: React.FC<TaskStatsWidgetProps> = ({ taskData = [] }) => {
    const total = taskData.reduce((sum, item) => sum + item.value, 0);
    const completed = taskData.find(t => t.name === 'Completed')?.value || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // SVG ring params
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeDash = (completionRate / 100) * circumference;

    const getRingColor = (rate: number) => {
        if (rate >= 80) return 'var(--accent)';
        if (rate >= 1)  return 'var(--accent-glow)';
        return 'var(--border-mid)';
    };

    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[140px] text-center p-4">
                <BarChart3 size={24} strokeWidth={1.75} className="mb-2 opacity-40" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>No activity tracked yet</p>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-6 h-full p-2">
            {/* Completion Ring */}
            <div className="relative flex-shrink-0 w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                    {/* Track */}
                    <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
                    {/* Progress */}
                    <circle
                        cx="48" cy="48" r={radius}
                        fill="none"
                        stroke={getRingColor(completionRate)}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${strokeDash} ${circumference}`}
                        className="transition-all duration-700"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-xl font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>{completionRate}%</span>
                    <span className="text-[10px] font-medium leading-none" style={{ color: 'var(--accent)' }}>Done</span>
                </div>
            </div>

            {/* Status Bars */}
            <div className="flex-1 space-y-2.5">
                {STATUS_CONFIG.map(cfg => {
                    const item = taskData.find(t => t.name === cfg.key);
                    const count = item?.value || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const Icon = cfg.icon;

                    return (
                        <div key={cfg.key} className="group/bar">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <Icon size={12} strokeWidth={1.75} className={cfg.color} />
                                    <span className="text-xs font-normal transition-colors" style={{ color: 'var(--text-muted)' }}>{cfg.key}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>{count}</span>
                                    <span className="text-[10px] font-normal tabular-nums" style={{ color: 'var(--text-muted)' }}>({pct}%)</span>
                                </div>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${pct}%`,
                                        background: cfg.key === 'Completed' ? 'var(--accent)' : 'var(--border-mid)',
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}

                {/* Total Footer */}
                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>Total tasks</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{total}</span>
                </div>
            </div>
        </div>
    );
};

export default TaskStatsWidget;
