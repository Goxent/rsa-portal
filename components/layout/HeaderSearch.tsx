import React, { useRef, useEffect } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Search, X, History, ArrowRight } from 'lucide-react';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import { CATEGORY_LABELS, CATEGORY_ORDER, Command } from '../../types/command';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
// Re-use logic from CommandPalette for registering defaults
import { CommandRegistry } from '../../services/command-registry';
import {
    Home, CheckSquare, Users, Calendar, Briefcase, Clock, FileText, Settings, LogOut, Sun, Moon, Plus, Sparkles, BarChart3, Bell
} from 'lucide-react';

// Register default commands
const registerDefaultCommands = (
    navigate: ReturnType<typeof useNavigate>,
    logout: () => void,
    toggleTheme: () => void,
    theme: string
) => {
    CommandRegistry.registerAll([
        { id: 'nav-dashboard', title: 'Go to Dashboard', subtitle: 'View overview and stats', icon: Home, keywords: ['dashboard', 'home', 'overview', 'main'], shortcut: ['G', 'D'], category: 'navigation', action: () => navigate('/dashboard') },
        { id: 'nav-tasks', title: 'Go to Tasks', subtitle: 'Manage tasks and assignments', icon: CheckSquare, keywords: ['tasks', 'todo', 'assignments', 'work'], shortcut: ['G', 'T'], category: 'navigation', action: () => navigate('/tasks') },
        { id: 'nav-calendar', title: 'Go to Calendar', subtitle: 'Events and deadlines', icon: Calendar, keywords: ['calendar', 'events', 'schedule', 'deadlines'], shortcut: ['G', 'E'], category: 'navigation', action: () => navigate('/calendar') },
        { id: 'nav-attendance', title: 'Go to Attendance', subtitle: 'Clock in/out and history', icon: Clock, keywords: ['attendance', 'clock', 'time', 'tracking'], shortcut: ['G', 'A'], category: 'navigation', action: () => navigate('/attendance') },
        { id: 'nav-staff', title: 'Go to Staff Directory', subtitle: 'Team members and roles', icon: Users, keywords: ['staff', 'team', 'employees', 'directory'], shortcut: ['G', 'S'], category: 'navigation', action: () => navigate('/staff') },
        { id: 'nav-clients', title: 'Go to Clients', subtitle: 'Manage clients', icon: Briefcase, keywords: ['clients', 'crm', 'companies'], shortcut: ['G', 'C'], category: 'navigation', action: () => navigate('/clients') },
        { id: 'nav-resources', title: 'Go to Resources', subtitle: 'Documents and files', icon: FileText, keywords: ['resources', 'files', 'documents', 'library'], shortcut: ['G', 'R'], category: 'navigation', action: () => navigate('/resources') },
        { id: 'nav-performance', title: 'Go to Performance', subtitle: 'Staff performance metrics', icon: BarChart3, keywords: ['performance', 'metrics', 'analytics', 'stats'], shortcut: ['G', 'P'], category: 'navigation', action: () => navigate('/performance') },

        { id: 'action-new-task', title: 'Create New Task', subtitle: 'Add a new task', icon: Plus, keywords: ['new', 'create', 'add', 'task'], category: 'action', action: () => navigate('/tasks?action=new') },
        { id: 'action-clock-in', title: 'Clock In / Out', subtitle: 'Record attendance', icon: Clock, keywords: ['clock', 'in', 'out', 'attendance', 'punch'], category: 'action', action: () => navigate('/attendance?action=clock') },
        { id: 'action-request-leave', title: 'Request Leave', subtitle: 'Submit a leave request', icon: Calendar, keywords: ['leave', 'vacation', 'time off', 'request'], category: 'action', action: () => navigate('/leaves?action=new') },

        { id: 'settings-theme', title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode', subtitle: 'Toggle theme', icon: theme === 'dark' ? Sun : Moon, keywords: ['theme', 'dark', 'light', 'mode', 'toggle'], category: 'settings', action: toggleTheme },
        { id: 'settings-notifications', title: 'Notification Settings', subtitle: 'Manage notifications', icon: Bell, keywords: ['notifications', 'alerts', 'settings'], category: 'settings', action: () => navigate('/settings/notifications') },
        { id: 'settings-logout', title: 'Log Out', subtitle: 'Sign out of your account', icon: LogOut, keywords: ['logout', 'signout', 'exit'], category: 'settings', action: logout },

        { id: 'ai-assistant', title: 'Ask AI Assistant', subtitle: 'Get help with tasks', icon: Sparkles, keywords: ['ai', 'assistant', 'help', 'ask', 'gemini'], category: 'ai', action: () => { alert('AI Assistant coming soon!'); } },
    ]);
};

const HeaderSearch: React.FC = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { theme, toggleTheme } = useTheme();

    // Register commands on mount
    useEffect(() => {
        registerDefaultCommands(navigate, logout, toggleTheme, theme);
    }, [navigate, logout, toggleTheme, theme]);

    const {
        isOpen,
        setIsOpen,
        search,
        setSearch,
        groupedCommands,
        executeCommand,
        clearSearch,
    } = useCommandPalette();

    const inputRef = useRef<HTMLInputElement>(null);

    // If Cmd+K is pressed, useCommandPalette automatically toggles `isOpen`. 
    // We want to force focus the input when `isOpen` becomes true.
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Delay closing to allow clicks on dropdown items
    const handleBlur = () => {
        setTimeout(() => setIsOpen(false), 200);
    };

    const nonEmptyCategories = CATEGORY_ORDER.filter(
        cat => (groupedCommands.get(cat)?.length || 0) > 0
    );

    return (
        <div className="relative flex-1 max-w-xl hidden sm:block mx-4">
            <CommandPrimitive className="relative w-full" shouldFilter={false}>
                <div className="relative flex items-center w-full h-9 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] group focus-within:border-[var(--accent)] transition-colors">
                    <Search size={15} className="absolute left-3 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" />

                    <CommandPrimitive.Input
                        ref={inputRef}
                        value={search}
                        onValueChange={setSearch}
                        onFocus={() => setIsOpen(true)}
                        onBlur={handleBlur}
                        placeholder="Search for pages, features, or actions..."
                        className="w-full h-full pl-9 pr-14 bg-transparent text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] outline-none rounded-lg"
                    />

                    {search ? (
                        <button
                            onClick={() => { clearSearch(); inputRef.current?.focus(); }}
                            className="absolute right-2.5 p-1 hover:bg-[var(--bg-surface)] rounded-md transition-colors"
                        >
                            <X size={13} className="text-[var(--text-muted)] hover:text-[var(--text-heading)]" />
                        </button>
                    ) : (
                        <div className="absolute right-2.5 text-[10px] text-[var(--text-muted)] font-mono font-medium hidden md:flex items-center gap-1 border border-[var(--border)] px-1.5 py-0.5 rounded bg-[var(--bg-surface)]">
                            <span>Ctrl</span> K
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-[100]"
                        >
                            <CommandPrimitive.List className="max-h-[50vh] overflow-y-auto p-1.5 custom-scrollbar">
                                <CommandPrimitive.Empty className="py-6 text-center text-xs text-[var(--text-muted)]">
                                    No results found for "<span className="text-[var(--text-heading)] font-medium">{search}</span>"
                                </CommandPrimitive.Empty>

                                {nonEmptyCategories.map(category => {
                                    const commands = groupedCommands.get(category) || [];
                                    if (commands.length === 0) return null;

                                    return (
                                        <CommandPrimitive.Group
                                            key={category}
                                            heading={
                                                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] mt-1.5 mb-0.5">
                                                    {category === 'recent' && <History size={12} />}
                                                    {CATEGORY_LABELS[category]}
                                                </div>
                                            }
                                        >
                                            {commands.map(command => (
                                                <SearchItem
                                                    key={command.id}
                                                    command={command}
                                                    onSelect={() => executeCommand(command)}
                                                />
                                            ))}
                                        </CommandPrimitive.Group>
                                    );
                                })}
                            </CommandPrimitive.List>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CommandPrimitive>
        </div>
    );
};

const SearchItem: React.FC<{ command: Command; onSelect: () => void }> = ({
    command,
    onSelect,
}) => {
    const Icon = command.icon;
    return (
        <CommandPrimitive.Item
            value={command.id}
            onSelect={onSelect}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-[var(--text-body)] data-[selected=true]:bg-[var(--accent-dim)] data-[selected=true]:text-[var(--text-heading)] hover:bg-[var(--bg-surface)] my-0.5 outline-none group border border-transparent data-[selected=true]:border-[var(--border-accent)]"
        >
            {Icon && (
                <div className="w-7 h-7 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center group-data-[selected=true]:bg-[var(--accent)] group-data-[selected=true]:text-[var(--on-accent)] transition-colors">
                    <Icon size={14} className="text-[var(--text-muted)] group-data-[selected=true]:text-[var(--on-accent)]" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-[var(--text-heading)]">{command.title}</p>
                {command.subtitle && (
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{command.subtitle}</p>
                )}
            </div>
            {command.shortcut && (
                <div className="flex items-center gap-0.5">
                    {command.shortcut.map((key, i) => (
                        <kbd key={i} className="px-1.5 py-0.5 text-[10px] bg-[var(--bg-main)] border border-[var(--border)] rounded text-[var(--text-muted)] font-mono">
                            {key}
                        </kbd>
                    ))}
                </div>
            )}
            <ArrowRight size={13} className="text-[var(--accent)] opacity-0 group-data-[selected=true]:opacity-100 transition-opacity ml-1.5 shrink-0" />
        </CommandPrimitive.Item>
    );
};

export default HeaderSearch;
