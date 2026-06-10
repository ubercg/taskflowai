# CLAUDE.md

Guía para trabajar en **TaskFlow**. Documentación de producto adicional: `README.md`.

## Qué es

Plataforma de gestión operativa y estratégica que conecta planificación de alto nivel (**Objetivos / OKRs**) con ejecución diaria (**Kanban**), registro de tiempo, métricas de flujo y una capa de **IA** que detecta cuellos de botella y genera resúmenes ejecutivos.

Además, el Nginx de este repo actúa como **gateway** del ecosistema: enruta `/bloque` → `bloque-hub` y `/mailer` → app de correo masivo (Streamlit). TaskFlow es el pivote sobre el que montan esas dos apps.

## Stack

| Capa | Tecnologías |
|------|-------------|
| Frontend | React 18, Vite, Zustand (estado), SWR (fetching), React Router v6, @hello-pangea/dnd (drag&drop), Recharts |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic V2, JWT + bcrypt, Google GenAI (Gemini `gemini-2.5-flash`) |
| Base de datos | PostgreSQL 15 |
| Infra | Nginx (reverse proxy, puerto 80), Docker + Docker Compose |
| Testing | Pytest (backend), Vitest + Testing Library (frontend), Playwright (E2E) |

## Estructura

```
backend/app/
  api/v1/endpoints/   # auth, ai, projects, tasks, tasks_crud, users, admin_users,
                      # objectives, metrics, timelogs
  core/               # config.py (settings), security.py (JWT/roles)
  db/                 # database.py (engine, get_db, Base)
  models/models.py    # ORM (User, Project, Objective, Task, TimeLog, Activity...)
  modules/intelligence/  # daily_summary.py, bottleneck.py (capa IA)
  schemas/schemas.py  # Pydantic V2
frontend/src/
  components/         # kanban, projects, users, shared
  features/           # analytics (charts), execution (Kanban), operations (time log)
  pages/              # rutas de página
  store/              # Zustand: authStore, kanbanStore, okrStore
  services/api/       # client.js (axios) + index.js (endpoints)
docker/init.sql       # esquema PostgreSQL: tablas, vistas, seed super-admin
nginx/nginx.conf      # gateway: /api → backend, /bloque, /mailer, catch-all → frontend
docker-compose.yml    # db, backend, frontend, nginx (red externa bloque-hub_app-network)
```

## Modelo de dominio

- **User**: roles `admin | manager | developer | viewer`, color, `is_active`.
- **Project**: estado `active | on_hold | completed | archived`.
- **ProjectMember**: rol por proyecto (PK `project_id + user_id`).
- **Objective**: OKR ligado a un proyecto, con `due_date`.
- **Task**: estado `backlog | todo | in_progress | review | done | blocked`; prioridad `critical | high | medium | low`; tipo `task | subtask | activity`; jerarquía vía `parent_id` (self-FK); `position` para orden Kanban; `estimated_hours` / `logged_hours`.
- **TimeLog**: registro de horas por tarea y usuario.
- **Activity**: log de transiciones de estado (`from_status` → `to_status`). Base de las métricas y la IA.

### Analytics en DB
- Vista `project_metrics`: agregados por proyecto.
- Vista materializada `flow_metrics`: lead/cycle time, throughput semanal, efficiency ratio. Se refresca con `refresh_flow_metrics()` (`CONCURRENTLY`).
- Tabla `kanban_bottlenecks`: UPSERT por `project + status`.

## Auth (`backend/app/core/security.py`)

- JWT HS256 + bcrypt. `get_current_user` resuelve el usuario desde `sub` del token.
- `require_role(*roles)` es factory de dependencias; shortcuts `require_admin`, `require_manager_or_above`.
- `check_project_access` valida membresía (admin la saltea).
- Super-admin sembrado: `admin@taskflow.com` / `taskflow123`.

## Capa de IA (`backend/app/modules/intelligence/`)

- **`daily_summary.py`**: agrega avances / bloqueadas / riesgos / stats de las últimas 24h con SQL crudo y arma un texto rule-based en español. Si existe `GEMINI_API_KEY` o `GOOGLE_API_KEY`, lo mejora con Gemini (con fallback graceful al texto determinístico). Cache en memoria de 60 min por `project_id`.
- **`bottleneck.py`**: calcula aging por columna contra el cycle time histórico (threshold = cycle × 2). Corre en background y **nunca lanza excepciones** (no debe romper el thread principal). UPSERT en `kanban_bottlenecks`.

## Comandos

Levantar / bajar:
```bash
make dev      # docker compose up -d  → http://localhost/  (Swagger: /docs)
make down
```

Testing:
```bash
make test-backend    # pytest vía docker-compose.test.yml
make test-frontend   # vitest vía docker-compose.test.yml
make test-e2e        # Playwright (levanta compose, corre en e2e/, baja compose)
make test-all
```

Frontend local (sin Docker): `cd frontend && npm run dev | build | test`.

## Convenciones y gotchas

- **Idioma de artefactos**: el proyecto existente está en español (comentarios, UI, mensajes de error, docs). Al extender, mantené español neutro/profesional para coincidir con el código existente.
- **Nginx evita CORS**: el navegador siempre habla con el mismo origen; `/api/` va al backend. No fijar `VITE_API_URL` en el frontend (ver comentario en `docker-compose.yml`).
- **Red externa**: `docker-compose.yml` requiere la red `bloque-hub_app-network` (external). Si no existe, `make dev` falla hasta crearla o levantar bloque-hub.
- **DB no expone puerto al host en prod** (usa `expose`, no `ports`); en dev local sí mapea `5435:5432`.
- **`SECRET_KEY`**: se inyecta por env / `backend/.env` (ver `backend/.env.example`). No hay secreto quemado; sin `SECRET_KEY` la app genera una clave **efímera** + warning (los JWT mueren en cada reinicio). En prod, definila siempre.
- **Seguridad pendiente para prod real**: frontend corre `vite dev` tras Nginx (falta build estático multi-stage), sin SSL/443, password de DB (`taskflow_secret`) quemado en `docker-compose.yml`.
- **`spec/`**: el README la menciona (PRD, roadmap) pero **no existe** en el repo actual.
- **Backend monta volumen** `./backend:/app` con `--reload`: los cambios en Python recargan en caliente.

## Memoria persistente (Engram)

El contexto de arquitectura está guardado en Engram bajo los topic keys `architecture/overview` y `architecture/domain-model` (proyecto `taskflowai`). Buscá ahí antes de re-derivar contexto.
