import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { AuthProvider, useAuth } from './context/AuthContext';
import { UserRole } from './types';
import { ThemeProvider, ThemedToaster } from './context/ThemeContext';
import { ModalProvider } from './context/ModalContext';
import { ModalManager } from './components/ModalManager';
import ErrorBoundary from './components/ErrorBoundary'; // App-wide boundary
import PageErrorBoundary from './components/common/PageErrorBoundary'; // Per-route boundary
import { PageLoader } from './components/ui/LoadingSkeleton';
import Layout from './components/Layout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const LeavePage = lazy(() => import('./pages/LeavePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'));
const SystemSettingsPage = lazy(() => import('./pages/SystemSettingsPage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'));
const CompliancePage = lazy(() => import('./pages/CompliancePage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const MyPerformancePage = lazy(() => import('./pages/MyPerformancePage'));
const PeerReviewPage = lazy(() => import('./pages/PeerReviewPage'));
const ResourcePlanningPage = lazy(() => import('./pages/ResourcePlanningPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));

// Suspense wrapper for lazy-loaded components with Error Boundary
const LazyPage = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();

  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full h-full"
        >
          {children}
        </motion.div>
      </Suspense>
    </PageErrorBoundary>
  );
};


// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  // User must be logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Block users pending approval
  if (user.status === 'Pending Approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Check if profile setup is complete
  // Allow access to verify-email page even if setup is not complete
  if (!user.isSetupComplete && location.pathname !== '/setup-profile') {
    return <Navigate to="/setup-profile" replace />;
  }

  return <>{children}</>;
};

// Special wrapper for ProfileSetup that only requires login
const ProfileSetupRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Admin Route Wrapper
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <ModalProvider>
              <HashRouter>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Profile Setup - Protected but doesn't require isSetupComplete */}
                  <Route
                    path="/setup-profile"
                    element={
                      <ProfileSetupRoute>
                        <ProfileSetupPage />
                      </ProfileSetupRoute>
                    }
                  />

                  {/* Email Verification Page - Protected but doesn't require isSetupComplete */}
                  <Route
                    path="/verify-email"
                    element={
                      <ProfileSetupRoute>
                        <VerifyEmailPage />
                      </ProfileSetupRoute>
                    }
                  />

                  {/* Pending Approval Page */}
                  <Route
                    path="/pending-approval"
                    element={
                      <ProfileSetupRoute>
                        <LazyPage><PendingApprovalPage /></LazyPage>
                      </ProfileSetupRoute>
                    }
                  />

                  {/* Protected Routes - Requires login AND profile setup */}
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<LazyPage><Dashboard /></LazyPage>} />
                    <Route path="attendance" element={<LazyPage><AttendancePage /></LazyPage>} />
                    <Route path="clients" element={
                      <AdminRoute>
                        <LazyPage><ClientsPage /></LazyPage>
                      </AdminRoute>
                    } />
                    <Route path="clients/:clientId" element={
                      <AdminRoute>
                        <LazyPage><ClientDetailPage /></LazyPage>
                      </AdminRoute>
                    } />
                    <Route path="tasks" element={<LazyPage><TasksPage /></LazyPage>} />
                    <Route path="calendar" element={<LazyPage><CalendarPage /></LazyPage>} />
                    <Route path="workload" element={
                      <AdminRoute>
                        <LazyPage><ResourcePlanningPage /></LazyPage>
                      </AdminRoute>
                    } />
                    <Route path="resources" element={<LazyPage><ResourcesPage /></LazyPage>} />

                    <Route path="knowledge-base" element={<LazyPage><KnowledgeBasePage /></LazyPage>} />
                    <Route path="leaves" element={<LazyPage><LeavePage /></LazyPage>} />
                    <Route path="staff" element={
                      <AdminRoute>
                        <LazyPage><StaffPage /></LazyPage>
                      </AdminRoute>
                    } />
                    <Route path="performance" element={
                      <AdminRoute>
                        <LazyPage><PerformancePage /></LazyPage>
                      </AdminRoute>
                    } />
                    <Route path="settings" element={<LazyPage><SystemSettingsPage /></LazyPage>} />
                    <Route path="audit-log" element={
                      <AdminRoute>
                        <LazyPage><AuditLogPage /></LazyPage>
                      </AdminRoute>
                    } />
                    <Route path="compliance" element={<LazyPage><CompliancePage /></LazyPage>} />
                    <Route path="templates" element={<LazyPage><TemplatesPage /></LazyPage>} />
                    <Route path="my-performance" element={<LazyPage><MyPerformancePage /></LazyPage>} />
                    <Route path="peer-reviews" element={<LazyPage><PeerReviewPage /></LazyPage>} />
                    {/* Redirect legacy /workflow to /tasks */}
                    <Route path="workflow" element={<Navigate to="/tasks" replace />} />

                  </Route>

                  {/* Catch all - redirect to login */}
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>

                {/* Global Toast Notifications */}
                <ThemedToaster />
                <ModalManager />
              </HashRouter>
            </ModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider >
  );
};

export default App;