#!/bin/bash

# Launch Development Environment
# Hybrid approach: Databases in containers, Backend and Frontend locally for fast iteration

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Source port utilities
source "$SCRIPT_DIR/scripts/port-utils.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE_FILE="$PROJECT_ROOT/.env.example"
DEV_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
PUBLIC_IP="192.168.1.4" # As specified by user

# Command line options
SKIP_DATABASES=false
SKIP_BACKEND=false
SKIP_FRONTEND=false
BACKGROUND=false

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

print_header() {
    echo -e "\n${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}\n"
}

# Function to configure the .env file automatically
configure_environment() {
    print_header "PHASE 0: Configuring Environment"

    # Define all default values, including ports
    declare -A DEFAULT_ENV_VARS=(
        ["POSTGRES_USER"]="postgres"
        ["POSTGRES_PASSWORD"]="dev_password_change_in_prod"
        ["POSTGRES_DB"]="legal_ai"
        ["POSTGRES_PORT"]=5432
        ["REDIS_PORT"]=6379
        ["NEO4J_USER"]="neo4j"
        ["NEO4J_PASSWORD"]="dev_password_change_in_prod"
        ["NEO4J_PORT"]=7687
        ["NEO4J_HTTP_PORT"]=7474
        ["QDRANT_PORT"]=6333
        ["QDRANT_GRPC_PORT"]=6334
        ["MINIO_ROOT_USER"]="minioadmin"
        ["MINIO_ROOT_PASSWORD"]="dev_password_change_in_prod"
        ["MINIO_ACCESS_KEY"]="minioadmin"
        ["MINIO_SECRET_KEY"]="dev_password_change_in_prod"
        ["MINIO_PORT"]=9000
        ["MINIO_CONSOLE_PORT"]=9001
        ["CLAMAV_PORT"]=3310
        ["CLAMAV_NO_FRESHCLAM"]="true"
        ["CLAMAV_NO_CLAMD"]="false"
        ["BACKEND_PORT"]=8000
        ["FRONTEND_PORT"]=3000
        ["SECRET_KEY"]="a_very_secret_dev_key_change_in_prod"
        ["JWT_SECRET_KEY"]="a_very_secret_jwt_dev_key_change_in_prod"
        ["ALLOWED_HOSTS"]="localhost,127.0.0.1,192.168.1.4,legal.smartpi.ai"
        ["LOG_LEVEL"]="DEBUG"
    )

    if [ ! -f "$ENV_FILE" ]; then
        print_status "No .env file found. Creating a new one..."
        touch "$ENV_FILE"
    fi

    print_status "Ensuring all required variables are in .env file..."
    for key in "${!DEFAULT_ENV_VARS[@]}"; do
        if ! grep -q "^$key=" "$ENV_FILE"; then
            echo "$key=${DEFAULT_ENV_VARS[$key]}" >> "$ENV_FILE"
        fi
    done
    print_success ".env file is complete."

    print_status "Checking for port conflicts and reconfiguring if necessary..."
    for service_key in "${!DEFAULT_PORTS[@]}"; do
        local current_port=$(grep "^$service_key=" "$ENV_FILE" | cut -d= -f2)
        if ! is_port_available $current_port; then
            print_warning "Port $current_port for ${SERVICE_NAMES[$service_key]} is in use."
            local new_port=$(get_alternative_port "$service_key")
            print_success "  → Found alternative port: $new_port"
            update_env_port "$ENV_FILE" "$service_key" "$new_port"
        fi
    done
    print_success "Port configuration is up to date."

    print_status "Finalizing dynamic configuration..."
    set -a; source "$ENV_FILE"; set +a

    update_env_port "$ENV_FILE" "VITE_API_BASE_URL" "/api/v1"
    update_env_port "$ENV_FILE" "DATABASE_URL" "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
    update_env_port "$ENV_FILE" "BACKEND_CORS_ORIGINS" "http://localhost:3000,http://localhost:8000,http://${PUBLIC_IP}:${FRONTEND_PORT},https://legal.smartpi.ai"
    update_env_port "$ENV_FILE" "NEO4J_AUTH" "${NEO4J_USER}/${NEO4J_PASSWORD}"
    update_env_port "$ENV_FILE" "MINIO_ENDPOINT" "localhost:${MINIO_PORT}"

    print_success "Environment configuration complete."
}


# Function to check prerequisites
check_prerequisites() {
    print_status "Checking development prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        echo "Docker is required for database services"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null 2>&1; then
        print_error "Docker Compose is not available"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed!"
        echo "Python 3.11+ is required for backend development"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        echo "Node.js 18+ is required for frontend development"
        exit 1
    fi
    
    print_success "All prerequisites are available"
}

# Function to start database services
start_databases() {
    if [ "$SKIP_DATABASES" = true ]; then
        print_status "Skipping database startup (--skip-databases specified)"
        return 0
    fi
    
    print_header "PHASE 1: Starting Database Services"
    
    print_status "Starting PostgreSQL, Redis, Neo4j, Qdrant, MinIO, and ClamAV..."
    
    if ! docker compose --env-file "$ENV_FILE" -f "$DEV_COMPOSE_FILE" up -d; then
        print_error "Failed to start database services"
        return 1
    fi
    
    # Wait for critical services
    print_status "Waiting for database services to become healthy..."
    
    local max_wait=120
    local wait_interval=5
    local elapsed=0
    
    while [ $elapsed -lt $max_wait ]; do
        local healthy_count_str=$(docker compose --env-file "$ENV_FILE" -f "$DEV_COMPOSE_FILE" ps | grep -c "healthy" || echo "0")
        local healthy_count=${healthy_count_str//[$'\t\r\n ']} # Trim whitespace
        
        if [ "$healthy_count" -ge 3 ]; then  # PostgreSQL, Redis, MinIO (minimum needed)
            print_success "Database services are healthy and ready"
            break
        fi
        
        print_status "Waiting for databases... ($elapsed/$max_wait seconds, $healthy_count healthy)"
        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done
    
    if [ $elapsed -ge $max_wait ]; then
        print_warning "Some databases may not be fully ready, but continuing..."
    fi
    
    # Display database URLs
    source "$ENV_FILE"
    echo ""
    print_status "Database Services:"
    echo "  • PostgreSQL:  localhost:${POSTGRES_PORT}"
    echo "  • Redis:       localhost:${REDIS_PORT}"
    echo "  • Neo4j:       http://localhost:${NEO4J_HTTP_PORT}"
    echo "  • Qdrant:      http://localhost:${QDRANT_PORT}"
    echo "  • MinIO:       http://localhost:${MINIO_CONSOLE_PORT}"
    echo ""
}

# Function to start backend locally
start_backend() {
    if [ "$SKIP_BACKEND" = true ]; then
        print_status "Skipping backend startup (--skip-backend specified)"
        return 0
    fi
    
    print_header "PHASE 2: Starting Backend Locally"
    
    if [ "$BACKGROUND" = true ]; then
        print_status "Starting backend in background..."
        nohup "$PROJECT_ROOT/scripts/backend-dev.sh" > "$PROJECT_ROOT/.backend-dev.log" 2>&1 &
        echo $! > "$PROJECT_ROOT/.backend-dev.pid"
        
        # Wait for backend to be ready
        sleep 10
        if curl -f -s "http://localhost:8000/api/v1/health/ready" >/dev/null 2>&1; then
            print_success "Backend started successfully in background"
        else
            print_warning "Backend may still be starting up"
        fi
    else
        print_status "Starting backend in foreground (run with --background for background mode)"
        print_status "Open a new terminal and run: ./scripts/frontend-dev.sh"
        exec "$PROJECT_ROOT/scripts/backend-dev.sh"
    fi
}

# Function to start frontend locally
start_frontend() {
    if [ "$SKIP_FRONTEND" = true ]; then
        print_status "Skipping frontend startup (--skip-frontend specified)"
        return 0
    fi
    
    print_header "PHASE 3: Starting Frontend Locally"
    
    if [ "$BACKGROUND" = true ]; then
        print_status "Starting frontend in background..."
        nohup "$PROJECT_ROOT/scripts/frontend-dev.sh" > "$PROJECT_ROOT/.frontend-dev.log" 2>&1 &
        echo $! > "$PROJECT_ROOT/.frontend-dev.pid"
        
        sleep 5
        print_success "Frontend started in background"
    else
        exec "$PROJECT_ROOT/scripts/frontend-dev.sh"
    fi
}

# Function to display final status
display_status() {
    print_header "DEVELOPMENT ENVIRONMENT READY"
    
    source "$ENV_FILE"
    
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    🚀 DEVELOPMENT READY 🚀                      ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}  🌐 Frontend (Local):${NC}"
    echo -e "     ${GREEN}http://localhost:3000${NC}"
    echo ""
    echo -e "${CYAN}  🚀 Backend API (Local):${NC}"
    echo -e "     ${GREEN}http://localhost:8000${NC}"
    echo -e "     ${GREEN}http://localhost:8000/docs${NC} (API documentation)"
    echo ""
    echo -e "${CYAN}  🗄️  Database Services (Containers):${NC}"
    echo -e "     • PostgreSQL:  ${GREEN}localhost:${POSTGRES_PORT}${NC}"
    echo -e "     • Redis:       ${GREEN}localhost:${REDIS_PORT}${NC}"
    echo -e "     • Neo4j:       ${GREEN}http://localhost:${NEO4J_HTTP_PORT}${NC}"
    echo -e "     • Qdrant:      ${GREEN}http://localhost:${QDRANT_PORT}${NC}"
    echo -e "     • MinIO:       ${GREEN}http://localhost:${MINIO_CONSOLE_PORT}${NC}"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    print_status "Development Features:"
    echo "  • Hot Reload:     ✅ Frontend (Vite) + Backend (Uvicorn)"
    echo "  • Live Debugging: ✅ Full IDE support"
    echo "  • Fast Iteration: ✅ No container rebuilds needed"
    echo "  • Database Persistence: ✅ Data survives restarts"
    echo ""
    
    if [ "$BACKGROUND" = true ]; then
        print_status "Background Services Running:"
        echo "  • Backend logs:   tail -f .backend-dev.log"
        echo "  • Frontend logs:  tail -f .frontend-dev.log"
        echo "  • Stop backend:   kill \$(cat .backend-dev.pid)"
        echo "  • Stop frontend:  kill \$(cat .frontend-dev.pid)"
        echo ""
    fi
    
    print_status "Development Commands:"
    echo "  • Stop databases:     docker compose -f docker-compose.dev.yml down"
    echo "  • Reset data:         docker compose -f docker-compose.dev.yml down -v"
    echo "  • View DB logs:       docker compose -f docker-compose.dev.yml logs -f [service]"
    echo "  • Restart dev:        ./launch-dev.sh"
    echo ""
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-databases)
                SKIP_DATABASES=true
                shift
                ;;
            --skip-backend)
                SKIP_BACKEND=true
                shift
                ;;
            --skip-frontend)
                SKIP_FRONTEND=true
                shift
                ;;
            --background|-b)
                BACKGROUND=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Hybrid development environment for Legal AI Platform"
                echo ""
                echo "Options:"
                echo "  --skip-databases     Skip database startup"
                echo "  --skip-backend       Skip backend startup"
                echo "  --skip-frontend      Skip frontend startup"
                echo "  --background, -b     Run backend/frontend in background"
                echo "  --help, -h           Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                   Start everything in sequence"
                echo "  $0 --background      Start all services in background"
                echo "  $0 --skip-backend    Start databases and frontend only"
                echo ""
                echo "Development Workflow:"
                echo "  1. Databases run in containers (persistent, no rebuilds)"
                echo "  2. Backend runs locally (instant restart, hot reload)"
                echo "  3. Frontend runs locally (instant hot reload, live CSS)"
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
    parse_arguments "$@"
    
    print_header "Legal AI Platform - Hybrid Development Environment"
    
    # Phase 0: Configure environment
    configure_environment
    
    # Check prerequisites
    check_prerequisites
    
    # Phase 1: Start databases
    start_databases
    
    if [ "$BACKGROUND" = true ]; then
        # Phase 2 & 3: Start backend and frontend in background
        start_backend
        start_frontend
        
        # Display status
        display_status
        
        print_status "All services running in background"
        print_status "Monitor with: tail -f .backend-dev.log .frontend-dev.log"
    else
        # Phase 2: Start backend (or frontend if backend skipped)
        if [ "$SKIP_BACKEND" = false ]; then
            start_backend
        else
            start_frontend
        fi
    fi
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
