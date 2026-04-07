import api from './client';

// ── PROJECTS ─────────────────────────────────────

/**
 * @returns {Promise<Project[]>}
 */
export const getProjects = () => api.get('/api/v1/projects').then(res => res.data); // ✓ EXISTÍA

/**
 * @param {number} id
 * @returns {Promise<Project>}
 */
export const getProject = (id) => api.get(`/api/v1/projects/${id}`).then(res => res.data); // ✓ EXISTÍA

/**
 * @param {Object} data
 * @returns {Promise<Project>}
 */
export const createProject = (data) => api.post('/api/v1/projects', data).then(res => res.data); // + AGREGADO

/**
 * @param {number} id
 * @param {Object} data
 * @returns {Promise<Project>}
 */
export const updateProject = (id, data) => api.patch(`/api/v1/projects/${id}`, data).then(res => res.data); // + AGREGADO

/**
 * @param {number} id
 * @returns {Promise<any>}
 */
export const deleteProject = (id) => api.delete(`/api/v1/projects/${id}`).then(res => res.data); // + AGREGADO

/**
 * @param {number} projectId
 * @returns {Promise<Member[]>}
 */
export const getProjectMembers = (projectId) => api.get(`/api/v1/projects/${projectId}/members`).then(res => res.data); // + AGREGADO

/**
 * @param {number} projectId
 * @param {number} userId
 * @param {string} role
 * @returns {Promise<any>}
 */
export const addProjectMember = (projectId, userId, role = 'developer') => 
  api.post(`/api/v1/projects/${projectId}/members/${userId}`, { role }).then(res => res.data); // + AGREGADO

/**
 * @param {number} projectId
 * @param {number} userId
 * @param {string} role
 * @returns {Promise<any>}
 */
export const updateMemberRole = (projectId, userId, role) => 
  api.patch(`/api/v1/projects/${projectId}/members/${userId}`, { role }).then(res => res.data); // + AGREGADO

/**
 * @param {number} projectId
 * @param {number} userId
 * @returns {Promise<any>}
 */
export const removeProjectMember = (projectId, userId) => 
  api.delete(`/api/v1/projects/${projectId}/members/${userId}`).then(res => res.data); // + AGREGADO


// ── OBJECTIVES ───────────────────────────────────

/**
 * @param {number} projectId
 * @returns {Promise<Objective[]>}
 */
export const getObjectives = (projectId) => api.get('/api/v1/objectives', { params: { project_id: projectId } }).then(res => res.data); // ✓ EXISTÍA

/**
 * @param {number} id
 * @returns {Promise<Objective>}
 */
export const getObjective = (id) => api.get(`/api/v1/objectives/${id}`).then(res => res.data); // + AGREGADO

/**
 * @param {Object} data
 * @returns {Promise<Objective>}
 */
export const createObjective = (data) => api.post('/api/v1/objectives', data).then(res => res.data); // + AGREGADO

/**
 * @param {number} id
 * @param {Object} data
 * @returns {Promise<Objective>}
 */
export const updateObjective = (id, data) => api.patch(`/api/v1/objectives/${id}`, data).then(res => res.data); // + AGREGADO

/**
 * @param {number} id
 * @returns {Promise<any>}
 */
export const deleteObjective = (id) => api.delete(`/api/v1/objectives/${id}`).then(res => res.data); // + AGREGADO


// ── TASKS ────────────────────────────────────────

/**
 * @param {Object} params - { project_id, status, assignee_id }
 * @returns {Promise<Task[]>}
 */
export const getTasks = (params) => api.get('/api/v1/tasks', { params }).then(res => res.data); // ✓ EXISTÍA

/**
 * @param {number} id
 * @returns {Promise<Task>}
 */
export const getTask = (id) => api.get(`/api/v1/tasks/${id}`).then(res => res.data); // ✓ EXISTÍA

/**
 * @param {Object} data
 * @returns {Promise<Task>}
 */
export const createTask = (body) => api.post('/api/v1/tasks', body).then(res => res.data); // ✓ EXISTÍA

/**
 * @param {number} id
 * @param {Object} data
 * @returns {Promise<Task>}
 */
export const updateTask = (id, body) => api.patch(`/api/v1/tasks/${id}`, body).then(res => res.data); // ✓ EXISTÍA

/**
 * @param {number} id
 * @param {Object} body - { status, position, user_id }
 * @returns {Promise<any>}
 */
export const moveTask = (id, body) => api.patch(`/api/v1/tasks/${id}/move`, body).then(res => res.data); // ✓ EXISTÍA

/**
 * @param {number} id
 * @returns {Promise<any>}
 */
export const deleteTask = (id) => api.delete(`/api/v1/tasks/${id}`).then(res => res.data); // ✓ EXISTÍA


// ── USERS ────────────────────────────────────────

/**
 * @param {Object} params - { search, role }
 * @returns {Promise<User[]>}
 */
export const getUsers = (params) => api.get('/api/v1/users', { params }).then(res => res.data); // ✓ EXISTÍA (modificado para recibir params)

/**
 * @param {number} id
 * @returns {Promise<User>}
 */
export const getUser = (id) => api.get(`/api/v1/users/${id}`).then(res => res.data); // + AGREGADO

/**
 * @param {Object} data
 * @returns {Promise<User>}
 */
export const createUser = (data) => api.post('/api/v1/admin/users', data).then(res => res.data); // ✓ EXISTÍA (ruta actualizada a admin/users)

/**
 * @param {number} id
 * @returns {Promise<User>}
 */
export const getAdminUser = (id) =>
  api.get(`/api/v1/admin/users/${id}`).then((res) => res.data);

/**
 * @param {number} id
 * @param {Object} data
 * @returns {Promise<User>}
 */
export const updateUser = (id, data) => api.patch(`/api/v1/admin/users/${id}`, data).then(res => res.data); // ✓ EXISTÍA (alias de updateAdminUser)

/**
 * @param {number} id
 * @returns {Promise<any>}
 */
export const deleteUser = (id) => api.delete(`/api/v1/admin/users/${id}`).then((res) => res.data);

/**
 * @param {number} id
 * @returns {Promise<any>}
 */
export const toggleUser = (id) => api.patch(`/api/v1/admin/users/${id}/toggle`).then(res => res.data); // ✓ EXISTÍA (alias de toggleAdminUser)

/**
 * @param {number} id
 * @returns {Promise<any>}
 */
export const getUserStats = (id) => api.get(`/api/v1/admin/users/${id}/stats`).then(res => res.data); // ✓ EXISTÍA (alias de getAdminUserStats)

/**
 * @param {number} id
 * @param {Object} params
 * @returns {Promise<Task[]>}
 */
export const getUserTasks = (id, params) => api.get(`/api/v1/admin/users/${id}/tasks`, { params }).then(res => res.data); // ✓ EXISTÍA (alias de getAdminUserTasks)

// Mantenemos las variables viejas por retrocompatibilidad temporal si algún componente las usa
export const getAdminUsers = (params) => api.get('/api/v1/admin/users', { params }).then(res => res.data); // ✓ EXISTÍA
export const createAdminUser = createUser; // ✓ EXISTÍA
export const updateAdminUser = updateUser; // ✓ EXISTÍA
export const deleteAdminUser = deleteUser;
export const toggleAdminUser = toggleUser; // ✓ EXISTÍA
export const getAdminUserTasks = getUserTasks; // ✓ EXISTÍA
export const getAdminUserStats = getUserStats; // ✓ EXISTÍA


// ── TIME LOGS ────────────────────────────────────

/**
 * @param {Object} params - { task_id, user_id }
 * @returns {Promise<TimeLog[]>}
 */
export const getTimeLogs = (params) => api.get('/api/v1/time-logs', { params }).then(res => res.data); // ✓ EXISTÍA

/**
 * @param {Object} data
 * @returns {Promise<TimeLog>}
 */
export const createTimeLog = (body) => api.post('/api/v1/time-logs', body).then(res => res.data); // ✓ EXISTÍA


// ── METRICS ──────────────────────────────────────

/**
 * @returns {Promise<any>}
 */
export const getProjectMetrics = () => api.get('/api/v1/metrics/projects').then(res => res.data); // ✓ EXISTÍA

/**
 * @returns {Promise<any>}
 */
export const getGlobalSummary = () => api.get('/api/v1/metrics/summary').then(res => res.data); // ✓ EXISTÍA (era getMetrics)

/**
 * @returns {Promise<any>}
 */
export const getVelocity = () => api.get('/api/v1/metrics/velocity').then(res => res.data); // ✓ EXISTÍA (era getVelocityMetrics)

/**
 * @param {number} projectId
 * @returns {Promise<any>}
 */
export const getFlowMetrics = (projectId) => api.get('/api/v1/metrics/flow', { params: { project_id: projectId } }).then(res => res.data); // ✓ EXISTÍA

/**
 * @returns {Promise<any>}
 */
export const getAgingMetrics = () => api.get('/api/v1/metrics/aging').then(res => res.data); // ✓ EXISTÍA

/**
 * @param {number} projectId
 * @returns {Promise<any>}
 */
export const getBottlenecks = (projectId) => api.get('/api/v1/metrics/bottlenecks', { params: { project_id: projectId } }).then(res => res.data); // ✓ EXISTÍA

export const triggerBottleneckAnalysis = (projectId) =>
  api.post(`/api/v1/metrics/trigger-analysis?project_id=${projectId}`)
    .then(r => r.data);

// Mantenemos alias temporales para las metricas
export const getMetrics = getGlobalSummary;
export const getVelocityMetrics = getVelocity;


// ── AUTH ─────────────────────────────────────────

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<any>}
 */
export const login = (email, password) => {
  const form = new URLSearchParams();
  form.append('username', email);
  form.append('password', password);
  return api.post('/api/v1/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then(res => res.data);
}; // + AGREGADO

/**
 * @returns {Promise<User>}
 */
export const getMe = () => api.get('/api/v1/auth/me').then(res => res.data); // + AGREGADO

/**
 * @param {Object} data - { current_password, new_password }
 * @returns {Promise<any>}
 */
export const changePassword = (data) => api.post('/api/v1/auth/change-password', data).then(res => res.data); // + AGREGADO


// ── AI INTELLIGENCE ──────────────────────────────

/**
 * @param {number} projectId
 * @returns {Promise<any>}
 */
export const getDailySummary = (projectId) => api.get('/api/v1/ai/daily-summary', { params: { project_id: projectId } }).then(res => res.data); // ✓ EXISTÍA
