import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setAdminUserPassword } from '../../services/api';
import { resolveApiError } from '../../services/api/errors';
import { Modal, Input, Button } from '../ui';

const LABEL = 'mb-1.5 block text-[13px] font-medium text-fg';

/**
 * Assign a temporary password (mode=assign). Reset uses confirm on the page.
 */
const AssignPasswordModal = ({ user, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password.trim()) return setError(t('users.admin.password.errors.required'));
    if (password !== confirm) return setError(t('users.admin.password.errors.mismatch'));

    setIsSubmitting(true);
    try {
      await setAdminUserPassword(user.id, { mode: 'assign', new_password: password });
      onSaved();
    } catch (err) {
      setError(resolveApiError(err, 'users.admin.password.errors.save'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-md p-8">
      <div data-testid="assign-password-modal">
        <h2 className="mb-2 text-xl font-semibold text-fg">
          {t('users.admin.password.assignTitle')}
        </h2>
        <p className="mb-5 text-[13px] text-muted">
          {t('users.admin.password.assignHint', { name: user.name, email: user.email })}
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={LABEL}>{t('users.admin.password.newLabel')}</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="assign-password-input"
            />
          </div>
          <div>
            <label className={LABEL}>{t('users.admin.password.confirmLabel')}</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              data-testid="assign-password-confirm"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                {t('common.actions.cancel')}
              </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="assign-password-submit">
              {isSubmitting
                ? t('users.admin.password.assigning')
                : t('users.admin.password.assignSubmit')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AssignPasswordModal;
