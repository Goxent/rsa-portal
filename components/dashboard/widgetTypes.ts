// Dashboard Widget Types and Configuration

export type WidgetType =
    | 'my-tasks'
    | 'all-tasks'
    | 'team-workload'
    | 'pending-actions'
    | 'calendar'
    | 'performance'
    | 'quick-actions'
    | 'recent-activity'
    | 'task-stats'
    | 'client-stats'
    | 'staff-stats'
    | 'impact-stats'
    | 'compliance-countdown'
    | 'ai-insight';

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
    },
    {
        type: 'ai-insight',
        title: 'AI Daily Insight',
        description: 'Smart tips and task suggestions',
        icon: 'Sparkles',
        defaultSize: 'full',
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
    {
        type: 'client-stats',
        title: 'Client Overview',
        description: 'Client distribution and signing status',
        icon: 'Briefcase',
        defaultSize: 'sm',
    },
    {
        type: 'staff-stats',
        title: 'Department Overview',
        description: 'Staff distribution by department',
        icon: 'Users',
        defaultSize: 'sm',
    },
];

// Default widget layout for new users
export const getDefaultWidgetConfig = (isAdmin: boolean): WidgetConfig[] => {
    if (isAdmin) {
        // Admin: work management + event management focused
        return [
            { id: 'w_ai', type: 'ai-insight', title: 'AI Daily Insight', position: 0, size: 'full', visible: true },
            { id: 'w_alltasks', type: 'all-tasks', title: 'All Tasks', position: 1, size: 'full', visible: true },
            { id: 'w_workload', type: 'team-workload', title: 'Team Workload', position: 2, size: 'md', visible: true },
            { id: 'w_cal', type: 'calendar', title: 'Upcoming Schedule', position: 3, size: 'md', visible: true },
            { id: 'w_stats', type: 'task-stats', title: 'Task Statistics', position: 4, size: 'md', visible: true },
            { id: 'w_activity', type: 'recent-activity', title: 'Recent Activity', position: 5, size: 'md', visible: true },
            { id: 'w_qa', type: 'quick-actions', title: 'Quick Actions', position: 6, size: 'sm', visible: true },
            { id: 'w_clients', type: 'client-stats', title: 'Client Overview', position: 7, size: 'sm', visible: true },
            { id: 'w_staff', type: 'staff-stats', title: 'Department Overview', position: 8, size: 'sm', visible: true },
            { id: 'w_comp', type: 'compliance-countdown', title: 'Tax Deadlines', position: 9, size: 'md', visible: true },
        ];
    }

    // Staff: personal task + performance focused
    return [
        { id: 'w_ai', type: 'ai-insight', title: 'AI Daily Insight', position: 0, size: 'full', visible: true },
        { id: 'w1', type: 'task-stats', title: 'Task Statistics', position: 1, size: 'md', visible: true },
        { id: 'w2', type: 'my-tasks', title: 'My Tasks', position: 2, size: 'md', visible: true },
        { id: 'w3', type: 'calendar', title: 'Upcoming Schedule', position: 3, size: 'md', visible: true },
        { id: 'w4', type: 'quick-actions', title: 'Quick Actions', position: 4, size: 'sm', visible: true },
        { id: 'w5', type: 'performance', title: 'Performance', position: 5, size: 'sm', visible: true },
        { id: 'w_comp', type: 'compliance-countdown', title: 'Tax Deadlines', position: 6, size: 'md', visible: true },
        { id: 'w_act', type: 'recent-activity', title: 'Recent Activity', position: 7, size: 'md', visible: true },
    ];
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
