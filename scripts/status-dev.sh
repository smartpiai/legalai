#!/bin/bash

# Development Status Script
# Shows status of all development services

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "\n${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}\n"
}

check_service() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    if curl -f -s "$url" >/dev/null 2>&1; then
        echo -e "  • $name: ${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "  • $name: ${RED}✗ Not responding${NC}"
        return 1
    fi
}

check_port() {
    local name=$1
    local port=$2
    
    if nc -z localhost "$port" 2>/dev/null; then
        echo -e "  • $name: ${GREEN}✓ Port $port open${NC}"
        return 0
    else
        echo -e "  • $name: ${RED}✗ Port $port closed${NC}"
        return 1
    fi
}

# Load environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

print_header "Development Environment Status"

echo -e "${CYAN}🌐 Frontend Status:${NC}"
check_service "Vite Dev Server" "http://localhost:3000"
check_service "Frontend Health" "http://localhost:3000"

echo ""
echo -e "${CYAN}🚀 Backend Status:${NC}"
check_service "FastAPI Server" "http://localhost:8000"
check_service "API Health" "http://localhost:8000/api/v1/health/ready"
check_service "API Docs" "http://localhost:8000/docs"

echo ""
echo -e "${CYAN}🗄️  Database Status:${NC}"
check_port "PostgreSQL" "${POSTGRES_PORT:-15432}"
check_port "Redis" "${REDIS_PORT:-16379}"
check_port "Neo4j HTTP" "${NEO4J_HTTP_PORT:-17474}"
check_port "Neo4j Bolt" "${NEO4J_PORT:-17687}"
check_port "Qdrant" "${QDRANT_PORT:-16333}"
check_port "MinIO API" "${MINIO_PORT:-19000}"
check_port "MinIO Console" "${MINIO_CONSOLE_PORT:-19001}"

echo ""
echo -e "${CYAN}📊 Process Status:${NC}"

# Check backend process
if [ -f "$PROJECT_ROOT/.backend-dev.pid" ] && kill -0 "$(cat "$PROJECT_ROOT/.backend-dev.pid")" 2>/dev/null; then
    echo -e "  • Backend Process: ${GREEN}✓ Running (PID: $(cat "$PROJECT_ROOT/.backend-dev.pid"))${NC}"
else
    echo -e "  • Backend Process: ${RED}✗ Not running${NC}"
fi

# Check frontend process
if [ -f "$PROJECT_ROOT/.frontend-dev.pid" ] && kill -0 "$(cat "$PROJECT_ROOT/.frontend-dev.pid")" 2>/dev/null; then
    echo -e "  • Frontend Process: ${GREEN}✓ Running (PID: $(cat "$PROJECT_ROOT/.frontend-dev.pid"))${NC}"
else
    echo -e "  • Frontend Process: ${RED}✗ Not running${NC}"
fi

# Check Docker containers
echo ""
echo -e "${CYAN}🐳 Database Containers:${NC}"
if docker compose -f "$PROJECT_ROOT/docker-compose.dev.yml" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null; then
    echo ""
else
    echo -e "  ${RED}✗ No database containers running${NC}"
    echo "  Start with: docker compose -f docker-compose.dev.yml up -d"
fi

echo ""
echo -e "${CYAN}🛠️  Quick Actions:${NC}"
echo "  • View logs:       ./scripts/logs-dev.sh [service]"
echo "  • Stop all:        ./scripts/stop-dev.sh"
echo "  • Reset dev:       ./scripts/reset-dev.sh"
echo "  • Restart:         ./launch-dev.sh"
echo ""