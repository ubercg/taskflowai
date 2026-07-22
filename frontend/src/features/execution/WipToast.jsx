import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const WipToast = () => {
  const { t } = useTranslation();
  const [toastData, setToastData] = useState(null);

  useEffect(() => {
    const handleWipExceeded = (e) => {
      setToastData(e.detail);
      setTimeout(() => setToastData(null), 3000);
    };
    window.addEventListener('wip-exceeded', handleWipExceeded);
    return () => window.removeEventListener('wip-exceeded', handleWipExceeded);
  }, []);

  if (!toastData) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-lg border border-status-blocked/40 bg-surface px-5 py-3 text-status-blocked shadow-overlay"
      style={{ animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <div>
        <p className="text-sm font-semibold text-fg">{t('execution.wip.title')}</p>
        <p className="mt-0.5 text-[13px] text-muted">
          {t('execution.wip.detail', { limit: toastData.limit, current: toastData.current_wip })}
        </p>
      </div>

      <style>
        {`
          @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default WipToast;
