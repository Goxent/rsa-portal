import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    CheckSquare,
    Clock,
    Calendar,
    AlertCircle,
    Building2,
    BarChart3,
    FileStack,
    BookOpen,
    Trophy,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    X,
    PieChart,
    Users,
    Pin,
    Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
    isMobileOpen: boolean;
    closeMobileMenu: () => void;
}

const ALL_NAV_ITEMS = [
    { id: 'dashboard', to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'tasks', to: '/tasks', icon: CheckSquare, label: 'Tasks & Workflow' },
    { id: 'clients', to: '/clients', icon: Building2, label: 'Clients' },
    { id: 'calendar', to: '/calendar', icon: Calendar, label: 'Calendar' },
    { id: 'attendance', to: '/attendance', icon: Clock, label: 'Attendance' },
    { id: 'compliance', to: '/compliance', icon: AlertCircle, label: 'Compliance' },
    { id: 'leaves', to: '/leaves', icon: Calendar, label: 'Leaves & Requests' },
    { id: 'staff', to: '/staff', icon: Users, label: 'Staff Directory', adminOnly: true },
    { id: 'workload', to: '/workload', icon: BarChart3, label: 'Resource Planning', adminOnly: true },
    { id: 'performance', to: '/performance', icon: Trophy, label: 'Performance', adminOnly: true },
    { id: 'my-performance', to: '/my-performance', icon: PieChart, label: 'My Performance' },
    { id: 'templates', to: '/templates', icon: FileStack, label: 'Templates' },
    { id: 'knowledge-base', to: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
    { id: 'audit-log', to: '/audit-log', icon: Activity, label: 'Audit Log', adminOnly: true },
    { id: 'settings', to: '/settings', icon: Settings, label: 'Settings', masterAdminOnly: true }
];

const CORE_ITEM_IDS = ['dashboard', 'tasks', 'clients', 'calendar', 'attendance'];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse, isMobileOpen, closeMobileMenu }) => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('rsa_pinned_nav') || '[]');
        } catch { return []; }
    });

    const [isMoreOpen, setIsMoreOpen] = useState(true);

    const togglePin = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setPinnedIds(prev => {
            const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
            localStorage.setItem('rsa_pinned_nav', JSON.stringify(next));
            return next;
        });
    };

    const handleLogout = () => {
        logout().then(() => {
            window.location.href = '/login';
        });
    };

    const NavItem = ({ item }: { item: any }) => {
        const isPinned = pinnedIds.includes(item.id);
        const Icon = item.icon;

        return (
            <NavLink
                to={item.to}
                end={item.exact}
                onClick={closeMobileMenu}
                onContextMenu={(e) => togglePin(e, item.id)}
                className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-1 group relative overflow-hidden ${isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`
                }
            >
                <div className="relative z-10 flex items-center min-w-0 w-full">
                    <Icon size={isCollapsed ? 20 : 18} className={`shrink-0 transition-all duration-300 ${!isCollapsed ? 'mr-3' : 'mx-auto'}`} />
                    {!isCollapsed && (
                        <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className="font-medium text-sm truncate transition-opacity duration-300">{item.label}</span>
                            <button
                                onClick={(e) => togglePin(e, item.id)}
                                className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 rounded hover:bg-white/10 ${isPinned ? 'text-brand-400 opacity-100' : 'text-gray-500'}`}
                                title={isPinned ? "Unpin from Favorites" : "Pin to Favorites"}
                            >
                                <Pin size={12} className={isPinned ? "fill-brand-400/20" : ""} />
                            </button>
                        </div>
                    )}
                </div>

                {isCollapsed && (
                    <div className="absolute left-full ml-4 px-2 py-1 bg-navy-900 text-white text-xs rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none drop-shadow-lg flex items-center gap-2">
                        {item.label}
                        {isPinned && <Pin size={10} className="text-brand-400" />}
                    </div>
                )}
            </NavLink>
        );
    };

    const SectionLabel = ({ label }: { label: string }) => {
        if (isCollapsed) return <div className="h-px bg-white/5 my-4 mx-2" />;
        return (
            <p className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-6 mb-2 animate-in fade-in duration-300">
                {label}
            </p>
        );
    };

    const sidebarClasses = `
    fixed inset-y-0 left-0 z-30 bg-[#0B1120] border-r border-white/5 flex flex-col transition-all duration-300 ease-in-out
    ${isCollapsed ? 'w-20' : 'w-64'}
    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
  `;

    return (
        <>
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
                    onClick={closeMobileMenu}
                />
            )}

            <aside className={sidebarClasses}>
                {/* Header / Logo */}
                <div className={`h-16 flex items-center border-b border-white/5 px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span className="text-white font-bold text-lg leading-none">R</span>
                        </div>
                        {!isCollapsed && (
                            <div className="animate-in fade-in duration-300">
                                <h1 className="font-bold text-white text-lg leading-none tracking-tight">RSA Portal</h1>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={toggleCollapse}
                        className="hidden md:flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>

                    <button
                        onClick={closeMobileMenu}
                        className="md:hidden p-1 text-gray-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4 px-3 space-y-1">

                    {/* Favorites Section */}
                    {pinnedIds.length > 0 && (
                        <div className="mb-4">
                            <SectionLabel label="Favorites" />
                            {pinnedIds.map(id => {
                                const item = ALL_NAV_ITEMS.find(i => i.id === id);
                                if (!item) return null;
                                if (item.adminOnly && user?.role !== UserRole.ADMIN && user?.role !== UserRole.MASTER_ADMIN) return null;
                                if (item.masterAdminOnly && user?.role !== UserRole.MASTER_ADMIN) return null;
                                return <NavItem key={`pinned-${item.id}`} item={item} />;
                            })}
                        </div>
                    )}

                    <SectionLabel label="Core" />
                    {ALL_NAV_ITEMS.filter(i => CORE_ITEM_IDS.includes(i.id)).map(item => (
                        <NavItem key={`core-${item.id}`} item={item} />
                    ))}

                    <div className="mt-6">
                        <button
                            onClick={() => setIsMoreOpen(!isMoreOpen)}
                            className="w-full flex items-center justify-between px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 hover:text-gray-300 transition-colors"
                        >
                            <span>More</span>
                            {!isCollapsed && (
                                <ChevronRight size={14} className={`transition-transform duration-200 ${isMoreOpen ? 'rotate-90' : ''}`} />
                            )}
                        </button>

                        {isMoreOpen && (
                            <div className="space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                                {ALL_NAV_ITEMS.filter(i => !CORE_ITEM_IDS.includes(i.id)).map(item => {
                                    if (item.adminOnly && user?.role !== UserRole.ADMIN && user?.role !== UserRole.MASTER_ADMIN) return null;
                                    if (item.masterAdminOnly && user?.role !== UserRole.MASTER_ADMIN) return null;
                                    return <NavItem key={`more-${item.id}`} item={item} />;
                                })}
                            </div>
                        )}
                    </div>
                </nav>

                {/* Footer / User Profile */}
                <div className="p-3 border-t border-white/5">
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-2 rounded-xl bg-white/5 border border-white/5`}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {user?.displayName?.charAt(0).toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="text-xs font-medium text-white truncate">{user?.displayName}</p>
                                <p className="text-[10px] text-gray-500 truncate">{user?.role}</p>
                            </div>
                        )}
                        {!isCollapsed && (
                            <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors">
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
                    {isCollapsed && (
                        <button onClick={handleLogout} className="mt-2 w-full flex justify-center p-2 text-gray-400 hover:text-red-400 transition-colors">
                            <LogOut size={18} />
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
