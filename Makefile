.PHONY: test-backend test-backend-integration test-backend-local test-frontend test-all dev down

dev:
	docker compose up -d

down:
	docker compose down

test-backend:
	docker compose -f docker-compose.test.yml run --rm backend_test

test-backend-integration:
	docker compose -f docker-compose.test.yml run --rm backend_test_integration

# Local fallback (no Docker): create a venv and run unit tests directly.
#   cd backend && python -m venv .venv && source .venv/bin/activate
#   pip install -r requirements.txt -r requirements-dev.txt
#   python -m pytest -m "not integration" -q
test-backend-local:
	cd backend && python -m pytest -m "not integration" -q

test-frontend:
	docker compose -f docker-compose.test.yml run --rm frontend_test

# E2E targets removed (TSK-013 opción A): el directorio e2e/ no existe.
# Cuando haya Playwright real, reintroducir targets con contenido.

test-all: test-backend test-backend-integration test-frontend
