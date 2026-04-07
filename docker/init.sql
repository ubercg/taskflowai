-- TaskFlow — esquema inicial alineado con backend/app/models/models.py y endpoints de métricas/IA
-- Ejecutado solo en el primer arranque del volumen PostgreSQL (docker-entrypoint-initdb.d)

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'developer', 'viewer');
CREATE TYPE project_status AS ENUM ('active', 'on_hold', 'completed', 'archived');
CREATE TYPE task_status AS ENUM ('backlog', 'todo', 'in_progress', 'review', 'done', 'blocked');
CREATE TYPE task_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE task_type AS ENUM ('task', 'subtask', 'activity');

-- 2. TABLAS (orden de dependencias)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) DEFAULT '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniJ7HQxQZFx3g8K5vP.8X/5oq',
    role user_role NOT NULL DEFAULT 'developer',
    color VARCHAR(7) DEFAULT '#6366f1',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(10) DEFAULT '🚀',
    status project_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_members (
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'developer',
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE objectives (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    objective_id INT REFERENCES objectives(id) ON DELETE SET NULL,
    assignee_id INT REFERENCES users(id) ON DELETE SET NULL,
    parent_id INT REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'backlog',
    priority task_priority NOT NULL DEFAULT 'medium',
    type task_type NOT NULL DEFAULT 'task',
    position INT NOT NULL DEFAULT 0,
    estimated_hours DECIMAL(5,2),
    logged_hours DECIMAL(5,2) DEFAULT 0,
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE time_logs (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hours DECIMAL(5,2) NOT NULL,
    description TEXT,
    log_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    from_status task_status,
    to_status task_status NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices usados por analytics, daily summary y listados
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_activities_task_id ON activities(task_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);
CREATE INDEX idx_time_logs_task_id ON time_logs(task_id);
CREATE INDEX idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX idx_objectives_project_id ON objectives(project_id);

-- 3. Vista: agregados por proyecto (ProjectsPage, métricas)
CREATE VIEW project_metrics AS
SELECT
    p.id AS project_id,
    COUNT(t.id) AS total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'done') AS completed_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS in_progress_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'blocked') AS blocked_tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id;

-- 4. Vista materializada: métricas de flujo por proyecto (MetricsPage, refresh_flow_metrics)
CREATE MATERIALIZED VIEW flow_metrics AS
SELECT
    t.project_id,
    COUNT(*) FILTER (WHERE t.status = 'done') AS total_completed,
    ROUND(
        AVG(
            EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 3600
        ) FILTER (WHERE t.completed_at IS NOT NULL),
        2
    ) AS lead_time_avg_h,
    ROUND(
        AVG(
            EXTRACT(EPOCH FROM (
                t.completed_at - (
                    SELECT MIN(a.created_at)
                    FROM activities a
                    WHERE a.task_id = t.id AND a.to_status = 'in_progress'
                )
            )) / 3600
        ) FILTER (WHERE t.completed_at IS NOT NULL),
        2
    ) AS cycle_time_avg_h,
    COUNT(*) FILTER (
        WHERE t.status = 'done'
        AND t.completed_at >= NOW() - INTERVAL '7 days'
    ) AS throughput_week,
    ROUND(
        COALESCE(SUM(t.logged_hours), 0)
        / NULLIF(COALESCE(SUM(t.estimated_hours), 0), 0) * 100,
        2
    ) AS efficiency_ratio
FROM tasks t
WHERE t.type = 'task' AND t.parent_id IS NULL
GROUP BY t.project_id;

CREATE UNIQUE INDEX idx_flow_metrics_project_id ON flow_metrics(project_id);

CREATE OR REPLACE FUNCTION refresh_flow_metrics()
RETURNS void AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY flow_metrics;
$$ LANGUAGE sql;

-- 5. Cuellos de botella Kanban (trigger-analysis, SWR bottlenecks)
CREATE TABLE kanban_bottlenecks (
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status task_status NOT NULL,
    avg_hours NUMERIC(8,2) DEFAULT 0,
    task_count INT NOT NULL DEFAULT 0,
    is_bottleneck BOOLEAN NOT NULL DEFAULT FALSE,
    threshold_h NUMERIC(8,2) DEFAULT 0,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, status)
);

CREATE INDEX idx_kanban_bottlenecks_project ON kanban_bottlenecks(project_id);

-- 6. Datos iniciales
INSERT INTO users (name, email, password_hash, role, color, is_active)
VALUES (
    'Admin',
    'admin@taskflow.com',
    '$2b$12$EmDne7HgDLrc5yXsaj08G.g3tOi4UULL.malxrljmZXS8jEzw9myO',
    'admin',
    '#6366f1',
    TRUE
);
