import React, { useEffect, useState } from 'react';

const WipToast = () => {
  const [toastData, setToastData] = useState(null);

  useEffect(() => {
    const handleWipExceeded = (e) => {
      setToastData(e.detail);
      
      // Auto-ocultar a los 3 segundos
      setTimeout(() => {
        setToastData(null);
      }, 3000);
    };

    window.addEventListener('wip-exceeded', handleWipExceeded);
    
    return () => {
      window.removeEventListener('wip-exceeded', handleWipExceeded);
    };
  }, []);

  if (!toastData) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: '#fef2f2',
      border: '1px solid #fca5a5',
      color: '#991b1b',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 9999,
      animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
          WIP Limit alcanzado
        </p>
        <p style={{ margin: 0, fontSize: '13px', marginTop: '2px' }}>
          Máximo {toastData.limit} tareas en progreso (actual: {toastData.current_wip})
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
