import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { getProject, getObjectives, getProjectMetrics } from '../services/api';
import api from '../services/api/client';
import usePermissions from '../hooks/usePermissions';
import Can from '../components/shared/Can';
import ProjectFormModal from '../components/projects/ProjectFormModal';
import ObjectiveFormModal from '../components/projects/ObjectiveFormModal';
import MembersPanel from '../components/projects/MembersPanel';
import ObjectiveTasksPanel from '../components/projects/ObjectiveTasksPanel';
import { formatCalendarLocale } from '../utils/dateUtils';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEditProject } = usePermissions();

  const [showEditProject, setShowEditProject] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState(null);

  // Data fetching
  const { data: project, mutate: mutateProject } = useSWR(
    `/api/v1/projects/${id}`,
    () => getProject(id)
  );

  const { data: objectives, mutate: mutateObjectives } = useSWR(
    `/api/v1/objectives?project_id=${id}`,
    () => getObjectives(id)
  );

  const { data: members } = useSWR(
    `/api/v1/projects/${id}/members`,
    () => api.get(`/api/v1/projects/${id}/members`).then(res => res.data),
    { fallbackData: [] } // Fallback empty array para cuando el backend se actualice en P2
  );

  const { data: metricsData } = useSWR(
    '/api/v1/metrics/projects',
    () => getProjectMetrics()
  );

  const projectMetrics = Array.isArray(metricsData) 
    ? metricsData.find(m => m.project_id === Number(id)) 
    : { total_tasks: 0, completed_tasks: 0, in_progress_tasks: 0, blocked_tasks: 0 };

  if (!project) {
    return <div style={{ padding: '32px', color: '#64748b' }}>Cargando proyecto...</div>;
  }

  const getProgressColor = (percentage) => {
    if (percentage < 30) return '#f87171';
    if (percentage <= 70) return '#fb923c';
    return '#4ade80';
  };

  return (
    <div style={{ padding: '0 16px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Container 70/30 */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Columna Izquierda (70%) */}
        <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header del Proyecto */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '32px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: project.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', flexShrink: 0 }}>
                {project.icon || '🚀'}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>{project.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <span style={{ 
                    backgroundColor: project.status === 'active' ? '#dcfce7' : '#f1f5f9', 
                    color: project.status === 'active' ? '#16a34a' : '#64748b', 
                    padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' 
                  }}>
                    {project.status?.replace('_', ' ') || 'Active'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Creado el {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.6, margin: '0 0 24px 0' }}>
              {project.description || 'Sin descripción proporcionada para este proyecto.'}
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Can permission={canEditProject}>
                <button 
                  onClick={() => setShowEditProject(true)}
                  style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Editar Proyecto
                </button>
              </Can>
              <button 
                onClick={() => navigate(`/projects/${id}/board`)}
                style={{ padding: '8px 16px', backgroundColor: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(99, 102, 241, 0.2)' }}
              >
                Ir al Kanban →
              </button>
            </div>
          </div>

          {/* Objetivos (OKRs) Section */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>Objetivos (OKRs)</h2>
              <Can permission={canEditProject}>
                <button 
                  onClick={() => { setEditingObjective(null); setShowObjectiveForm(true); }}
                  style={{ padding: '6px 12px', backgroundColor: '#f8fafc', color: '#6366f1', border: '1px solid #e0e7ff', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  + Nuevo Objetivo
                </button>
              </Can>
            </div>

            {(!objectives || objectives.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                No hay objetivos estratégicos definidos aún.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {objectives.map(obj => (
                  <div key={obj.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div 
                      onClick={() => setExpandedObjectiveId(expandedObjectiveId === obj.id ? null : obj.id)}
                      style={{ padding: '16px', backgroundColor: expandedObjectiveId === obj.id ? '#f8fafc' : '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', transition: 'background-color 0.2s' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{obj.title}</h3>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{obj.progress || 0}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${obj.progress || 0}%`, backgroundColor: getProgressColor(obj.progress || 0) }} />
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                          <div>Vence</div>
                          <div style={{ fontWeight: 500, color: '#334155' }}>{formatCalendarLocale(obj.due_date)}</div>
                        </div>
                        {obj.owner_id ? (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                            {/* Dummy fallback in case owner isn't expanded by backend */}
                            U{obj.owner_id}
                          </div>
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1' }} />
                        )}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ transform: expandedObjectiveId === obj.id ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>
                    
                    {expandedObjectiveId === obj.id && (
                      <ObjectiveTasksPanel 
                        objective={obj} 
                        projectId={id} 
                        onClose={() => setExpandedObjectiveId(null)} 
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Columna Derecha (30%) */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Widget Equipo */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>Equipo</h3>
              <Can permission={canEditProject}>
                <button 
                  onClick={() => setShowMembersPanel(true)}
                  style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  + Administrar
                </button>
              </Can>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {members?.map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: member.color || '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>
                    {getInitials(member.name)}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {member.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {member.role}
                    </div>
                  </div>
                </div>
              ))}
              {members?.length === 0 && (
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Sin miembros asignados.</span>
              )}
            </div>
          </div>

          {/* Widget Resumen Rápido */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>Resumen Rápido</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{projectMetrics?.total_tasks || 0}</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase' }}>Total</div>
              </div>
              <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{projectMetrics?.completed_tasks || 0}</div>
                <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 500, textTransform: 'uppercase' }}>Hechas</div>
              </div>
              <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb' }}>{projectMetrics?.in_progress_tasks || 0}</div>
                <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 500, textTransform: 'uppercase' }}>WIP</div>
              </div>
              <div style={{ backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{projectMetrics?.blocked_tasks || 0}</div>
                <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 500, textTransform: 'uppercase' }}>Bloqueo</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modales */}
      {showEditProject && (
        <ProjectFormModal 
          project={project} 
          onClose={() => setShowEditProject(false)} 
          onSaved={() => { mutateProject(); setShowEditProject(false); }} 
        />
      )}

      {showObjectiveForm && (
        <ObjectiveFormModal 
          projectId={id}
          objective={editingObjective}
          onClose={() => setShowObjectiveForm(false)}
          onSaved={() => { mutateObjectives(); setShowObjectiveForm(false); }}
        />
      )}

      {showMembersPanel && (
        <MembersPanel 
          projectId={id}
          onClose={() => setShowMembersPanel(false)}
        />
      )}

    </div>
  );
};

export default ProjectDetailPage;
