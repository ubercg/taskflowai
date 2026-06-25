import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/authStore';
import { Button, Input } from '../components/ui';
import { cn } from '../lib/cn';

const FEATURES = [
  { icon: '⚡', label: 'Kanban con límites WIP inteligentes' },
  { icon: '📊', label: 'Métricas de flujo en tiempo real' },
  { icon: '🤖', label: 'AI que detecta cuellos de botella' },
];

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/projects';

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch {
      // El error ya está manejado en el store
    }
  };

  return (
    <div className="flex min-h-screen w-screen bg-canvas">
      {/* Columna izquierda (decorativa) */}
      <div className="hidden flex-1 flex-col justify-center bg-gradient-to-br from-indigo-600 to-violet-700 p-16 text-white lg:flex">
        <div className="mx-auto w-full max-w-[480px]">
          <h1 className="mb-4 text-5xl font-extrabold tracking-tight">TaskFlow</h1>
          <p className="mb-12 text-xl leading-relaxed opacity-90">Motor de ejecución operativa</p>

          <div className="flex flex-col gap-6">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-4">
                <div className="rounded-xl bg-white/20 p-3 text-xl">{f.icon}</div>
                <span className="text-lg font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Columna derecha (formulario) */}
      <div className="flex flex-1 flex-col items-center justify-center bg-surface p-8">
        <div className="w-full max-w-[380px]">
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-fg">Bienvenido de vuelta</h2>
          <p className="mb-8 text-[15px] text-muted">Inicia sesión en tu workspace</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-fg">Email</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
                className={cn('py-3', error && 'border-status-blocked')}
              />
            </div>

            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-fg">Contraseña</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={cn('py-3 pr-12', error && 'border-status-blocked')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[34px] text-faint hover:text-muted"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            {error && <p className="text-[13px] text-status-blocked">{error}</p>}

            <Button
              type="submit"
              size="lg"
              disabled={isLoading || !email || !password}
              className="mt-2 w-full"
            >
              {isLoading ? 'Autenticando...' : 'Iniciar sesión'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-muted">
            ¿Olvidaste tu contraseña? Contacta al administrador
          </p>

          <div className="mt-12 rounded-lg border border-dashed border-border bg-canvas p-4">
            <h4 className="mb-3 text-xs uppercase tracking-wider text-muted">Credenciales por defecto</h4>
            <ul className="flex flex-col gap-2 text-[13px] text-fg">
              <li>
                <span className="font-semibold">Administrador:</span> admin@taskflow.com / taskflow123
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
