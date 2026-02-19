import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Users,
  Calendar,
  LogOut,
  AlertTriangle,
  Bell,
  Settings,
  Trophy,
  Command,
  Clock3,
  MessageSquare,
  AlertCircle,
  FileStack,
  BarChart3,
  Workflow,
  Building2,
  BookOpen,
  UserCog,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, AppNotification } from '../types';
import { AuthService } from '../services/firebase';
import CommandPalette from './CommandPalette';
import { useAutoLogout } from '../hooks/useAutoLogout';
import { getCurrentDateUTC } from '../utils/dates';

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

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (user) {
      const fetchLateStatus = async () => {
        try {
          const count = await AuthService.getLateCountLast30Days(user.uid);
          if (count > 5) {
            setShowLateWarning(true);

            // Check if we already sent a notification today
            const todayStr = getCurrentDateUTC();
            const lastNotifDate = localStorage.getItem('last_late_warning_date');

            if (lastNotifDate !== todayStr) {
              await AuthService.createNotification({
                userId: user.uid,
                title: 'Attendance Warning',
                message: `You have been late ${count} times in the last 30 days. Please ensure punctuality.`,
                type: 'WARNING',
                category: 'SYSTEM',
                link: '/attendance'
              });
              localStorage.setItem('last_late_warning_date', todayStr);
            }

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
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [user]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


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
            <SidebarItem to="/tasks" icon={CheckSquare} label="Workflow Management" />
            <SidebarItem to="/calendar" icon={Calendar} label="Calendar" />
            <SidebarItem to="/attendance" icon={Clock} label="Attendance" />
            <SidebarItem to="/leaves" icon={Calendar} label="Leaves" />

            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-8">Practice Management</p>
            <SidebarItem to="/compliance" icon={AlertCircle} label="Compliance" />
            {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
              <>
                <SidebarItem to="/clients" icon={Building2} label="Clients" />
                <SidebarItem to="/workload" icon={BarChart3} label="Workload" />
              </>
            )}

            <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-8">Knowledge & Assets</p>
            <SidebarItem to="/templates" icon={FileStack} label="Templates" />
            <SidebarItem to="/knowledge-base" icon={BookOpen} label="Knowledge Base" />

            {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
              <>
                <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-8">Administration</p>
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
            {/* Notification & Profile Section */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 flex items-center space-x-3 px-3 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors cursor-pointer group">
                <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold shadow-lg text-white group-hover:scale-105 transition-transform">
                  {getInitials(user?.displayName || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-white group-hover:text-blue-200 transition-colors">{user?.displayName}</p>
                  <p className="text-[10px] text-gray-400 opacity-70 truncate">{user?.role}</p>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-3 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative border border-white/5 bg-white/5"
                >
                  <Bell size={18} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-dark-900"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute bottom-full right-0 mb-3 w-72 bg-navy-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden z-20 animate-in slide-in-from-bottom-2 md:left-auto md:right-0">
                    <div className="px-4 py-3 border-b border-white/10 bg-white/5">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-white">Notifications</h3>
                        {notifications.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              notifications.forEach(n => AuthService.markAsRead(n.id));
                            }}
                            className="text-[10px] text-blue-400 font-medium"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">No notifications</div>
                      ) : notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => {
                            AuthService.markAsRead(n.id);
                            if (n.link) navigate(n.link);
                            setShowNotifications(false);
                          }}
                          className={`p-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!n.read ? 'bg-blue-500/5' : ''}`}
                        >
                          <p className={`text-xs font-bold ${n.type === 'WARNING' ? 'text-red-300' : 'text-blue-300'}`}>{n.title}</p>
                          <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                logout().then(() => {
                  window.location.href = '/login';
                });
              }}
              className="w-full flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/20 py-2.5 rounded-xl transition-all duration-300 text-sm font-medium hover:shadow-lg hover:shadow-red-900/20"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative pt-4 md:pt-6">
          {/* Mobile Menu Toggle - Floating */}
          <button
            className="md:hidden fixed bottom-6 right-6 z-[60] bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all outline-none border border-blue-400/50 backdrop-blur-md animate-in slide-in-from-bottom-10"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

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
              <button onClick={() => {
                logout().then(() => {
                  window.location.href = '/login';
                });
              }} className="mt-auto flex items-center justify-center space-x-2 text-red-300 py-4 border border-red-500/30 rounded-xl bg-red-500/10">
                <LogOut size={20} /> <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Scrollable Content */}
          <main className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth custom-scrollbar">
            {!isOnline && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-2 rounded-lg mb-4 flex items-center justify-center animate-pulse">
                <WifiOff size={18} className="mr-2" />
                <span className="text-sm font-medium">You are currently offline. Changes will sync when connection is restored.</span>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default Layout;
