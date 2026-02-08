// Dashboard Widget Types and Configuration

export type WidgetType =
    | 'my-tasks'
    | 'team-workload'
    | 'pending-actions'
    | 'calendar'
    | 'performance'
    | 'quick-actions'
    | 'recent-activity'
    | 'task-stats';

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
        type: 'team-workload',
        title: 'Team Workload',
        description: 'Staff capacity and assignment overview',
        icon: 'Users',
        defaultSize: 'md',
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
        type: 'performance',
        title: 'Performance',
        description: 'Your performance metrics and scores',
        icon: 'TrendingUp',
        defaultSize: 'sm',
    },
    {
        type: 'quick-actions',
        title: 'Quick Actions',
        description: 'Shortcuts for common tasks',
        icon: 'Zap',
        defaultSize: 'sm',
    },
    {
        type: 'pending-actions',
        title: 'Pending Actions',
        description: 'Items awaiting client response',
        icon: 'Clock',
        defaultSize: 'sm',
        adminOnly: true,
    },
    {
        type: 'recent-activity',
        title: 'Recent Activity',
        description: 'Latest actions and updates',
        icon: 'Activity',
        defaultSize: 'md',
    },
];

// Default widget layout for new users
export const getDefaultWidgetConfig = (isAdmin: boolean): WidgetConfig[] => {
    const baseWidgets: WidgetConfig[] = [
        { id: 'w1', type: 'task-stats', title: 'Task Statistics', position: 0, size: 'md', visible: true },
        { id: 'w2', type: 'my-tasks', title: 'My Tasks', position: 1, size: 'md', visible: true },
        { id: 'w3', type: 'calendar', title: 'Upcoming Schedule', position: 2, size: 'md', visible: true },
        { id: 'w4', type: 'quick-actions', title: 'Quick Actions', position: 3, size: 'sm', visible: true },
        { id: 'w5', type: 'performance', title: 'Performance', position: 4, size: 'sm', visible: true },
    ];

    if (isAdmin) {
        baseWidgets.push(
            { id: 'w6', type: 'team-workload', title: 'Team Workload', position: 5, size: 'md', visible: true },
            { id: 'w7', type: 'pending-actions', title: 'Pending Actions', position: 6, size: 'sm', visible: true }
        );
    }

    return baseWidgets;
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
