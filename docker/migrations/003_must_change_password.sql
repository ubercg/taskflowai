-- Migración incremental: flag must_change_password en users (TSK-014)
-- Ejecutar en bases existentes:
--   psql -U taskflow -d taskflow_db -f docker/migrations/003_must_change_password.sql
--   docker compose exec -T db psql -U taskflow -d taskflow_db < docker/migrations/003_must_change_password.sql
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- Filas existentes quedan en FALSE (no forzamos cambio masivo).
-- Altas nuevas por admin setean TRUE en la app; seed de init.sql usa TRUE.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
