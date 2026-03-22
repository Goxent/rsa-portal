// Dashboard Widget Types and Configuration

export type WidgetType =
    | 'my-tasks'
    | 'all-tasks'
    | 'team-workload'
    | 'pending-actions'
    | 'calendar'
    | 'quick-actions'
    | 'recent-activity'
    | 'task-stats'
    | 'client-stats'
    | 'staff-stats'
    | 'impact-stats'
    | 'compliance-countdown'
    | 'greetings'
    | 'compliance-banner'
    | 'focus'
    | 'ai-insight'
    | 'workload-heatmap';

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface WidgetConfig {
    id: string;
    type: WidgetType;
    title: string;
    position: number;
    size: WidgetSize;
    visible: boolean;
    settings?: Record<string, any>;
}

export interface DashboardConfig {
    userId: string;
    widgets: WidgetConfig[];
    lastUpdated: string;
}

// Widget metadata for the widget picker
export interface WidgetMeta {
    type: WidgetType;
    title: string;
    description: string;
    icon: string;
    defaultSize: WidgetSize;
    adminOnly?: boolean;
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
    {
        type: 'impact-stats',
        title: 'Impact Stats',
        description: 'High-level business numbers (Revenue, Clients, Deadlines)',
        icon: 'BarChart2',
        defaultSize: 'full',
        adminOnly: true,
    },
    {
        type: 'compliance-countdown',
        title: 'Tax Deadlines',
        description: 'Countdown to major compliance dates',
        icon: 'Clock',
        defaultSize: 'md',
    },
    {
        type: 'my-tasks',
        title: 'My Tasks',
        description: 'Your personal task list with status updates',
        icon: 'CheckSquare',
        defaultSize: 'md',
    },
    {
        type: 'task-stats',
        title: 'Task Statistics',
        description: 'Overview of task distribution by status',
        icon: 'PieChart',
        defaultSize: 'md',
    },
    {
        type: 'all-tasks',
        title: 'All Tasks',
        description: 'Firm-wide task list with urgency filters and assignee view',
        icon: 'CheckSquare',
        defaultSize: 'full',
        adminOnly: true,
    },
    {
        type: 'calendar',
        title: 'Upcoming Schedule',
        description: 'Events and deadlines calendar view',
        icon: 'Calendar',
        defaultSize: 'md',
    },
    {
        type: 'quick-actions',
        title: 'Quick Actions',
        description: 'Shortcuts for common tasks',
        icon: 'Zap',
        defaultSize: 'sm',
    },

    {
        type: 'recent-activity',
        title: 'Recent Activity',
        description: 'Latest actions and updates',
        icon: 'Activity',
        defaultSize: 'md',
    },
    {
        type: 'client-stats',
        title: 'Client Overview',
        description: 'Client distribution and signing status',
        icon: 'Briefcase',
        defaultSize: 'sm',
        adminOnly: true,
    },
    {
        type: 'staff-stats',
        title: 'Department Overview',
        description: 'Staff distribution by department',
        icon: 'Users',
        defaultSize: 'sm',
        adminOnly: true,
    },
    { type: 'focus', title: 'Focus Timer', description: 'Pomodoro timer for focused work', icon: 'Target', defaultSize: 'md' },
    { type: 'ai-insight', title: 'AI Insights', description: 'AI-generated task insights', icon: 'Sparkles', defaultSize: 'md', adminOnly: true },
    { type: 'workload-heatmap', title: 'Workload Map', description: 'Heatmap of staff task distribution', icon: 'LayoutGrid', defaultSize: 'lg', adminOnly: true },
];

import { UserRole } from '../../types';

// Default widget layout for new users
export const getDefaultWidgetConfig = (role: UserRole): WidgetConfig[] => {
    switch (role) {
        case UserRole.STAFF:
            return [
                { id: 'w_mytask', type: 'my-tasks', title: 'My Tasks', position: 0, size: 'full', visible: true },
            ];
        case UserRole.MANAGER:
            return [
                { id: 'w_tstat', type: 'task-stats', title: 'Task Statistics', position: 0, size: 'md', visible: true },
                { id: 'w_sstat', type: 'staff-stats', title: 'Department Overview', position: 1, size: 'sm', visible: true },
            ];
        case UserRole.ADMIN:
        case UserRole.MASTER_ADMIN:
        default:
            return [
                { id: 'w_focus', type: 'focus', title: 'Focus Timer', position: 0, size: 'md', visible: true },
                { id: 'w_heat', type: 'workload-heatmap', title: 'Workload Map', position: 1, size: 'lg', visible: true },
                { id: 'w_tstat', type: 'task-stats', title: 'Task Statistics', position: 2, size: 'md', visible: true },
                { id: 'w_alltasks', type: 'all-tasks', title: 'All Tasks', position: 3, size: 'full', visible: true },
                { id: 'w_cal', type: 'calendar', title: 'Upcoming Schedule', position: 4, size: 'md', visible: true },
            ];
    }
};

// Size class mapping for Tailwind
export const getWidgetSizeClasses = (size: WidgetSize): string => {
    switch (size) {
        case 'sm':
            return 'col-span-1';
        case 'md':
            return 'col-span-1 md:col-span-2';
        case 'lg':
            return 'col-span-1 md:col-span-2 lg:col-span-3';
        case 'full':
            return 'col-span-full';
        default:
            return 'col-span-1';
    }
};
