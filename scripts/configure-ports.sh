#!/bin/bash

# Port Configuration Script
# Legal AI Platform - Automatic port conflict resolution

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source port utilities
source "$SCRIPT_DIR/port-utils.sh"

# Configuration
ENV_FILE="$PROJECT_ROOT/.env"
AUTO_MODE=false
FORCE_MODE=false
RESET_MODE=false
INTERACTIVE_MODE=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto|-a)
            AUTO_MODE=true
            INTERACTIVE_MODE=false
            shift
            ;;
        --force|-f)
            FORCE_MODE=true
            INTERACTIVE_MODE=false
            shift
            ;;
        --reset|-r)
            RESET_MODE=true
            INTERACTIVE_MODE=false
            shift
            ;;
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --auto, -a       Automatically assign free ports for conflicts"
            echo "  --force, -f      Force use of default ports (exit if conflicts)"
            echo "  --reset, -r      Reset all ports to defaults"
            echo "  --env FILE       Specify custom .env file (default: .env)"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0               Interactive mode (default)"
            echo "  $0 --auto        Auto-resolve port conflicts"
            echo "  $0 --reset       Reset to default ports"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Function to print header
print_header() {
    echo ""
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}          Legal AI Platform - Port Configuration Tool           ${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Function to check for duplicate port assignments
check_duplicate_ports() {
    local env_file=${1:-"$ENV_FILE"}
    local duplicates_found=false
    declare -A port_services
    
    # Build a map of ports to services
    for service_key in POSTGRES_PORT REDIS_PORT NEO4J_PORT NEO4J_HTTP_PORT QDRANT_PORT QDRANT_GRPC_PORT MINIO_PORT MINIO_CONSOLE_PORT CLAMAV_PORT BACKEND_PORT FRONTEND_PORT; do
        local port=$(grep "^$service_key=" "$env_file" 2>/dev/null | cut -d= -f2)
        
        if [ -z "$port" ]; then
            port="${DEFAULT_PORTS[$service_key]}"
        fi
        
        if [ -n "${port_services[$port]}" ]; then
            # Duplicate found
            if [ "$duplicates_found" = false ]; then
                echo -e "${YELLOW}⚠ Duplicate port assignments detected:${NC}"
                duplicates_found=true
            fi
            echo -e "  ${RED}Port $port is assigned to both ${SERVICE_NAMES[$service_key]} and ${port_services[$port]}${NC}"
        else
            port_services[$port]="${SERVICE_NAMES[$service_key]}"
        fi
    done
    
    if [ "$duplicates_found" = true ]; then
        return 1
    else
        return 0
    fi
}

# Function to fix duplicate ports automatically
fix_duplicate_ports() {
    local env_file=${1:-"$ENV_FILE"}
    declare -A used_ports
    local changes_made=false
    
    echo -e "${BLUE}Fixing duplicate port assignments...${NC}"
    
    for service_key in POSTGRES_PORT REDIS_PORT NEO4J_PORT NEO4J_HTTP_PORT QDRANT_PORT QDRANT_GRPC_PORT MINIO_PORT MINIO_CONSOLE_PORT CLAMAV_PORT BACKEND_PORT FRONTEND_PORT; do
        local port=$(grep "^$service_key=" "$env_file" 2>/dev/null | cut -d= -f2)
        
        if [ -z "$port" ]; then
            port="${DEFAULT_PORTS[$service_key]}"
        fi
        
        # Check if this port is already used by another service
        if [ -n "${used_ports[$port]}" ]; then
            # Port is duplicate, find a new one
            local new_port=$(get_alternative_port "$service_key")
            
            # Make sure the new port isn't already in our used list
            while [ -n "${used_ports[$new_port]}" ]; do
                new_port=$((new_port + 1))
            done
            
            echo -e "  ${YELLOW}${SERVICE_NAMES[$service_key]}: $port → $new_port (was duplicate)${NC}"
            update_env_port "$env_file" "$service_key" "$new_port"
            used_ports[$new_port]="$service_key"
            changes_made=true
        else
            used_ports[$port]="$service_key"
        fi
    done
    
    if [ "$changes_made" = true ]; then
        echo -e "${GREEN}✓ Duplicate ports have been resolved${NC}"
    fi
    
    return 0
}

# Function to configure ports automatically
configure_ports_auto() {
    echo -e "${BLUE}Running automatic port configuration...${NC}"
    echo ""
    
    # First check for duplicate ports within our own configuration
    if ! check_duplicate_ports; then
        echo ""
        fix_duplicate_ports
        echo ""
    fi
    
    local changes_made=false
    local port_assignments=()
    
    # Check each service port
    for service_key in POSTGRES_PORT REDIS_PORT NEO4J_PORT NEO4J_HTTP_PORT QDRANT_PORT QDRANT_GRPC_PORT MINIO_PORT MINIO_CONSOLE_PORT CLAMAV_PORT BACKEND_PORT FRONTEND_PORT; do
        local service_name="${SERVICE_NAMES[$service_key]}"
        local current_port=$(grep "^$service_key=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
        
        # Use default if not set
        if [ -z "$current_port" ]; then
            current_port="${DEFAULT_PORTS[$service_key]}"
        fi
        
        # Check if port is available
        if is_port_available $current_port; then
            port_assignments+=("${GREEN}✓${NC} $service_name: $current_port (available)")
            # Ensure it's in the env file
            update_env_port "$ENV_FILE" "$service_key" "$current_port"
            # No need to update connection strings if port hasn't changed
        else
            # Port is in use, find alternative
            local process=$(get_port_process $current_port)
            echo -e "${YELLOW}⚠ Port $current_port for $service_name is in use by: $process${NC}"
            
            local new_port=$(get_alternative_port "$service_key")
            if [ -n "$new_port" ]; then
                echo -e "${GREEN}  → Found alternative port: $new_port${NC}"
                update_env_port "$ENV_FILE" "$service_key" "$new_port"
                
                # Note: Connection strings use internal Docker ports, not host ports
                # So we don't need to update DATABASE_URL, REDIS_URL, etc.
                # They always use the standard ports inside the Docker network
                
                port_assignments+=("${GREEN}✓${NC} $service_name: $current_port → $new_port (reassigned)")
                changes_made=true
            else
                echo -e "${RED}  ✗ Could not find available port for $service_name${NC}"
                port_assignments+=("${RED}✗${NC} $service_name: No available port found")
            fi
        fi
    done
    
    echo ""
    echo -e "${CYAN}Port Assignment Summary:${NC}"
    echo -e "${CYAN}────────────────────────${NC}"
    for assignment in "${port_assignments[@]}"; do
        echo -e "  $assignment"
    done
    
    if [ "$changes_made" = true ]; then
        echo ""
        echo -e "${GREEN}✓ Port configuration updated successfully!${NC}"
        echo -e "${YELLOW}Note: The .env file has been updated with new port assignments.${NC}"
    else
        echo ""
        echo -e "${GREEN}✓ All ports are available. No changes needed.${NC}"
    fi
}

# Function to configure ports interactively
configure_ports_interactive() {
    echo -e "${BLUE}Interactive port configuration${NC}"
    echo ""
    
    # First, check current status
    check_all_ports
    
    local conflicts_found=false
    local port_conflicts=()
    
    # Identify conflicts
    for service_key in POSTGRES_PORT REDIS_PORT NEO4J_PORT NEO4J_HTTP_PORT QDRANT_PORT QDRANT_GRPC_PORT MINIO_PORT MINIO_CONSOLE_PORT CLAMAV_PORT BACKEND_PORT FRONTEND_PORT; do
        local service_name="${SERVICE_NAMES[$service_key]}"
        local current_port=$(grep "^$service_key=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
        
        if [ -z "$current_port" ]; then
            current_port="${DEFAULT_PORTS[$service_key]}"
        fi
        
        if ! is_port_available $current_port; then
            conflicts_found=true
            port_conflicts+=("$service_key:$current_port:$service_name")
        fi
    done
    
    if [ "$conflicts_found" = false ]; then
        echo -e "${GREEN}No port conflicts detected!${NC}"
        echo ""
        read -p "Would you like to view the current configuration? (y/n): " view_config
        if [[ "$view_config" =~ ^[Yy]$ ]]; then
            display_port_table "$ENV_FILE"
        fi
        return 0
    fi
    
    echo -e "${YELLOW}Port conflicts detected. Choose an action:${NC}"
    echo "  1) Automatically resolve conflicts"
    echo "  2) Manually specify ports for conflicts"
    echo "  3) Force use anyway (not recommended)"
    echo "  4) Exit without changes"
    echo ""
    read -p "Enter choice (1-4): " choice
    
    case $choice in
        1)
            configure_ports_auto
            ;;
        2)
            echo ""
            echo -e "${BLUE}Manual port configuration${NC}"
            for conflict in "${port_conflicts[@]}"; do
                IFS=':' read -r service_key current_port service_name <<< "$conflict"
                local process=$(get_port_process $current_port)
                
                echo ""
                echo -e "${YELLOW}$service_name (port $current_port) is in use by: $process${NC}"
                
                while true; do
                    read -p "Enter new port for $service_name (or press Enter for auto): " new_port
                    
                    if [ -z "$new_port" ]; then
                        new_port=$(get_alternative_port "$service_key")
                        echo -e "${GREEN}Auto-selected port: $new_port${NC}"
                    fi
                    
                    if [[ "$new_port" =~ ^[0-9]+$ ]] && [ "$new_port" -ge 1 ] && [ "$new_port" -le 65535 ]; then
                        if is_port_available $new_port; then
                            update_env_port "$ENV_FILE" "$service_key" "$new_port"
                            echo -e "${GREEN}✓ $service_name updated to port $new_port${NC}"
                            break
                        else
                            echo -e "${RED}Port $new_port is already in use. Please try another.${NC}"
                        fi
                    else
                        echo -e "${RED}Invalid port number. Please enter a number between 1 and 65535.${NC}"
                    fi
                done
            done
            echo ""
            echo -e "${GREEN}✓ Manual configuration complete!${NC}"
            ;;
        3)
            echo -e "${YELLOW}⚠ Warning: Forcing use of conflicting ports may cause startup failures.${NC}"
            ;;
        4)
            echo -e "${BLUE}Exiting without changes.${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Exiting.${NC}"
            exit 1
            ;;
    esac
}

# Function to force default ports
configure_ports_force() {
    echo -e "${YELLOW}Checking if default ports can be used...${NC}"
    echo ""
    
    local all_available=true
    
    # Check all default ports
    for service_key in "${!DEFAULT_PORTS[@]}"; do
        local port="${DEFAULT_PORTS[$service_key]}"
        local service_name="${SERVICE_NAMES[$service_key]}"
        
        if ! is_port_available $port; then
            local process=$(get_port_process $port)
            echo -e "${RED}✗ $service_name (port $port) is in use by: $process${NC}"
            all_available=false
        else
            echo -e "${GREEN}✓ $service_name (port $port) is available${NC}"
        fi
    done
    
    if [ "$all_available" = false ]; then
        echo ""
        echo -e "${RED}Cannot force default ports - conflicts detected!${NC}"
        echo -e "${YELLOW}Use --auto to automatically resolve conflicts.${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}All default ports are available!${NC}"
    
    # Ensure all defaults are in the env file
    for service_key in "${!DEFAULT_PORTS[@]}"; do
        update_env_port "$ENV_FILE" "$service_key" "${DEFAULT_PORTS[$service_key]}"
    done
}

# Main execution
main() {
    print_header
    
    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}No .env file found at $ENV_FILE${NC}"
        echo -e "${BLUE}Creating new .env file with default ports...${NC}"
        touch "$ENV_FILE"
        reset_to_defaults "$ENV_FILE"
    else
        # Backup existing env file
        backup_env_file "$ENV_FILE"
    fi
    
    # Handle different modes
    if [ "$RESET_MODE" = true ]; then
        reset_to_defaults "$ENV_FILE"
        echo ""
        display_port_table "$ENV_FILE"
    elif [ "$FORCE_MODE" = true ]; then
        configure_ports_force
    elif [ "$AUTO_MODE" = true ]; then
        configure_ports_auto
        echo ""
        display_port_table "$ENV_FILE"
    else
        configure_ports_interactive
        echo ""
        display_port_table "$ENV_FILE"
    fi
    
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "  • Start services: ./scripts/start-dev.sh"
    echo "  • Check ports:    ./scripts/check-ports.sh"
    echo "  • View logs:      docker compose logs -f [service]"
    echo ""
}

# Run main function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi