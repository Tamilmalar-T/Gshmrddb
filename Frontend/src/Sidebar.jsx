import { useEffect } from 'react';
import { createPortal } from 'react-dom';

function Sidebar({ isOpen, onClose, activeTab, onNavigate }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { tab: 'users',       icon: '👤', label: 'User Management' },
    { tab: 'departments', icon: '🏥', label: 'Departments' },
  ];

  return createPortal(
    <>
      {/* Dark overlay — clicking closes sidebar */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 9998,
        }}
      />

      {/* Sidebar panel — slides in from the LEFT */}
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '240px',
          height: '100vh',
          background: '#ffffff',
          boxShadow: '8px 0 32px rgba(15, 23, 42, 0.14)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          animation: 'sidebarSlideInLeft 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.1rem 1.25rem 0.9rem',
          borderBottom: '1px solid #f1f5f9',
        }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>Menu</span>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#64748b',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Section label */}
        <div style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#94a3b8',
          padding: '0.9rem 1.25rem 0.4rem',
        }}>
          Administration
        </div>

        {/* Nav items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0.75rem' }}>
          {menuItems.map(({ tab, icon, label }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  onNavigate(tab);   // set the tab
                  onClose();         // close sidebar immediately
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: 10,
                  border: 'none',
                  background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  color: isActive ? '#4f46e5' : '#334155',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{
                  width: 32, height: 32,
                  borderRadius: 8,
                  background: isActive ? 'rgba(79, 70, 229, 0.1)' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  flexShrink: 0,
                }}>
                  {icon}
                </span>
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      <style>{`
        @keyframes sidebarSlideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>,
    document.body
  );
}

export default Sidebar;
