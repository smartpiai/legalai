#!/bin/bash

# Master Launch Script for Legal AI Platform
# Handles IP detection, environment configuration, and service orchestration

set -e

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

# Configuration files
ENV_FILE="$PROJECT_ROOT/.env"
ENV_BACKUP="$PROJECT_ROOT/.env.backup.$(date +%Y%m%d_%H%M%S)"

# Command line options
AUTO_PORTS=false
CLEAN_START=false
FORCE_IP=""
SKIP_DOCKER_CHECK=false
VERBOSE=false

# Function to print colored output
print_header() {
    echo -e "\n${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}\n"
}

print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✗ $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ⚠ $1"
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Function to detect machine IP address
detect_machine_ip() {
    local detected_ip=""
    
    print_status "Detecting machine IP address..." >&2
    
    # If IP was forced via command line, use that
    if [ -n "$FORCE_IP" ]; then
        detected_ip="$FORCE_IP"
        print_info "Using forced IP: $detected_ip" >&2
        echo "$detected_ip"
        return 0
    fi
    
    # Method 1: Try hostname -I (most reliable on Linux)
    if command -v hostname >/dev/null 2>&1; then
        detected_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$detected_ip" ] && [ "$detected_ip" != "127.0.0.1" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via hostname: $detected_ip" >&2
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Method 2: Try ip command
    if command -v ip >/dev/null 2>&1; then
        detected_ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
        if [ -n "$detected_ip" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via ip command: $detected_ip" >&2
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Method 3: Try ifconfig
    if command -v ifconfig >/dev/null 2>&1; then
        detected_ip=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
        if [ -n "$detected_ip" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via ifconfig: $detected_ip" >&2
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Method 4: Try to get from default route
    if command -v ip >/dev/null 2>&1; then
        detected_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
        if [ -n "$detected_ip" ] && [ "$detected_ip" != "127.0.0.1" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via route: $detected_ip" >&2
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Method 5: Check for cloud provider metadata services
    # AWS EC2
    if curl -s --max-time 1 http://169.254.169.254/latest/meta-data/local-ipv4 >/dev/null 2>&1; then
        detected_ip=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4 2>/dev/null)
        if [ -n "$detected_ip" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via AWS metadata: $detected_ip" >&2
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # GCP
    if curl -s --max-time 1 -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip >/dev/null 2>&1; then
        detected_ip=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip 2>/dev/null)
        if [ -n "$detected_ip" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via GCP metadata: $detected_ip" >&2
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Azure
    if curl -s --max-time 1 -H "Metadata: true" "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/privateIpAddress?api-version=2021-02-01&format=text" >/dev/null 2>&1; then
        detected_ip=$(curl -s -H "Metadata: true" "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/privateIpAddress?api-version=2021-02-01&format=text" 2>/dev/null)
        if [ -n "$detected_ip" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via Azure metadata: $detected_ip" >&2
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Default to localhost if nothing else works
    print_warning "Could not detect machine IP, defaulting to localhost" >&2
    echo "localhost"
}

# Function to backup .env file
backup_env_file() {
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$ENV_BACKUP"
        print_success "Environment backup created: $ENV_BACKUP"
    fi
}

# Portable in-place sed (GNU vs BSD/macOS)
if sed --version >/dev/null 2>&1; then
    SED_INPLACE=(sed -i)
else
    SED_INPLACE=(sed -i '')
fi

# Function to update environment variables with detected IP
update_env_with_ip() {
    local machine_ip="$1"

    print_status "Updating environment configuration with IP: $machine_ip"
    
    # Backup current .env file
    backup_env_file
    
    # Update CORS origins to include the machine IP
    local current_cors=$(grep "^BACKEND_CORS_ORIGINS=" "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
    if [ -n "$current_cors" ]; then
        # Remove quotes if present
        current_cors=${current_cors#\"}
        current_cors=${current_cors%\"}
        
        # Check if machine IP is already in CORS
        if [[ "$current_cors" != *"$machine_ip"* ]]; then
            # Add machine IP to CORS origins
            local new_cors="$current_cors,http://$machine_ip:3000,http://$machine_ip:8000"
            "${SED_INPLACE[@]}" "s|^BACKEND_CORS_ORIGINS=.*|BACKEND_CORS_ORIGINS=\"$new_cors\"|" "$ENV_FILE"
            print_success "Updated CORS origins with machine IP"
        fi
    fi
    
    # Update API base URL for frontend (if not localhost)
    if [ "$machine_ip" != "localhost" ]; then
        # Update VITE_API_BASE_URL to use the machine IP
        "${SED_INPLACE[@]}" "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=\"http://$machine_ip:8000\"|" "$ENV_FILE"
        print_success "Updated frontend API base URL"
        
        # Update FRONTEND_URL and BACKEND_URL
        "${SED_INPLACE[@]}" "s|^FRONTEND_URL=.*|FRONTEND_URL=\"http://$machine_ip:3000\"|" "$ENV_FILE"
        "${SED_INPLACE[@]}" "s|^BACKEND_URL=.*|BACKEND_URL=\"http://$machine_ip:8000\"|" "$ENV_FILE"
        print_success "Updated frontend and backend URLs"
    fi
    
    # Export the machine IP for use in other scripts
    echo "$machine_ip" > "$PROJECT_ROOT/.machine_ip"
}

# Function to check Docker installation
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        echo ""
        echo "Docker is required to run the Legal AI Platform."
        echo ""
        echo "Would you like to install Docker now? (y/n)"
        read -p "> " install_docker
        
        if [[ "$install_docker" =~ ^[Yy]$ ]]; then
            print_status "Installing Docker..."
            if [ -f "$SCRIPT_DIR/install-docker.sh" ]; then
                bash "$SCRIPT_DIR/install-docker.sh"
                
                # Check if installation was successful
                if command -v docker &> /dev/null; then
                    print_success "Docker installed successfully!"
                    # Apply group changes
                    newgrp docker || true
                else
                    print_error "Docker installation failed. Please install Docker manually."
                    exit 1
                fi
            else
                print_error "Docker installation script not found!"
                echo "Please install Docker manually from: https://docs.docker.com/get-docker/"
                exit 1
            fi
        else
            print_error "Docker is required. Please install Docker and try again."
            echo "Installation guide: https://docs.docker.com/get-docker/"
            exit 1
        fi
    else
        print_success "Docker is installed: $(docker --version)"
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null 2>&1; then
        if ! command -v docker-compose &> /dev/null; then
            print_error "Docker Compose is not installed!"
            echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
            exit 1
        fi
    else
        print_success "Docker Compose is installed"
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null 2>&1; then
        print_warning "Docker daemon is not running"
        print_status "Attempting to start Docker..."
        
        if command -v systemctl &> /dev/null; then
            sudo systemctl start docker 2>/dev/null || true
            sudo systemctl enable docker 2>/dev/null || true
        elif command -v service &> /dev/null; then
            sudo service docker start 2>/dev/null || true
        fi
        
        # Check again
        if ! docker info &> /dev/null 2>&1; then
            print_error "Failed to start Docker daemon"
            echo "Please start Docker manually and run this script again"
            exit 1
        fi
    fi
    
    print_success "Docker is running and ready"
}

# Function to check and configure ports
configure_ports() {
    print_status "Checking port availability..."
    
    if [ "$AUTO_PORTS" = true ]; then
        # Run port configuration in auto mode
        if [ -f "$SCRIPT_DIR/configure-ports.sh" ]; then
            bash "$SCRIPT_DIR/configure-ports.sh" --auto
        else
            print_warning "Port configuration script not found, skipping port checks"
        fi
    else
        # Run port check
        if [ -f "$SCRIPT_DIR/check-ports.sh" ]; then
            if ! bash "$SCRIPT_DIR/check-ports.sh" >/dev/null 2>&1; then
                print_warning "Some ports may be in use"
                echo "Would you like to automatically resolve port conflicts? (y/n)"
                read -p "> " resolve_ports
                
                if [[ "$resolve_ports" =~ ^[Yy]$ ]]; then
                    bash "$SCRIPT_DIR/configure-ports.sh" --auto
                fi
            else
                print_success "All required ports are available"
            fi
        fi
    fi
}

# Function to start services
start_services() {
    print_header "Starting Legal AI Platform Services"
    
    # Load environment variables
    if [ -f "$ENV_FILE" ]; then
        set -a
        source "$ENV_FILE"
        set +a
    else
        print_error "Environment file not found: $ENV_FILE"
        exit 1
    fi
    
    # Use the existing start-dev.sh script for the actual startup
    local start_args=""
    
    if [ "$CLEAN_START" = true ]; then
        start_args="$start_args --clean"
    fi
    
    if [ "$AUTO_PORTS" = true ]; then
        start_args="$start_args --auto-ports"
    fi
    
    # Run the start script
    if [ -f "$SCRIPT_DIR/start-dev.sh" ]; then
        bash "$SCRIPT_DIR/start-dev.sh" $start_args
    else
        print_error "Start script not found: $SCRIPT_DIR/start-dev.sh"
        exit 1
    fi
}

# Function to display final status
display_final_status() {
    local machine_ip=$(cat "$PROJECT_ROOT/.machine_ip" 2>/dev/null || echo "localhost")
    
    # Load port numbers from .env
    source "$ENV_FILE"
    
    print_header "DEPLOYMENT COMPLETE"
    
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    ACCESS YOUR APPLICATION                     ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}  🌐 Main Application:${NC}"
    echo -e "     ${GREEN}http://$machine_ip:${FRONTEND_PORT:-3000}${NC}"
    if [ "$machine_ip" != "localhost" ]; then
        echo -e "     ${BLUE}http://localhost:${FRONTEND_PORT:-3000}${NC} (local)"
    fi
    echo ""
    echo -e "${CYAN}  📚 API Documentation:${NC}"
    echo -e "     ${GREEN}http://$machine_ip:${BACKEND_PORT:-8000}/docs${NC}"
    if [ "$machine_ip" != "localhost" ]; then
        echo -e "     ${BLUE}http://localhost:${BACKEND_PORT:-8000}/docs${NC} (local)"
    fi
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Save URLs to files for other scripts
    echo "http://$machine_ip:${FRONTEND_PORT:-3000}" > "$PROJECT_ROOT/.app_url"
    echo "http://$machine_ip:${BACKEND_PORT:-8000}" > "$PROJECT_ROOT/.api_url"
    
    print_info "Machine IP: $machine_ip"
    print_info "Logs: docker compose logs -f [service_name]"
    print_info "Stop: docker compose down"
    print_info "Restart: ./scripts/launch.sh"
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto-ports|-a)
                AUTO_PORTS=true
                shift
                ;;
            --clean|-c)
                CLEAN_START=true
                shift
                ;;
            --ip)
                FORCE_IP="$2"
                shift 2
                ;;
            --skip-docker-check)
                SKIP_DOCKER_CHECK=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Master launch script for Legal AI Platform"
                echo ""
                echo "Options:"
                echo "  --auto-ports, -a        Automatically resolve port conflicts"
                echo "  --clean, -c             Clean start (remove existing containers)"
                echo "  --ip IP_ADDRESS         Force specific IP address"
                echo "  --skip-docker-check     Skip Docker installation check"
                echo "  --verbose, -v           Verbose output"
                echo "  --help, -h              Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                      Normal launch with auto IP detection"
                echo "  $0 --auto-ports         Launch with automatic port resolution"
                echo "  $0 --clean              Clean restart"
                echo "  $0 --ip 192.168.1.100   Use specific IP address"
                echo ""
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Main execution function
main() {
    # Parse command line arguments
    parse_arguments "$@"
    
    print_header "Legal AI Platform - Master Launch Script"
    
    # Check Docker installation (unless skipped)
    if [ "$SKIP_DOCKER_CHECK" = false ]; then
        check_docker
    fi
    
    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found: $ENV_FILE"
        echo "Creating from example..."
        
        if [ -f "$PROJECT_ROOT/.env.example" ]; then
            cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
            print_success "Created .env file from example"
        else
            print_error "No .env.example file found!"
            exit 1
        fi
    fi
    
    # Detect machine IP
    MACHINE_IP=$(detect_machine_ip)
    print_success "Detected machine IP: $MACHINE_IP"
    
    # Update environment with detected IP
    update_env_with_ip "$MACHINE_IP"
    
    # Configure ports if needed
    configure_ports
    
    # Start all services
    start_services
    
    # Display final status
    display_final_status
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi