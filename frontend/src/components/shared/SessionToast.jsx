import { useState, useEffect } from 'react';

const SessionToast = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleExpired = () => {
      setIsVisible(true);
      setTimeout(() => setIsVisible(false), 2000);
    };
    window.addEventListener('session-expired', handleExpired);
    return () => window.removeEventListener('session-expired', handleExpired);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed left-1/2 top-6 z-[9999] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-priority-medium/40 bg-surface px-5 py-3 text-fg shadow-overlay"
      style={{ animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1), fadeOut 0.3s ease-in 1.7s forwards' }}
    >
      <span className="text-xl">⏰</span>
      <p className="text-sm font-medium">Tu sesión expiró. Redirigiendo al login...</p>

      <style>
        {`
          @keyframes slideDown {
            from { transform: translate(-50%, -100%); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};

export default SessionToast;
