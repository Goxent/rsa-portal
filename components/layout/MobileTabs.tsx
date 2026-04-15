import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Clock, Calendar, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

const MobileTabs: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();
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
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-[#0c0c0e]/80 backdrop-blur-xl border-t border-white/5 z-50 flex items-center justify-around px-4 pb-safe shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = location.pathname === tab.to;
                
                return (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        className="relative flex flex-col items-center justify-center w-full h-full group"
                    >
                        {({ isActive: linkActive }) => (
                            <>
                                {/* Sliding Pill Indicator */}
                                {linkActive && (
                                    <motion.div
                                        layoutId="activeTabPill"
                                        className="absolute inset-x-1 inset-y-2 bg-accent/10 rounded-2xl -z-10"
                                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                    />
                                )}

                                <motion.div
                                    animate={linkActive ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                    className="relative"
                                >
                                    <Icon 
                                        size={22} 
                                        className={`transition-colors duration-300 ${
                                            linkActive ? 'text-accent drop-shadow-[0_0_12px_var(--accent-glow)]' : 'text-gray-500 group-hover:text-gray-300'
                                        }`} 
                                    />
                                    
                                    {/* Active indicator dot at the top */}
                                    {linkActive && (
                                        <motion.div 
                                            layoutId="activeDot"
                                            className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)]"
                                        />
                                    )}
                                </motion.div>

                                <span className={`text-[10px] mt-1.5 font-bold tracking-wider transition-all duration-300 uppercase ${
                                    linkActive ? 'text-accent opacity-100' : 'text-gray-500 opacity-60'
                                }`}>
                                    {tab.label}
                                </span>
                            </>
                        )}
                    </NavLink>
                );
            })}
        </nav>
    );
};

export default MobileTabs;

