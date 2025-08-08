#!/bin/bash

# Port Checker Script
# Legal AI Platform - Standalone port availability checker

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source port utilities
source "$SCRIPT_DIR/port-utils.sh"

# Configuration
ENV_FILE="$PROJECT_ROOT/.env"
VERBOSE=false
SHOW_PROCESSES=false
CHECK_SPECIFIC=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --processes|-p)
            SHOW_PROCESSES=true
            shift
            ;;
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --port)
            CHECK_SPECIFIC="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verbose, -v      Show detailed port information"
            echo "  --processes, -p    Show processes using ports"
            echo "  --env FILE         Specify custom .env file"
            echo "  --port PORT        Check a specific port"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                 Check all configured ports"
            echo "  $0 --verbose       Show detailed information"
            echo "  $0 --port 8080     Check if port 8080 is available"
            echo "  $0 --processes     Show which processes are using ports"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Function to check specific port
check_specific_port() {
    local port=$1
    
    echo -e "${BLUE}Checking port $port...${NC}"
    echo ""
    
    if is_port_available $port; then
        echo -e "${GREEN}✓ Port $port is available${NC}"
        return 0
    else
        echo -e "${RED}✗ Port $port is in use${NC}"
        
        if [ "$SHOW_PROCESSES" = true ] || [ "$VERBOSE" = true ]; then
            local process=$(get_port_process $port)
            echo -e "  Process: $process"
        fi
        
        if [ "$VERBOSE" = true ]; then
            echo ""
            echo "Detailed information:"
            if command -v lsof >/dev/null 2>&1; then
                echo "  Using lsof:"
                lsof -i :$port 2>/dev/null | head -5 || echo "    No details available"
            fi
            
            if command -v ss >/dev/null 2>&1; then
                echo "  Using ss:"
                ss -tulpn 2>/dev/null | grep ":$port " | head -5 || echo "    No details available"
            fi
        fi
        
        return 1
    fi
}

# Function to display comprehensive port report
display_port_report() {
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}           Legal AI Platform - Port Status Report               ${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}Timestamp: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${CYAN}Environment file: $ENV_FILE${NC}"
    echo ""
    
    # Check if env file exists
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}Warning: Environment file not found at $ENV_FILE${NC}"
        echo -e "${YELLOW}Using default port configuration${NC}"
        echo ""
    fi
    
    # Display port table
    display_port_table "$ENV_FILE"
    
    echo ""
    
    # Summary statistics
    local total_ports=0
    local available_ports=0
    local used_ports=0
    
    for service_key in "${!DEFAULT_PORTS[@]}"; do
        local port=$(grep "^$service_key=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
        if [ -z "$port" ]; then
            port="${DEFAULT_PORTS[$service_key]}"
        fi
        
        total_ports=$((total_ports + 1))
        
        if is_port_available $port; then
            available_ports=$((available_ports + 1))
        else
            used_ports=$((used_ports + 1))
        fi
    done
    
    echo -e "${CYAN}Port Statistics:${NC}"
    echo -e "  Total services:    $total_ports"
    echo -e "  Available ports:   ${GREEN}$available_ports${NC}"
    echo -e "  Ports in use:      ${RED}$used_ports${NC}"
    
    # Recommendations
    if [ $used_ports -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}Recommendations:${NC}"
        echo "  • Run './scripts/configure-ports.sh --auto' to resolve conflicts"
        echo "  • Or use './scripts/start-dev.sh --auto-ports' to auto-resolve on start"
    else
        echo ""
        echo -e "${GREEN}✓ All ports are available. Ready to start services!${NC}"
    fi
    
    # Show running Docker containers if verbose
    if [ "$VERBOSE" = true ]; then
        echo ""
        echo -e "${CYAN}Docker Container Status:${NC}"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  No containers running"
    fi
}

# Function to check system port usage
check_system_ports() {
    echo -e "${CYAN}System Port Usage Summary:${NC}"
    echo ""
    
    # Count total listening ports
    local total_listening=0
    if command -v ss >/dev/null 2>&1; then
        total_listening=$(ss -tuln | grep LISTEN | wc -l)
    elif command -v netstat >/dev/null 2>&1; then
        total_listening=$(netstat -tuln | grep LISTEN | wc -l)
    fi
    
    echo "  Total listening ports on system: $total_listening"
    
    if [ "$VERBOSE" = true ]; then
        echo ""
        echo "  Top 10 ports in use:"
        if command -v ss >/dev/null 2>&1; then
            ss -tuln | grep LISTEN | awk '{print $5}' | sed 's/.*://' | sort -n | uniq -c | sort -rn | head -10 | while read count port; do
                printf "    Port %-6s : %s connections\n" "$port" "$count"
            done
        fi
    fi
}

# Main execution
main() {
    # Check if specific port was requested
    if [ -n "$CHECK_SPECIFIC" ]; then
        check_specific_port "$CHECK_SPECIFIC"
        exit $?
    fi
    
    # Display comprehensive report
    display_port_report
    
    if [ "$VERBOSE" = true ]; then
        echo ""
        check_system_ports
    fi
    
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo "  • Configure ports:  ./scripts/configure-ports.sh"
    echo "  • Start services:   ./scripts/start-dev.sh"
    echo "  • Check specific:   ./scripts/check-ports.sh --port <PORT>"
    echo ""
}

# Run main function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi