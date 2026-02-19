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
    UserCog,
    Trophy,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    PieChart,
    Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
    isMobileOpen: boolean;
    closeMobileMenu: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse, isMobileOpen, closeMobileMenu }) => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const handleLogout = () => {
        logout().then(() => {
            window.location.href = '/login';
        });
    };

    const NavItem = ({ to, icon: Icon, label, exact = false }: { to: string, icon: any, label: string, exact?: boolean }) => {
        return (
            <NavLink
                to={to}
                end={exact}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-1 group relative overflow-hidden ${isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`
                }
            >
                <div className="relative z-10 flex items-center min-w-0">
                    <Icon size={isCollapsed ? 20 : 18} className={`shrink-0 transition-all duration-300 ${!isCollapsed ? 'mr-3' : 'mx-auto'}`} />
                    {!isCollapsed && <span className="font-medium text-sm truncate transition-opacity duration-300">{label}</span>}
                </div>

                {/* Tooltip for Collapsed State */}
                {isCollapsed && (
                    <div className="absolute left-full ml-4 px-2 py-1 bg-navy-900 text-white text-xs rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none drop-shadow-lg">
                        {label}
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
                            <img src="/rsa-logo.png" alt="RSA" className="w-5 h-5 object-contain" />
                        </div>
                        {!isCollapsed && (
                            <div className="animate-in fade-in duration-300">
                                <h1 className="font-bold text-white leading-none tracking-tight">RSA Portal</h1>
                                <p className="text-[9px] text-blue-400 font-medium uppercase tracking-wider mt-0.5">Audit & Tax</p>
                            </div>
                        )}
                    </div>

                    {/* Collapse Toggle (Desktop Only) */}
                    <button
                        onClick={toggleCollapse}
                        className="hidden md:flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>

                    {/* Close Menu (Mobile Only) */}
                    <button
                        onClick={closeMobileMenu}
                        className="md:hidden p-1 text-gray-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4 px-3 space-y-1">
                    <SectionLabel label="Workspace" />
                    <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                    <NavItem to="/tasks" icon={CheckSquare} label="Tasks & Workflow" />
                    <NavItem to="/calendar" icon={Calendar} label="Calendar" />
                    <NavItem to="/compliance" icon={AlertCircle} label="Compliance" />

                    <SectionLabel label="People" />
                    <NavItem to="/attendance" icon={Clock} label="Attendance" />
                    <NavItem to="/leaves" icon={Calendar} label="Leavs & Requests" />
                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                        <NavItem to="/staff" icon={Users} label="Staff Directory" />
                    )}

                    <SectionLabel label="Insights" />
                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                        <>
                            <NavItem to="/workload" icon={BarChart3} label="Resource Planning" />
                            <NavItem to="/performance" icon={Trophy} label="Performance" />
                        </>
                    )}
                    {/* Staff Performance View */}
                    <NavItem to="/my-performance" icon={PieChart} label="My Performance" />


                    <SectionLabel label="Assets" />
                    <NavItem to="/clients" icon={Building2} label="Clients" />
                    <NavItem to="/templates" icon={FileStack} label="Templates" />
                    <NavItem to="/knowledge-base" icon={BookOpen} label="Knowledge Base" />

                    <SectionLabel label="System" />
                    {user?.role === UserRole.MASTER_ADMIN && (
                        <NavItem to="/settings" icon={Settings} label="Settings" />
                    )}
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
