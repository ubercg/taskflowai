-- Migración incremental: extensiones SIGAO para proyectos estratégicos
-- Ejecutar en bases existentes: psql -U taskflow -d taskflow_db -f docker/migrations/001_sigao_extensions.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS external_uuid UUID UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_total NUMERIC(14,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_spent NUMERIC(14,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_kpis (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50),
    target_value NUMERIC(14,4) NOT NULL CHECK (target_value > 0),
    current_value NUMERIC(14,4) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milestones (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_events (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    actor_name VARCHAR(255),
    summary TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_project_kpis_project ON project_kpis(project_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_milestones_project ON milestones(project_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_project_events_project_created ON project_events(project_id, created_at DESC);
