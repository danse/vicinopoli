SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help up up-manual down monitoring build gen migrate test-backend lint-backend \
        test-frontend build-frontend lint-frontend test-e2e coverage-backend coverage-frontend \
        coverage format backup

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Start the full stack (dev, deterministic static geocoder)
	docker compose up -d --build

up-manual: ## Start the stack with the real geocoder (Nominatim) for manual testing
	GEOCODER_MODE=nominatim docker compose up -d --build

down: ## Stop the stack
	docker compose down

monitoring: ## Start the opt-in monitoring stack (Prometheus + Grafana)
	docker compose --profile monitoring up -d

build: ## Build all images
	docker compose build

gen: ## Generate TS types from the backend OpenAPI schema
	docker compose build backend
	mkdir -p openapi
	docker compose run -T --rm --no-deps backend python scripts/export_openapi.py > openapi/openapi.json
	cd frontend && npm run gen:types

migrate: ## Run Alembic migrations
	docker compose run --rm backend alembic upgrade head

test-backend: ## Run backend tests (pytest)
	cd backend && .venv/bin/python -m pytest

lint-backend: ## Lint backend (ruff + mypy)
	cd backend && .venv/bin/ruff check . && .venv/bin/mypy app

test-frontend: ## Run frontend tests (vitest)
	cd frontend && npm run test

test-e2e: ## Run end-to-end tests against the running stack (Playwright)
	cd e2e && npm run test

coverage-backend: ## Backend coverage report (HTML in backend/htmlcov/, .coverage data file)
	cd backend && .venv/bin/python -m pytest --cov=app --cov-report=term-missing --cov-report=html:htmlcov

coverage-frontend: ## Frontend coverage report (HTML in frontend/coverage/)
	cd frontend && npm run coverage

coverage: ## Full coverage report (backend + frontend)
	$(MAKE) coverage-backend && $(MAKE) coverage-frontend

build-frontend: ## Build frontend (vite build, also typechecks)
	cd frontend && npm run build

lint-frontend: ## Lint frontend (eslint + tsc --noEmit)
	cd frontend && npm run lint

format: ## Format backend and frontend
	cd backend && .venv/bin/ruff format . && .venv/bin/ruff check --fix .
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}"

backup: ## Dump the database and mirror the object store into backups/
	bash scripts/backup.sh
