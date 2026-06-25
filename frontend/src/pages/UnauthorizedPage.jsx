import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';
import { Button } from '../components/ui';

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-canvas p-6">
      <div className="max-w-[400px] rounded-xl border border-border bg-surface p-12 text-center shadow-card">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-status-blocked/15 text-status-blocked">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-fg">Acceso Denegado</h1>
        <p className="mb-6 text-[15px] leading-relaxed text-muted">
          No tienes permiso para ver esta sección. Tu rol actual es <strong className="capitalize text-fg">{user?.role || 'Desconocido'}</strong>.
          <br /><br />
          Si crees que esto es un error, contacta al administrador del workspace.
        </p>
        <Button onClick={() => navigate(-1)}>Volver atrás</Button>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
