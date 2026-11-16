import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[var(--bg-surface)] border-t border-[var(--border)] z-[60] flex items-center justify-around px-2 pb-safe">
                {visibleCoreTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            onClick={closeDrawer}
                            className="relative flex flex-col items-center justify-center w-full min-h-[44px] py-1 transition-colors"
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon 
                                        size={18} 
                                        className={`transition-colors ${
                                            isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                                        }`} 
                                    />
                                    <span className={`text-[10px] mt-0.5 font-medium transition-colors ${
                                        isActive ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)]'
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
                    className="relative flex flex-col items-center justify-center w-full min-h-[44px] py-1 transition-colors"
                    aria-label="More navigation options"
                >
                    <MoreHorizontal 
                        size={18} 
                        className={`transition-colors ${
                            isMoreOpen ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                        }`} 
                    />
                    <span className={`text-[10px] mt-0.5 font-medium transition-colors ${
                        isMoreOpen ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)]'
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
                            className="fixed inset-0 bg-black/60 z-[70] md:hidden"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 220 }}
                            className="fixed bottom-0 left-0 right-0 z-[80] bg-[var(--bg-elevated)] border-t border-[var(--border)] rounded-t-2xl px-5 pt-2 pb-10 md:hidden"
                            style={{ maxHeight: '80vh', overflowY: 'auto' }}
                        >
                            {/* Handle Bar */}
                            <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto my-3" />
                            
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-[var(--text-heading)] font-semibold text-xs">All Navigation</h2>
                                <button onClick={closeDrawer} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-heading)]" aria-label="Close menu">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                {visibleDrawerItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            onClick={closeDrawer}
                                            className={({ isActive }) => `
                                                flex flex-col items-center justify-center p-3 rounded-lg border transition-colors min-h-[44px]
                                                ${isActive 
                                                    ? 'bg-[var(--accent-dim)] border-[var(--border-accent)] text-[var(--accent)] font-semibold' 
                                                    : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-elevated)]'
                                                }
                                            `}
                                        >
                                            <Icon size={20} className="mb-1" />
                                            <span className="text-xs font-medium">{item.label}</span>
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
