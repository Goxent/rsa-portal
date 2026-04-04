import React from 'react';
import { Bell, Sun, Moon } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
    toggleMobileMenu: () => void;
    unreadCount: number;
    toggleNotifications: () => void;
    isSidebarCollapsed: boolean;
}

const Header: React.FC<HeaderProps> = ({
    toggleMobileMenu,
    unreadCount,
    toggleNotifications,
    isSidebarCollapsed
}) => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    return (
        <header
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
            className={`fixed top-0 right-0 z-20 h-16 backdrop-blur-md border-b flex items-center justify-between px-4 md:px-6 transition-all duration-300 ${isSidebarCollapsed ? 'left-0 md:left-20' : 'left-0 md:left-64'}`}
        >

            {/* Left: Mobile Toggle & Breadcrumbs */}
            <div className="flex items-center gap-4">
                <div className="hidden md:block">
                    <Breadcrumbs />
                </div>
                {/* Mobile Logo substitute */}
                <div className="md:hidden flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg leading-none">R</span>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 md:gap-6">



                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    style={{ color: 'var(--text-body)' }}
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all duration-200 hover:scale-110"
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {theme === 'dark'
                        ? <Sun size={18} className="text-amber-400" />
                        : <Moon size={18} className="text-brand-700" style={{ color: 'var(--accent)' }} />}
                </button>

                {/* Notifications */}
                <button
                    onClick={toggleNotifications}
                    className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors group"
                >
                    <Bell size={18} className="group-hover:animate-swing" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#0c0c0e] animate-pulse" />
                    )}
                </button>

                {/* Mobile Profile Trigger (or simple avatar) */}
                <div className="md:hidden w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                    {user?.displayName ? getInitials(user.displayName) : 'U'}
                </div>

            </div>
        </header>
    );
};

export default Header;
