import React from 'react';
import { Users, UserCheck, UserX } from 'lucide-react';
import { UserProfile } from '../../../types';

interface TeamWorkloadWidgetProps {
    staffStats?: {
        busy: (UserProfile & { taskCount: number })[];
        free: UserProfile[];
    };
}

const TeamWorkloadWidget: React.FC<TeamWorkloadWidgetProps> = ({
    staffStats = { busy: [], free: [] }
}) => {
    const totalStaff = staffStats.busy.length + staffStats.free.length;

    if (totalStaff === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Users size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No staff data available</p>
            </div>
        );
    }

    const getWorkloadColor = (taskCount: number) => {
        if (taskCount >= 5) return 'bg-red-500';
        if (taskCount >= 3) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="flex justify-around text-center">
                <div>
                    <div className="flex items-center justify-center gap-1">
                        <UserCheck size={16} className="text-green-400" />
                        <span className="text-2xl font-bold text-white">{staffStats.free.length}</span>
                    </div>
                    <p className="text-xs text-gray-400">Available</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                    <div className="flex items-center justify-center gap-1">
                        <UserX size={16} className="text-orange-400" />
                        <span className="text-2xl font-bold text-white">{staffStats.busy.length}</span>
                    </div>
                    <p className="text-xs text-gray-400">Busy</p>
                </div>
            </div>

            {/* Workload Bars */}
            <div className="space-y-2 max-h-32 overflow-y-auto">
                {staffStats.busy.slice(0, 5).map((staff) => (
                    <div key={staff.uid} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-xs font-bold text-white">
                            {staff.displayName?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="text-gray-300 truncate max-w-[100px]">{staff.displayName}</span>
                                <span className="text-gray-400">{staff.taskCount} tasks</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${getWorkloadColor(staff.taskCount)} rounded-full transition-all`}
                                    style={{ width: `${Math.min(staff.taskCount * 20, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TeamWorkloadWidget;
