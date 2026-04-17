import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    CheckSquare,
    Clock,
    Calendar,
    AlertCircle,
    Building2,
    BarChart3,
    Library,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    X,
    Users,
    Archive,
    FolderArchive,
    Pin,
    PinOff,
    Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    { id: 'workload', to: '/workload', icon: BarChart3, label: 'Resource Planning', adminOnly: true, managerAllowed: true },
    { id: 'templates', to: '/templates', icon: Library, label: 'Resources' },
    { id: 'archived-tasks', to: '/archived-tasks', icon: Archive, label: 'Archived Tasks', adminOnly: true },
    { id: 'audit-log', to: '/audit-log', icon: Activity, label: 'Audit Log', masterAdminOnly: true },
    { id: 'audit-docs', to: '/audit-docs', icon: FolderArchive, label: 'Audit Documentation' },
    { id: 'settings', to: '/settings', icon: Settings, label: 'Settings', masterAdminOnly: true }
];

const CORE_ITEM_IDS = ['dashboard', 'tasks', 'clients', 'calendar', 'attendance'];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse, isMobileOpen, closeMobileMenu }) => {
    const { user, logout } = useAuth();
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('rsa_pinned_nav') || '[]');
        } catch { return []; }
    });
    const [isMoreOpen, setIsMoreOpen] = useState(true);
    const [isHovered, setIsHovered] = useState(false);

    // If it's not pinned (isCollapsed is true), expansion depends on hover.
    // If it's pinned (isCollapsed is false), it's always expanded.
    const isExpanded = !isCollapsed || isHovered;

    const togglePin = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setPinnedIds(prev => {
            const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
            localStorage.setItem('rsa_pinned_nav', JSON.stringify(next));
            return next;
        });
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            window.location.href = '/#/login';
        }
    };

    const isManager = user?.role === UserRole.MANAGER;
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const filterVisibleItems = (item: any) => {
        if (item.masterAdminOnly) return user?.role === UserRole.MASTER_ADMIN;
        if (item.adminOnly) return isAdmin || (isManager && item.managerAllowed);
        return true;
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
                className={({ isActive }) => `
                    relative flex items-center gap-[0.625rem] px-3 transition-all duration-200 mb-[2px] rounded-[var(--radius-md)] group h-[40px] overflow-hidden
                    ${isActive ? '' : 'hover:bg-[var(--bg-surface)]'}
                `}
                style={({ isActive }) => ({
                    background: isActive ? 'var(--accent-dim)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-body)',
                    border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.8125rem'
                })}
            >
                {({ isActive }) => (
                    <>
                        <Icon 
                            size={18} 
                            className="shrink-0 transition-all duration-200" 
                            style={{ 
                                color: isActive ? 'var(--accent)' : 'inherit',
                                transform: !isExpanded ? 'scale(1.1)' : 'scale(1)'
                            }}
                        />
                        
                        <div className={`flex-1 flex items-center justify-between min-w-0 transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                            <span className="truncate">{item.label}</span>
                            <button
                                onClick={(e) => togglePin(e, item.id)}
                                className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 rounded hover:bg-black/10 ${isPinned ? 'opacity-100' : ''}`}
                                title={isPinned ? "Unpin from Favorites" : "Pin to Favorites"}
                                style={{ color: isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
                            >
                                <Pin size={10} className={isPinned ? "fill-current/20" : ""} />
                            </button>
                        </div>

                        {!isExpanded && (
                            <div
                                className="absolute left-full ml-4 px-2.5 py-1.5 text-xs rounded-[var(--radius-sm)] border opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 pointer-events-none shadow-xl flex items-center gap-2"
                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-heading)', borderColor: 'var(--border-mid)' }}
                            >
                                {item.label}
                                {isPinned && <Pin size={10} style={{ color: 'var(--accent)' }} />}
                            </div>
                        )}
                    </>
                )}
            </NavLink>
        );
    };

    const SectionLabel = ({ label }: { label: string }) => {
        return (
            <p className={`uppercase transition-all duration-300 ${isExpanded ? 'opacity-100 px-[0.875rem]' : 'opacity-0 px-0'}`} style={{ 
                fontSize: '0.625rem', 
                fontWeight: 700, 
                letterSpacing: '0.1em', 
                color: 'var(--text-muted)',
                paddingTop: '1.25rem',
                paddingBottom: '0.5rem',
                whiteSpace: 'nowrap'
            }}>
                {label}
            </p>
        );
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={closeMobileMenu}
                />
            )}

            <motion.aside
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className={`fixed inset-y-0 left-0 z-[60] flex flex-col transition-all duration-300 ease-in-out dotted-grid ${isMobileOpen ? 'translate-x-0' : 'hidden md:flex -translate-x-full md:translate-x-0'}`}
                style={{ 
                    width: isExpanded ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed)',
                    background: 'var(--bg-secondary)',
                    borderRight: '1px solid var(--border)',
                    boxShadow: isExpanded && isCollapsed ? '10px 0 30px rgba(0,0,0,0.5)' : 'none',
                    top: 0,
                    bottom: 0,
                    height: '100vh'
                }}
            >
                {/* Brand glow at bottom of sidebar */}
                <div 
                    className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none opacity-20"
                    style={{ backgroundImage: 'radial-gradient(circle at 50% 100%, var(--accent) 0%, transparent 70%)' }}
                />
                {/* Logo Area */}
                <div
                    className="flex items-center"
                    style={{ 
                        height: 'var(--header-height)',
                        padding: '0 0.875rem',
                        borderBottom: '1px solid var(--border)'
                    }}
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div 
                            className="shrink-0 flex items-center justify-center text-white shadow-lg transition-transform duration-300"
                            style={{ 
                                width: '32px',
                                height: '24px',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
                                borderRadius: 'var(--radius-sm)',
                                transform: !isExpanded ? 'scale(1.1)' : 'scale(1)'
                            }}
                        >
                            <span style={{ fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.02em' }}>RSA</span>
                        </div>
                        <h1 className={`truncate transition-all duration-300 origin-left ${isExpanded ? 'opacity-100 scale-100 w-auto' : 'opacity-0 scale-95 w-0 pointer-events-none'}`} style={{ 
                            fontSize: '0.9375rem', 
                            fontWeight: 700, 
                            color: 'var(--text-heading)',
                            letterSpacing: '-0.02em'
                        }}>
                            RSA Portal
                        </h1>
                    </div>

                    <button
                        onClick={closeMobileMenu}
                        className="md:hidden ml-auto p-1 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Sidebar Pin Toggle (Desktop Only) - Hidden from its original position, moved to footer */}


                {/* Navigation Scroll Area */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 px-2">
                    {/* Favorites */}
                    {pinnedIds.length > 0 && (
                        <div className="mb-4">
                            <SectionLabel label="Favorites" />
                            {pinnedIds.map(id => {
                                const item = ALL_NAV_ITEMS.find(i => i.id === id);
                                if (!item || !filterVisibleItems(item)) return null;
                                return <NavItem key={`pinned-${item.id}`} item={item} />;
                            })}
                        </div>
                    )}

                    <SectionLabel label="Core" />
                    {ALL_NAV_ITEMS.filter(i => CORE_ITEM_IDS.includes(i.id)).map(item => {
                        if (!filterVisibleItems(item)) return null;
                        return <NavItem key={`core-${item.id}`} item={item} />
                    })}

                    <div className="mt-2">
                        {isExpanded ? (
                            <button
                                onClick={() => setIsMoreOpen(!isMoreOpen)}
                                className="w-full flex items-center justify-between px-[0.875rem] mb-1.5 group transition-colors mt-6"
                                style={{ 
                                    fontSize: '0.625rem', 
                                    fontWeight: 700, 
                                    letterSpacing: '0.1em', 
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase'
                                }}
                            >
                                <span>More</span>
                                <ChevronRight size={12} className={`transition-transform duration-200 ${isMoreOpen ? 'rotate-90' : ''}`} />
                            </button>
                        ) : (
                            <div className="h-10 invisible" aria-hidden="true" />
                        )}

                        {(isMoreOpen || isCollapsed) && (
                            <div className="space-y-[2px]">
                                {ALL_NAV_ITEMS.filter(i => !CORE_ITEM_IDS.includes(i.id)).map(item => {
                                    if (!filterVisibleItems(item)) return null;
                                    return <NavItem key={`more-${item.id}`} item={item} />;
                                })}
                            </div>
                        )}
                    </div>
                </nav>

                {/* Footer Area */}
                <div
                    className="mt-auto"
                    style={{ 
                        borderTop: '1px solid var(--border)',
                        padding: '0.5rem'
                    }}
                >
                    {/* Pin Toggle Button */}
                    <button
                        onClick={toggleCollapse}
                        className="hidden md:flex items-center gap-[0.625rem] px-3 w-full h-[36px] rounded-[var(--radius-md)] mb-1 transition-all duration-200 group text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)]"
                        title={isCollapsed ? "Pin Sidebar" : "Unpin Sidebar"}
                    >
                        {isCollapsed ? <Pin size={18} className="shrink-0" /> : <PinOff size={18} className="shrink-0" />}
                        <span className={`truncate transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`} style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                            {isCollapsed ? 'Pin Sidebar' : 'Unpin Sidebar'}
                        </span>
                    </button>
                    {/* User Profile */}
                    <div
                        className="flex items-center gap-[0.625rem] px-3 h-[36px] rounded-[var(--radius-md)] mb-1.5 transition-colors group cursor-default"
                        style={{ color: 'var(--text-body)' }}
                        onMouseEnter={e => { if (!isCollapsed) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                        onMouseLeave={e => { if (!isCollapsed) e.currentTarget.style.background = 'transparent'; }}
                    >
                        <div 
                            className="shrink-0 flex items-center justify-center text-white transition-transform duration-300"
                            style={{ 
                                width: '24px',
                                height: '24px',
                                borderRadius: '99px',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                transform: !isExpanded ? 'scale(1.1)' : 'scale(1)'
                            }}
                        >
                            {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        
                        <div className={`flex-1 min-w-0 flex items-center justify-between transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none w-0 overflow-hidden'}`}>
                            <div className="truncate pr-1">
                                <p className="truncate" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-heading)' }}>
                                    {user?.displayName}
                                </p>
                            </div>
                            <span className="shrink-0" style={{ 
                                fontSize: '0.625rem', 
                                padding: '1px 6px', 
                                borderRadius: '99px', 
                                background: 'var(--accent-dim)', 
                                color: 'var(--accent)',
                                fontWeight: 600
                            }}>
                                {user?.role === 'STAFF' ? 'USER' : user?.role}
                            </span>
                        </div>
                    </div>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-[0.625rem] px-3 h-[36px] rounded-[var(--radius-md)] transition-all duration-150 group"
                        style={{ color: 'var(--text-body)', fontSize: '0.8125rem', fontWeight: 500 }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-surface)';
                            e.currentTarget.style.color = 'var(--color-danger)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-body)';
                        }}
                    >
                        <LogOut size={18} className="shrink-0" />
                        <span className={`truncate transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Sign Out</span>
                    </button>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;
