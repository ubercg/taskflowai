import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './store/authStore';
import usePermissions from './hooks/usePermissions';

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
  const location = useLocation();
  const { user, logout } = useAuth();
  const { canAccessAdmin, isViewer, role } = usePermissions();

  const navItems = [
    { 
      path: '/projects', 
      label: 'Proyectos', 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
      ) 
    }
  ];

  if (!isViewer) {
    navItems.push({
      path: '/my-tasks',
      label: 'Mis Tareas',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      )
    });
  }

  if (['admin', 'manager'].includes(role)) {
    navItems.push({ 
      path: '/users', 
      label: 'Usuarios', 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ) 
    });
  }

  if (canAccessAdmin) {
    navItems.push({
      path: '/admin/users', 
      label: 'Admin 🛡️', 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      )
    });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ paddingBottom: '12px' }}>
        TaskFlow
      </div>
      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      
      {/* Footer del Sidebar con info de usuario actual */}
      <UserMenu />
    </aside>
  );
};

const AuthenticatedLayout = ({ children }) => (
  <div className="app-layout">
    <Sidebar />
    <main className="main-content">
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
