BACKEND_DIR  := backend
FRONTEND_DIR := frontend
PYTHON       := python3

.PHONY: install install-backend install-frontend dev backend frontend stop clean

## Install all dependencies
install: install-backend install-frontend

install-backend:
	$(PYTHON) -m pip install -r "$(CURDIR)/$(BACKEND_DIR)/requirements.txt"
	@echo "✅ Backend dependencies installed"

install-frontend:
	cd "$(CURDIR)/$(FRONTEND_DIR)" && npm install
	@echo "✅ Frontend dependencies installed"

## Run both backend and frontend concurrently
dev:
	@echo "🚀 Starting backend :8000 and frontend :3000"
	@trap 'kill 0' SIGINT; \
	  (cd "$(CURDIR)/$(BACKEND_DIR)" && $(PYTHON) -m uvicorn main:app --reload --port 8000) & \
	  (cd "$(CURDIR)/$(FRONTEND_DIR)" && npm run dev) & \
	  wait

## Run backend only
backend:
	cd "$(CURDIR)/$(BACKEND_DIR)" && $(PYTHON) -m uvicorn main:app --reload --port 8000

## Run frontend only
frontend:
	cd "$(CURDIR)/$(FRONTEND_DIR)" && npm run dev

## Kill anything on ports 8000 and 3000
stop:
	-lsof -ti:8000 | xargs kill -9 2>/dev/null
	-lsof -ti:3000 | xargs kill -9 2>/dev/null
	@echo "🛑 Stopped"

## Remove node_modules
clean:
	rm -rf "$(CURDIR)/$(FRONTEND_DIR)/node_modules"
	@echo "🧹 Cleaned"
