import { useAuth } from '../store/authStore';

const usePermissions = () => {
  const { user } = useAuth();
  const role = user?.role || 'viewer'; // Default to viewer to prevent undefined errors

  return {
    // Proyectos
    canCreateProject:    ['admin', 'manager'].includes(role),
    canDeleteProject:    role === 'admin',
    canEditProject:      ['admin', 'manager'].includes(role),

    // Tareas
    canCreateTask:       ['admin', 'manager'].includes(role),
    canMoveAnyTask:      ['admin', 'manager'].includes(role),
    canMoveOwnTask:      ['admin', 'manager', 'developer'].includes(role),
    canAssignTask:       ['admin', 'manager'].includes(role),
    canDeleteTask:       ['admin', 'manager'].includes(role),

    // Tiempo
    canLogTime:          ['admin', 'manager', 'developer'].includes(role),

    // Métricas (lectura de dashboards de proyecto)
    canViewMetrics:      ['admin', 'manager', 'developer', 'viewer'].includes(role),

    // Admin
    canAccessAdmin:      role === 'admin',

    // Helper: saber si puede mover UNA tarea específica
    canMoveTask: (task) => {
      if (['admin', 'manager'].includes(role)) return true;
      if (role === 'developer') return task.assignee_id === user?.id;
      return false;
    },

    // Helper: saber si puede editar campos de UNA tarea
    editableFields: (task) => {
      if (['admin', 'manager'].includes(role)) return 'all';
      if (role === 'developer' && task.assignee_id === user?.id) {
        return ['status', 'logged_hours', 'description'];
      }
      return [];
    },

    isAdmin:     role === 'admin',
    isManager:   role === 'manager',
    isDeveloper: role === 'developer',
    isViewer:    role === 'viewer',
    role,
  };
};

export default usePermissions;
