SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help up down build gen migrate test-backend lint-backend \
        test-frontend build-frontend lint-frontend test-e2e format

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Start the full stack
	docker compose up -d --build

down: ## Stop the stack
	docker compose down

build: ## Build all images
	docker compose build

gen: ## Generate TS types from the backend OpenAPI schema
	docker compose build backend
	mkdir -p openapi
	docker compose run --rm --no-deps backend python scripts/export_openapi.py > openapi/openapi.json
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

build-frontend: ## Build frontend (vite build, also typechecks)
	cd frontend && npm run build

lint-frontend: ## Lint frontend (eslint + tsc --noEmit)
	cd frontend && npm run lint

format: ## Format backend and frontend
	cd backend && ruff format . && ruff check --fix .
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}"
