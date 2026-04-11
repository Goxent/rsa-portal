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
        if (count >= 7) return 'bg-status-halted';
        if (count >= 5) return 'bg-color-warning'; // or status-pending
        if (count >= 3) return 'bg-accent';
        return 'bg-status-completed';
    };

    const getStatusDot = (count: number) => {
        if (count >= 5) return 'bg-status-halted shadow-status-halted-dim';
        if (count >= 3) return 'bg-accent shadow-accent-glow';
        return 'bg-status-completed shadow-status-completed-dim';
    };

    const getStatusLabel = (count: number) => {
        if (count >= 7) return { text: 'Critical', color: 'text-status-halted bg-status-halted-dim border-status-halted-dim' };
        if (count >= 5) return { text: 'Overloaded', color: 'text-status-pending bg-status-pending-dim border-status-pending-dim' };
        if (count >= 3) return { text: 'Busy', color: 'text-accent bg-accent/10 border-accent/20' };
        return { text: 'Optimal', color: 'text-status-completed bg-status-completed-dim border-status-completed-dim' };
    };

    if (totalStaff === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[160px] text-muted">
                <Users size={24} className="mb-2 opacity-20" />
                <p className="text-[11px] font-medium uppercase tracking-widest">No Staff Connected</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-1">
            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface rounded-xl p-3 border border-border shadow-sm">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Users size={12} className="text-muted" />
                        <span className="text-xl font-bold text-heading tabular-nums">{totalStaff}</span>
                    </div>
                    <p className="text-[9px] text-muted font-black uppercase tracking-widest text-center">Connected</p>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-border shadow-sm">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <TrendingUp size={12} className="text-accent" />
                        <span className="text-xl font-bold text-heading tabular-nums">{avgTasks}</span>
                    </div>
                    <p className="text-[9px] text-muted font-black uppercase tracking-widest text-center">Avg Load</p>
                </div>
                <div className={`rounded-xl p-3 border shadow-sm transition-colors ${overloadedCount > 0 ? 'bg-status-halted-dim border-status-halted-dim' : 'bg-status-completed-dim border-status-completed-dim'}`}>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        {overloadedCount > 0
                            ? <Zap size={12} className="text-status-halted" />
                            : <CheckCircle size={12} className="text-status-completed" />
                        }
                        <span className={`text-xl font-bold tabular-nums ${overloadedCount > 0 ? 'text-status-halted' : 'text-status-completed'}`}>
                            {overloadedCount > 0 ? overloadedCount : '✓'}
                        </span>
                    </div>
                    <p className={`text-[9px] font-black uppercase tracking-widest text-center ${overloadedCount > 0 ? 'text-status-halted' : 'text-status-completed'}`}>
                        {overloadedCount > 0 ? 'Strain' : 'Stable'}
                    </p>
                </div>
            </div>

            {/* Staff Workload Bars */}
            <div className="space-y-1.5 max-h-[190px] overflow-y-auto custom-scrollbar pr-1">
                {allStaff.map((staff) => {
                    const barWidth = staff.taskCount === 0 ? 4 : Math.min((staff.taskCount / maxTasks) * 100, 100);
                    const isHovered = hoveredId === staff.uid;
                    const status = getStatusLabel(staff.taskCount);

                    return (
                        <div
                            key={staff.uid}
                            className={`group relative rounded-lg p-3 border transition-all duration-200
                                ${isHovered ? 'bg-surface border-border shadow-card' : 'bg-transparent border-transparent hover:bg-secondary/40'}`}
                            onMouseEnter={() => setHoveredId(staff.uid)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-[11px] font-black text-heading group-hover:border-accent group-hover:text-accent transition-all">
                                        {staff.displayName?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-secondary ${getStatusDot(staff.taskCount)}`} />
                                </div>

                                {/* Name + Bar */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[12px] font-bold text-heading truncate">
                                            {staff.displayName || 'Anonymous'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {(staff.overdueCount || 0) > 0 && (
                                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-status-halted bg-status-halted-dim px-1.5 rounded">
                                                    <Clock size={8} />
                                                    {staff.overdueCount}
                                                </span>
                                            )}
                                            <span className="text-[11px] font-black text-heading tabular-nums">
                                                {staff.taskCount}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="h-1 bg-surface rounded-full overflow-hidden border border-border/20">
                                        <div
                                            className={`h-full ${getBarColor(staff.taskCount)} rounded-full transition-all duration-700 shadow-sm`}
                                            style={{ width: `${barWidth}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Status Badge (shown on hover) */}
                                <div className={`flex-shrink-0 transition-all duration-200 hidden sm:block ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border ${status.color}`}>
                                        {status.text}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center flex-wrap gap-4 pt-4 border-t border-border/50">
                {[
                    { color: 'bg-status-completed', label: 'Optimal' },
                    { color: 'bg-accent', label: 'Active' },
                    { color: 'bg-status-pending', label: 'High' },
                    { color: 'bg-status-halted', label: 'Strain' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                        <span className="text-[9px] text-muted font-bold uppercase tracking-widest">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TeamWorkloadWidget;
