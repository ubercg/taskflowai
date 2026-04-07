import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/authStore';

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
    } catch (err) {
      // El error ya está manejado en el store
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      
      {/* Columna Izquierda (Decorativa) */}
      <div style={{ 
        flex: 1, 
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: '64px',
        color: '#fff' 
      }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 800, margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
            TaskFlow
          </h1>
          <p style={{ fontSize: '20px', opacity: 0.9, marginBottom: '48px', lineHeight: 1.5 }}>
            Motor de ejecución operativa
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 500 }}>Kanban con límites WIP inteligentes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px' }}>
                <span style={{ fontSize: '20px' }}>📊</span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 500 }}>Métricas de flujo en tiempo real</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px' }}>
                <span style={{ fontSize: '20px' }}>🤖</span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 500 }}>AI que detecta cuellos de botella</span>
            </div>
          </div>
        </div>
      </div>

      {/* Columna Derecha (Formulario) */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#fff', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '32px'
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
            Bienvenido de vuelta
          </h2>
          <p style={{ fontSize: '15px', color: '#64748b', margin: '0 0 32px 0' }}>
            Inicia sesión en tu workspace
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Input Email */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#334155', marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '8px', 
                  border: `1px solid ${error ? '#fca5a5' : '#cbd5e1'}`, 
                  fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            {/* Input Contraseña */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#334155', marginBottom: '8px' }}>
                Contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '12px 48px 12px 16px', borderRadius: '8px', 
                  border: `1px solid ${error ? '#fca5a5' : '#cbd5e1'}`, 
                  fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '16px', top: '38px', background: 'none', border: 'none', 
                  cursor: 'pointer', color: '#94a3b8', padding: 0
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            {/* Manejo de Errores */}
            {error && (
              <p style={{ color: '#ef4444', fontSize: '13px', margin: '0' }}>{error}</p>
            )}

            {/* Botón Submit */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                backgroundColor: isLoading ? '#a5b4fc' : '#6366f1',
                color: '#fff', fontSize: '15px', fontWeight: 600, cursor: isLoading ? 'wait' : 'pointer',
                marginTop: '8px', transition: 'background-color 0.2s'
              }}
            >
              {isLoading ? 'Autenticando...' : 'Iniciar sesión'}
            </button>

          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '24px' }}>
            ¿Olvidaste tu contraseña? Contacta al administrador
          </p>

          {/* Demo Credentials Card */}
          <div style={{ 
            marginTop: '48px', padding: '16px', backgroundColor: '#f8fafc', 
            borderRadius: '8px', border: '1px dashed #cbd5e1' 
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Credenciales por defecto
            </h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#334155' }}>
              <li><span style={{ fontWeight: 600 }}>Administrador:</span> admin@taskflow.com / taskflow123</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
};

export default LoginPage;
