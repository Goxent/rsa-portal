// Command Palette Types

import { LucideIcon } from 'lucide-react';

export type CommandCategory =
    | 'navigation'
    | 'action'
    | 'search'
    | 'settings'
    | 'ai'
    | 'recent';

export interface Command {
    id: string;
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    keywords: string[];
    shortcut?: string[];
    category: CommandCategory;
    action: () => void | Promise<void>;
    visible?: () => boolean;
    disabled?: () => boolean;
}

export interface CommandGroup {
    category: CommandCategory;
    title: string;
    commands: Command[];
}

export interface CommandPaletteState {
    isOpen: boolean;
    search: string;
    selectedIndex: number;
    loading: boolean;
}

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
    navigation: 'Navigation',
    action: 'Actions',
    search: 'Search',
    settings: 'Settings',
    ai: 'AI Assistant',
    recent: 'Recent',
};

export const CATEGORY_ORDER: CommandCategory[] = [
    'recent',
    'navigation',
    'action',
    'search',
    'ai',
    'settings',
];
