import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader } from './components/ui/LoadingSkeleton';
import Layout from './components/Layout';

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
const StaffPage = lazy(() => import('./pages/StaffPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const SystemSettingsPage = lazy(() => import('./pages/SystemSettingsPage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'));
const TimeTrackingPage = lazy(() => import('./pages/TimeTrackingPage'));
const TeamChatPage = lazy(() => import('./pages/TeamChatPage'));
const CompliancePage = lazy(() => import('./pages/CompliancePage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const AdvancedAnalyticsPage = lazy(() => import('./pages/AdvancedAnalyticsPage'));

// Suspense wrapper for lazy-loaded components
const LazyPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);


// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  // User must be logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if profile setup is complete
  // Allow access to verify-email page even if setup is not complete
  if (!user.isSetupComplete && window.location.hash !== '#/setup-profile') {
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

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
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

              {/* Protected Routes - Requires login AND profile setup */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<LazyPage><Dashboard /></LazyPage>} />
                <Route path="attendance" element={<LazyPage><AttendancePage /></LazyPage>} />
                <Route path="tasks" element={<LazyPage><TasksPage /></LazyPage>} />
                <Route path="calendar" element={<LazyPage><CalendarPage /></LazyPage>} />
                <Route path="resources" element={<LazyPage><ResourcesPage /></LazyPage>} />
                <Route path="clients" element={<LazyPage><ClientsPage /></LazyPage>} />
                <Route path="knowledge-base" element={<LazyPage><KnowledgeBasePage /></LazyPage>} />
                <Route path="leaves" element={<LazyPage><LeavePage /></LazyPage>} />
                <Route path="staff" element={<LazyPage><StaffPage /></LazyPage>} />
                <Route path="performance" element={<LazyPage><PerformancePage /></LazyPage>} />
                <Route path="settings" element={<LazyPage><SystemSettingsPage /></LazyPage>} />
                <Route path="time-tracking" element={<LazyPage><TimeTrackingPage /></LazyPage>} />
                <Route path="team-chat" element={<LazyPage><TeamChatPage /></LazyPage>} />
                <Route path="compliance" element={<LazyPage><CompliancePage /></LazyPage>} />
                <Route path="templates" element={<LazyPage><TemplatesPage /></LazyPage>} />
                <Route path="analytics" element={<LazyPage><AdvancedAnalyticsPage /></LazyPage>} />
              </Route>

              {/* Catch all - redirect to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </HashRouter>

          {/* Global Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(30, 41, 59, 0.95)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                backdropFilter: 'blur(10px)',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;