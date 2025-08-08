#!/bin/bash

# Development Startup Orchestration Script
# Legal AI Platform - Complete Development Environment

# Don't exit on error immediately - we handle errors explicitly
set +e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
ENV_FILE="$PROJECT_ROOT/.env"

# Port management settings
AUTO_PORTS=false
FORCE_PORTS=false
CHECK_PORTS=true

# Source port utilities
source "$SCRIPT_DIR/port-utils.sh"

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

# Function to check if Docker is running
check_docker() {
    print_status "Checking Docker availability..."
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    if ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are ready"
}

# Function to load environment variables
load_environment() {
    print_status "Loading environment configuration..."
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file $ENV_FILE not found!"
        print_warning "Please ensure .env file exists in the root directory"
        exit 1
    fi
    
    # Export all variables from .env file
    set -a
    source "$ENV_FILE"
    set +a
    
    print_success "Environment variables loaded from $ENV_FILE"
    print_status "Environment: ${ENVIRONMENT:-development}"
}

# Function to clean up any existing containers
cleanup_containers() {
    print_status "Cleaning up existing containers..."
    
    # Stop and remove containers if they exist
    docker compose -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
    
    # Clean up any dangling images and volumes (optional)
    if [ "${CLEAN_DOCKER:-false}" = "true" ]; then
        print_status "Performing deep cleanup (images and volumes)..."
        docker system prune -f >/dev/null 2>&1 || true
    fi
    
    print_success "Container cleanup completed"
}

# Function to start database services
start_databases() {
    print_header "PHASE 1: Starting Database Services"
    
    print_status "Starting PostgreSQL, Redis, Neo4j, Qdrant, MinIO, and ClamAV..."
    
    # Start all database services
    if ! docker compose -f "$COMPOSE_FILE" up -d postgres redis neo4j qdrant minio clamav 2>&1; then
        print_error "Failed to start database services"
        print_status "This is likely due to port conflicts. Checking docker compose output..."
        docker compose -f "$COMPOSE_FILE" ps
        return 1
    fi
    
    print_status "Waiting for all database services to become healthy..."
    
    # Wait for each service to be healthy
    # Critical services that must be healthy
    local critical_services=("postgres" "redis" "neo4j" "minio")
    # Optional services that can be unhealthy but running
    local optional_services=("qdrant" "clamav")
    local max_wait=300  # 5 minutes
    local wait_interval=10
    local elapsed=0
    
    while [ $elapsed -lt $max_wait ]; do
        local critical_healthy=true
        local status_messages=()
        
        # Check critical services
        for service in "${critical_services[@]}"; do
            local health=$(docker compose -f "$COMPOSE_FILE" ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "unhealthy")
            
            if [ "$health" != "healthy" ]; then
                critical_healthy=false
                status_messages+=("$service: $health (critical)")
            else
                status_messages+=("$service: $health ✓")
            fi
        done
        
        # Check optional services (don't fail if unhealthy)
        for service in "${optional_services[@]}"; do
            local health=$(docker compose -f "$COMPOSE_FILE" ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "unhealthy")
            local running=$(docker compose -f "$COMPOSE_FILE" ps -q "$service" | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "exited")
            
            if [ "$running" = "running" ]; then
                if [ "$health" = "healthy" ]; then
                    status_messages+=("$service: $health ✓")
                else
                    status_messages+=("$service: $health (optional, running)")
                fi
            else
                status_messages+=("$service: not running (optional)")
            fi
        done
        
        # Display status
        for msg in "${status_messages[@]}"; do
            print_status "$msg"
        done
        
        if [ "$critical_healthy" = true ]; then
            print_success "All critical database services are healthy!"
            break
        fi
        
        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done
    
    if [ $elapsed -ge $max_wait ]; then
        print_error "Critical database services failed to become healthy within ${max_wait}s"
        print_status "Checking critical service logs..."
        for service in "${critical_services[@]}"; do
            echo -e "\n${YELLOW}=== $service logs ===${NC}"
            docker compose -f "$COMPOSE_FILE" logs --tail=20 "$service"
        done
        return 1
    fi
    
    print_success "Phase 1 completed: All database services are running and healthy"
}

# Function to apply schemas and seed data
apply_schemas() {
    print_header "PHASE 2: Schema Application and Data Seeding"
    
    print_status "Running database initialization scripts..."
    
    # PostgreSQL initialization (already handled by init script in container)
    print_status "PostgreSQL: Schema initialization completed via init script"
    
    # Neo4j initialization
    print_status "Neo4j: Running Cypher initialization script..."
    docker compose -f "$COMPOSE_FILE" exec -T neo4j cypher-shell -u neo4j -p "${NEO4J_PASSWORD}" < scripts/init-neo4j.cypher || {
        print_warning "Neo4j initialization may have already been completed"
    }
    
    # Qdrant collections (handled by wait-for-services.sh)
    print_status "Qdrant: Collections will be initialized during backend startup"
    
    print_success "Phase 2 completed: Database schemas and initial data ready"
    return 0
}

# Function to start backend service
start_backend() {
    print_header "PHASE 3: Starting Backend Service"
    
    print_status "Starting backend API service..."
    docker compose -f "$COMPOSE_FILE" up -d backend celery
    
    print_status "Waiting for backend to become ready..."
    
    local max_wait=180  # 3 minutes
    local wait_interval=5
    local elapsed=0
    
    while [ $elapsed -lt $max_wait ]; do
        # Check backend health
        if docker compose -f "$COMPOSE_FILE" exec -T backend curl -f http://localhost:8000/api/v1/health/ready >/dev/null 2>&1; then
            print_success "Backend service is ready!"
            break
        fi
        
        print_status "Backend not ready yet, waiting... (${elapsed}s/${max_wait}s)"
        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done
    
    if [ $elapsed -ge $max_wait ]; then
        print_error "Backend service failed to become ready within ${max_wait}s"
        print_status "Checking backend logs..."
        docker compose -f "$COMPOSE_FILE" logs --tail=30 backend
        exit 1
    fi
    
    # Verify celery worker
    print_status "Checking Celery worker status..."
    if docker compose -f "$COMPOSE_FILE" exec -T celery celery -A app.workers.celery_app inspect ping >/dev/null 2>&1; then
        print_success "Celery worker is ready!"
    else
        print_warning "Celery worker may not be fully ready, but continuing..."
    fi
    
    print_success "Phase 3 completed: Backend services are running and ready"
    return 0
}

# Function to start frontend service
start_frontend() {
    print_header "PHASE 4: Starting Frontend Service"
    
    print_status "Starting frontend development server..."
    docker compose -f "$COMPOSE_FILE" up -d frontend
    
    print_status "Waiting for frontend to become ready..."
    
    local max_wait=120  # 2 minutes
    local wait_interval=5
    local elapsed=0
    
    while [ $elapsed -lt $max_wait ]; do
        # Check frontend health
        if curl -f "http://localhost:${FRONTEND_PORT:-3000}" >/dev/null 2>&1; then
            print_success "Frontend service is ready!"
            break
        fi
        
        print_status "Frontend not ready yet, waiting... (${elapsed}s/${max_wait}s)"
        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done
    
    if [ $elapsed -ge $max_wait ]; then
        print_error "Frontend service failed to become ready within ${max_wait}s"
        print_status "Checking frontend logs..."
        docker compose -f "$COMPOSE_FILE" logs --tail=30 frontend
        exit 1
    fi
    
    print_success "Phase 4 completed: Frontend service is running and ready"
    return 0
}

# Function to get public IP
get_public_ip() {
    # Try multiple methods to get public IP
    local public_ip=""
    
    # Method 1: Try to get from network interface
    if command -v ip >/dev/null 2>&1; then
        public_ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
    fi
    
    # Method 2: Try hostname -I
    if [ -z "$public_ip" ] && command -v hostname >/dev/null 2>&1; then
        public_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    # Method 3: Get from default route
    if [ -z "$public_ip" ]; then
        public_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    fi
    
    # Default to localhost if can't determine
    if [ -z "$public_ip" ]; then
        public_ip="localhost"
    fi
    
    echo "$public_ip"
}

# Function to display final status
display_status() {
    print_header "DEPLOYMENT COMPLETE"
    
    print_success "All services are running successfully!"
    
    # Get public IP
    local public_ip=$(get_public_ip)
    
    # Display access URLs prominently
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    ACCESS YOUR APPLICATION                     ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}  🌐 Main Application:${NC}"
    echo -e "     ${GREEN}http://${public_ip}:${FRONTEND_PORT:-3000}${NC}"
    if [ "$public_ip" != "localhost" ]; then
        echo -e "     ${BLUE}http://localhost:${FRONTEND_PORT:-3000}${NC} (local)"
    fi
    echo ""
    echo -e "${CYAN}  📚 API Documentation:${NC}"
    echo -e "     ${GREEN}http://${public_ip}:${BACKEND_PORT:-8000}/docs${NC}"
    if [ "$public_ip" != "localhost" ]; then
        echo -e "     ${BLUE}http://localhost:${BACKEND_PORT:-8000}/docs${NC} (local)"
    fi
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    
    echo ""
    print_status "Service URLs:"
    echo "  • Frontend:    http://${public_ip}:${FRONTEND_PORT:-3000}"
    echo "  • Backend API: http://${public_ip}:${BACKEND_PORT:-8000}"
    echo "  • API Docs:    http://${public_ip}:${BACKEND_PORT:-8000}/docs"
    echo "  • Neo4j:       http://${public_ip}:${NEO4J_HTTP_PORT:-7474}"
    echo "  • MinIO:       http://${public_ip}:${MINIO_CONSOLE_PORT:-9001}"
    echo ""
    print_status "Database Connections:"
    echo "  • PostgreSQL:  ${public_ip}:${POSTGRES_PORT:-5432}"
    echo "  • Redis:       ${public_ip}:${REDIS_PORT:-6379}"
    echo "  • Neo4j:       bolt://${public_ip}:${NEO4J_PORT:-7687}"
    echo "  • Qdrant:      http://${public_ip}:${QDRANT_PORT:-6333}"
    echo ""
    print_status "Management Commands:"
    echo "  • View logs:      docker compose logs -f [service_name]"
    echo "  • Stop all:       ./stop.sh"
    echo "  • Restart:        ./scripts/start-dev.sh"
    echo "  • Clean restart:  ./scripts/start-dev.sh --clean --auto-ports"
    echo ""
    
    # Save the public URL to a file for other scripts to use
    echo "http://${public_ip}:${FRONTEND_PORT:-3000}" > "$PROJECT_ROOT/.app_url"
    echo "http://${public_ip}:${BACKEND_PORT:-8000}" > "$PROJECT_ROOT/.api_url"
}

# Function to handle cleanup on script exit
cleanup_on_exit() {
    if [ $? -ne 0 ]; then
        print_error "Startup failed. Checking service status..."
        docker compose -f "$COMPOSE_FILE" ps
        echo ""
        print_status "To view logs: docker compose logs [service_name]"
        print_status "To cleanup: docker compose down"
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
            --force|-f)
                FORCE_PORTS=true
                CHECK_PORTS=false
                shift
                ;;
            --no-port-check)
                CHECK_PORTS=false
                shift
                ;;
            --clean)
                CLEAN_START=true
                shift
                ;;
            --clean-docker)
                CLEAN_DOCKER=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --auto-ports, -a    Automatically resolve port conflicts"
                echo "  --force, -f         Force start without port checks"
                echo "  --no-port-check     Skip port availability checks"
                echo "  --clean             Clean start (remove existing containers)"
                echo "  --clean-docker      Deep clean (remove containers and images)"
                echo "  --help, -h          Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                  Normal start with port checking"
                echo "  $0 --auto-ports     Auto-resolve any port conflicts"
                echo "  $0 --force          Force start (may fail if ports in use)"
                echo "  $0 --clean          Remove containers before starting"
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

# Function to handle port configuration
handle_port_configuration() {
    if [ "$CHECK_PORTS" = false ]; then
        print_status "Skipping port checks (--force or --no-port-check specified)"
        return 0
    fi
    
    print_header "Port Configuration Check"
    
    # Check current port status
    local port_check_result
    check_all_ports "$ENV_FILE"
    port_check_result=$?
    
    if [ $port_check_result -eq 0 ]; then
        print_success "All ports are available - ready to start services"
        return 0
    fi
    
    # Ports are in use, handle based on mode
    if [ "$AUTO_PORTS" = true ]; then
        print_status "Auto-resolving port conflicts..."
        
        # Run the configuration script and check if it succeeds
        if "$SCRIPT_DIR/configure-ports.sh" --auto; then
            # Reload environment with new ports
            print_status "Reloading environment with new port configuration..."
            set -a
            source "$ENV_FILE"
            set +a
            
            print_success "Port conflicts resolved automatically"
            echo ""
            display_port_table "$ENV_FILE"
            echo ""
            
            # Verify the new ports are available
            print_status "Verifying new port configuration..."
            if check_all_ports "$ENV_FILE"; then
                print_success "New ports verified and available"
            else
                print_error "Port resolution failed - some ports still in use"
                exit 1
            fi
        else
            print_error "Failed to auto-configure ports"
            exit 1
        fi
    else
        echo ""
        echo -e "${YELLOW}Port conflicts detected!${NC}"
        echo ""
        echo "Options:"
        echo "  1) Automatically resolve conflicts (recommended)"
        echo "  2) Configure ports manually"
        echo "  3) Force start anyway (may fail)"
        echo "  4) Exit"
        echo ""
        read -p "Enter choice (1-4): " choice
        
        case $choice in
            1)
                "$SCRIPT_DIR/configure-ports.sh" --auto
                load_environment
                print_success "Port conflicts resolved"
                ;;
            2)
                "$SCRIPT_DIR/configure-ports.sh"
                load_environment
                print_success "Port configuration complete"
                ;;
            3)
                print_warning "Forcing start with port conflicts - this may fail!"
                CHECK_PORTS=false
                ;;
            4)
                print_status "Exiting without starting services"
                exit 0
                ;;
            *)
                print_error "Invalid choice. Exiting."
                exit 1
                ;;
        esac
    fi
}

# Main execution function
main() {
    # Parse command line arguments
    parse_arguments "$@"
    
    print_header "Legal AI Platform - Development Environment Startup"
    
    # Set up cleanup trap
    trap cleanup_on_exit EXIT
    
    # Phase 0: Pre-flight checks
    check_docker
    load_environment
    
    # Handle port configuration
    handle_port_configuration
    
    if [ "${CLEAN_START:-false}" = "true" ] || [ "${CLEAN_DOCKER:-false}" = "true" ]; then
        cleanup_containers
    fi
    
    # Phase 1: Database services
    if ! start_databases; then
        print_error "Failed to start database services"
        exit 1
    fi
    
    # Phase 2: Schema and seeding
    if ! apply_schemas; then
        print_error "Failed to apply database schemas"
        exit 1
    fi
    
    # Phase 3: Backend services
    if ! start_backend; then
        print_error "Failed to start backend services"
        exit 1
    fi
    
    # Phase 4: Frontend service
    if ! start_frontend; then
        print_error "Failed to start frontend service"
        exit 1
    fi
    
    # Final status display
    display_status
    
    # Remove the error trap since we succeeded
    trap - EXIT
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi