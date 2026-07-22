import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './store/authStore';
import usePermissions from './hooks/usePermissions';
import { cn } from './lib/cn';

import ProtectedRoute from './components/shared/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ProjectsPage from './pages/ProjectsPage';
import BoardPage from './pages/BoardPage';
import MetricsPage from './pages/MetricsPage';
import UsersPage from './pages/UsersPage';
import AdminUsersPage from './pages/AdminUsersPage';
import SessionToast from './components/shared/SessionToast';
import UserMenu from './components/shared/UserMenu';
import ProfilePage from './pages/ProfilePage';

import ProjectDetailPage from './pages/ProjectDetailPage';
import MyTasksPage from './pages/MyTasksPage';

const Sidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { canAccessAdmin, isViewer, role } = usePermissions();

  const navItems = [
    {
      path: '/projects',
      label: t('nav.projects'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
      ),
    },
  ];

  if (!isViewer) {
    navItems.push({
      path: '/my-tasks',
      label: t('nav.myTasks'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      ),
    });
  }

  if (['admin', 'manager'].includes(role)) {
    navItems.push({
      path: '/users',
      label: t('nav.users'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    });
  }

  if (canAccessAdmin) {
    navItems.push({
      path: '/admin/users',
      label: t('nav.admin'),
      badge: '🛡️',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      ),
    });
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 pb-3 pt-6">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg">
          T
        </span>
        <span className="text-lg font-semibold tracking-tight text-fg">{t('common.brand')}</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map(item => {
          const active = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                active
                  ? 'bg-accent-soft font-medium text-accent'
                  : 'text-muted hover:bg-raised hover:text-fg',
              )}
            >
              {item.icon}
              <span>
                {item.label}
                {item.badge ? <span aria-hidden="true"> {item.badge}</span> : null}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer del Sidebar con info de usuario actual */}
      <UserMenu />
    </aside>
  );
};

const AuthenticatedLayout = ({ children }) => (
  <div className="flex min-h-screen bg-canvas">
    <Sidebar />
    <main className="ml-60 flex-1 p-8">
      {children}
    </main>
  </div>
);

const App = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <SessionToast />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      
      {/* Redirección root */}
      <Route path="/" element={
        isAuthenticated ? <Navigate to="/projects" replace /> : <Navigate to="/login" replace />
      } />

      {/* Rutas protegidas bajo Layout principal */}
      <Route path="/*" element={
        <AuthenticatedLayout>
          <Routes>
            <Route path="projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
            <Route path="projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
            <Route path="projects/:id/board" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
            
            <Route path="projects/:id/metrics" element={
              <ProtectedRoute roles={['admin', 'manager', 'developer', 'viewer']}>
                <MetricsPage />
              </ProtectedRoute>
            } />
            
            <Route path="users" element={<ProtectedRoute roles={['admin', 'manager']}><UsersPage /></ProtectedRoute>} />
            <Route path="my-tasks" element={<ProtectedRoute roles={['admin', 'manager', 'developer']}><MyTasksPage /></ProtectedRoute>} />
            
            <Route path="admin/users" element={
              <ProtectedRoute roles={['admin']}>
                <AdminUsersPage />
              </ProtectedRoute>
            } />

            <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          </Routes>
        </AuthenticatedLayout>
      } />
    </Routes>
    </>
  );
};

export default App;
