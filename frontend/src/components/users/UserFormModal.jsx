import { useState, useEffect } from 'react';
import { createAdminUser, updateAdminUser } from '../../services/api';
import { Modal, Input, Select, Button } from '../ui';
import { cn } from '../../lib/cn';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];
const LABEL = 'mb-1.5 block text-[13px] font-medium text-fg';

const getInitials = (name) => {
  if (!name) return '';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const UserFormModal = ({ user, onClose, onSaved }) => {
  const [formData, setFormData] = useState({ name: '', email: '', role: 'developer', color: COLORS[0], is_active: true });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name, email: user.email, role: user.role, color: user.color, is_active: user.is_active });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.name.trim().length < 3) return setError('El nombre debe tener al menos 3 caracteres.');
    if (!formData.email.trim()) return setError('El email es obligatorio.');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return setError('Formato de correo inválido.');

    setIsSubmitting(true);
    try {
      if (user) {
        await updateAdminUser(user.id, formData);
      } else {
        const { name, email, role, color } = formData;
        await createAdminUser({ name, email, role, color });
      }
      onSaved();
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = (typeof err.detail === 'string' && err.detail)
        || (typeof d === 'string' ? d : Array.isArray(d) ? d.map((e) => e.msg || JSON.stringify(e)).join(' ') : d?.detail ? d.detail : err.message);
      setError(msg || 'Error al guardar el usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = !!user;

  return (
    <Modal open onClose={onClose} className="max-w-lg p-8">
      <div data-testid="user-form-modal">
        <h2 className="mb-6 text-xl font-semibold text-fg">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>

        {error && (
          <div className="mb-5 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="mb-2 flex items-center gap-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white" style={{ backgroundColor: formData.color }}>
              {getInitials(formData.name) || '??'}
            </div>
            <div className="flex-1">
              <label className={LABEL}>Nombre completo *</label>
              <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Jane Doe" />
            </div>
          </div>

          <div>
            <label className={LABEL}>Email *</label>
            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="jane@example.com" />
          </div>

          <div>
            <label className={LABEL}>Rol de sistema</label>
            <Select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
              <option value="admin">⚡ Admin</option>
              <option value="manager">🎯 Manager</option>
              <option value="developer">💻 Developer</option>
              <option value="viewer">👁 Viewer</option>
            </Select>
          </div>

          {isEdit && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              Usuario activo (puede iniciar sesión)
            </label>
          )}

          <div>
            <label className={LABEL}>Color de Avatar</label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => setFormData({ ...formData, color: c })}
                  className={cn('flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-all', formData.color === c ? 'border-fg' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                >
                  {formData.color === c && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Usuario'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default UserFormModal;
