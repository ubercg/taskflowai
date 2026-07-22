import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createUser } from '../../services/api';
import { Modal, Input, Select, Button } from '../ui';
import { cn } from '../../lib/cn';
import { userRoleLabel } from '../../i18n/enums';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];
const LABEL = 'mb-1.5 block text-[13px] font-medium text-fg';
const ROLE_OPTIONS = ['admin', 'manager', 'developer', 'viewer'];

const NewUserModal = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ name: '', email: '', role: 'developer', color: COLORS[0] });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.email.trim()) return setError(t('users.form.errors.nameEmailRequired'));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return setError(t('users.form.errors.emailInvalid'));

    setIsSubmitting(true);
    try {
      await createUser(formData);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.detail || t('users.form.errors.create'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-sm p-6">
      <h2 className="mb-4 text-xl font-semibold text-fg">{t('users.form.createTitle')}</h2>

      {error && (
        <div className="mb-4 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={LABEL}>{t('users.form.name.label')}</label>
          <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('users.form.name.placeholder')} />
        </div>
        <div>
          <label className={LABEL}>{t('users.form.email.label')}</label>
          <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t('users.form.email.placeholder')} />
        </div>
        <div>
          <label className={LABEL}>{t('users.form.role.label')}</label>
          <Select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{userRoleLabel(role)}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className={LABEL}>{t('users.form.identifierColor.label')}</label>
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
          <Button variant="secondary" onClick={onClose}>{t('common.actions.cancel')}</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('users.form.creating') : t('users.form.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewUserModal;
