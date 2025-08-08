#!/bin/bash

# Quick Start Script
# Legal AI Platform - Simple startup for testing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✗ $1"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo ""
echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}           Legal AI Platform - Quick Start                      ${NC}"
echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Load environment
if [ -f ".env" ]; then
    source .env
    print_success "Environment loaded"
else
    print_error ".env file not found"
    exit 1
fi

# Start critical database services only
print_status "Starting critical database services..."
docker compose up -d postgres redis neo4j minio

print_status "Waiting for services to be ready (30s)..."
sleep 30

# Check status
print_status "Checking service status..."
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Service}}"

echo ""

# Get public IP
get_public_ip() {
    local public_ip=""
    
    if command -v ip >/dev/null 2>&1; then
        public_ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
    fi
    
    if [ -z "$public_ip" ] && command -v hostname >/dev/null 2>&1; then
        public_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    if [ -z "$public_ip" ]; then
        public_ip="localhost"
    fi
    
    echo "$public_ip"
}

PUBLIC_IP=$(get_public_ip)

echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                   SERVICES RUNNING                             ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Database Access:${NC}"
echo "  • PostgreSQL:  ${PUBLIC_IP}:${POSTGRES_PORT:-15432}"
echo "  • Redis:       ${PUBLIC_IP}:${REDIS_PORT:-16379}"
echo "  • Neo4j:       http://${PUBLIC_IP}:${NEO4J_HTTP_PORT:-17474}"
echo "  • MinIO:       http://${PUBLIC_IP}:${MINIO_CONSOLE_PORT:-9001}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  • Build backend:   docker compose build backend"
echo "  • Start backend:   docker compose up -d backend"
echo "  • Build frontend:  docker compose build frontend"
echo "  • Start frontend:  docker compose up -d frontend"
echo "  • Full startup:    ./scripts/start-dev.sh"
echo "  • Stop all:        docker compose down"
echo ""