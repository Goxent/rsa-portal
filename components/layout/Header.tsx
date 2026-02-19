import React, { useState, useEffect } from 'react';
import { Search, Bell, Menu, Clock } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { getCurrentDateUTC } from '../../utils/dates';
// @ts-ignore
import NepaliDate from 'nepali-date-converter';

interface HeaderProps {
    toggleMobileMenu: () => void;
    openCommandPalette: () => void;
    unreadCount: number;
    toggleNotifications: () => void;
}

const Header: React.FC<HeaderProps> = ({
    toggleMobileMenu,
    openCommandPalette,
    unreadCount,
    toggleNotifications
}) => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    // Format Nepali Date
    const getNepaliDateStr = () => {
        try {
            const npDate = new NepaliDate(currentTime);
            return npDate.format('DD MMMM YYYY');
        } catch (e) {
            return '';
        }
    };

    return (
        <header className="fixed top-0 right-0 left-0 md:left-auto w-full z-20 h-16 bg-[#0B1120]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 md:px-6 transition-all duration-300 md:w-[calc(100%-5rem)] md:ml-20">

            {/* Left: Mobile Toggle & Breadcrumbs */}
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleMobileMenu}
                    className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
                >
                    <Menu size={20} />
                </button>

                <div className="hidden md:block">
                    <Breadcrumbs />
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 md:gap-6">

                {/* Real-time Clock (Desktop Only) */}
                <div className="hidden lg:flex flex-col items-end mr-2 text-right">
                    <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <Clock size={12} className="text-blue-400" />
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                        {getNepaliDateStr()} • {currentTime.toLocaleDateString()}
                    </div>
                </div>

                {/* Global Search Trigger */}
                <button
                    onClick={openCommandPalette}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-all group"
                >
                    <Search size={14} className="group-hover:text-blue-400 transition-colors" />
                    <span className="text-xs hidden sm:inline">Search...</span>
                    <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-black/20 rounded border border-white/10 text-gray-500">⌘K</kbd>
                </button>

                {/* Notifications */}
                <button
                    onClick={toggleNotifications}
                    className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors group"
                >
                    <Bell size={18} className="group-hover:animate-swing" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#0B1120] animate-pulse" />
                    )}
                </button>

                {/* Mobile Profile Trigger (or simple avatar) */}
                <div className="md:hidden w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                    {user?.displayName ? getInitials(user.displayName) : 'U'}
                </div>

            </div>
        </header>
    );
};

export default Header;
