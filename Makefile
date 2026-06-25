.PHONY: test-backend test-backend-integration test-backend-local test-frontend test-e2e test-all dev down

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

test-e2e:
	docker compose up -d
	cd e2e && npm install && npx playwright install chromium --with-deps
	cd e2e && npx playwright test --reporter=list
	docker compose down

test-e2e-ui:
	cd e2e && npx playwright test --ui

test-e2e-debug:
	cd e2e && npx playwright test --debug

test-all: test-backend test-frontend test-e2e
