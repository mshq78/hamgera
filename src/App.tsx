import React, { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/auth/AuthContext';
import { ShellProvider } from './core/shell/ShellContext';
import { TestsProvider } from './core/hub/TestsContext';
import { ErrorBoundary } from './core/components/ErrorBoundary';
import { PageShell } from './core/components/PageShell';
import { LoadingSkeleton } from './core/components/StateViews';
import { LoginScreen } from './core/login/LoginScreen';
import { HubScreen } from './core/hub/HubScreen';
import { TestHost } from './core/hub/TestHost';

const AdminView = lazy(() => import('./core/admin/AdminView').then((m) => ({ default: m.AdminView })));

/** Everything except the login page and the admin panel needs a logged-in participant. */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <PageShell wide={pathname === '/admin'} compactHeader={pathname === '/admin'}>
      <Suspense fallback={<LoadingSkeleton lines={5} />}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="/" element={<RequireAuth><HubScreen /></RequireAuth>} />
          <Route path="/t/:testId/*" element={<RequireAuth><TestHost /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </PageShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <ShellProvider>
            <TestsProvider>
              <AppRoutes />
            </TestsProvider>
          </ShellProvider>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
