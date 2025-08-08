.PHONY: help setup install dev test build deploy clean

help:
	@echo "Available commands:"
	@echo "  make setup     - Initial project setup"
	@echo "  make install   - Install dependencies"
	@echo "  make dev       - Start development servers"
	@echo "  make test      - Run tests"
	@echo "  make build     - Build for production"
	@echo "  make deploy    - Deploy to production"
	@echo "  make clean     - Clean up generated files"

setup:
	@echo "Setting up project..."
	cd backend && python -m venv venv && . venv/bin/activate && pip install -r requirements.txt
	cd frontend && npm install
	docker-compose pull

install:
	cd backend && pip install -r requirements.txt -r requirements-dev.txt
	cd frontend && npm install
	cd ml-services && pip install -r requirements.txt

dev:
	docker-compose up

test:
	cd backend && pytest
	cd frontend && npm test
	cd ml-services && pytest

build:
	docker-compose build
	cd frontend && npm run build

deploy:
	./scripts/deploy.sh

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf frontend/node_modules frontend/build
	rm -rf backend/venv
	docker-compose down -v
