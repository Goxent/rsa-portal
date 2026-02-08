import React from 'react';
import { Activity, CheckCircle, Clock, UserPlus, Edit, Trash } from 'lucide-react';

interface RecentActivityWidgetProps {
    recentActivity?: Array<{
        id: string;
        type: 'task_completed' | 'task_created' | 'user_joined' | 'task_updated' | 'task_deleted';
        message: string;
        time: string;
        user?: string;
    }>;
}

const activityConfig = {
    task_completed: { icon: CheckCircle, color: 'text-green-400' },
    task_created: { icon: Clock, color: 'text-blue-400' },
    user_joined: { icon: UserPlus, color: 'text-purple-400' },
    task_updated: { icon: Edit, color: 'text-yellow-400' },
    task_deleted: { icon: Trash, color: 'text-red-400' },
};

// Mock data since we don't have activity tracking yet
const mockActivity = [
    { id: '1', type: 'task_completed' as const, message: 'Completed annual audit review', time: '2 hours ago', user: 'You' },
    { id: '2', type: 'task_created' as const, message: 'New task assigned: Q4 Report', time: '4 hours ago', user: 'Admin' },
    { id: '3', type: 'task_updated' as const, message: 'Updated tax filing deadline', time: 'Yesterday', user: 'You' },
];

const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({
    recentActivity = mockActivity
}) => {
    if (recentActivity.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Activity size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity) => {
                const config = activityConfig[activity.type];
                const Icon = config?.icon || Activity;
                const color = config?.color || 'text-gray-400';

                return (
                    <div key={activity.id} className="flex gap-3">
                        <div className={`p-1.5 rounded-lg bg-white/5 ${color}`}>
                            <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">{activity.message}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500">{activity.time}</span>
                                {activity.user && (
                                    <>
                                        <span className="text-gray-600">•</span>
                                        <span className="text-xs text-gray-500">{activity.user}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default RecentActivityWidget;
