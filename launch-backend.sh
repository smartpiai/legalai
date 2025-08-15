#!/bin/bash

# Backend Launch Script for Legal AI Platform
# Handles port detection, Docker services, health checks, and backend startup

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

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
STATUS_FILE="$PROJECT_ROOT/.backend_status"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Command line options
AUTO_PORTS=false
CLEAN_START=false
FORCE_IP=""
SKIP_MIGRATIONS=false
VERBOSE=false

# Source existing utilities if available
if [ -f "$PROJECT_ROOT/scripts/port-utils.sh" ]; then
    source "$PROJECT_ROOT/scripts/port-utils.sh"
fi

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

# Function to find available port starting from default
find_available_port() {
    local default_port=$1
    local port=$default_port
    
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
        port=$((port + 1))
    done
    echo $port
}

# Function to update .env with discovered configuration
update_env_var() {
    local key=$1
    local value=$2
    
    if grep -q "^$key=" "$ENV_FILE"; then
        sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
    else
        echo "$key=$value" >> "$ENV_FILE"
    fi
}

# Function to backup .env file
backup_env_file() {
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$ENV_BACKUP"
        print_success "Environment backup created: $ENV_BACKUP"
    fi
}

# Function to detect machine IP address
detect_machine_ip() {
    local detected_ip=""
    
    print_status "Detecting machine IP address..."
    
    # If IP was forced via command line, use that
    if [ -n "$FORCE_IP" ]; then
        detected_ip="$FORCE_IP"
        print_info "Using forced IP: $detected_ip"
        echo "$detected_ip"
        return 0
    fi
    
    # Method 1: Try hostname -I (most reliable on Linux)
    if command -v hostname >/dev/null 2>&1; then
        detected_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$detected_ip" ] && [ "$detected_ip" != "127.0.0.1" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via hostname: $detected_ip"
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Method 2: Try ip command
    if command -v ip >/dev/null 2>&1; then
        detected_ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
        if [ -n "$detected_ip" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via ip command: $detected_ip"
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Method 3: Try to get from default route
    if command -v ip >/dev/null 2>&1; then
        detected_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
        if [ -n "$detected_ip" ] && [ "$detected_ip" != "127.0.0.1" ]; then
            [ "$VERBOSE" = true ] && print_info "IP detected via route: $detected_ip"
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Default to localhost if nothing else works
    print_warning "Could not detect machine IP, defaulting to localhost"
    echo "localhost"
}

# Function to check and configure ports
configure_ports() {
    print_header "Port Configuration"
    
    backup_env_file
    
    # Default ports
    local postgres_port=5432
    local redis_port=6379
    local neo4j_http_port=7474
    local neo4j_port=7687
    local qdrant_port=6333
    local qdrant_grpc_port=6334
    local minio_port=9000
    local minio_console_port=9001
    local clamav_port=3310
    local backend_port=8000
    
    print_status "Checking port availability..."
    
    # Check and find available ports
    postgres_port=$(find_available_port $postgres_port)
    redis_port=$(find_available_port $redis_port)
    neo4j_http_port=$(find_available_port $neo4j_http_port)
    neo4j_port=$(find_available_port $neo4j_port)
    qdrant_port=$(find_available_port $qdrant_port)
    qdrant_grpc_port=$(find_available_port $qdrant_grpc_port)
    minio_port=$(find_available_port $minio_port)
    minio_console_port=$(find_available_port $minio_console_port)
    clamav_port=$(find_available_port $clamav_port)
    backend_port=$(find_available_port $backend_port)
    
    # Update .env file with discovered ports
    update_env_var "POSTGRES_PORT" "$postgres_port"
    update_env_var "REDIS_PORT" "$redis_port"
    update_env_var "NEO4J_HTTP_PORT" "$neo4j_http_port"
    update_env_var "NEO4J_PORT" "$neo4j_port"
    update_env_var "QDRANT_PORT" "$qdrant_port"
    update_env_var "QDRANT_GRPC_PORT" "$qdrant_grpc_port"
    update_env_var "MINIO_PORT" "$minio_port"
    update_env_var "MINIO_CONSOLE_PORT" "$minio_console_port"
    update_env_var "CLAMAV_PORT" "$clamav_port"
    update_env_var "BACKEND_PORT" "$backend_port"
    
    print_success "Port configuration completed"
    
    # Display port assignments
    echo ""
    print_info "Port Assignments:"
    echo "  • PostgreSQL:      $postgres_port"
    echo "  • Redis:           $redis_port"
    echo "  • Neo4j HTTP:      $neo4j_http_port"
    echo "  • Neo4j Bolt:      $neo4j_port"
    echo "  • Qdrant:          $qdrant_port"
    echo "  • Qdrant gRPC:     $qdrant_grpc_port"
    echo "  • MinIO API:       $minio_port"
    echo "  • MinIO Console:   $minio_console_port"
    echo "  • ClamAV:          $clamav_port"
    echo "  • Backend API:     $backend_port"
    echo ""
}

# Function to check Docker installation and status
check_docker() {
    print_status "Checking Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        echo ""
        echo "Docker is required to run the Legal AI Platform backend."
        echo "Please install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info &> /dev/null 2>&1; then
        print_error "Docker daemon is not running"
        echo "Please start Docker and run this script again"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null 2>&1; then
        print_error "Docker Compose is not available"
        echo "Please install Docker Compose"
        exit 1
    fi
    
    print_success "Docker and Docker Compose are ready"
}

# Function to load and validate environment
load_environment() {
    print_status "Loading environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found: $ENV_FILE"
        
        if [ -f "$PROJECT_ROOT/.env.example" ]; then
            print_status "Creating .env from .env.example..."
            cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
            print_success "Created .env file from example"
        else
            print_error "No .env.example file found!"
            exit 1
        fi
    fi
    
    # Load environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    print_success "Environment variables loaded"
}

# Function to update environment with detected IP
update_env_with_ip() {
    local machine_ip="$1"
    
    print_status "Updating environment configuration with IP: $machine_ip"
    
    # Update CORS origins to include the machine IP
    local backend_port=${BACKEND_PORT:-8000}
    update_env_var "BACKEND_HOST" "$machine_ip"
    update_env_var "BACKEND_URL" "http://$machine_ip:$backend_port"
    
    # Export the machine IP for use by other scripts
    echo "$machine_ip" > "$PROJECT_ROOT/.machine_ip"
    
    print_success "Environment updated with machine IP"
}

# Function to wait for service with timeout and retry
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=60
    local attempt=1
    
    print_status "Waiting for $service to be ready on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            print_success "$service is ready on port $port"
            return 0
        fi
        
        if [ $((attempt % 10)) -eq 0 ]; then
            print_status "Still waiting for $service... (attempt $attempt/$max_attempts)"
        fi
        
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service failed to start within expected time"
    return 1
}

# Function to clean up existing containers
cleanup_containers() {
    print_status "Cleaning up existing containers..."
    
    docker compose -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
    
    print_success "Container cleanup completed"
}

# Function to start database services
start_databases() {
    print_header "Starting Database Services"
    
    print_status "Starting PostgreSQL, Redis, Neo4j, Qdrant, MinIO, and ClamAV..."
    
    # Start all database services
    if ! docker compose -f "$COMPOSE_FILE" up -d postgres redis neo4j qdrant minio clamav; then
        print_error "Failed to start database services"
        return 1
    fi
    
    # Load current ports from environment
    source "$ENV_FILE"
    
    # Wait for critical services with health checks
    local services=(
        "PostgreSQL:${POSTGRES_PORT:-5432}"
        "Redis:${REDIS_PORT:-6379}" 
        "Neo4j:${NEO4J_HTTP_PORT:-7474}"
        "MinIO:${MINIO_PORT:-9000}"
        "Qdrant:${QDRANT_PORT:-6333}"
    )
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service port <<< "$service_info"
        if ! wait_for_service "$service" "$port"; then
            print_error "Critical service $service failed to start"
            return 1
        fi
    done
    
    # ClamAV is optional - just check if it's running
    print_status "Checking ClamAV status..."
    if nc -z localhost ${CLAMAV_PORT:-3310} 2>/dev/null; then
        print_success "ClamAV is ready"
    else
        print_warning "ClamAV not ready (optional service)"
    fi
    
    print_success "All database services are running and healthy"
}

# Function to run database migrations
run_migrations() {
    if [ "$SKIP_MIGRATIONS" = true ]; then
        print_status "Skipping database migrations (--skip-migrations specified)"
        return 0
    fi
    
    print_header "Database Migrations"
    
    print_status "Running Alembic migrations..."
    
    # Run migrations inside the backend container
    if docker compose -f "$COMPOSE_FILE" exec -T backend alembic upgrade head; then
        print_success "Database migrations completed successfully"
    else
        print_warning "Migration may have failed or database not ready yet"
        print_status "This might be normal on first startup"
    fi
}

# Function to start backend service
start_backend() {
    print_header "Starting Backend Service"
    
    print_status "Starting FastAPI backend and Celery worker..."
    
    if ! docker compose -f "$COMPOSE_FILE" up -d backend celery; then
        print_error "Failed to start backend services"
        return 1
    fi
    
    # Wait for backend to be ready
    local backend_port=${BACKEND_PORT:-8000}
    local max_wait=120
    local wait_interval=5
    local elapsed=0
    
    print_status "Waiting for backend API to become ready..."
    
    while [ $elapsed -lt $max_wait ]; do
        # Check backend health endpoint
        if curl -f "http://localhost:$backend_port/api/v1/health/ready" >/dev/null 2>&1; then
            print_success "Backend API is ready!"
            break
        fi
        
        print_status "Backend not ready yet, waiting... (${elapsed}s/${max_wait}s)"
        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done
    
    if [ $elapsed -ge $max_wait ]; then
        print_error "Backend API failed to become ready within ${max_wait}s"
        print_status "Checking backend logs..."
        docker compose -f "$COMPOSE_FILE" logs --tail=20 backend
        return 1
    fi
    
    # Check Celery worker
    print_status "Checking Celery worker status..."
    if docker compose -f "$COMPOSE_FILE" exec -T celery celery -A app.workers.celery_app inspect ping >/dev/null 2>&1; then
        print_success "Celery worker is ready"
    else
        print_warning "Celery worker may not be fully ready"
    fi
    
    print_success "Backend services are running and ready"
}

# Function to save status information
save_status() {
    local machine_ip=$(cat "$PROJECT_ROOT/.machine_ip" 2>/dev/null || echo "localhost")
    
    # Load current environment
    source "$ENV_FILE"
    
    # Create status file for frontend script to read
    cat > "$STATUS_FILE" << EOF
# Backend Status - Generated by launch-backend.sh
BACKEND_READY=true
MACHINE_IP=$machine_ip
BACKEND_PORT=${BACKEND_PORT:-8000}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
REDIS_PORT=${REDIS_PORT:-6379}
NEO4J_HTTP_PORT=${NEO4J_HTTP_PORT:-7474}
NEO4J_PORT=${NEO4J_PORT:-7687}
QDRANT_PORT=${QDRANT_PORT:-6333}
MINIO_PORT=${MINIO_PORT:-9000}
MINIO_CONSOLE_PORT=${MINIO_CONSOLE_PORT:-9001}
BACKEND_URL=http://$machine_ip:${BACKEND_PORT:-8000}
API_DOCS_URL=http://$machine_ip:${BACKEND_PORT:-8000}/docs
STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
    
    print_success "Backend status saved to $STATUS_FILE"
}

# Function to display final status
display_status() {
    local machine_ip=$(cat "$PROJECT_ROOT/.machine_ip" 2>/dev/null || echo "localhost")
    
    # Load current environment
    source "$ENV_FILE"
    
    print_header "BACKEND SERVICES READY"
    
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    BACKEND SERVICES STARTED                     ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}  🚀 Backend API:${NC}"
    echo -e "     ${GREEN}http://$machine_ip:${BACKEND_PORT:-8000}${NC}"
    if [ "$machine_ip" != "localhost" ]; then
        echo -e "     ${BLUE}http://localhost:${BACKEND_PORT:-8000}${NC} (local)"
    fi
    echo ""
    echo -e "${CYAN}  📚 API Documentation:${NC}"
    echo -e "     ${GREEN}http://$machine_ip:${BACKEND_PORT:-8000}/docs${NC}"
    echo ""
    echo -e "${CYAN}  🗄️  Database Services:${NC}"
    echo -e "     • PostgreSQL:    ${GREEN}localhost:${POSTGRES_PORT:-5432}${NC}"
    echo -e "     • Redis:         ${GREEN}localhost:${REDIS_PORT:-6379}${NC}"
    echo -e "     • Neo4j:         ${GREEN}http://$machine_ip:${NEO4J_HTTP_PORT:-7474}${NC}"
    echo -e "     • Qdrant:        ${GREEN}http://$machine_ip:${QDRANT_PORT:-6333}${NC}"
    echo -e "     • MinIO Console: ${GREEN}http://$machine_ip:${MINIO_CONSOLE_PORT:-9001}${NC}"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    print_info "Next Steps:"
    echo "  1. Backend services are ready"
    echo "  2. Run './launch-frontend.sh' to start the frontend"
    echo "  3. Or test the API directly at the URLs above"
    echo ""
    print_info "Management Commands:"
    echo "  • View logs:    docker compose logs -f [service_name]"
    echo "  • Stop all:     docker compose down"
    echo "  • Restart:      ./launch-backend.sh"
}

# Function to handle cleanup on script exit
cleanup_on_exit() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        print_error "Backend startup failed"
        print_status "Checking service status..."
        docker compose -f "$COMPOSE_FILE" ps
        echo ""
        print_status "To view logs: docker compose logs [service_name]"
        print_status "To cleanup: docker compose down"
        
        # Remove status file on failure
        rm -f "$STATUS_FILE"
    fi
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
            --skip-migrations)
                SKIP_MIGRATIONS=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Backend launch script for Legal AI Platform"
                echo ""
                echo "Options:"
                echo "  --auto-ports, -a        Automatically resolve port conflicts"
                echo "  --clean, -c             Clean start (remove existing containers)"
                echo "  --ip IP_ADDRESS         Force specific IP address"
                echo "  --skip-migrations       Skip database migrations"
                echo "  --verbose, -v           Verbose output"
                echo "  --help, -h              Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                      Normal backend launch"
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
    
    print_header "Legal AI Platform - Backend Launch"
    
    # Set up cleanup trap
    trap cleanup_on_exit EXIT
    
    # Pre-flight checks
    check_docker
    load_environment
    
    # Detect machine IP
    MACHINE_IP=$(detect_machine_ip)
    print_success "Detected machine IP: $MACHINE_IP"
    
    # Update environment with IP
    update_env_with_ip "$MACHINE_IP"
    
    # Configure ports
    configure_ports
    
    # Reload environment after port configuration
    load_environment
    
    # Clean containers if requested
    if [ "$CLEAN_START" = true ]; then
        cleanup_containers
    fi
    
    # Start database services
    if ! start_databases; then
        print_error "Failed to start database services"
        exit 1
    fi
    
    # Run migrations
    run_migrations
    
    # Start backend services
    if ! start_backend; then
        print_error "Failed to start backend services"
        exit 1
    fi
    
    # Save status for frontend script
    save_status
    
    # Display final status
    display_status
    
    # Remove the error trap since we succeeded
    trap - EXIT
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi