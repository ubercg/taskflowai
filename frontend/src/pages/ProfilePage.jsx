import { useState } from 'react';
import { useAuth } from '../store/authStore';
import api from '../services/api/client';
import { Input, Button } from '../components/ui';

const LABEL = 'mb-1.5 block text-[13px] font-medium text-fg';

const ProfilePage = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) return setError('Las contraseñas nuevas no coinciden');

    try {
      await api.post('/api/v1/auth/change-password', { current_password: currentPassword, new_password: newPassword });
      setMessage('¡Contraseña actualizada con éxito!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || err.detail || 'Error al actualizar contraseña');
    }
  };

  return (
    <div className="mx-auto max-w-[600px] px-4 py-8">
      <h1 className="mb-6 text-[28px] font-semibold tracking-tight text-fg">Mi Perfil</h1>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold text-white" style={{ backgroundColor: user?.color || '#6366f1' }}>
            {user?.name ? user.name.slice(0, 2).toUpperCase() : '??'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-fg">{user?.name}</h2>
            <p className="my-1 text-sm text-muted">{user?.email}</p>
            <span className="inline-block rounded-full bg-raised px-2 py-0.5 text-xs font-semibold capitalize text-muted">{user?.role}</span>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="p-6">
          <h3 className="mb-4 text-base font-semibold text-fg">Cambiar Contraseña</h3>

          {message && (
            <div className="mb-4 rounded-md border border-status-done/40 bg-status-done/10 p-3 text-[13px] text-status-done">{message}</div>
          )}
          {error && (
            <div className="mb-4 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={LABEL}>Contraseña actual</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL}>Nueva contraseña</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL}>Confirmar nueva contraseña</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={!currentPassword || !newPassword || !confirmPassword} className="mt-2 self-start">
              Actualizar contraseña
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
