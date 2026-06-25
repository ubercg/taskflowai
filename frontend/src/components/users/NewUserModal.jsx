import { useState } from 'react';
import { createUser } from '../../services/api';
import { Modal, Input, Select, Button } from '../ui';
import { cn } from '../../lib/cn';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];
const LABEL = 'mb-1.5 block text-[13px] font-medium text-fg';

const NewUserModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ name: '', email: '', role: 'developer', color: COLORS[0] });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.email.trim()) return setError('Nombre y correo son obligatorios.');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return setError('Formato de correo inválido.');

    setIsSubmitting(true);
    try {
      await createUser(formData);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.detail || 'Error al crear usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-sm p-6">
      <h2 className="mb-4 text-xl font-semibold text-fg">Nuevo Usuario</h2>

      {error && (
        <div className="mb-4 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={LABEL}>Nombre completo</label>
          <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: John Doe" />
        </div>
        <div>
          <label className={LABEL}>Email</label>
          <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
        </div>
        <div>
          <label className={LABEL}>Rol</label>
          <Select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="developer">Developer</option>
            <option value="viewer">Viewer</option>
          </Select>
        </div>
        <div>
          <label className={LABEL}>Color identificador</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setFormData({ ...formData, color: c })}
                className={cn(
                  'h-8 w-8 cursor-pointer rounded-full border-2 transition-all',
                  formData.color === c ? 'scale-110 border-fg' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear Usuario'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewUserModal;
