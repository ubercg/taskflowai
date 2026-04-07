import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePermissions from '../../hooks/usePermissions';

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return '#22c55e'; // green
    case 'on_hold': return '#eab308'; // yellow
    case 'completed': return '#94a3b8'; // gray
    default: return '#94a3b8';
  }
};

const getProgressColor = (percentage) => {
  if (percentage < 30) return '#f87171'; // red
  if (percentage <= 70) return '#fb923c'; // orange
  return '#4ade80'; // green
};

const ProjectCard = ({ project, metrics, onEdit, onArchive }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const { canEditProject, canDeleteProject } = usePermissions();
  const navigate = useNavigate();

  // Cerrar menú al clickear afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);
  // Valores por defecto ya que el seed no los tiene todos
  const color = project.color || '#6366f1'; 
  const icon = project.icon || '🚀';
  const description = project.description || 'Gestión y ejecución de tareas estratégicas. Enfocado en reducir el Cycle Time y mejorar el delivery.';
  const ownerAvatar = project.owner_avatar || `https://ui-avatars.com/api/?name=${project.name}&background=random&color=fff`;

  // Métricas con fallbacks
  const completionPercentage = metrics?.completion_percentage || 0;
  const totalTasks = metrics?.total_tasks || 0;
  const inProgressTasks = metrics?.in_progress_tasks || 0;
  const blockedTasks = metrics?.blocked_tasks || 0;

  const showMenuTrigger = canEditProject || canDeleteProject;

  const cardStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderLeft: `4px solid ${color}`,
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    transition: 'box-shadow 0.2s ease',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
    position: 'relative',
    // Con el menú abierto, la tarjeta entera sube en la pila; si no, el grid de abajo tapa el dropdown
    zIndex: menuOpen ? 50 : 0,
  };

  const handleMouseEnter = (e) => {
    setIsHovered(true);
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
  };

  const handleMouseLeave = (e) => {
    setIsHovered(false);
    if (!menuOpen) {
      e.currentTarget.style.boxShadow = 'none';
    }
  };

  return (
    <div 
      data-testid="project-card"
      style={cardStyle} 
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
    >
      {/* Header: Icon + Name + Status + Avatar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>{icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
              {project.name}
            </h3>
            <span style={{ 
              display: 'inline-block',
              marginTop: '4px',
              padding: '2px 8px', 
              borderRadius: '12px', 
              fontSize: '12px', 
              fontWeight: 500,
              backgroundColor: `${getStatusColor(project.status)}20`,
              color: getStatusColor(project.status),
              textTransform: 'capitalize'
            }}>
              {project.status.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src={ownerAvatar} 
            alt="Owner Avatar" 
            style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #e2e8f0' }}
          />
          {/* Menú 3 puntos — solo si hay al menos una acción (evita panel vacío / altura 0) */}
          {showMenuTrigger && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Acciones del proyecto"
              aria-expanded={menuOpen}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                opacity: (isHovered || menuOpen) ? 1 : 0.45, transition: 'opacity 0.2s',
                padding: '4px', display: 'flex', alignItems: 'center', color: '#64748b'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
            </button>

            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                  backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                  border: '1px solid #e2e8f0', zIndex: 60, minWidth: '168px', overflow: 'hidden'
                }}
              >
                {canEditProject && (
                  <button 
                    type="button"
                    role="menuitem"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onEdit && onEdit(project); }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>✏️</span> Editar proyecto
                  </button>
                )}
                {canDeleteProject && (
                  <button 
                    type="button"
                    role="menuitem"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onArchive && onArchive(project); }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>📦</span> Archivar
                  </button>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p style={{ 
        margin: 0, 
        fontSize: '14px', 
        color: '#64748b', 
        display: '-webkit-box', 
        WebkitLineClamp: 2, 
        WebkitBoxOrient: 'vertical', 
        overflow: 'hidden',
        lineHeight: '1.5'
      }}>
        {description}
      </p>

      {/* Progress Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>
          <span>Progreso</span>
          <span>{completionPercentage}%</span>
        </div>
        <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${completionPercentage}%`, 
            backgroundColor: getProgressColor(completionPercentage),
            borderRadius: '3px',
            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
      </div>

      {/* Metrics Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
          📋 {totalTasks} Tareas
        </span>
        <span style={{ backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', color: '#3b82f6', fontWeight: 500 }}>
          ⏳ {inProgressTasks} En curso
        </span>
        {blockedTasks > 0 && (
          <span style={{ backgroundColor: '#fee2e2', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', color: '#ef4444', fontWeight: 500 }}>
            🛑 {blockedTasks} Bloqueadas
          </span>
        )}
      </div>

      {/* Actions (MODIFICADO) */}
      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/projects/${project.id}`); }}
          style={{
            flex: 1,
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#334155',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          Ver detalle
        </button>
        <Link 
          data-testid="btn-open-board"
          to={`/projects/${project.id}/board`}
          style={{
            flex: 1,
            display: 'block',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.15s',
            textDecoration: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          Ver Kanban →
        </Link>
      </div>
    </div>
  );
};

export default ProjectCard;
