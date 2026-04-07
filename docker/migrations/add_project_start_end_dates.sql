-- Ejecutar una vez en bases ya creadas (antes sin estas columnas):
--   docker compose exec -T db psql -U taskflow -d taskflow_db -f - < docker/migrations/add_project_start_end_dates.sql
-- o copiar/pegar en psql.

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE;
