import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Users,
  Calendar,
  LogOut,
  Menu,
  X,
  Briefcase,
  BookOpen,
  UserCog,
  AlertTriangle,
  Bell,
  Sun,
  Moon,
  Settings,
  Trophy,
  Command,
  Clock3,
  MessageSquare,
  AlertCircle,
  FileStack,
  BarChart3,
  Workflow,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole, AppNotification } from '../types';
import { AuthService } from '../services/firebase';
import CommandPalette from './CommandPalette';
import { useAutoLogout } from '../hooks/useAutoLogout';

const SidebarItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }: { isActive: boolean }) =>
        `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 mb-1.5 border border-transparent group relative overflow-hidden ${isActive
          ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/10 text-blue-100 border-blue-500/20 shadow-[0_0_20px_rgba(37,99,235,0.15)]'
          : 'text-gray-400 hover:bg-white/5 hover:text-white hover:border-white/5'
        }`
      }
    >
      <div className="relative z-10 flex items-center space-x-3">
        <Icon size={18} className="transition-transform group-hover:scale-110" />
        <span className="font-medium text-sm">{label}</span>
      </div>
      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </NavLink>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto Logout Hook
  useAutoLogout();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Late Warning State
  const [showLateWarning, setShowLateWarning] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchLateStatus = async () => {
        try {
          const count = await AuthService.getLateCountLast30Days(user.uid);
          if (count > 5) {
            setShowLateWarning(true);
          }
        } catch (error) {
          console.error("Failed to check late status", error);
        }
      };

      fetchLateStatus();

      const unsubscribe = AuthService.subscribeToNotifications(user.uid, (data) => {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const getTitle = () => {
    switch (location.pathname.split('/')[1]) {
      case 'dashboard': return 'Executive Dashboard';
      case 'attendance': return 'Attendance & Time';
      case 'tasks': return 'Workflow & Kanban';
      case 'calendar': return 'Firm Calendar';
      case 'knowledge-base': return 'Knowledge Base';
      case 'staff': return 'Staff Directory';
      case 'performance': return 'Performance Evaluation';
      default: return 'RSA Portal System';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <>
      {/* Command Palette - Accessible via Cmd+K / Ctrl+K */}
      <CommandPalette />

      <div className="flex h-screen bg-transparent overflow-hidden text-gray-100 font-sans">
        {/* Sidebar - Desktop (Glass) */}
        <aside className={`hidden md:flex flex-col w-72 glass-panel m-4 rounded-2xl shadow-2xl z-20`}>
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-900/40">
                <img src="/rsa-logo.png" alt="RSA Logo" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight text-white tracking-wide">RSA Portal</h1>
                <p className="text-[10px] text-blue-300 font-medium tracking-wider uppercase">Practice Management</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Workspace</p>
            <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <SidebarItem to="/attendance" icon={Clock} label="Attendance" />
            <SidebarItem to="/calendar" icon={Calendar} label="Calendar" />
            <SidebarItem to="/tasks" icon={CheckSquare} label="Tasks & Kanban" />
            <SidebarItem to="/leaves" icon={Calendar} label="Leaves" />

            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-8">Advanced</p>
            <SidebarItem to="/time-tracking" icon={Clock3} label="Time Tracking" />
            <SidebarItem to="/compliance" icon={AlertCircle} label="Compliance" />
            <SidebarItem to="/templates" icon={FileStack} label="Templates" />


            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-8">Firm Data</p>
            <SidebarItem to="/knowledge-base" icon={BookOpen} label="Knowledge Base" />

            {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
              <>
                <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-8">Administration</p>
                <SidebarItem to="/clients" icon={Building2} label="Clients" />
                <SidebarItem to="/staff" icon={UserCog} label="Staff Directory" />
                <SidebarItem to="/performance" icon={Trophy} label="Performance Eval" />

                {user?.role === UserRole.MASTER_ADMIN && (
                  <SidebarItem to="/settings" icon={Settings} label="System Settings" />
                )}

                <div className="mt-4 mx-2 p-5 bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 rounded-2xl backdrop-blur-sm shadow-inner">
                  <p className="text-xs text-indigo-200 mb-1 font-semibold flex items-center">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]"></span>
                    {user?.role === UserRole.MASTER_ADMIN ? 'Master Console' : 'Admin Console'}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">System access granted.</p>
                </div>
              </>
            )}
          </nav>

          <div className="p-4 border-t border-white/5">
            <div className="flex items-center space-x-3 mb-4 px-3 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold shadow-lg text-white group-hover:scale-105 transition-transform">
                {getInitials(user?.displayName || 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-white group-hover:text-blue-200 transition-colors">{user?.displayName}</p>
                <p className="text-xs text-gray-400 opacity-70 truncate">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/20 py-2.5 rounded-xl transition-all duration-300 text-sm font-medium hover:shadow-lg hover:shadow-red-900/20"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Topbar (Glass) */}
          <header className="h-20 flex items-center justify-between px-6 md:px-8 mt-4 mx-4 md:ml-0 rounded-2xl glass-panel z-10 shrink-0">
            <div className="flex items-center">
              <button
                className="md:hidden mr-4 text-gray-300 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide drop-shadow-sm">{getTitle()}</h2>
                <div className="h-1 w-12 bg-blue-500 rounded-full mt-1 hidden md:block opacity-60"></div>
              </div>
            </div>

            <div className="flex items-center space-x-4 md:space-x-6">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-all duration-300 hover:rotate-12"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun size={20} className="text-accent-gold" /> : <Moon size={20} className="text-blue-600" />}
              </button>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors relative"
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-dark-900 animate-pulse"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 glass-panel rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-white/10 bg-white/5">
                      {/* Late Warning Banner */}
                      {showLateWarning && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/40 p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
                          <div className="flex items-center space-x-3">
                            <AlertCircle className="text-red-500 shrink-0" size={20} />
                            <div>
                              <h3 className="font-bold text-red-400 text-sm">Attendance Warning</h3>
                              <p className="text-xs text-red-200">
                                You have exceeded 5 late arrivals this month.
                              </p>
                            </div>
                          </div>
                          <button onClick={() => setShowLateWarning(false)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
                        </div>
                      )}
                      <h3 className="text-sm font-bold text-white">Notifications</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
                      ) : notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => {
                            AuthService.markAsRead(n.id);
                            if (n.link) window.location.href = `/#${n.link}`;
                          }}
                          className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!n.read ? 'bg-blue-500/5' : ''}`}
                        >
                          <div className="flex items-start">
                            {n.type === 'WARNING' ? <AlertTriangle size={16} className="text-red-400 mr-2 mt-0.5" /> : <Bell size={16} className="text-blue-400 mr-2 mt-0.5" />}
                            <div>
                              <h4 className={`text-sm font-bold ${n.type === 'WARNING' ? 'text-red-300' : 'text-blue-300'}`}>{n.title}</h4>
                              <p className="text-xs text-gray-400 mt-1">{n.message}</p>
                              <p className="text-[10px] text-gray-500 mt-2">{new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden md:flex flex-col items-end">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Today</p>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-300">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="absolute inset-0 bg-dark-900/95 z-50 p-6 md:hidden flex flex-col backdrop-blur-xl animate-fade-in">
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-white text-2xl font-bold">RSA Portal</h1>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-white bg-white/10 p-2 rounded-full"><X /></button>
              </div>
              <nav className="flex-col space-y-4">
                <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                <SidebarItem to="/attendance" icon={Clock} label="Attendance" />
                <SidebarItem to="/calendar" icon={Calendar} label="Calendar" />
                <SidebarItem to="/tasks" icon={CheckSquare} label="Tasks" />
                <SidebarItem to="/leaves" icon={Calendar} label="Leaves" />
                <SidebarItem to="/knowledge-base" icon={BookOpen} label="Knowledge Base" />
                {user?.role === UserRole.ADMIN && <SidebarItem to="/staff" icon={UserCog} label="Staff Directory" />}
                {user?.role === UserRole.ADMIN && <SidebarItem to="/performance" icon={Trophy} label="Performance" />}
              </nav>
              <button onClick={() => logout()} className="mt-auto flex items-center justify-center space-x-2 text-red-300 py-4 border border-red-500/30 rounded-xl bg-red-500/10">
                <LogOut size={20} /> <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Scrollable Content */}
          <main className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth custom-scrollbar">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default Layout;
