import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, UserPlus, FileText, MessageSquare } from 'lucide-react';
import { Task } from '../../../types';
import { formatDistanceToNow } from 'date-fns';

interface RecentActivityWidgetProps {
    recentCompletedTasks?: Task[];
    isLoading?: boolean;
}

// Mock Activity Type
interface ActivityItem {
    id: string;
    type: 'TASK_COMPLETE' | 'CLIENT_ADDED' | 'NEW_RESOURCE' | 'COMMENT';
    title: string;
    description: string;
    timestamp: Date;
    user: string;
}

const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({ recentCompletedTasks, isLoading }) => {
    const [activities, setActivities] = useState<ActivityItem[]>([]);

    useEffect(() => {
        // In a real app, we'd fetch a dedicated activity feed.
        // For now, we simulate it using recent tasks and some fake data.

        const generated: ActivityItem[] = [];

        // Add Recent Tasks
        recentCompletedTasks?.forEach(t => {
            generated.push({
                id: `task-${t.id}`,
                type: 'TASK_COMPLETE',
                title: 'Task Completed',
                description: `${t.title} for ${t.clientName}`,
                timestamp: new Date(t.completedAt || t.createdAt || new Date()),
                user: 'System'
            });
        });

        // Mock some other events
        generated.push(
            {
                id: 'mock-1',
                type: 'CLIENT_ADDED',
                title: 'New Client Onboarded',
                description: 'Apex Industries Pvt Ltd',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
                user: 'Admin'
            },
            {
                id: 'mock-2',
                type: 'NEW_RESOURCE',
                title: 'Resource Update',
                description: 'Added "Tax Audit Guide 2081"',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
                user: 'Manager'
            }
        );

        // Sort by time
        generated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivities(generated.slice(0, 5));

    }, [recentCompletedTasks]);

    if (isLoading) return <div className="space-y-3 p-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}</div>;

    const getIcon = (type: string) => {
        switch (type) {
            case 'TASK_COMPLETE': return <CheckCircle size={16} className="text-emerald-400" />;
            case 'CLIENT_ADDED': return <UserPlus size={16} className="text-blue-400" />;
            case 'NEW_RESOURCE': return <FileText size={16} className="text-purple-400" />;
            default: return <MessageSquare size={16} className="text-gray-400" />;
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pr-2 -mr-2">
            {activities.length > 0 ? (
                <div className="relative border-l border-white/10 ml-3 space-y-6 py-2">
                    {activities.map((item, idx) => (
                        <div key={item.id} className="relative pl-6 group">
                            <div className="absolute -left-[9px] top-1 p-1 bg-navy-900 border border-white/10 rounded-full group-hover:border-brand-500/50 transition-colors">
                                {getIcon(item.type)}
                            </div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-white group-hover:text-brand-300 transition-colors">{item.title}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                                </div>
                                <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                                    {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-500 py-8 text-sm">
                    No recent activity
                </div>
            )}
        </div>
    );
};

export default RecentActivityWidget;
