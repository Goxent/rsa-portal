import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { AppNotification } from '../types';
import CommandPalette from './CommandPalette';
import { useAutoLogout } from '../hooks/useAutoLogout';
import { getCurrentDateUTC } from '../utils/dates';

// New Components
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import NotificationPanel from './layout/NotificationPanel';

const Layout: React.FC = () => {
  const { user } = useAuth();

  // Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('rsa_sidebar_collapsed') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Command Palette State
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Connectivity State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useAutoLogout();

  // Persist Sidebar State
  useEffect(() => {
    localStorage.setItem('rsa_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Network Status
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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette (Cmd+K or Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch Notifications & Late Warning
  useEffect(() => {
    if (user) {
      const fetchLateStatus = async () => {
        try {
          const count = await AuthService.getLateCountLast30Days(user.uid);
          if (count > 5) {
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

  return (
    <>
      {/* Global Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      <div className="flex h-screen bg-[#0B1120] text-gray-100 font-sans overflow-hidden">

        {/* Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileMenuOpen}
          closeMobileMenu={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Wrapper */}
        <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>

          {/* Header */}
          <Header
            toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            openCommandPalette={() => setShowCommandPalette(true)}
            unreadCount={unreadCount}
            toggleNotifications={() => setShowNotifications(!showNotifications)}
          />

          {/* Slide-over Notifications */}
          <NotificationPanel
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            notifications={notifications}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-4 md:p-6 mt-16 scroll-smooth custom-scrollbar relative">
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
