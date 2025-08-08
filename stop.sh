#!/bin/bash

# Stop Script
# Legal AI Platform - Complete shutdown and cleanup

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

# Configuration
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
ENV_FILE="$PROJECT_ROOT/.env"
REMOVE_VOLUMES=false
REMOVE_IMAGES=false
KILL_PORTS=false
FORCE_STOP=false

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

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --volumes|-v)
            REMOVE_VOLUMES=true
            shift
            ;;
        --images|-i)
            REMOVE_IMAGES=true
            shift
            ;;
        --kill-ports|-k)
            KILL_PORTS=true
            shift
            ;;
        --force|-f)
            FORCE_STOP=true
            shift
            ;;
        --all|-a)
            REMOVE_VOLUMES=true
            REMOVE_IMAGES=true
            KILL_PORTS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --volumes, -v      Remove Docker volumes (data will be lost)"
            echo "  --images, -i       Remove Docker images"
            echo "  --kill-ports, -k   Kill processes on application ports"
            echo "  --force, -f        Force stop without confirmation"
            echo "  --all, -a          Full cleanup (volumes, images, ports)"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                 Stop containers and services"
            echo "  $0 --volumes       Stop and remove data volumes"
            echo "  $0 --all           Complete cleanup"
            echo "  $0 --force         Skip confirmation prompts"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_warning "Docker is not running or not accessible"
        return 1
    fi
    return 0
}

# Function to stop Docker containers
stop_containers() {
    print_status "Stopping Docker containers..."
    
    if [ -f "$COMPOSE_FILE" ]; then
        # Get list of running containers
        local running_containers=$(docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null)
        
        if [ -n "$running_containers" ]; then
            print_status "Found running containers, stopping them..."
            
            # Stop containers gracefully
            docker compose -f "$COMPOSE_FILE" stop 2>/dev/null || true
            
            # Remove containers
            docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
            
            print_success "Docker containers stopped and removed"
        else
            print_status "No running containers found"
        fi
    else
        print_warning "docker-compose.yml not found, checking for orphaned containers..."
    fi
    
    # Check for any Legal AI Platform containers still running
    local platform_containers=$(docker ps -a --filter "name=legal-ai" --format "{{.Names}}" 2>/dev/null)
    
    if [ -n "$platform_containers" ]; then
        print_status "Found Legal AI Platform containers:"
        echo "$platform_containers" | while read container; do
            echo "  • $container"
        done
        
        print_status "Stopping and removing platform containers..."
        docker ps -a --filter "name=legal-ai" -q | xargs -r docker stop 2>/dev/null || true
        docker ps -a --filter "name=legal-ai" -q | xargs -r docker rm 2>/dev/null || true
        
        print_success "Platform containers cleaned up"
    fi
}

# Function to remove Docker volumes
remove_volumes() {
    print_status "Removing Docker volumes..."
    
    # List volumes from docker-compose
    local volumes=$(docker compose -f "$COMPOSE_FILE" config --volumes 2>/dev/null)
    
    if [ -n "$volumes" ]; then
        echo "$volumes" | while read volume; do
            if [ -n "$volume" ]; then
                print_status "Removing volume: $volume"
                docker volume rm "${PROJECT_ROOT##*/}_${volume}" 2>/dev/null || true
            fi
        done
    fi
    
    # Remove any legal-ai prefixed volumes
    local platform_volumes=$(docker volume ls --filter "name=legal-ai" --format "{{.Name}}" 2>/dev/null)
    
    if [ -n "$platform_volumes" ]; then
        echo "$platform_volumes" | while read volume; do
            print_status "Removing volume: $volume"
            docker volume rm "$volume" 2>/dev/null || true
        done
    fi
    
    print_success "Docker volumes removed"
}

# Function to remove Docker images
remove_images() {
    print_status "Removing Docker images..."
    
    # Get images used by the project
    local images=$(docker compose -f "$COMPOSE_FILE" config --images 2>/dev/null)
    
    if [ -n "$images" ]; then
        echo "$images" | while read image; do
            if [ -n "$image" ]; then
                print_status "Removing image: $image"
                docker rmi "$image" 2>/dev/null || true
            fi
        done
    fi
    
    # Remove any legal-ai tagged images
    local platform_images=$(docker images --filter "reference=*legal-ai*" --format "{{.Repository}}:{{.Tag}}" 2>/dev/null)
    
    if [ -n "$platform_images" ]; then
        echo "$platform_images" | while read image; do
            print_status "Removing image: $image"
            docker rmi "$image" 2>/dev/null || true
        done
    fi
    
    print_success "Docker images removed"
}

# Function to kill processes on specific ports
kill_port_processes() {
    print_status "Checking for processes on application ports..."
    
    # Load port configuration
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
    fi
    
    # Define ports to check
    local ports=(
        "${FRONTEND_PORT:-3000}"
        "${BACKEND_PORT:-8000}"
        "${POSTGRES_PORT:-5432}"
        "${REDIS_PORT:-6379}"
        "${NEO4J_PORT:-7687}"
        "${NEO4J_HTTP_PORT:-7474}"
        "${QDRANT_PORT:-6333}"
        "${QDRANT_GRPC_PORT:-6334}"
        "${MINIO_PORT:-9000}"
        "${MINIO_CONSOLE_PORT:-9001}"
        "${CLAMAV_PORT:-3310}"
    )
    
    local killed_any=false
    
    for port in "${ports[@]}"; do
        # Check if port is in use
        if lsof -i :$port >/dev/null 2>&1; then
            local process_info=$(lsof -i :$port 2>/dev/null | grep LISTEN | head -1)
            
            if [ -n "$process_info" ]; then
                local pid=$(echo "$process_info" | awk '{print $2}')
                local process_name=$(echo "$process_info" | awk '{print $1}')
                
                print_warning "Port $port is in use by $process_name (PID: $pid)"
                
                if [ "$FORCE_STOP" = true ]; then
                    kill -9 $pid 2>/dev/null && print_success "Killed process on port $port" || print_error "Failed to kill process on port $port"
                    killed_any=true
                else
                    read -p "Kill this process? (y/n): " kill_confirm
                    if [[ "$kill_confirm" =~ ^[Yy]$ ]]; then
                        kill -9 $pid 2>/dev/null && print_success "Killed process on port $port" || print_error "Failed to kill process on port $port"
                        killed_any=true
                    fi
                fi
            fi
        fi
    done
    
    if [ "$killed_any" = false ]; then
        print_status "No processes found on application ports"
    fi
}

# Function to kill Node.js development servers
kill_node_processes() {
    print_status "Checking for Node.js development servers..."
    
    # Find any node processes running in the project directory
    local node_pids=$(ps aux | grep -E "node.*$PROJECT_ROOT" | grep -v grep | awk '{print $2}')
    
    if [ -n "$node_pids" ]; then
        print_warning "Found Node.js processes in project directory"
        
        echo "$node_pids" | while read pid; do
            local process_info=$(ps -p $pid -o comm= -o args= 2>/dev/null)
            print_status "  PID $pid: $process_info"
            
            if [ "$FORCE_STOP" = true ]; then
                kill -9 $pid 2>/dev/null && print_success "Killed Node.js process $pid" || true
            else
                read -p "Kill this process? (y/n): " kill_confirm
                if [[ "$kill_confirm" =~ ^[Yy]$ ]]; then
                    kill -9 $pid 2>/dev/null && print_success "Killed Node.js process $pid" || true
                fi
            fi
        done
    else
        print_status "No Node.js development servers found"
    fi
    
    # Also check for npm/yarn processes
    local npm_pids=$(ps aux | grep -E "(npm|yarn).*$PROJECT_ROOT" | grep -v grep | awk '{print $2}')
    
    if [ -n "$npm_pids" ]; then
        echo "$npm_pids" | while read pid; do
            kill -9 $pid 2>/dev/null || true
        done
        print_success "Killed npm/yarn processes"
    fi
}

# Function to kill Python/Uvicorn processes
kill_python_processes() {
    print_status "Checking for Python/Uvicorn servers..."
    
    # Find uvicorn processes
    local uvicorn_pids=$(ps aux | grep -E "uvicorn.*app.main:app" | grep -v grep | awk '{print $2}')
    
    if [ -n "$uvicorn_pids" ]; then
        print_warning "Found Uvicorn processes"
        
        echo "$uvicorn_pids" | while read pid; do
            if [ "$FORCE_STOP" = true ]; then
                kill -9 $pid 2>/dev/null && print_success "Killed Uvicorn process $pid" || true
            else
                read -p "Kill Uvicorn process $pid? (y/n): " kill_confirm
                if [[ "$kill_confirm" =~ ^[Yy]$ ]]; then
                    kill -9 $pid 2>/dev/null && print_success "Killed Uvicorn process $pid" || true
                fi
            fi
        done
    else
        print_status "No Uvicorn servers found"
    fi
    
    # Find Celery workers
    local celery_pids=$(ps aux | grep -E "celery.*app.workers" | grep -v grep | awk '{print $2}')
    
    if [ -n "$celery_pids" ]; then
        print_warning "Found Celery workers"
        echo "$celery_pids" | while read pid; do
            kill -9 $pid 2>/dev/null && print_success "Killed Celery worker $pid" || true
        done
    fi
}

# Function to clean up temporary files
cleanup_temp_files() {
    print_status "Cleaning up temporary files..."
    
    # Remove URL files
    rm -f "$PROJECT_ROOT/.app_url" "$PROJECT_ROOT/.api_url" 2>/dev/null || true
    
    # Remove Python cache
    find "$PROJECT_ROOT/backend" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$PROJECT_ROOT/backend" -type f -name "*.pyc" -delete 2>/dev/null || true
    
    # Remove Node modules cache (optional)
    # rm -rf "$PROJECT_ROOT/frontend/node_modules/.cache" 2>/dev/null || true
    
    print_success "Temporary files cleaned up"
}

# Function to display summary
display_summary() {
    print_header "SHUTDOWN COMPLETE"
    
    echo -e "${GREEN}✓ All services have been stopped${NC}"
    echo ""
    
    if [ "$REMOVE_VOLUMES" = true ]; then
        echo -e "${YELLOW}⚠ Docker volumes removed (data deleted)${NC}"
    else
        echo -e "${BLUE}ℹ Docker volumes preserved${NC}"
    fi
    
    if [ "$REMOVE_IMAGES" = true ]; then
        echo -e "${YELLOW}⚠ Docker images removed${NC}"
    else
        echo -e "${BLUE}ℹ Docker images preserved${NC}"
    fi
    
    if [ "$KILL_PORTS" = true ]; then
        echo -e "${YELLOW}⚠ Port processes killed${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "  • Start services:    ./scripts/start-dev.sh"
    echo "  • Check port status: ./scripts/check-ports.sh"
    echo "  • Clean start:       ./scripts/start-dev.sh --clean --auto-ports"
    echo ""
}

# Main execution
main() {
    print_header "Legal AI Platform - Shutdown Sequence"
    
    # Confirmation prompt (unless force mode)
    if [ "$FORCE_STOP" = false ]; then
        echo -e "${YELLOW}This will stop all Legal AI Platform services.${NC}"
        
        if [ "$REMOVE_VOLUMES" = true ]; then
            echo -e "${RED}WARNING: This will also DELETE all data volumes!${NC}"
        fi
        
        echo ""
        read -p "Continue? (y/n): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            print_status "Shutdown cancelled"
            exit 0
        fi
    fi
    
    # Step 1: Stop Docker containers
    if check_docker; then
        stop_containers
    else
        print_warning "Skipping Docker container cleanup"
    fi
    
    # Step 2: Kill local development servers
    kill_node_processes
    kill_python_processes
    
    # Step 3: Kill processes on ports (if requested)
    if [ "$KILL_PORTS" = true ]; then
        kill_port_processes
    fi
    
    # Step 4: Remove volumes (if requested)
    if [ "$REMOVE_VOLUMES" = true ] && check_docker; then
        print_warning "Removing data volumes..."
        remove_volumes
    fi
    
    # Step 5: Remove images (if requested)
    if [ "$REMOVE_IMAGES" = true ] && check_docker; then
        remove_images
    fi
    
    # Step 6: Clean up temporary files
    cleanup_temp_files
    
    # Display summary
    display_summary
}

# Run main function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi