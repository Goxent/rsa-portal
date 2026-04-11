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
    Library,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    X,
    Users,
    Pin,
    Activity,
    Archive,
    FolderArchive
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
    { id: 'clients', to: '/clients', icon: Building2, label: 'Clients', adminOnly: true },
    { id: 'calendar', to: '/calendar', icon: Calendar, label: 'Calendar' },
    { id: 'attendance', to: '/attendance', icon: Clock, label: 'Attendance' },
    { id: 'compliance', to: '/compliance', icon: AlertCircle, label: 'Compliance' },
    { id: 'leaves', to: '/leaves', icon: Calendar, label: 'Leaves & Requests' },
    { id: 'staff', to: '/staff', icon: Users, label: 'Staff Directory', adminOnly: true },
    { id: 'workload', to: '/workload', icon: BarChart3, label: 'Resource Planning', adminOnly: true, managerAllowed: true },
    { id: 'templates', to: '/templates', icon: Library, label: 'Resources' },
    { id: 'archived-tasks', to: '/archived-tasks', icon: Archive, label: 'Archived Tasks', adminOnly: true },
    { id: 'audit-log', to: '/audit-log', icon: Activity, label: 'Audit Log', adminOnly: true },
    { id: 'audit-docs', to: '/audit-docs', icon: FolderArchive, label: 'Audit Documentation', adminOnly: true },
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
                    relative flex items-center gap-[0.625rem] px-3 transition-all duration-150 mb-[2px] rounded-[var(--radius-md)] group h-[36px] overflow-hidden
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
                            className="shrink-0 transition-colors" 
                            style={{ color: isActive ? 'var(--accent)' : 'inherit' }}
                        />
                        
                        {!isCollapsed && (
                            <div className="flex-1 flex items-center justify-between min-w-0">
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
                        )}

                        {isCollapsed && (
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
        if (isCollapsed) return <div className="h-px mx-4 my-4" style={{ background: 'var(--border)' }} />;
        return (
            <p className="uppercase" style={{ 
                fontSize: '0.6rem', 
                fontWeight: 700, 
                letterSpacing: '0.1em', 
                color: 'var(--text-muted)',
                padding: '0.75rem 0.875rem 0.375rem'
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

            <aside
                className={`fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-[250ms] cubic-bezier(0.4, 0, 0.2, 1) dotted-grid ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
                style={{ 
                    width: isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
                    background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-main) 100%)',
                    borderRight: '1px solid var(--border)',
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
                            className="shrink-0 flex items-center justify-center text-white"
                            style={{ 
                                width: '28px',
                                height: '28px',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            <span style={{ fontWeight: 800, fontSize: '1rem' }}>R</span>
                        </div>
                        {!isCollapsed && (
                            <h1 className="truncate" style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600, 
                                color: 'var(--text-heading)' 
                            }}>
                                RSA Portal
                            </h1>
                        )}
                    </div>

                    <button
                        onClick={closeMobileMenu}
                        className="md:hidden ml-auto p-1 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation Toggle (Desktop Only) */}
                <button
                    onClick={toggleCollapse}
                    className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3 items-center justify-center transition-all duration-200 z-50 group"
                    style={{ 
                        width: '24px',
                        height: '24px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-mid)',
                        borderRadius: '99px',
                        color: 'var(--text-muted)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.color = 'var(--accent)';
                        e.currentTarget.style.borderColor = 'var(--border-accent)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.borderColor = 'var(--border-mid)';
                    }}
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

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

                    <div className="mt-4">
                        {!isCollapsed && (
                            <button
                                onClick={() => setIsMoreOpen(!isMoreOpen)}
                                className="w-full flex items-center justify-between px-[0.875rem] mb-1.5 group transition-colors"
                                style={{ 
                                    fontSize: '0.6rem', 
                                    fontWeight: 700, 
                                    letterSpacing: '0.1em', 
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase'
                                }}
                            >
                                <span>More</span>
                                <ChevronRight size={12} className={`transition-transform duration-200 ${isMoreOpen ? 'rotate-90' : ''}`} />
                            </button>
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
                    style={{ 
                        borderTop: '1px solid var(--border)',
                        padding: '0.75rem',
                        marginTop: 'auto'
                    }}
                >
                    {/* User Profile */}
                    <div
                        className="flex items-center gap-[0.625rem] px-3 h-[36px] rounded-[var(--radius-md)] mb-1.5 transition-colors group cursor-default"
                        style={{ color: 'var(--text-body)' }}
                        onMouseEnter={e => { if (!isCollapsed) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                        onMouseLeave={e => { if (!isCollapsed) e.currentTarget.style.background = 'transparent'; }}
                    >
                        <div 
                            className="shrink-0 flex items-center justify-center text-white"
                            style={{ 
                                width: '24px',
                                height: '24px',
                                borderRadius: '99px',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
                                fontSize: '0.625rem',
                                fontWeight: 700
                            }}
                        >
                            {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 flex items-center justify-between">
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
                                    {user?.role}
                                </span>
                            </div>
                        )}
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
                        {!isCollapsed && <span>Sign Out</span>}
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
