import React, { useState, useEffect } from 'react';
import { Search, Bell, Menu, Clock } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import HeaderSearch from './HeaderSearch';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { getCurrentDateUTC } from '../../utils/dates';
// @ts-ignore
import NepaliDate from 'nepali-date-converter';

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
        <header className={`fixed top-0 right-0 z-20 h-16 bg-[#0B1120]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 md:px-6 transition-all duration-300 ${isSidebarCollapsed ? 'left-0 md:left-20' : 'left-0 md:left-64'}`}>

            {/* Left: Mobile Toggle & Breadcrumbs */}
            <div className="flex items-center gap-4">
                <div className="hidden md:block">
                    <Breadcrumbs />
                </div>
                {/* Mobile Logo substitute */}
                <div className="md:hidden flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg leading-none">R</span>
                    </div>
                </div>
            </div>

            {/* Center: Search Bar */}
            <HeaderSearch />

            {/* Right: Actions */}
            <div className="flex items-center gap-3 md:gap-6">

                {/* Real-time Clock (Desktop Only) */}
                <div className="hidden xl:flex flex-col items-end mr-2 text-right font-mono">
                    <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <Clock size={12} className="text-blue-400" />
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[10px] text-gray-400 group relative flex items-center justify-end cursor-help w-full mt-0.5">
                        <span className="border-b border-dashed border-gray-600 hover:text-white transition-colors">{currentTime.toLocaleDateString()}</span>
                        {/* Tooltip */}
                        <div className="absolute top-full right-0 mt-2 px-3 py-1.5 bg-navy-900 text-white text-xs rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none drop-shadow-xl font-sans">
                            {getNepaliDateStr()} BS
                        </div>
                    </div>
                </div>



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
