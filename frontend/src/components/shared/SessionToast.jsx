import React, { useState, useEffect } from 'react';

const SessionToast = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleExpired = () => {
      setIsVisible(true);
      setTimeout(() => {
        setIsVisible(false);
      }, 2000);
    };

    window.addEventListener('session-expired', handleExpired);

    return () => {
      window.removeEventListener('session-expired', handleExpired);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      backgroundColor: '#fef3c7',
      border: '1px solid #fbbf24',
      color: '#92400e',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1), fadeOut 0.3s ease-in 1.7s forwards'
    }}>
      <span style={{ fontSize: '20px' }}>⏰</span>
      <p style={{ margin: 0, fontWeight: 500, fontSize: '14px' }}>
        Tu sesión expiró. Redirigiendo al login...
      </p>

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
