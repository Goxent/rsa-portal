import React, { useEffect, useState } from 'react';
import { CheckCircle2, Briefcase, Clock, ArrowRight } from 'lucide-react';
import { Task, TaskStatus } from '../../../types';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface RecentActivityWidgetProps {
    recentCompletedTasks?: Task[];
    recentTasks?: Task[];
    isLoading?: boolean;
}

interface ActivityItem {
    id: string;
    type: 'COMPLETED' | 'OVERDUE' | 'IN_PROGRESS' | 'REVIEW';
    title: string;
    client: string;
    timestamp: Date;
    priority: string;
}

const getActivityStyle = (type: ActivityItem['type']) => {
    switch (type) {
        case 'COMPLETED': return { dot: 'bg-brand-500', icon: <CheckCircle2 size={12} className="text-brand-500" />, label: 'Completed', color: 'text-brand-600 dark:text-brand-400' };
        case 'OVERDUE': return { dot: 'bg-red-500 animate-pulse', icon: <Clock size={12} className="text-red-500" />, label: 'Overdue', color: 'text-red-600 dark:text-red-400' };
        case 'IN_PROGRESS': return { dot: 'bg-amber-500', icon: <Briefcase size={12} className="text-amber-500" />, label: 'In Progress', color: 'text-amber-600 dark:text-amber-400' };
        case 'REVIEW': return { dot: 'bg-amber-500', icon: <Briefcase size={12} className="text-amber-500" />, label: 'Under Review', color: 'text-indigo-600 dark:text-amber-400' };
    }
};

const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({
    recentCompletedTasks = [],
    recentTasks = [],
    isLoading
}) => {
    const navigate = useNavigate();
    const [activities, setActivities] = useState<ActivityItem[]>([]);

    useEffect(() => {
        const items: ActivityItem[] = [];

        // Completed tasks
        recentCompletedTasks.slice(0, 5).forEach(t => {
            items.push({
                id: `done-${t.id}`,
                type: 'COMPLETED',
                title: t.title,
                client: t.clientName || 'Internal',
                timestamp: new Date(t.completedAt || t.createdAt || Date.now()),
                priority: t.priority,
            });
        });

        // Overdue active tasks
        recentTasks
            .filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TaskStatus.COMPLETED)
            .slice(0, 3)
            .forEach(t => {
                items.push({
                    id: `overdue-${t.id}`,
                    type: 'OVERDUE',
                    title: t.title,
                    client: t.clientName || 'Internal',
                    timestamp: new Date(t.dueDate),
                    priority: t.priority,
                });
            });

        // In-progress tasks
        recentTasks
            .filter(t => t.status === TaskStatus.IN_PROGRESS)
            .slice(0, 3)
            .forEach(t => {
                items.push({
                    id: `prog-${t.id}`,
                    type: 'IN_PROGRESS',
                    title: t.title,
                    client: t.clientName || 'Internal',
                    timestamp: new Date(t.createdAt || Date.now()),
                    priority: t.priority,
                });
            });

        // Under review
        recentTasks
            .filter(t => t.status === TaskStatus.UNDER_REVIEW)
            .slice(0, 2)
            .forEach(t => {
                items.push({
                    id: `rev-${t.id}`,
                    type: 'REVIEW',
                    title: t.title,
                    client: t.clientName || 'Internal',
                    timestamp: new Date(t.createdAt || Date.now()),
                    priority: t.priority,
                });
            });

        // Sort: overdue first, then by recency
        items.sort((a, b) => {
            if (a.type === 'OVERDUE' && b.type !== 'OVERDUE') return -1;
            if (b.type === 'OVERDUE' && a.type !== 'OVERDUE') return 1;
            return b.timestamp.getTime() - a.timestamp.getTime();
        });

        setActivities(items.slice(0, 7));
    }, [recentCompletedTasks, recentTasks]);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-white/10 mt-2 flex-shrink-0 animate-pulse" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-white/8 rounded animate-pulse w-3/4" />
                            <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <CheckCircle2 size={28} className="mb-2 opacity-30" />
                <p className="text-sm">No recent activity</p>
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-slate-200 dark:bg-white/[0.04]" />

                <div className="space-y-0">
                    {activities.map((item, idx) => {
                        const style = getActivityStyle(item.type);
                        return (
                            <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0 group">
                                {/* Dot */}
                                <div className={`relative z-10 w-3.5 h-3.5 rounded-full mt-1 flex-shrink-0 border-2 border-[#0a0f1e] ${style.dot}`} />

                                {/* Content */}
                                <div className="flex-1 min-w-0 hover:bg-slate-50 dark:hover:bg-white/[0.03] rounded-xl px-2.5 py-2 transition-colors border border-transparent">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-bold text-slate-900 dark:text-gray-200 truncate leading-tight transition-colors">{item.title}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className={`text-[10px] font-bold uppercase tracking-tight ${style.color}`}>{style.label}</span>
                                                <span className="text-slate-300 dark:text-gray-800 text-[10px]">·</span>
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-gray-600 truncate uppercase tracking-tight">{item.client}</span>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-500 dark:text-gray-500 whitespace-nowrap flex-shrink-0 mt-1 uppercase tracking-wider">
                                            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button
                onClick={() => navigate('/tasks')}
                className="flex items-center justify-center gap-1.5 w-full pt-3 text-[11px] text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors font-bold"
            >
                View all tasks <ArrowRight size={11} />
            </button>
        </div>
    );
};

export default RecentActivityWidget;
