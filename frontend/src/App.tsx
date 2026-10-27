import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';

// Supervisor pages
import { SupervisorDashboardPage } from './pages/supervisor/DashboardPage';
import { UploadPage } from './pages/supervisor/UploadPage';
import { AllocationPage } from './pages/supervisor/AllocationPage';
import { ReportsPage } from './pages/supervisor/ReportsPage';
import { TeamManagementPage } from './pages/supervisor/TeamManagementPage';
import { AuditLogsPage } from './pages/supervisor/AuditLogsPage';

// Agent pages
import { AgentDashboardPage } from './pages/agent/AgentDashboardPage';
import { AddCustomerPage } from './pages/agent/AddCustomerPage';
import { VisitFormPage } from './pages/agent/VisitFormPage';

// Shared pages
import { CustomerListPage } from './pages/shared/CustomerListPage';
import { CustomerDetailPage } from './pages/shared/CustomerDetailPage';
import { FollowUpsPage } from './pages/shared/FollowUpsPage';
import { VisitHistoryPage } from './pages/shared/VisitHistoryPage';
import { SettingsPage } from './pages/shared/SettingsPage';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactElement; requiredRole?: 'SUPERVISOR' | 'AGENT' | 'ADMIN' }> = ({
  children,
  requiredRole,
}) => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-red"></div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Super Admin has unrestricted access to all routes
  if (user.role === 'ADMIN') {
    return children;
  }

  if (requiredRole === 'SUPERVISOR' && user.role === 'AGENT') {
    return <Navigate to="/agent/dashboard" replace />;
  }

  return children;
};

// Index Redirect Component
const IndexRedirect: React.FC = () => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-red"></div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'AGENT') {
    return <Navigate to="/agent/dashboard" replace />;
  }
  return <Navigate to="/supervisor/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root Redirect */}
          <Route path="/" element={<IndexRedirect />} />

          {/* Authenticated Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Supervisor Specific */}
            <Route
              path="/supervisor/dashboard"
              element={
                <ProtectedRoute requiredRole="SUPERVISOR">
                  <SupervisorDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supervisor/uploads"
              element={
                <ProtectedRoute requiredRole="SUPERVISOR">
                  <UploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supervisor/allocation"
              element={
                <ProtectedRoute requiredRole="SUPERVISOR">
                  <AllocationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supervisor/reports"
              element={
                <ProtectedRoute requiredRole="SUPERVISOR">
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supervisor/team"
              element={
                <ProtectedRoute requiredRole="SUPERVISOR">
                  <TeamManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supervisor/audit"
              element={
                <ProtectedRoute requiredRole="SUPERVISOR">
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />

            {/* Agent Specific */}
            <Route path="/agent/dashboard" element={<AgentDashboardPage />} />

            {/* Shared Routes */}
            <Route path="/customers" element={<CustomerListPage />} />
            <Route path="/customers/new" element={<AddCustomerPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/visits" element={<VisitHistoryPage />} />
            <Route path="/visits/new" element={<VisitFormPage />} />
            <Route path="/followups" element={<FollowUpsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
