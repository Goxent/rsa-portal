import React, { useEffect, useRef } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import {
    Search,
    Home,
    CheckSquare,
    Users,
    Calendar,
    Briefcase,
    Clock,
    FileText,
    Settings,
    LogOut,
    Sun,
    Moon,
    Plus,
    Sparkles,
    BarChart3,
    Bell,
    X,
    Command as CommandIcon,
    ArrowRight,
    History,
} from 'lucide-react';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { Command, CATEGORY_LABELS, CommandCategory, CATEGORY_ORDER } from '../types/command';
import { CommandRegistry } from '../services/command-registry';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

// Register default commands
const registerDefaultCommands = (
    navigate: ReturnType<typeof useNavigate>,
    logout: () => void,
    toggleTheme: () => void,
    theme: string
) => {
    CommandRegistry.registerAll([
        // Navigation
        {
            id: 'nav-dashboard',
            title: 'Go to Dashboard',
            subtitle: 'View overview and stats',
            icon: Home,
            keywords: ['dashboard', 'home', 'overview', 'main'],
            shortcut: ['G', 'D'],
            category: 'navigation',
            action: () => navigate('/dashboard'),
        },
        {
            id: 'nav-tasks',
            title: 'Go to Tasks',
            subtitle: 'Manage tasks and assignments',
            icon: CheckSquare,
            keywords: ['tasks', 'todo', 'assignments', 'work'],
            shortcut: ['G', 'T'],
            category: 'navigation',
            action: () => navigate('/tasks'),
        },

        {
            id: 'nav-calendar',
            title: 'Go to Calendar',
            subtitle: 'Events and deadlines',
            icon: Calendar,
            keywords: ['calendar', 'events', 'schedule', 'deadlines'],
            shortcut: ['G', 'E'],
            category: 'navigation',
            action: () => navigate('/calendar'),
        },
        {
            id: 'nav-attendance',
            title: 'Go to Attendance',
            subtitle: 'Clock in/out and history',
            icon: Clock,
            keywords: ['attendance', 'clock', 'time', 'tracking'],
            shortcut: ['G', 'A'],
            category: 'navigation',
            action: () => navigate('/attendance'),
        },
        {
            id: 'nav-staff',
            title: 'Go to Staff Directory',
            subtitle: 'Team members and roles',
            icon: Users,
            keywords: ['staff', 'team', 'employees', 'directory'],
            shortcut: ['G', 'S'],
            category: 'navigation',
            action: () => navigate('/staff'),
        },
        {
            id: 'nav-resources',
            title: 'Go to Resources',
            subtitle: 'Documents and files',
            icon: FileText,
            keywords: ['resources', 'files', 'documents', 'library'],
            shortcut: ['G', 'R'],
            category: 'navigation',
            action: () => navigate('/resources'),
        },
        {
            id: 'nav-performance',
            title: 'Go to Performance',
            subtitle: 'Staff performance metrics',
            icon: BarChart3,
            keywords: ['performance', 'metrics', 'analytics', 'stats'],
            shortcut: ['G', 'P'],
            category: 'navigation',
            action: () => navigate('/performance'),
        },

        // Actions
        {
            id: 'action-new-task',
            title: 'Create New Task',
            subtitle: 'Add a new task',
            icon: Plus,
            keywords: ['new', 'create', 'add', 'task'],
            category: 'action',
            action: () => navigate('/tasks?action=new'),
        },

        {
            id: 'action-clock-in',
            title: 'Clock In / Out',
            subtitle: 'Record attendance',
            icon: Clock,
            keywords: ['clock', 'in', 'out', 'attendance', 'punch'],
            category: 'action',
            action: () => navigate('/attendance?action=clock'),
        },
        {
            id: 'action-request-leave',
            title: 'Request Leave',
            subtitle: 'Submit a leave request',
            icon: Calendar,
            keywords: ['leave', 'vacation', 'time off', 'request'],
            category: 'action',
            action: () => navigate('/leaves?action=new'),
        },

        // Settings
        {
            id: 'settings-theme',
            title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
            subtitle: 'Toggle theme',
            icon: theme === 'dark' ? Sun : Moon,
            keywords: ['theme', 'dark', 'light', 'mode', 'toggle'],
            category: 'settings',
            action: toggleTheme,
        },
        {
            id: 'settings-notifications',
            title: 'Notification Settings',
            subtitle: 'Manage notifications',
            icon: Bell,
            keywords: ['notifications', 'alerts', 'settings'],
            category: 'settings',
            action: () => navigate('/settings/notifications'),
        },
        {
            id: 'settings-logout',
            title: 'Log Out',
            subtitle: 'Sign out of your account',
            icon: LogOut,
            keywords: ['logout', 'signout', 'exit'],
            category: 'settings',
            action: logout,
        },

        // AI
        {
            id: 'ai-assistant',
            title: 'Ask AI Assistant',
            subtitle: 'Get help with tasks',
            icon: Sparkles,
            keywords: ['ai', 'assistant', 'help', 'ask', 'gemini'],
            category: 'ai',
            action: () => {
                // Could open an AI chat modal
                alert('AI Assistant coming soon!');
            },
        },
    ]);
};

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        setIsOpen,
        search,
        setSearch,
        groupedCommands,
        executeCommand,
        clearSearch,
    } = useCommandPalette(isOpen, onClose);

    // Register commands on mount
    useEffect(() => {
        registerDefaultCommands(navigate, logout, toggleTheme, theme);
    }, [navigate, logout, toggleTheme, theme]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Get non-empty categories
    const nonEmptyCategories = CATEGORY_ORDER.filter(
        cat => (groupedCommands.get(cat)?.length || 0) > 0
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
                    onClick={() => setIsOpen(false)}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: -20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: -20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="w-full max-w-xl mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <CommandPrimitive
                            className="glass-modal rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                            loop
                        >
                            {/* Search Input */}
                            <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
                                <Search size={20} className="text-gray-400 flex-shrink-0" />
                                <CommandPrimitive.Input
                                    ref={inputRef}
                                    value={search}
                                    onValueChange={setSearch}
                                    placeholder="Type a command or search..."
                                    className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-base"
                                />
                                {search && (
                                    <button
                                        onClick={clearSearch}
                                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X size={16} className="text-gray-400" />
                                    </button>
                                )}
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">ESC</kbd>
                                    <span>to close</span>
                                </div>
                            </div>

                            {/* Command List */}
                            <CommandPrimitive.List className="max-h-[50vh] overflow-y-auto p-2">
                                <CommandPrimitive.Empty className="py-8 text-center text-gray-400">
                                    No commands found.
                                </CommandPrimitive.Empty>

                                {nonEmptyCategories.map(category => {
                                    const commands = groupedCommands.get(category) || [];
                                    if (commands.length === 0) return null;

                                    return (
                                        <CommandPrimitive.Group
                                            key={category}
                                            heading={
                                                <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    {category === 'recent' && <History size={12} />}
                                                    {CATEGORY_LABELS[category]}
                                                </div>
                                            }
                                        >
                                            {commands.map(command => (
                                                <CommandItem
                                                    key={command.id}
                                                    command={command}
                                                    onSelect={() => executeCommand(command)}
                                                />
                                            ))}
                                        </CommandPrimitive.Group>
                                    );
                                })}
                            </CommandPrimitive.List>

                            {/* Footer */}
                            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/5 text-xs text-gray-500">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑↓</kbd>
                                        Navigate
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Enter</kbd>
                                        Select
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <CommandIcon size={12} />
                                    <span>Command Palette</span>
                                </div>
                            </div>
                        </CommandPrimitive>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Individual command item
const CommandItem: React.FC<{ command: Command; onSelect: () => void }> = ({
    command,
    onSelect,
}) => {
    const Icon = command.icon;

    return (
        <CommandPrimitive.Item
            value={command.id}
            onSelect={onSelect}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors data-[selected=true]:bg-brand-600/20 data-[selected=true]:text-white text-gray-300 hover:bg-white/5 group"
        >
            {Icon && (
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-data-[selected=true]:bg-brand-600/30">
                    <Icon size={16} className="text-gray-400 group-data-[selected=true]:text-brand-400" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{command.title}</p>
                {command.subtitle && (
                    <p className="text-xs text-gray-500 truncate">{command.subtitle}</p>
                )}
            </div>
            {command.shortcut && (
                <div className="flex items-center gap-0.5">
                    {command.shortcut.map((key, i) => (
                        <kbd
                            key={i}
                            className="px-1.5 py-0.5 text-xs bg-white/10 rounded text-gray-400"
                        >
                            {key}
                        </kbd>
                    ))}
                </div>
            )}
            <ArrowRight size={14} className="text-gray-500 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity" />
        </CommandPrimitive.Item>
    );
};

export default CommandPalette;
