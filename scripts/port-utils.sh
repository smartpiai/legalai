#!/bin/bash

# Port Management Utilities
# Legal AI Platform - Shared functions for port handling

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# All service keys
ALL_SERVICE_KEYS="POSTGRES_PORT REDIS_PORT NEO4J_PORT NEO4J_HTTP_PORT QDRANT_PORT QDRANT_GRPC_PORT MINIO_PORT MINIO_CONSOLE_PORT CLAMAV_PORT BACKEND_PORT FRONTEND_PORT"

# Port range definitions (safe ranges to avoid system ports)
DEFAULT_PORT_POSTGRES_PORT=5432
DEFAULT_PORT_REDIS_PORT=6379
DEFAULT_PORT_NEO4J_PORT=7687
DEFAULT_PORT_NEO4J_HTTP_PORT=7474
DEFAULT_PORT_QDRANT_PORT=6333
DEFAULT_PORT_QDRANT_GRPC_PORT=6334
DEFAULT_PORT_MINIO_PORT=9000
DEFAULT_PORT_MINIO_CONSOLE_PORT=9001
DEFAULT_PORT_CLAMAV_PORT=3310
DEFAULT_PORT_BACKEND_PORT=8000
DEFAULT_PORT_FRONTEND_PORT=3000

# Alternative port ranges when defaults are taken
ALT_RANGE_POSTGRES_PORT="15432:15532"
ALT_RANGE_REDIS_PORT="16379:16479"
ALT_RANGE_NEO4J_PORT="17687:17787"
ALT_RANGE_NEO4J_HTTP_PORT="17474:17574"
ALT_RANGE_QDRANT_PORT="16333:16433"
ALT_RANGE_QDRANT_GRPC_PORT="16334:16434"
ALT_RANGE_MINIO_PORT="19000:19100"
ALT_RANGE_MINIO_CONSOLE_PORT="19001:19101"
ALT_RANGE_CLAMAV_PORT="13310:13410"
ALT_RANGE_BACKEND_PORT="18000:18100"
ALT_RANGE_FRONTEND_PORT="13000:13100"

# Service display names
SERVICE_NAME_POSTGRES_PORT="PostgreSQL"
SERVICE_NAME_REDIS_PORT="Redis"
SERVICE_NAME_NEO4J_PORT="Neo4j Bolt"
SERVICE_NAME_NEO4J_HTTP_PORT="Neo4j HTTP"
SERVICE_NAME_QDRANT_PORT="Qdrant API"
SERVICE_NAME_QDRANT_GRPC_PORT="Qdrant gRPC"
SERVICE_NAME_MINIO_PORT="MinIO API"
SERVICE_NAME_MINIO_CONSOLE_PORT="MinIO Console"
SERVICE_NAME_CLAMAV_PORT="ClamAV"
SERVICE_NAME_BACKEND_PORT="Backend API"
SERVICE_NAME_FRONTEND_PORT="Frontend"

# Helper to get default port for a service key
get_default_port() {
    eval echo "\$DEFAULT_PORT_$1"
}

# Helper to get alt range for a service key
get_alt_range() {
    eval echo "\$ALT_RANGE_$1"
}

# Helper to get service name for a service key
get_service_name() {
    eval echo "\$SERVICE_NAME_$1"
}

# Function to check if a port is available
is_port_available() {
    local port=$1
    local check_type=${2:-"all"}  # all, tcp, udp
    
    # Check if port is a valid number
    if ! [[ "$port" =~ ^[0-9]+$ ]]; then
        return 1
    fi
    
    # Check if port is in valid range (1-65535)
    if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        return 1
    fi
    
    # Check TCP port
    if [ "$check_type" = "all" ] || [ "$check_type" = "tcp" ]; then
        # Check with netstat if available
        if command -v netstat >/dev/null 2>&1; then
            if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                return 1
            fi
        fi
        
        # Check with ss if available
        if command -v ss >/dev/null 2>&1; then
            if ss -tuln 2>/dev/null | grep -q ":$port "; then
                return 1
            fi
        fi
        
        # Check with lsof if available
        if command -v lsof >/dev/null 2>&1; then
            if lsof -i :$port 2>/dev/null | grep -q LISTEN; then
                return 1
            fi
        fi
        
        # Try to bind to the port as a final check
        if command -v nc >/dev/null 2>&1; then
            nc -z localhost $port 2>/dev/null && return 1
        fi
    fi
    
    return 0
}

# Function to find next available port in a range
find_available_port() {
    local start_port=$1
    local end_port=$2
    local current_port=$start_port
    
    while [ $current_port -le $end_port ]; do
        if is_port_available $current_port; then
            echo $current_port
            return 0
        fi
        current_port=$((current_port + 1))
    done
    
    return 1
}

# Function to get a random available port in a range
get_random_port() {
    local start_port=$1
    local end_port=$2
    local max_attempts=100
    local attempts=0
    
    while [ $attempts -lt $max_attempts ]; do
        local port=$((RANDOM % ($end_port - $start_port + 1) + $start_port))
        if is_port_available $port; then
            echo $port
            return 0
        fi
        attempts=$((attempts + 1))
    done
    
    # Fall back to sequential search
    find_available_port $start_port $end_port
}

# Function to get alternative port for a service
get_alternative_port() {
    local service_key=$1
    local range="$(get_alt_range "$service_key")"
    
    if [ -z "$range" ]; then
        # No alternative range defined, use generic high port
        range="20000:30000"
    fi
    
    local start_port=$(echo $range | cut -d: -f1)
    local end_port=$(echo $range | cut -d: -f2)
    
    # Try to find a port close to the start of the range first
    local port=$(find_available_port $start_port $((start_port + 10)))
    if [ $? -eq 0 ]; then
        echo $port
        return 0
    fi
    
    # If not found, get a random port in the range
    get_random_port $start_port $end_port
}

# Function to check all default ports
check_all_ports() {
    local all_available=true
    local port_status=()
    local env_file=${1:-".env"}
    
    echo -e "${BLUE}Checking port availability...${NC}"
    echo ""

    for service_key in $ALL_SERVICE_KEYS; do
        # Try to get port from env file first, then fall back to default
        local port=$(grep "^$service_key=" "$env_file" 2>/dev/null | cut -d= -f2)
        if [ -z "$port" ]; then
            port="$(get_default_port "$service_key")"
        fi

        local service_name="$(get_service_name "$service_key")"
        
        if is_port_available $port; then
            port_status+=("${GREEN}✓${NC} $service_name (port $port): Available")
        else
            port_status+=("${RED}✗${NC} $service_name (port $port): In use")
            all_available=false
        fi
    done
    
    # Display status (without sorting to maintain order)
    for status in "${port_status[@]}"; do
        echo -e "$status"
    done
    echo ""
    
    if [ "$all_available" = true ]; then
        echo -e "${GREEN}All ports are available!${NC}"
        return 0
    else
        echo -e "${YELLOW}Some ports are already in use.${NC}"
        return 1
    fi
}

# Function to get process using a port
get_port_process() {
    local port=$1
    
    if command -v lsof >/dev/null 2>&1; then
        local process=$(lsof -i :$port 2>/dev/null | grep LISTEN | awk '{print $1" (PID: "$2")"}' | head -1)
        if [ -n "$process" ]; then
            echo "$process"
            return 0
        fi
    fi
    
    if command -v ss >/dev/null 2>&1; then
        local process=$(ss -tulpn 2>/dev/null | grep ":$port " | awk '{print $NF}' | sed 's/.*users:(("\([^"]*\)".*/\1/' | head -1)
        if [ -n "$process" ]; then
            echo "$process"
            return 0
        fi
    fi
    
    echo "Unknown process"
}

# Function to display port configuration table
display_port_table() {
    local env_file=${1:-".env"}
    
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              Current Port Configuration                      ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
    
    printf "${CYAN}║${NC} %-20s │ %-10s │ %-10s │ %-10s ${CYAN}║${NC}\n" "Service" "Port" "Status" "Process"
    echo -e "${CYAN}╟──────────────────────┼────────────┼────────────┼────────────╢${NC}"
    
    for service_key in $ALL_SERVICE_KEYS; do
        local service_name="$(get_service_name "$service_key")"
        local port=$(grep "^$service_key=" "$env_file" 2>/dev/null | cut -d= -f2)

        if [ -z "$port" ]; then
            port="$(get_default_port "$service_key")"
        fi
        
        local status_symbol
        local status_color
        local process=""
        
        if is_port_available $port; then
            status_symbol="✓ Free"
            status_color="${GREEN}"
        else
            status_symbol="✗ Used"
            status_color="${RED}"
            process=$(get_port_process $port | cut -c1-10)
        fi
        
        printf "${CYAN}║${NC} %-20s │ %-10s │ ${status_color}%-10s${NC} │ %-10s ${CYAN}║${NC}\n" \
            "$service_name" "$port" "$status_symbol" "$process"
    done
    
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
}

# Function to backup .env file
backup_env_file() {
    local env_file=${1:-".env"}
    local backup_file="${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "$env_file" ]; then
        cp "$env_file" "$backup_file"
        echo -e "${GREEN}Backed up $env_file to $backup_file${NC}"
        return 0
    else
        echo -e "${YELLOW}No $env_file file to backup${NC}"
        return 1
    fi
}

# Function to update port in .env file
update_env_port() {
    local env_file=$1
    local port_key=$2
    local new_port=$3
    
    if grep -q "^$port_key=" "$env_file"; then
        # Update existing entry
        # Use # as a delimiter to handle slashes in the value
        sed -i.tmp "s#^$port_key=.*#$port_key=$new_port#" "$env_file"
        rm -f "${env_file}.tmp"
    else
        # Add new entry
        echo "$port_key=$new_port" >> "$env_file"
    fi
}

# Function to reset to default ports
reset_to_defaults() {
    local env_file=${1:-".env"}
    
    echo -e "${YELLOW}Resetting to default ports...${NC}"
    
    for service_key in $ALL_SERVICE_KEYS; do
        local default_port="$(get_default_port "$service_key")"
        update_env_port "$env_file" "$service_key" "$default_port"
    done
    
    echo -e "${GREEN}Reset complete. All ports set to defaults.${NC}"
}

# Note: Functions will be available when this script is sourced
# No need to export them as that's not portable across all shells
