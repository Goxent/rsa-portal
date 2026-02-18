import React from 'react';
import { CheckCircle2, Loader, Eye, Pause, BarChart3 } from 'lucide-react';

interface TaskStatsWidgetProps {
    taskData?: { name: string; value: number }[];
}

const STATUS_CONFIG = [
    { key: 'Completed', icon: CheckCircle2, color: 'text-emerald-400', bar: 'from-emerald-500 to-teal-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { key: 'In Progress', icon: Loader, color: 'text-brand-400', bar: 'from-brand-500 to-indigo-400', bg: 'bg-brand-500/10', border: 'border-brand-500/20' },
    { key: 'Review', icon: Eye, color: 'text-purple-400', bar: 'from-purple-500 to-violet-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { key: 'Pending', icon: Pause, color: 'text-gray-400', bar: 'from-gray-500 to-slate-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
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
        if (rate >= 75) return '#10b981'; // emerald
        if (rate >= 50) return '#6366f1'; // brand
        if (rate >= 25) return '#f59e0b'; // amber
        return '#ef4444'; // red
    };

    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <BarChart3 size={28} className="mb-2 opacity-30" />
                <p className="text-sm">No task data yet</p>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-5">
            {/* Completion Ring */}
            <div className="relative flex-shrink-0 w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                    {/* Track */}
                    <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                    {/* Progress */}
                    <circle
                        cx="48" cy="48" r={radius}
                        fill="none"
                        stroke={getRingColor(completionRate)}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${strokeDash} ${circumference}`}
                        className="transition-all duration-1000"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-white">{completionRate}%</span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-wide">Done</span>
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
                        <div key={cfg.key}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <Icon size={11} className={cfg.color} />
                                    <span className="text-[11px] text-gray-400">{cfg.key}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-white">{count}</span>
                                    <span className="text-[10px] text-gray-600">{pct}%</span>
                                </div>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r ${cfg.bar} rounded-full transition-all duration-700`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}

                {/* Total */}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                    <span className="text-[11px] text-gray-500">Total tasks</span>
                    <span className="text-sm font-bold text-white">{total}</span>
                </div>
            </div>
        </div>
    );
};

export default TaskStatsWidget;
