
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

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, emailVerified } = useAuth();

  if (loading) return <PageLoader />;

  // Strict check: User must be logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if profile setup is complete (Name & Phone)
  if (!user.isSetupComplete) {
    return <Navigate to="/setup-profile" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Profile Setup Route - Protected but doesn't require setupComplete to access itself */}
            <Route path="/setup-profile" element={<ProfileSetupPage />} />

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
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;

