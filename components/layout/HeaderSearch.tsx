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
                <div className="relative flex items-center w-full h-10 rounded-xl bg-navy-900/50 border border-white/10 group focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 focus-within:bg-[#0B1120] transition-all shadow-inner">
                    <Search size={16} className="absolute left-3 text-gray-500 group-focus-within:text-brand-400 transition-colors" />

                    <CommandPrimitive.Input
                        ref={inputRef}
                        value={search}
                        onValueChange={setSearch}
                        onFocus={() => setIsOpen(true)}
                        onBlur={handleBlur}
                        placeholder="Search for pages, features, or actions..."
                        className="w-full h-full pl-10 pr-16 bg-transparent text-sm text-white placeholder-gray-500 outline-none rounded-xl"
                    />

                    {search ? (
                        <button
                            onClick={() => { clearSearch(); inputRef.current?.focus(); }}
                            className="absolute right-3 p-1 hover:bg-white/10 rounded-md transition-colors"
                        >
                            <X size={14} className="text-gray-400" />
                        </button>
                    ) : (
                        <div className="absolute right-3 text-[10px] text-gray-500 font-mono font-medium hidden md:flex items-center gap-1 border border-white/10 px-1.5 py-0.5 rounded shadow-sm">
                            <span className="text-gray-400">Ctrl</span> K
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-navy-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100]"
                        >
                            <CommandPrimitive.List className="max-h-[50vh] overflow-y-auto p-2 custom-scrollbar">
                                <CommandPrimitive.Empty className="py-8 text-center text-sm text-gray-400">
                                    No results found for "<span className="text-white">{search}</span>"
                                </CommandPrimitive.Empty>

                                {nonEmptyCategories.map(category => {
                                    const commands = groupedCommands.get(category) || [];
                                    if (commands.length === 0) return null;

                                    return (
                                        <CommandPrimitive.Group
                                            key={category}
                                            heading={
                                                <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 mb-1">
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-gray-300 data-[selected=true]:bg-brand-600/20 data-[selected=true]:text-white hover:bg-white/5 my-0.5 outline-none group border border-transparent data-[selected=true]:border-brand-500/30"
        >
            {Icon && (
                <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center group-data-[selected=true]:bg-brand-600/30 shadow-sm transition-colors">
                    <Icon size={16} className="text-gray-400 group-data-[selected=true]:text-brand-400" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-white">{command.title}</p>
                {command.subtitle && (
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{command.subtitle}</p>
                )}
            </div>
            {command.shortcut && (
                <div className="flex items-center gap-0.5">
                    {command.shortcut.map((key, i) => (
                        <kbd key={i} className="px-1.5 py-0.5 text-[10px] bg-white/10 border border-white/5 rounded text-gray-400 font-mono shadow-sm">
                            {key}
                        </kbd>
                    ))}
                </div>
            )}
            <ArrowRight size={14} className="text-brand-400 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity ml-2 shrink-0 translate-x-1 group-data-[selected=true]:translate-x-0 duration-200" />
        </CommandPrimitive.Item>
    );
};

export default HeaderSearch;
