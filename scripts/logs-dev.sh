#!/bin/bash

# Development Logs Script
# Shows logs from all development services

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

show_usage() {
    echo "Usage: $0 [SERVICE|all]"
    echo ""
    echo "Services:"
    echo "  backend      Show backend development logs"
    echo "  frontend     Show frontend development logs"
    echo "  postgres     Show PostgreSQL container logs"
    echo "  redis        Show Redis container logs"
    echo "  neo4j        Show Neo4j container logs"
    echo "  qdrant       Show Qdrant container logs"
    echo "  minio        Show MinIO container logs"
    echo "  all          Show all logs (default)"
    echo ""
    echo "Examples:"
    echo "  $0                # Show all logs"
    echo "  $0 backend        # Show only backend logs"
    echo "  $0 postgres       # Show only PostgreSQL logs"
}

case "${1:-all}" in
    backend)
        echo -e "${GREEN}📊 Backend Development Logs:${NC}"
        if [ -f "$PROJECT_ROOT/.backend-dev.log" ]; then
            tail -f "$PROJECT_ROOT/.backend-dev.log"
        else
            echo "Backend log file not found. Is the backend running?"
            echo "Start with: ./scripts/backend-dev.sh"
        fi
        ;;
    frontend)
        echo -e "${BLUE}🌐 Frontend Development Logs:${NC}"
        if [ -f "$PROJECT_ROOT/.frontend-dev.log" ]; then
            tail -f "$PROJECT_ROOT/.frontend-dev.log"
        else
            echo "Frontend log file not found. Is the frontend running?"
            echo "Start with: ./scripts/frontend-dev.sh"
        fi
        ;;
    postgres|redis|neo4j|qdrant|minio|clamav)
        echo -e "${PURPLE}🗄️  Database Logs ($1):${NC}"
        docker compose -f "$PROJECT_ROOT/docker-compose.dev.yml" logs -f "$1"
        ;;
    all)
        echo -e "${YELLOW}📋 All Development Logs:${NC}"
        echo "Press Ctrl+C to stop log monitoring"
        echo ""
        
        # Show backend logs if available
        if [ -f "$PROJECT_ROOT/.backend-dev.log" ]; then
            echo -e "${GREEN}📊 Backend (last 10 lines):${NC}"
            tail -10 "$PROJECT_ROOT/.backend-dev.log"
            echo ""
        fi
        
        # Show frontend logs if available  
        if [ -f "$PROJECT_ROOT/.frontend-dev.log" ]; then
            echo -e "${BLUE}🌐 Frontend (last 10 lines):${NC}"
            tail -10 "$PROJECT_ROOT/.frontend-dev.log"
            echo ""
        fi
        
        # Show database logs
        echo -e "${PURPLE}🗄️  Database Services:${NC}"
        docker compose -f "$PROJECT_ROOT/docker-compose.dev.yml" logs --tail=5 postgres redis neo4j qdrant minio
        ;;
    --help|-h)
        show_usage
        ;;
    *)
        echo "Unknown service: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac