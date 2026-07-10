-- Migración incremental: modos de KPI (manual | por hitos) sobre objectives
-- Ejecutar en bases existentes:
--   psql -U taskflow -d taskflow_db -f docker/migrations/002_kpi_modes.sql

ALTER TABLE objectives
    ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'milestone';
ALTER TABLE objectives
    ADD COLUMN IF NOT EXISTS progress_pct INT;

ALTER TABLE objectives
    DROP CONSTRAINT IF EXISTS ck_objectives_mode;
ALTER TABLE objectives
    ADD CONSTRAINT ck_objectives_mode CHECK (mode IN ('manual', 'milestone'));

ALTER TABLE objectives
    DROP CONSTRAINT IF EXISTS ck_objectives_progress_pct;
ALTER TABLE objectives
    ADD CONSTRAINT ck_objectives_progress_pct
    CHECK (progress_pct IS NULL OR (progress_pct BETWEEN 0 AND 100));

CREATE TABLE IF NOT EXISTS objective_comments (
    id SERIAL PRIMARY KEY,
    objective_id INT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    actor_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_objective_comments_objective
    ON objective_comments(objective_id, created_at DESC);
