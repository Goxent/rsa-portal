import React from 'react';
import { TrendingUp, Award, Target, Clock } from 'lucide-react';

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
    const onTimeRate = staffPerformance.completed > 0
        ? Math.round(((staffPerformance.completed - staffPerformance.lateCount) / staffPerformance.completed) * 100)
        : 100;

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const metrics = [
        {
            label: 'Completion',
            value: `${completionRate}%`,
            icon: Target,
            color: getScoreColor(completionRate)
        },
        {
            label: 'On-Time',
            value: `${onTimeRate}%`,
            icon: Clock,
            color: getScoreColor(onTimeRate)
        },
        {
            label: 'Completed',
            value: staffPerformance.completed,
            icon: Award,
            color: 'text-brand-400'
        },
    ];

    return (
        <div className="space-y-3">
            {/* Progress Ring */}
            <div className="flex items-center justify-center">
                <div className="relative w-24 h-24">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-white/10"
                        />
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={`${completionRate * 2.51} 251`}
                            strokeLinecap="round"
                            className={getScoreColor(completionRate)}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <span className={`text-2xl font-bold ${getScoreColor(completionRate)}`}>
                                {completionRate}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
                {metrics.map((metric) => (
                    <div key={metric.label} className="text-center">
                        <metric.icon size={16} className={`mx-auto mb-1 ${metric.color}`} />
                        <div className={`text-lg font-bold ${metric.color}`}>{metric.value}</div>
                        <div className="text-xs text-gray-400">{metric.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PerformanceWidget;
