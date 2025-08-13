#!/bin/bash

# Service Health Check Script for Legal AI Platform
# Verifies all services are running correctly

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

print_header() {
    echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Service Health Check${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"
}

check_service() {
    local service_name=$1
    local check_command=$2
    
    echo -n "Checking $service_name... "
    
    if eval "$check_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Not Available${NC}"
        return 1
    fi
}

check_docker_service() {
    local service_name=$1
    local container_name=$2
    
    echo -n "Checking $service_name... "
    
    if [ -z "$(command -v docker)" ]; then
        echo -e "${RED}✗ Docker not installed${NC}"
        return 1
    fi
    
    # Check if container exists and is running
    local status=$(docker ps --filter "name=$container_name" --format "{{.Status}}" 2>/dev/null | head -1)
    
    if [ -z "$status" ]; then
        echo -e "${RED}✗ Not Running${NC}"
        return 1
    elif [[ "$status" == *"healthy"* ]]; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    elif [[ "$status" == *"Up"* ]]; then
        echo -e "${YELLOW}⚠ Running (health unknown)${NC}"
        return 0
    else
        echo -e "${RED}✗ Unhealthy${NC}"
        return 1
    fi
}

main() {
    print_header
    
    # Load machine IP if available
    local machine_ip="localhost"
    if [ -f "$PROJECT_ROOT/.machine_ip" ]; then
        machine_ip=$(cat "$PROJECT_ROOT/.machine_ip")
    fi
    
    echo -e "${BLUE}Machine IP:${NC} $machine_ip"
    echo ""
    
    # Check Docker services
    echo -e "${CYAN}Docker Services:${NC}"
    check_docker_service "PostgreSQL" "legal-ai-postgres"
    check_docker_service "Redis" "legal-ai-redis"
    check_docker_service "Neo4j" "legal-ai-neo4j"
    check_docker_service "Qdrant" "legal-ai-qdrant"
    check_docker_service "MinIO" "legal-ai-minio"
    check_docker_service "ClamAV" "legal-ai-clamav"
    check_docker_service "Backend API" "legal-ai-backend"
    check_docker_service "Celery Worker" "legal-ai-celery"
    check_docker_service "Frontend" "legal-ai-frontend"
    
    echo ""
    echo -e "${CYAN}Service Endpoints:${NC}"
    
    # Check HTTP endpoints
    check_service "Frontend (http://$machine_ip:${FRONTEND_PORT:-3000})" \
        "curl -f -s --max-time 2 http://localhost:${FRONTEND_PORT:-3000}"
    
    check_service "Backend API (http://$machine_ip:${BACKEND_PORT:-8000})" \
        "curl -f -s --max-time 2 http://localhost:${BACKEND_PORT:-8000}/api/v1/health/ready"
    
    check_service "API Docs (http://$machine_ip:${BACKEND_PORT:-8000}/docs)" \
        "curl -f -s --max-time 2 http://localhost:${BACKEND_PORT:-8000}/docs"
    
    echo ""
    echo -e "${CYAN}Database Connections:${NC}"
    
    # Check database ports
    check_service "PostgreSQL Port (${POSTGRES_PORT:-5432})" \
        "nc -zv localhost ${POSTGRES_PORT:-5432}"
    
    check_service "Redis Port (${REDIS_PORT:-6379})" \
        "nc -zv localhost ${REDIS_PORT:-6379}"
    
    check_service "Neo4j Bolt (${NEO4J_PORT:-7687})" \
        "nc -zv localhost ${NEO4J_PORT:-7687}"
    
    check_service "Qdrant Port (${QDRANT_PORT:-6333})" \
        "nc -zv localhost ${QDRANT_PORT:-6333}"
    
    check_service "MinIO Port (${MINIO_PORT:-9000})" \
        "nc -zv localhost ${MINIO_PORT:-9000}"
    
    echo ""
    echo -e "${CYAN}Quick Commands:${NC}"
    echo "  • View logs:       docker compose logs -f [service]"
    echo "  • Restart service: docker compose restart [service]"
    echo "  • Stop all:        docker compose down"
    echo "  • Access app:      http://$machine_ip:${FRONTEND_PORT:-3000}"
    echo "  • Access API docs: http://$machine_ip:${BACKEND_PORT:-8000}/docs"
    echo ""
}

# Run main function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi