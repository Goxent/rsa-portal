import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Clock, Calendar, Building2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

const MobileTabs: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const ALL_TABS = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
        { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { to: '/clients', icon: Building2, label: 'Clients', adminOnly: true },
        { to: '/calendar', icon: Calendar, label: 'Calendar' },
        { to: '/attendance', icon: Clock, label: 'Clock' },
    ];

    const visibleTabs = ALL_TABS.filter(tab => !tab.adminOnly || isAdmin);

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[68px] bg-[#0c0c0e]/95 backdrop-blur-lg border-t border-white/10 z-50 flex items-center justify-around px-2 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
            {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 ${isActive ? 'text-brand-400 -translate-y-1' : 'text-gray-500 hover:text-gray-300'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon size={22} className={`mb-0.5 transition-all ${isActive ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}`} />
                                <span className={`text-[10px] font-semibold tracking-wide transition-opacity ${isActive ? 'opacity-100' : 'opacity-80'}`}>{tab.label}</span>

                                {/* Active indicator dot */}
                                {isActive && (
                                    <div className="absolute top-1 w-1 h-1 rounded-full bg-brand-400" />
                                )}
                            </>
                        )}
                    </NavLink>
                );
            })}
        </nav>
    );
};

export default MobileTabs;
