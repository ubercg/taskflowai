# TaskFlow

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL_15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Ops-Docker-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

**TaskFlow** es una plataforma integral de gestión operativa y estratégica. Conecta la planificación de alto nivel mediante **Objetivos (OKRs)** con la ejecución diaria a través de tableros **Kanban**, registro de tiempo, métricas de flujo y una capa de Inteligencia Artificial que detecta cuellos de botella y genera resúmenes ejecutivos.

---

## 🏗️ Arquitectura y Stack Tecnológico

El sistema sigue una arquitectura moderna, separando el Frontend del Backend, orquestados mediante contenedores Docker y un Proxy Inverso para asegurar un despliegue seguro y sin problemas de CORS.

| Capa | Tecnologías Principales |
|------|-----------|
| **Frontend** | React 18, Vite, Zustand (Estado), SWR (Data Fetching), React Router v6, @hello-pangea/dnd (Drag & Drop), Recharts |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic V2, JWT (Bcrypt), Google GenAI (Gemini) |
| **Base de Datos** | PostgreSQL 15 |
| **Infraestructura** | Nginx (Reverse Proxy), Docker, Docker Compose |
| **Testing** | Pytest (Backend), Vitest + Testing Library (Frontend), Playwright (E2E) |

---

## 📂 Estructura del Proyecto (Desarrollo vs Producción)

Es crucial entender qué partes del repositorio se compilan y despliegan en un entorno de **Producción**, y cuáles existen puramente para **Desarrollo y Testing**.

### 🚀 Archivos y Carpetas de Producción
Estos son los elementos que conforman el sistema vivo que se despliega en un servidor:

*   **`docker-compose.yml`**: El orquestador principal. Define los servicios `db`, `backend`, `frontend` y `nginx`. En un entorno productivo real, el frontend se compilaría estáticamente (Fase de Build) en vez de usar el servidor de desarrollo de Vite.
*   **`nginx/nginx.sigao.conf`**: Reverse proxy. Expone el puerto `80`, sirve la SPA bajo `/taskflow/` (`VITE_BASE_PATH`), reescribe `/taskflow/api/` → `/api/` hacia FastAPI y redirige deep links sin prefijo con `302` a `/taskflow$request_uri`.
*   **`docker-compose.sigao.yml`**: Overlay de embed bajo SIGAO (no publica `:80`, ajusta HMR y el host de Postgres). El conf de nginx lo monta el compose base; este overlay no lo re-monta.
*   **`backend/`**: 
    *   `app/`: Contiene toda la lógica de negocio, modelos ORM, schemas Pydantic y el AI Layer.
    *   `requirements.txt` y `Dockerfile`: Instrucciones de construcción y dependencias.
*   **`frontend/`**:
    *   `src/`: Componentes React, hooks, store de Zustand y llamadas a la API.
    *   `package.json` y `Dockerfile`: Configuración del entorno Node/Vite.
*   **`docker/init.sql`**: Script de inicialización de PostgreSQL. Crea las tablas, vistas materializadas y el Super-Administrador por defecto.

---

## ⚙️ Puesta en Marcha (Local / Producción)

El proyecto está diseñado para levantarse con un solo comando gracias a Docker.

### 1. Requisitos Previos
*   [Docker](https://docs.docker.com/get-docker/) y Docker Compose v2 instalados.
*   *(Opcional)* Una API Key de Google Gemini AI para habilitar resúmenes en lenguaje natural.

### 2. Configuración (Opcional - AI)
Si deseas que el "Daily Summary" utilice IA en lugar del algoritmo determinístico basado en reglas, crea un archivo `.env` en la carpeta `backend/`:
```bash
echo "GEMINI_API_KEY=tu_clave_aqui" > backend/.env
```

### 3. Levantar la Infraestructura
Ejecuta el siguiente comando en la raíz del proyecto:
```bash
make dev
# o equivalente: docker compose up -d
```

### 4. Acceso al Sistema
`make dev` levanta el stack **standalone** con layout SIGAO-shaped: la app vive bajo `/taskflow/`. `http://localhost/` responde `302` hacia `/taskflow/`.
*   **App Web:** `http://localhost/taskflow/`
*   **Documentación API (Swagger):** `http://localhost/docs` (la API cuelga de la raíz; también `/taskflow/api/` vía rewrite)

Para embeber TaskFlow detrás de SIGAO (sin publicar `:80` de este stack):

```bash
docker compose -f docker-compose.yml -f docker-compose.sigao.yml up -d
```

**Credenciales del seed local (solo desarrollo / volumen fresco):**
*   **Email:** `admin@taskflow.com`
*   **Contraseña inicial:** la de `DEFAULT_NEW_USER_PASSWORD` en `backend/.env` (por defecto la misma que documenta `.env.example`; **no** la publiques en despliegues).
*   El seed marca `must_change_password=true`: el primer login obliga a cambiarla en Perfil.

---

## 🧪 Ejecución de Pruebas (Testing Suite)

TaskFlow cuenta con una cobertura de pruebas rigurosa. Puedes ejecutar las suites de manera aislada utilizando el `Makefile` provisto:

*   **Tests del Backend (Pytest):** Verifica la lógica transaccional de PostgreSQL y FastAPI.
    ```bash
    make test-backend
    ```
*   **Tests del Frontend (Vitest):** Verifica el renderizado condicional de componentes React.
    ```bash
    make test-frontend
    ```
*   **Tests End-to-End (Playwright):** Simula a un humano usando el sistema real.
    ```bash
    make test-e2e
    ```
*   **Correr todo el Pipeline:**
    ```bash
    make test-all
    ```

---

## 🛡️ Seguridad y Consideraciones para Despliegue Real

Si planeas llevar este repositorio a un servidor de producción real en la nube (AWS, DigitalOcean, VPS), considera los siguientes pasos:

1.  **Variables de Entorno Mínimas:** Definí `ENVIRONMENT=production`, `SECRET_KEY` y `SIGAO_API_KEY` en `backend/.env` (o como secretos inyectados). Sin esos dos secretos en production la app **no arranca**. Fuera de production, si falta `SECRET_KEY` se genera una efímera (warning) y los JWT mueren en cada reinicio. Generá una clave fuerte con `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2.  **Rotá** contraseñas de Postgres y la API key SIGAO en cada entorno desplegado (no reutilices los valores de desarrollo del compose local).
3.  **Usuarios nuevos** creados por admin nacen con `must_change_password=true` y deben cambiar la contraseña en el primer login.
4.  **Frontend Build Stage:** Actualmente, el contenedor del frontend corre `npm run dev` (Vite Hot-Reload) detrás de Nginx para facilitar el desarrollo continuo. En producción estricta, modifica el `frontend/Dockerfile` para que ejecute `npm run build` y que un contenedor de Nginx puro sirva directamente la carpeta `/dist` estática compilada (Multi-stage build).
5.  **Certificados SSL:** Configura Nginx (o el Load Balancer frontal de tu proveedor cloud) para manejar tráfico HTTPS (puerto 443) utilizando Let's Encrypt / Certbot.
6.  **Aislamiento de Red:** Actualmente la base de datos no mapea puertos al *host* por seguridad (usa `expose` en vez de `ports`). Mantén esta política en producción para que PostgreSQL solo sea accesible desde FastAPI.

---

## 📚 Documentación de Producto

En `spec/` encontrarás el **PRD** (`prd.md`), **roadmap** (`road-map.md`) y otros documentos de contexto. Son la referencia de la visión operativa (OKRs, métricas de flujo, papel de la IA) y los criterios de aceptación frente a lo ya implementado en código.

---

## 📜 Licencia

Este proyecto se publica bajo la licencia **MIT**. Consulta el archivo `LICENSE` (si existe) para el texto completo.
