import React, { useState } from 'react';
import { Users, AlertTriangle, CheckCircle, TrendingUp, Clock, Zap } from 'lucide-react';
import { UserProfile } from '../../../types';

interface StaffWorkload {
    uid: string;
    displayName?: string;
    taskCount: number;
    overdueCount?: number;
    highRiskCount?: number;
}

interface TeamWorkloadWidgetProps {
    staffStats?: {
        busy: (UserProfile & { taskCount: number; overdueCount?: number; highRiskCount?: number })[];
        free: UserProfile[];
    };
}

const TeamWorkloadWidget: React.FC<TeamWorkloadWidgetProps> = ({
    staffStats = { busy: [], free: [] }
}) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const totalStaff = staffStats.busy.length + staffStats.free.length;

    // Merge all staff into one list for display
    const allStaff: StaffWorkload[] = [
        ...staffStats.busy.map(s => ({
            uid: s.uid,
            displayName: s.displayName,
            taskCount: s.taskCount,
            overdueCount: s.overdueCount || 0,
            highRiskCount: s.highRiskCount || 0,
        })),
        ...staffStats.free.map(s => ({
            uid: s.uid,
            displayName: s.displayName,
            taskCount: 0,
            overdueCount: 0,
            highRiskCount: 0,
        })),
    ].sort((a, b) => b.taskCount - a.taskCount);

    const maxTasks = Math.max(...allStaff.map(s => s.taskCount), 1);
    const overloadedCount = allStaff.filter(s => s.taskCount >= 5).length;
    const totalActiveTasks = allStaff.reduce((sum, s) => sum + s.taskCount, 0);
    const avgTasks = totalStaff > 0 ? (totalActiveTasks / totalStaff).toFixed(1) : '0';

    const getBarColor = (count: number) => {
        if (count >= 7) return 'from-red-500 to-rose-600';
        if (count >= 5) return 'from-orange-400 to-amber-500';
        if (count >= 3) return 'from-yellow-400 to-amber-400';
        if (count >= 1) return 'from-brand-500 to-indigo-500';
        return 'from-emerald-500 to-teal-500';
    };

    const getStatusDot = (count: number) => {
        if (count >= 5) return 'bg-red-400 shadow-red-400/50';
        if (count >= 3) return 'bg-amber-400 shadow-amber-400/50';
        if (count >= 1) return 'bg-brand-400 shadow-brand-400/50';
        return 'bg-emerald-400 shadow-emerald-400/50';
    };

    const getStatusLabel = (count: number) => {
        if (count >= 7) return { text: 'Critical', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
        if (count >= 5) return { text: 'Overloaded', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
        if (count >= 3) return { text: 'Busy', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
        if (count >= 1) return { text: 'Active', color: 'text-brand-400 bg-brand-500/10 border-brand-500/20' };
        return { text: 'Free', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    };

    if (totalStaff === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <Users size={28} className="mb-2 opacity-40" />
                <p className="text-xs">No staff data available</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Users size={11} className="text-gray-400" />
                        <span className="text-lg font-bold text-white">{totalStaff}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        <TrendingUp size={11} className="text-brand-400" />
                        <span className="text-lg font-bold text-white">{avgTasks}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Avg Tasks</p>
                </div>
                <div className={`rounded-xl p-2.5 text-center border ${overloadedCount > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                        {overloadedCount > 0
                            ? <AlertTriangle size={11} className="text-red-400" />
                            : <CheckCircle size={11} className="text-emerald-400" />
                        }
                        <span className={`text-lg font-bold ${overloadedCount > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                            {overloadedCount > 0 ? overloadedCount : '✓'}
                        </span>
                    </div>
                    <p className={`text-[10px] uppercase tracking-wide ${overloadedCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {overloadedCount > 0 ? 'Overloaded' : 'Balanced'}
                    </p>
                </div>
            </div>

            {/* Staff Workload Bars */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {allStaff.map((staff) => {
                    const barWidth = staff.taskCount === 0 ? 4 : Math.min((staff.taskCount / maxTasks) * 100, 100);
                    const isHovered = hoveredId === staff.uid;
                    const status = getStatusLabel(staff.taskCount);

                    return (
                        <div
                            key={staff.uid}
                            className={`group relative rounded-xl p-2.5 border transition-all duration-200 cursor-default
                                ${isHovered ? 'bg-white/8 border-white/15' : 'bg-white/3 border-white/5 hover:bg-white/6 hover:border-white/10'}`}
                            onMouseEnter={() => setHoveredId(staff.uid)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            <div className="flex items-center gap-2.5">
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500/80 to-accent-purple/80 flex items-center justify-center text-[11px] font-bold text-white">
                                        {staff.displayName?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d1526] shadow-sm ${getStatusDot(staff.taskCount)}`} />
                                </div>

                                {/* Name + Bar */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-medium text-gray-200 truncate max-w-[90px]">
                                            {staff.displayName?.split(' ')[0] || 'Unknown'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {(staff.overdueCount || 0) > 0 && (
                                                <span className="flex items-center gap-0.5 text-[9px] text-red-400">
                                                    <Clock size={8} />
                                                    {staff.overdueCount}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-bold text-white">
                                                {staff.taskCount}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full bg-gradient-to-r ${getBarColor(staff.taskCount)} rounded-full transition-all duration-500`}
                                            style={{ width: `${barWidth}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Status Badge (shown on hover) */}
                                <div className={`flex-shrink-0 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-medium ${status.color}`}>
                                        {status.text}
                                    </span>
                                </div>
                            </div>

                            {/* Hover tooltip: risk + overdue details */}
                            {isHovered && ((staff.highRiskCount || 0) > 0 || (staff.overdueCount || 0) > 0) && (
                                <div className="mt-2 pt-2 border-t border-white/5 flex gap-3">
                                    {(staff.highRiskCount || 0) > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] text-red-400">
                                            <Zap size={9} />
                                            <span>{staff.highRiskCount} high risk</span>
                                        </div>
                                    )}
                                    {(staff.overdueCount || 0) > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] text-amber-400">
                                            <Clock size={9} />
                                            <span>{staff.overdueCount} overdue</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                {[
                    { color: 'bg-emerald-400', label: 'Free' },
                    { color: 'bg-brand-400', label: 'Active' },
                    { color: 'bg-amber-400', label: 'Busy' },
                    { color: 'bg-red-400', label: 'Overloaded' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                        <span className="text-[9px] text-gray-500">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TeamWorkloadWidget;
