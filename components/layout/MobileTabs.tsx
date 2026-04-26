import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, CheckSquare, Clock, Calendar, Building2, 
    MoreHorizontal, Bell, AlertCircle, FolderArchive, Megaphone, 
    Users, BarChart3, Archive, Activity, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

const MobileTabs: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [isMoreOpen, setIsMoreOpen] = useState(false);

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
    const isManager = user?.role === UserRole.MANAGER;
    const isMasterAdmin = user?.role === UserRole.MASTER_ADMIN;

    const CORE_TABS = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
        { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { to: '/clients', icon: Building2, label: 'Clients', adminOnly: true },
        { to: '/attendance', icon: Clock, label: 'Attendance' },
    ];

    const ALL_DRAWER_ITEMS = [
        { to: '/calendar', icon: Calendar, label: 'Calendar' },
        { to: '/compliance', icon: AlertCircle, label: 'Compliance' },
        { to: '/notices', icon: Bell, label: 'Notices' },
        { to: '/leaves', icon: Calendar, label: 'Leaves' },
        { to: '/audit-docs', icon: FolderArchive, label: 'Audit Docs' },
        { to: '/communication', icon: Megaphone, label: 'Communication', adminOnly: true },
        { to: '/staff', icon: Users, label: 'Staff', adminOnly: true },
        { to: '/workload', icon: BarChart3, label: 'Workload', adminOnly: true, managerAllowed: true },
        { to: '/archived-tasks', icon: Archive, label: 'Archived', adminOnly: true },
        { id: 'audit-log', to: '/audit-log', icon: Activity, label: 'Audit Log', masterAdminOnly: true }
    ];

    const filterVisible = (item: any) => {
        if (item.masterAdminOnly) return isMasterAdmin;
        if (item.adminOnly) return isAdmin || (isManager && item.managerAllowed);
        return true;
    };

    const visibleCoreTabs = CORE_TABS.filter(filterVisible);
    const visibleDrawerItems = ALL_DRAWER_ITEMS.filter(filterVisible);

    const closeDrawer = () => setIsMoreOpen(false);

    return (
        <>
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-[#0c0c0e]/80 backdrop-blur-xl border-t border-white/5 z-[60] flex items-center justify-around px-4 pb-safe shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                {visibleCoreTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            onClick={closeDrawer}
                            className="relative flex flex-col items-center justify-center w-full h-full group"
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeTabPill"
                                            className="absolute inset-x-1 inset-y-2 bg-accent/10 rounded-2xl -z-10"
                                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                        />
                                    )}
                                    <motion.div
                                        animate={isActive ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
                                        className="relative"
                                    >
                                        <Icon 
                                            size={22} 
                                            className={`transition-colors duration-300 ${
                                                isActive ? 'text-accent' : 'text-gray-500'
                                            }`} 
                                        />
                                        {isActive && (
                                            <motion.div 
                                                layoutId="activeDot"
                                                className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-accent"
                                            />
                                        )}
                                    </motion.div>
                                    <span className={`text-[10px] mt-1.5 font-bold tracking-wider transition-all duration-300 uppercase ${
                                        isActive ? 'text-accent' : 'text-gray-500 opacity-60'
                                    }`}>
                                        {tab.label}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    );
                })}

                {/* More Tab */}
                <button
                    onClick={() => setIsMoreOpen(!isMoreOpen)}
                    className="relative flex flex-col items-center justify-center w-full h-full group"
                >
                    <motion.div
                        animate={isMoreOpen ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
                    >
                        <MoreHorizontal 
                            size={22} 
                            className={`transition-colors duration-300 ${
                                isMoreOpen ? 'text-accent' : 'text-gray-500'
                            }`} 
                        />
                    </motion.div>
                    <span className={`text-[10px] mt-1.5 font-bold tracking-wider uppercase ${
                        isMoreOpen ? 'text-accent' : 'text-gray-500 opacity-60'
                    }`}>
                        More
                    </span>
                </button>
            </nav>

            {/* More Drawer */}
            <AnimatePresence>
                {isMoreOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeDrawer}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 z-[80] bg-[var(--bg-elevated)] border-t border-[var(--border)] rounded-t-[2rem] px-6 pt-2 pb-12 md:hidden"
                            style={{ maxHeight: '80vh', overflowY: 'auto' }}
                        >
                            {/* Handle Bar */}
                            <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto my-4" />
                            
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-[var(--text-heading)] font-black uppercase tracking-widest text-sm">Application Menu</h2>
                                <button onClick={closeDrawer} className="p-2 text-[var(--text-muted)] hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {visibleDrawerItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            onClick={closeDrawer}
                                            className={({ isActive }) => `
                                                flex flex-col items-center justify-center p-4 rounded-[var(--radius-md)] border transition-all duration-200
                                                ${isActive 
                                                    ? 'bg-accent/10 border-accent/30 text-accent shadow-accent-glow' 
                                                    : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-white/10 hover:text-white'
                                                }
                                            `}
                                        >
                                            <Icon size={24} className="mb-2" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default MobileTabs;

