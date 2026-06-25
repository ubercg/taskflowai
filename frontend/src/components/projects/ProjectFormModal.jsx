import { useState, useEffect } from 'react';
import api from '../../services/api/client';
import { toDateInputValue } from '../../utils/dateUtils';
import { Modal, Input, Textarea, Select, Button } from '../ui';
import { cn } from '../../lib/cn';

const EMOJIS = ['🚀', '🏛️', '🤖', '⚡', '🎯', '💡', '🔧', '📦'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const LABEL = 'mb-1.5 block text-[13px] font-medium text-fg';

const ProjectFormModal = ({ project, onClose, onSaved }) => {
  const isEdit = !!project;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: EMOJIS[0],
    color: COLORS[0],
    start_date: '',
    end_date: '',
    status: 'active',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        icon: project.icon || EMOJIS[0],
        color: project.color || COLORS[0],
        start_date: project.start_date ? toDateInputValue(project.start_date) : '',
        end_date: project.end_date ? toDateInputValue(project.end_date) : '',
        status: project.status || 'active',
      });
    }
  }, [project, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) return setError('El nombre es obligatorio');
    if (formData.start_date && formData.end_date && new Date(formData.end_date) < new Date(formData.start_date)) {
      return setError('La fecha fin debe ser posterior al inicio');
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description,
      icon: formData.icon,
      color: formData.color,
      status: formData.status,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    };

    setIsSubmitting(true);
    try {
      const res = isEdit
        ? await api.patch(`/api/v1/projects/${project.id}`, payload)
        : await api.post('/api/v1/projects', payload);
      onSaved(res.data);
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e) => e.msg || JSON.stringify(e)).join(' ') : d ? String(d) : err.message;
      setError(msg || 'Error al guardar el proyecto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="flex max-w-xl flex-col p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-fg">{isEdit ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
        <button onClick={onClose} className="text-muted transition-colors hover:text-fg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Preview en vivo */}
      <div className="mb-6 flex items-center gap-4 rounded-lg border border-border bg-canvas p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl" style={{ backgroundColor: formData.color }}>
          {formData.icon}
        </div>
        <div>
          <div className="mb-0.5 text-xs font-semibold uppercase text-muted">Preview</div>
          <div className="text-base font-semibold text-fg">{formData.name || 'Nombre del Proyecto'}</div>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto pr-2">
        <form id="project-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className={LABEL}>Nombre *</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn(error?.includes('nombre') && 'border-status-blocked')}
              placeholder="Ej: Lanzamiento V2"
            />
          </div>

          <div>
            <label className="mb-1.5 flex justify-between text-[13px] font-medium text-fg">
              <span>Descripción</span>
              <span className="text-faint">{formData.description.length}/300</span>
            </label>
            <Textarea
              maxLength={300}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-20"
              placeholder="Describe el objetivo general..."
            />
          </div>

          <div>
            <label className={LABEL}>Icono</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((emoji) => (
                <div
                  key={emoji}
                  onClick={() => setFormData({ ...formData, icon: emoji })}
                  className={cn(
                    'flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-2 text-xl transition-all',
                    formData.icon === emoji ? 'border-accent bg-accent-soft' : 'border-transparent bg-raised',
                  )}
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL}>Color</label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => setFormData({ ...formData, color: c })}
                  className={cn(
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-all',
                    formData.color === c ? 'border-fg' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                >
                  {formData.color === c && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className={LABEL}>Fecha Inicio</label>
              <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className={LABEL}>Fecha Fin estimada</label>
              <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className={LABEL}>Estado</label>
              <Select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                <option value="active">Activo</option>
                <option value="on_hold">En Pausa</option>
                <option value="completed">Completado</option>
                <option value="archived">Archivado</option>
              </Select>
            </div>
          )}
        </form>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="project-form" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Proyecto'}
        </Button>
      </div>
    </Modal>
  );
};

export default ProjectFormModal;
