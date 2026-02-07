import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader } from './components/ui/LoadingSkeleton';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AttendancePage from './pages/AttendancePage';
import TasksPage from './pages/TasksPage';
import ClientsPage from './pages/ClientsPage';
import LeavePage from './pages/LeavePage';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import ResourcesPage from './pages/ResourcesPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import StaffPage from './pages/StaffPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

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
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="resources" element={<ResourcesPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="leaves" element={<LeavePage />} />
              <Route path="staff" element={<StaffPage />} />
            </Route>

            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;