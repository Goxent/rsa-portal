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
        if (score >= 80) return { text: 'text-brand-400', ring: '#10b981', label: 'Excellent' };
        if (score >= 60) return { text: 'text-yellow-400', ring: '#f59e0b', label: 'Good' };
        if (score >= 40) return { text: 'text-orange-400', ring: '#f97316', label: 'Fair' };
        return { text: 'text-red-400', ring: '#ef4444', label: 'Needs Work' };
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
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke={color} strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    className="transition-all duration-1000"
                />
            </svg>
        );
    };

    const TrendIcon = ({ rate }: { rate: number }) => {
        if (rate >= 70) return <TrendingUp size={12} className="text-brand-400" />;
        if (rate >= 40) return <Minus size={12} className="text-yellow-400" />;
        return <TrendingDown size={12} className="text-red-400" />;
    };

    return (
        <div className="space-y-4">
            {/* Dual rings */}
            <div className="grid grid-cols-2 gap-3">
                {/* Completion Rate */}
                <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
                    <div className="relative inline-flex items-center justify-center mb-1">
                        <Ring rate={completionRate} color={compStyle.ring} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-sm font-bold ${compStyle.text}`}>{completionRate}%</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                        <Target size={10} className="text-gray-500" />
                        <span className="text-[10px] text-gray-400">Completion</span>
                    </div>
                    <div className={`text-[9px] font-medium mt-0.5 ${compStyle.text}`}>{compStyle.label}</div>
                </div>

                {/* On-Time Rate */}
                <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
                    <div className="relative inline-flex items-center justify-center mb-1">
                        <Ring rate={onTimeRate} color={onTimeStyle.ring} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-sm font-bold ${onTimeStyle.text}`}>{onTimeRate}%</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                        <Clock size={10} className="text-gray-500" />
                        <span className="text-[10px] text-gray-400">On-Time</span>
                    </div>
                    <div className={`text-[9px] font-medium mt-0.5 ${onTimeStyle.text}`}>{onTimeStyle.label}</div>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Award size={11} className="text-brand-400" />
                        <span className="text-base font-bold text-white">{staffPerformance.completed}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">Completed</span>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <TrendIcon rate={completionRate} />
                        <span className="text-base font-bold text-white">{staffPerformance.pending}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">Pending</span>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Clock size={11} className={staffPerformance.lateCount > 0 ? 'text-red-400' : 'text-gray-500'} />
                        <span className={`text-base font-bold ${staffPerformance.lateCount > 0 ? 'text-red-300' : 'text-white'}`}>
                            {staffPerformance.lateCount}
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-500">Late (30d)</span>
                </div>
            </div>

            {/* Overall score bar */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-gray-400 font-medium">Overall Score</span>
                    <span className={`text-[11px] font-bold ${compStyle.text}`}>
                        {Math.round((completionRate + onTimeRate) / 2)}%
                    </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-brand-500 to-brand- rounded-full transition-all duration-1000"
                        style={{ width: `${Math.round((completionRate + onTimeRate) / 2)}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default PerformanceWidget;
