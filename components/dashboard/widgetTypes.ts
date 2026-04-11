export type WidgetType =
    | 'tasks-overview'
    | 'my-tasks'
    | 'all-tasks'
    | 'pending-actions'
    | 'calendar'
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
    category: 'tasks' | 'attendance' | 'team' | 'schedule' | 'focus';
}

export const WIDGET_CATEGORY_COLORS: Record<string, { border: string; label: string; glow: string }> = {
    tasks:      { border: 'border-l-brand-500',   label: 'text-brand-400',   glow: 'rgba(99,102,241,0.08)' },
    attendance: { border: 'border-l-brand-', label: 'text-brand-400', glow: 'rgba(16,185,129,0.08)' },
    team:       { border: 'border-l-purple-500',  label: 'text-purple-400',  glow: 'rgba(168,85,247,0.08)'  },
    schedule:   { border: 'border-l-sky-500',     label: 'text-sky-400',     glow: 'rgba(14,165,233,0.08)'  },
    focus:      { border: 'border-l-amber-500',   label: 'text-amber-400',   glow: 'rgba(245,158,11,0.08)'  },
};

export const WIDGET_REGISTRY: WidgetMeta[] = [
    {
        type: 'tasks-overview',
        title: 'Tasks Overview',
        description: 'Unified view for firm-wide and personal tasks with toggleable modes',
        icon: 'LayoutGrid',
        defaultSize: 'full',
        category: 'tasks',
    },
    {
        type: 'my-tasks',
        title: 'Legacy: My Tasks',
        description: 'Individual task list (Replaced by Tasks Overview)',
        icon: 'CheckSquare',
        defaultSize: 'md',
        category: 'tasks',
    },

    {
        type: 'all-tasks',
        title: 'Legacy: All Tasks',
        description: 'Firm-wide task list (Replaced by Tasks Overview)',
        icon: 'CheckSquare',
        defaultSize: 'full',
        adminOnly: true,
        category: 'tasks',
    },
    {
        type: 'calendar',
        title: 'Upcoming Schedule',
        description: 'Events and deadlines calendar view',
        icon: 'Calendar',
        defaultSize: 'md',
        category: 'schedule',
    },
];

import { UserRole } from '../../types';

// Default widget layout for new users
export const getDefaultWidgetConfig = (role: UserRole): WidgetConfig[] => {
    switch (role) {
        case UserRole.ADMIN:
        case UserRole.MASTER_ADMIN:
            return [
                { id: 'w_cal', type: 'calendar', title: 'Upcoming Schedule', position: 0, size: 'md', visible: true },
                { id: 'w_tasks_over', type: 'tasks-overview', title: 'Tasks Overview', position: 1, size: 'full', visible: true },
            ];
        case UserRole.MANAGER:
            return [
                { id: 'w_cal', type: 'calendar', title: 'Upcoming Schedule', position: 0, size: 'md', visible: true },
                { id: 'w_tasks_over', type: 'tasks-overview', title: 'Tasks Overview', position: 1, size: 'full', visible: true },
            ];
        case UserRole.STAFF:
        default:
            return [
                { id: 'w_cal', type: 'calendar', title: 'Upcoming Schedule', position: 0, size: 'md', visible: true },
                { id: 'w_tasks_over', type: 'tasks-overview', title: 'Tasks Overview', position: 1, size: 'full', visible: true },
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
