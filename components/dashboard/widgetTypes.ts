// Dashboard Widget Types and Configuration

export type WidgetType =
    | 'my-tasks'
    | 'all-tasks'
    | 'pending-actions'
    | 'calendar'
    | 'task-stats'
    | 'greetings'
    | 'compliance-banner'
    | 'focus';

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
            ];
        case UserRole.ADMIN:
        case UserRole.MASTER_ADMIN:
        default:
            return [
                { id: 'w_tstat', type: 'task-stats', title: 'Task Statistics', position: 1, size: 'md', visible: true },
                { id: 'w_alltasks', type: 'all-tasks', title: 'All Tasks', position: 2, size: 'full', visible: true },
                { id: 'w_cal', type: 'calendar', title: 'Upcoming Schedule', position: 3, size: 'md', visible: true },
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
