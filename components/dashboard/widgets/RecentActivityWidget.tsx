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
        case 'COMPLETED': return { dotBg: 'var(--accent)', label: 'Completed', color: 'var(--accent)' };
        case 'OVERDUE': return { dotBg: 'var(--color-danger)', label: 'Overdue', color: 'var(--color-danger)' };
        case 'IN_PROGRESS': return { dotBg: 'var(--color-warning)', label: 'In progress', color: 'var(--color-warning)' };
        case 'REVIEW': return { dotBg: 'var(--color-info)', label: 'Under review', color: 'var(--color-info)' };
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
            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                <CheckCircle2 size={24} strokeWidth={1.75} className="mb-2 opacity-40" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>No recent activity</p>
                <p className="text-xs mt-1 max-w-[240px]" style={{ color: 'var(--text-muted)' }}>
                    As tasks are updated, reviewed, and completed, activity updates will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-[1px]" style={{ background: 'var(--border)' }} />

                <div className="space-y-0">
                    {activities.map((item) => {
                        const style = getActivityStyle(item.type);
                        return (
                            <div key={item.id} className="relative flex gap-3 pb-3.5 last:pb-0 group">
                                {/* Dot */}
                                <div
                                    className="relative z-10 w-3 h-3 rounded-full mt-1 flex-shrink-0 border-2"
                                    style={{ background: style.dotBg, borderColor: 'var(--bg-secondary)' }}
                                />

                                {/* Content */}
                                <div className="flex-1 min-w-0 rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-[var(--bg-surface)]">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate leading-tight" style={{ color: 'var(--text-heading)' }}>
                                                {item.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[11px] font-medium" style={{ color: style.color }}>{style.label}</span>
                                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>·</span>
                                                <span className="text-[11px] font-normal truncate" style={{ color: 'var(--text-muted)' }}>{item.client}</span>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-normal whitespace-nowrap flex-shrink-0 tabular-nums mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
                className="flex items-center justify-center gap-1.5 w-full pt-3 text-xs font-medium hover:underline transition-colors border-t mt-2"
                style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}
            >
                View all tasks <ArrowRight size={12} strokeWidth={1.75} />
            </button>
        </div>
    );
};

export default RecentActivityWidget;
