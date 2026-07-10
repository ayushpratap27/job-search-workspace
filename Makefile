.PHONY: dev infra infra-down migrate migrate-down \
        dev-backend dev-frontend dev-automation \
        build-backend build-frontend \
        install-frontend install-automation \
        tidy lint-backend help

# ── Infrastructure ───────────────────────────────────────────────────────────

infra:
	docker compose up -d

infra-down:
	docker compose down

infra-logs:
	docker compose logs -f

# ── Database migrations (goose) ──────────────────────────────────────────────

migrate:
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" up

migrate-down:
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" down

migrate-status:
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" status

# ── Development servers ──────────────────────────────────────────────────────

dev-backend:
	cd backend && air

dev-frontend:
	cd frontend && npm run dev

dev-automation:
	cd automation && npm run dev

# Run all three dev servers in parallel (requires GNU make 4.x or tmux setup)
dev:
	$(MAKE) -j3 dev-backend dev-frontend dev-automation

# ── Build ────────────────────────────────────────────────────────────────────

build-backend:
	cd backend && go build -o bin/api ./cmd/api && go build -o bin/worker ./cmd/worker
	@echo "Backend binaries built in backend/bin/"

build-frontend:
	cd frontend && npm run build
	@echo "Frontend built in frontend/dist/"

# ── Install dependencies ──────────────────────────────────────────────────────

install-frontend:
	cd frontend && npm install

install-automation:
	cd automation && npm install

install: install-frontend install-automation

# ── Go helpers ───────────────────────────────────────────────────────────────

tidy:
	cd backend && go mod tidy

lint-backend:
	cd backend && golangci-lint run ./...

# ── Help ─────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  make infra            start postgres + redis via docker compose"
	@echo "  make infra-down       stop docker services"
	@echo "  make migrate          run database migrations (requires DATABASE_URL)"
	@echo "  make dev-backend      start Go API server with live reload (air)"
	@echo "  make dev-frontend     start Vite dev server"
	@echo "  make dev-automation   start automation service with ts-node-dev"
	@echo "  make build-backend    compile Go binaries"
	@echo "  make build-frontend   build frontend for production"
	@echo "  make install          install npm dependencies for all services"
	@echo "  make tidy             run go mod tidy"
	@echo ""
