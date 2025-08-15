#!/bin/bash

# Stop Development Environment
# Stops all local development processes and database containers

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ⚠ $1"
}

echo -e "\n${YELLOW}════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}           Legal AI Platform - Stop Development                   ${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}\n"

# Stop backend process
if [ -f "$PROJECT_ROOT/.backend-dev.pid" ]; then
    print_status "Stopping backend development server..."
    if kill "$(cat "$PROJECT_ROOT/.backend-dev.pid")" 2>/dev/null; then
        print_success "Backend stopped"
    else
        print_warning "Backend process not found or already stopped"
    fi
    rm -f "$PROJECT_ROOT/.backend-dev.pid"
fi

# Stop frontend process
if [ -f "$PROJECT_ROOT/.frontend-dev.pid" ]; then
    print_status "Stopping frontend development server..."
    if kill "$(cat "$PROJECT_ROOT/.frontend-dev.pid")" 2>/dev/null; then
        print_success "Frontend stopped"
    else
        print_warning "Frontend process not found or already stopped"
    fi
    rm -f "$PROJECT_ROOT/.frontend-dev.pid"
fi

# Stop any remaining uvicorn/vite processes
print_status "Stopping any remaining development processes..."
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite.*--port 3000" 2>/dev/null || true

# Stop database containers
print_status "Stopping database containers..."
docker compose -f "$PROJECT_ROOT/docker-compose.dev.yml" down 2>/dev/null || true

# Clean up log files
rm -f "$PROJECT_ROOT/.backend-dev.log"
rm -f "$PROJECT_ROOT/.frontend-dev.log"

print_success "Development environment stopped"

echo ""
echo -e "${GREEN}✓ All development services have been stopped${NC}"
echo ""
echo -e "${BLUE}To restart development:${NC}"
echo "  ./launch-dev.sh                    # Start everything"
echo "  ./launch-dev.sh --background       # Start in background"
echo ""
echo -e "${BLUE}To reset databases:${NC}"
echo "  docker compose -f docker-compose.dev.yml down -v"
echo ""