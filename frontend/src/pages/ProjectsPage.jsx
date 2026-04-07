import React, { useState } from 'react';
import useSWR from 'swr';
import { getProjects, getProjectMetrics } from '../services/api';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectFormModal from '../components/projects/ProjectFormModal'; // AGREGADO
import Can from '../components/shared/Can'; // AGREGADO
import usePermissions from '../hooks/usePermissions'; // AGREGADO

const SkeletonCard = () => (
  <div style={{
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '20px',
    height: '240px',
    animation: 'pulse 1.5s infinite ease-in-out',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  }}>
    <div style={{ display: 'flex', gap: '12px' }}>
      <div style={{ width: '32px', height: '32px', backgroundColor: '#e2e8f0', borderRadius: '50%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ width: '120px', height: '16px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
        <div style={{ width: '60px', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
      </div>
    </div>
    <div style={{ width: '100%', height: '32px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
    <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', marginTop: 'auto' }} />
    <div style={{ display: 'flex', gap: '8px' }}>
      <div style={{ width: '60px', height: '20px', backgroundColor: '#e2e8f0', borderRadius: '10px' }} />
      <div style={{ width: '60px', height: '20px', backgroundColor: '#e2e8f0', borderRadius: '10px' }} />
    </div>
    <style>
      {`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}
    </style>
  </div>
);

const ProjectsPage = () => {
  const [showForm, setShowForm] = useState(false); // MODIFICADO
  const [editingProject, setEditingProject] = useState(null); // AGREGADO
  const { canCreateProject } = usePermissions(); // AGREGADO

  // Fetch en paralelo con manejo de errores centralizado
  const { data: projects, error: projectsError, isLoading: isLoadingProjects, mutate } = useSWR('/api/v1/projects', getProjects);
  // Como el endpoint de métricas aún no existe en el mock del backend, atrapamos el error y devolvemos [] localmente o evitamos crashear
  const { data: metricsData, error: metricsError, isLoading: isLoadingMetrics } = useSWR('/api/v1/metrics/projects', getProjectMetrics, {
    shouldRetryOnError: false, // No retentar si no existe el endpoint (Phase 3)
    onError: (err) => console.warn("Endpoint de métricas pendiente de implementación:", err)
  });

  const isLoading = isLoadingProjects || isLoadingMetrics;
  const hasError = projectsError; // Solo crasheamos duro si fallan los proyectos base

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
      {/* Header View */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Proyectos
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', marginTop: '4px' }}>
            Gestiona tus portafolios y visualiza el progreso estratégico.
          </p>
        </div>
        
        <Can permission={canCreateProject}>
          <button 
            onClick={() => { setEditingProject(null); setShowForm(true); }} // MODIFICADO
            style={{
              backgroundColor: 'var(--primary, #6366f1)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover, #4f46e5)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary, #6366f1)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nuevo Proyecto
          </button>
        </Can>
      </div>

      {/* Error State */}
      {hasError && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            <h4 style={{ margin: 0, fontWeight: 600 }}>Error al cargar proyectos</h4>
            <p style={{ margin: 0, fontSize: '14px', marginTop: '4px' }}>{projectsError?.detail || 'No se pudo conectar con el servidor. Verifica que el backend esté arriba.'}</p>
          </div>
        </div>
      )}

      {/* Grid Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        gap: '24px'
      }}>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          projects?.map((project) => {
            // Buscamos las métricas asociadas si existen
            const projectMetrics = Array.isArray(metricsData) 
              ? metricsData.find(m => m.project_id === project.id) 
              : null;
              
            // Usamos las métricas reales provistas por el backend, con fallback a ceros sanos
            const fallbackMetrics = projectMetrics || {
              total_tasks: 0,
              in_progress_tasks: 0,
              blocked_tasks: 0,
              completion_percentage: 0
            };

            return (
              <ProjectCard 
                key={project.id} 
                project={project} 
                metrics={fallbackMetrics}
                onEdit={(p) => { setEditingProject(p); setShowForm(true); }} // AGREGADO
                onArchive={() => { /* Placeholder TODO */ }} // AGREGADO
              />
            );
          })
        )}
      </div>

      {/* Modal Formulario (MODIFICADO) */}
      {showForm && (
        <ProjectFormModal
          project={editingProject}
          onClose={() => { setShowForm(false); setEditingProject(null); }}
          onSaved={() => { mutate(); setShowForm(false); setEditingProject(null); }}
        />
      )}
    </div>
  );
};

export default ProjectsPage;
