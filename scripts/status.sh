#!/bin/bash

# Status Script
# Legal AI Platform - Quick deployment status check

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
NC='\033[0m' # No Color

# Source utilities
source "$SCRIPT_DIR/port-utils.sh"

# Load environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

# Function to get public IP
get_public_ip() {
    local public_ip=""
    
    if command -v ip >/dev/null 2>&1; then
        public_ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
    fi
    
    if [ -z "$public_ip" ] && command -v hostname >/dev/null 2>&1; then
        public_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    if [ -z "$public_ip" ]; then
        public_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    fi
    
    if [ -z "$public_ip" ]; then
        public_ip="localhost"
    fi
    
    echo "$public_ip"
}

# Main status display
echo ""
echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}           Legal AI Platform - Deployment Status                ${NC}"
echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check Docker containers
echo -e "${CYAN}Docker Container Status:${NC}"
echo ""
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Service}}" 2>/dev/null || echo "  No containers found"
echo ""

# Check ports
echo -e "${CYAN}Port Configuration:${NC}"
display_port_table "$PROJECT_ROOT/.env"
echo ""

# Get public IP
PUBLIC_IP=$(get_public_ip)

# Display access URLs
if docker compose ps -q backend 2>/dev/null | xargs -r docker inspect --format='{{.State.Status}}' 2>/dev/null | grep -q running; then
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    APPLICATION ACCESS URLs                     ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}  🌐 Main Application:${NC}"
    echo -e "     ${GREEN}http://${PUBLIC_IP}:${FRONTEND_PORT:-3000}${NC}"
    if [ "$PUBLIC_IP" != "localhost" ]; then
        echo -e "     ${BLUE}http://localhost:${FRONTEND_PORT:-3000}${NC} (local)"
    fi
    echo ""
    echo -e "${CYAN}  📚 API Documentation:${NC}"
    echo -e "     ${GREEN}http://${PUBLIC_IP}:${BACKEND_PORT:-8000}/docs${NC}"
    if [ "$PUBLIC_IP" != "localhost" ]; then
        echo -e "     ${BLUE}http://localhost:${BACKEND_PORT:-8000}/docs${NC} (local)"
    fi
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
else
    echo -e "${YELLOW}Services are not fully running yet.${NC}"
    echo -e "${YELLOW}Use './scripts/start-dev.sh' to start the services.${NC}"
fi

echo ""
echo -e "${CYAN}Quick Commands:${NC}"
echo "  • Start services:  ./scripts/start-dev.sh --auto-ports"
echo "  • Stop services:   ./stop.sh"
echo "  • View logs:       docker compose logs -f [service]"
echo "  • Check ports:     ./scripts/check-ports.sh"
echo ""