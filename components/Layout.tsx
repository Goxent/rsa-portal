import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { AppNotification } from '../types';
import { useAutoLogout } from '../hooks/useAutoLogout';
import { useSessionManager } from '../hooks/useSessionManager';
import { getCurrentDateUTC } from '../utils/dates';

// New Components
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import NotificationPanel from './layout/NotificationPanel';
import MobileTabs from './layout/MobileTabs';
import { GlobalSearchModal } from './common/GlobalSearchModal';

import { motion, AnimatePresence } from 'framer-motion';

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

  // Connectivity State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useAutoLogout();
  useSessionManager();

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
      // Ctrl + /
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setIsSearchOpen(true);
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
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <div className="flex h-screen bg-transparent text-gray-100 font-sans overflow-hidden">

        {/* Sidebar */}
        <motion.div
          initial={{ x: -260 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.5, ease: "circOut" }}
          className="z-50 hidden md:block"
        >
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isMobileOpen={isMobileMenuOpen}
            closeMobileMenu={() => setIsMobileMenuOpen(false)}
          />
        </motion.div>

        {/* Main Content Wrapper */}
        <div className={`flex-1 flex flex-col h-full transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>

          {/* Header */}
          <Header
            toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            unreadCount={unreadCount}
            toggleNotifications={() => setShowNotifications(!showNotifications)}
            isSidebarCollapsed={isSidebarCollapsed}
          />

          <NotificationPanel
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            notifications={notifications}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden mt-16 relative">
            {!isOnline && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                    <AnimatePresence mode="wait">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-lg shadow-2xl flex items-center justify-center pointer-events-auto border border-white/20"
                        >
                            <WifiOff size={18} className="mr-2" />
                            <span className="text-sm font-medium">Offline Mode: Sync pending</span>
                        </motion.div>
                    </AnimatePresence>
                </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="h-full"
                >
                    <Outlet />
                </motion.div>
            </AnimatePresence>
          </main>


          <MobileTabs />
        </div>
      </div>
    </>
  );
};

export default Layout;
