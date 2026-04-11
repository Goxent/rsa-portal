import React from 'react';
import { CheckCircle2, Loader, Eye, Pause, BarChart3 } from 'lucide-react';

interface TaskStatsWidgetProps {
    taskData?: { name: string; value: number }[];
}

const STATUS_CONFIG = [
    { key: 'Completed', icon: CheckCircle2, color: 'text-brand-400', bar: 'bg-brand-500', ring: 'var(--accent)', bg: 'bg-brand-500/10' },
    { key: 'In Progress', icon: Loader, color: 'text-brand-500', bar: 'bg-brand-400', ring: 'var(--accent-glow)', bg: 'bg-brand-400/10' },
    { key: 'Review', icon: Eye, color: 'text-status-pending', bar: 'bg-status-pending', ring: 'var(--status-pending)', bg: 'bg-status-pending-dim' },
    { key: 'Pending', icon: Pause, color: 'text-brand-300 dark:text-brand-700/50', bar: 'bg-slate-300 dark:bg-brand-900/30', ring: 'var(--accent-dim)', bg: 'bg-brand-900/10' },
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
            <div className="flex flex-col items-center justify-center min-h-[140px] text-brand-500/40">
                <BarChart3 size={24} className="mb-2 opacity-50" />
                <p className="text-[11px] font-bold uppercase tracking-widest">No activity tracked</p>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-6 h-full p-2">
            {/* Completion Ring */}
            <div className="relative flex-shrink-0 w-28 h-28">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                    {/* Track */}
                    <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--accent-dim)" strokeWidth="6" strokeOpacity="0.2" />
                    {/* Progress */}
                    <circle
                        cx="48" cy="48" r={radius}
                        fill="none"
                        stroke={getRingColor(completionRate)}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${strokeDash} ${circumference}`}
                        className="transition-all duration-1000"
                        style={{ filter: completionRate > 0 ? 'drop-shadow(0 0 4px var(--accent-glow))' : 'none' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-heading drop-shadow-sm">{completionRate}%</span>
                    <span className="text-[9px] text-accent dark:text-brand-400 uppercase font-black tracking-widest leading-none">Done</span>
                </div>
            </div>

            {/* Status Bars */}
            <div className="flex-1 space-y-3">
                {STATUS_CONFIG.map(cfg => {
                    const item = taskData.find(t => t.name === cfg.key);
                    const count = item?.value || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const Icon = cfg.icon;

                    return (
                        <div key={cfg.key} className="group/bar">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <Icon size={12} className={`${cfg.color}`} />
                                    <span className="text-[11px] font-semibold text-muted group-hover/bar:text-heading transition-colors">{cfg.key}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-heading tabular-nums">{count}</span>
                                    <span className="text-[9px] font-bold text-muted/60 opacity-0 group-hover/bar:opacity-100 transition-opacity">{pct}%</span>
                                </div>
                            </div>
                            <div className="h-1 bg-surface rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${cfg.bar} rounded-full transition-all duration-700 shadow-sm`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}

                {/* Total Footer */}
                <div className="flex items-center justify-between pt-1 opacity-50">
                    <span className="text-[9px] font-black text-muted uppercase tracking-widest">Aggregate Load</span>
                    <span className="text-[11px] font-black text-heading tabular-nums">{total}</span>
                </div>
            </div>
        </div>
    );
};

export default TaskStatsWidget;
