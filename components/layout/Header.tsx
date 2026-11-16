import React from 'react';
import { Bell, Sun, Moon, Search } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import RSALogo from '../common/RSALogo';

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
            style={{ 
                height: 'var(--header-height)',
                backgroundColor: 'var(--bg-secondary)', 
                borderColor: 'var(--border)',
                left: isSidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)'
            }}
            className="fixed top-0 right-0 z-40 border-b flex items-center justify-between px-5 md:pl-4 transition-[left] duration-200"
        >

            {/* Left side: Breadcrumbs & Mobile Logo */}
            <div className="flex items-center gap-2">
                {/* Mobile Logo */}
                <div className="md:hidden flex items-center">
                    <RSALogo 
                        size="xs" 
                        className="shrink-0 rounded-md shadow-sm" 
                        style={{ width: '26px', height: '26px' }} 
                    />
                    <span className="mx-2 text-[var(--text-muted)] text-sm font-light">/</span>
                </div>

                <div className="flex items-center text-[0.8125rem]">
                    <Breadcrumbs />
                </div>
            </div>

            {/* Right side Actions Cluster */}
            <div className="flex items-center gap-1">
                

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center hover:bg-[var(--bg-surface)] transition-all duration-200"
                    style={{ 
                        height: '34px',
                        width: '34px',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-muted)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-heading)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    {theme === 'dark' ? (
                        <Sun size={18} strokeWidth={1.75} />
                    ) : (
                        <Moon size={18} strokeWidth={1.75} />
                    )}
                </button>

                {/* Notifications Bell */}
                <button
                    onClick={toggleNotifications}
                    className="relative flex items-center justify-center hover:bg-[var(--bg-surface)] transition-all duration-200 group"
                    style={{ 
                        height: '34px',
                        width: '34px',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-muted)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-heading)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <Bell size={18} strokeWidth={1.75} />
                    {unreadCount > 0 && (
                        <span 
                            className="absolute"
                            style={{ 
                                top: '7px',
                                right: '7px',
                                width: '7px',
                                height: '7px',
                                borderRadius: '99px',
                                background: 'var(--color-danger)',
                                border: '2px solid var(--bg-secondary)'
                            }}
                        />
                    )}
                </button>

                {/* Desktop User Avatar */}
                <div className="hidden md:flex ml-2">
                    <div 
                        className="flex items-center justify-center text-white cursor-pointer transition-shadow duration-150 hover:ring-2 hover:ring-[var(--border-mid)]"
                        style={{ 
                            height: '32px',
                            width: '32px',
                            borderRadius: '99px',
                            background: 'var(--accent)',
                            fontSize: '0.6875rem',
                            fontWeight: 700
                        }}
                    >
                        {user?.displayName ? getInitials(user.displayName) : 'U'}
                    </div>
                </div>

                {/* Mobile Tablet Menu Toggle */}
                <button
                    onClick={toggleMobileMenu}
                    className="md:hidden flex items-center justify-center h-[34px] w-[34px] rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-surface)]"
                >
                    <div className="flex flex-col gap-1 w-4">
                        <span className="h-[1.5px] w-full bg-current rounded-full" />
                        <span className="h-[1.5px] w-3/4 bg-current rounded-full" />
                        <span className="h-[1.5px] w-full bg-current rounded-full" />
                    </div>
                </button>

            </div>
        </header>
    );
};

export default Header;
