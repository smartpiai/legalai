#!/bin/bash

# Frontend Launch Script for Legal AI Platform
# Handles backend verification, port detection, and Vite development server startup

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
STATUS_FILE="$PROJECT_ROOT/.backend_status"
FRONTEND_STATUS_FILE="$PROJECT_ROOT/.frontend_status"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Command line options
AUTO_PORT=false
SKIP_BACKEND_CHECK=false
USE_DOCKER=false
VERBOSE=false
FRONTEND_PORT=""

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

# Function to load environment variables
load_environment() {
    print_status "Loading environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found: $ENV_FILE"
        print_error "Please run ./launch-backend.sh first to set up the environment"
        exit 1
    fi
    
    # Load environment variables
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
    fi
    
    print_success "Environment variables loaded"
}

# Function to check if backend is ready
check_backend_status() {
    if [ "$SKIP_BACKEND_CHECK" = true ]; then
        print_status "Skipping backend readiness check (--skip-backend-check specified)"
        return 0
    fi
    
    print_header "Backend Readiness Check"
    
    # Check if backend status file exists
    if [ ! -f "$STATUS_FILE" ]; then
        print_error "Backend status file not found: $STATUS_FILE"
        print_error "Please run ./launch-backend.sh first to start the backend services"
        exit 1
    fi
    
    # Load backend status
    source "$STATUS_FILE"
    
    if [ "$BACKEND_READY" != "true" ]; then
        print_error "Backend is not marked as ready"
        print_error "Please run ./launch-backend.sh first"
        exit 1
    fi
    
    # Test backend API connectivity
    local backend_url="${BACKEND_URL:-http://localhost:8000}"
    local health_url="$backend_url/api/v1/health/ready"
    
    print_status "Testing backend API connectivity..."
    print_status "Checking: $health_url"
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" >/dev/null 2>&1; then
            print_success "Backend API is responding and healthy"
            break
        fi
        
        if [ $attempt -eq 1 ]; then
            print_status "Backend API not ready yet, waiting..."
        fi
        
        if [ $((attempt % 10)) -eq 0 ]; then
            print_status "Still waiting for backend API... (attempt $attempt/$max_attempts)"
        fi
        
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Backend API failed to respond within expected time"
        print_error "Backend URL: $backend_url"
        print_status "Please check if backend services are running:"
        print_status "  docker compose ps"
        print_status "  docker compose logs backend"
        exit 1
    fi
    
    print_success "Backend verification completed"
    
    # Display backend connection info
    echo ""
    print_info "Backend Connection Details:"
    echo "  • API URL:          $backend_url"
    echo "  • Health Check:     $health_url"
    echo "  • Documentation:    $backend_url/docs"
    echo "  • Machine IP:       ${MACHINE_IP:-localhost}"
    echo ""
}

# Function to configure frontend port
configure_frontend_port() {
    print_header "Frontend Port Configuration"
    
    # Default frontend port
    local default_port=3000
    
    # Use specified port if provided
    if [ -n "$FRONTEND_PORT" ]; then
        default_port=$FRONTEND_PORT
    elif [ -n "${FRONTEND_PORT:-}" ]; then
        # Use from environment if set
        default_port=$FRONTEND_PORT
    fi
    
    print_status "Checking frontend port availability..."
    
    local frontend_port
    if [ "$AUTO_PORT" = true ]; then
        frontend_port=$(find_available_port $default_port)
        if [ "$frontend_port" != "$default_port" ]; then
            print_warning "Port $default_port was busy, using $frontend_port instead"
        fi
    else
        if lsof -Pi :$default_port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_error "Port $default_port is already in use"
            echo ""
            echo "Options:"
            echo "  1) Use automatic port selection (--auto-port)"
            echo "  2) Specify a different port (--port XXXX)"
            echo "  3) Stop the service using port $default_port"
            echo ""
            read -p "Enter choice (1-3) or press Ctrl+C to exit: " choice
            
            case $choice in
                1)
                    frontend_port=$(find_available_port $default_port)
                    print_success "Using available port: $frontend_port"
                    ;;
                2)
                    echo -n "Enter port number: "
                    read custom_port
                    if [[ "$custom_port" =~ ^[0-9]+$ ]] && [ "$custom_port" -ge 1024 ] && [ "$custom_port" -le 65535 ]; then
                        if lsof -Pi :$custom_port -sTCP:LISTEN -t >/dev/null 2>&1; then
                            print_error "Port $custom_port is also in use"
                            exit 1
                        fi
                        frontend_port=$custom_port
                    else
                        print_error "Invalid port number"
                        exit 1
                    fi
                    ;;
                3)
                    print_error "Please stop the service and run this script again"
                    exit 1
                    ;;
                *)
                    print_error "Invalid choice"
                    exit 1
                    ;;
            esac
        else
            frontend_port=$default_port
        fi
    fi
    
    # Update environment with frontend port
    update_env_var "FRONTEND_PORT" "$frontend_port"
    export FRONTEND_PORT=$frontend_port
    
    print_success "Frontend will run on port: $frontend_port"
    
    return 0
}

# Function to update frontend environment variables
update_frontend_env() {
    print_status "Configuring frontend environment..."
    
    # Load backend info
    if [ -f "$STATUS_FILE" ]; then
        source "$STATUS_FILE"
    fi
    
    local machine_ip="${MACHINE_IP:-localhost}"
    local backend_port="${BACKEND_PORT:-8000}"
    local backend_url="http://$machine_ip:$backend_port"
    
    # Update Vite environment variables
    update_env_var "VITE_API_BASE_URL" "$backend_url"
    update_env_var "VITE_APP_NAME" "Legal AI Platform"
    update_env_var "VITE_APP_VERSION" "1.0.0"
    update_env_var "VITE_ENABLE_DEBUG" "true"
    
    print_success "Frontend environment configured"
    
    print_info "Frontend Configuration:"
    echo "  • Frontend Port:    ${FRONTEND_PORT:-3000}"
    echo "  • API Base URL:     $backend_url"
    echo "  • Machine IP:       $machine_ip"
}

# Function to check Node.js and npm
check_nodejs() {
    print_status "Checking Node.js and npm..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        echo ""
        echo "Node.js is required to run the frontend development server."
        echo "Please install Node.js (version 18 or higher) from: https://nodejs.org/"
        exit 1
    fi
    
    local node_version=$(node --version | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)
    
    if [ "$major_version" -lt 18 ]; then
        print_warning "Node.js version $node_version detected. Version 18+ recommended."
    else
        print_success "Node.js version $node_version detected"
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed!"
        echo "npm is required to manage frontend dependencies."
        exit 1
    fi
    
    print_success "Node.js and npm are available"
}

# Function to install frontend dependencies
install_dependencies() {
    print_header "Frontend Dependencies"
    
    local frontend_dir="$PROJECT_ROOT/frontend"
    
    if [ ! -d "$frontend_dir" ]; then
        print_error "Frontend directory not found: $frontend_dir"
        exit 1
    fi
    
    cd "$frontend_dir"
    
    # Check if node_modules exists and package-lock.json is newer
    if [ -f "package-lock.json" ] && [ -d "node_modules" ]; then
        if [ "package-lock.json" -nt "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
            print_status "Dependencies are outdated, reinstalling..."
            rm -rf node_modules
        else
            print_status "Dependencies appear to be up-to-date"
            return 0
        fi
    fi
    
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        
        if npm ci --silent; then
            print_success "Frontend dependencies installed successfully"
        else
            print_warning "npm ci failed, trying npm install..."
            if npm install --silent; then
                print_success "Frontend dependencies installed successfully"
            else
                print_error "Failed to install frontend dependencies"
                exit 1
            fi
        fi
    fi
    
    cd "$PROJECT_ROOT"
}

# Function to start frontend development server
start_frontend_server() {
    print_header "Starting Frontend Development Server"
    
    local frontend_dir="$PROJECT_ROOT/frontend"
    local frontend_port="${FRONTEND_PORT:-3000}"
    
    if [ "$USE_DOCKER" = true ]; then
        print_status "Starting frontend using Docker Compose..."
        
        if ! docker compose -f "$COMPOSE_FILE" up -d frontend; then
            print_error "Failed to start frontend container"
            exit 1
        fi
        
        # Wait for frontend container to be ready
        local max_wait=60
        local wait_interval=2
        local elapsed=0
        
        print_status "Waiting for frontend container to be ready..."
        
        while [ $elapsed -lt $max_wait ]; do
            if curl -f -s "http://localhost:$frontend_port" >/dev/null 2>&1; then
                print_success "Frontend container is ready!"
                break
            fi
            
            sleep $wait_interval
            elapsed=$((elapsed + wait_interval))
        done
        
        if [ $elapsed -ge $max_wait ]; then
            print_error "Frontend container failed to become ready"
            docker compose logs frontend
            exit 1
        fi
        
    else
        print_status "Starting Vite development server on port $frontend_port..."
        
        cd "$frontend_dir"
        
        # Create a simple check script to verify the server is running
        cat > "$PROJECT_ROOT/.frontend_startup_check.js" << 'EOF'
const http = require('http');

const checkServer = (port, maxAttempts = 30) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const check = () => {
      attempts++;
      const req = http.get(`http://localhost:${port}`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          console.log(`Frontend server is responding on port ${port}`);
          resolve(true);
        } else {
          if (attempts < maxAttempts) {
            setTimeout(check, 1000);
          } else {
            reject(new Error(`Server not ready after ${maxAttempts} attempts`));
          }
        }
      });
      
      req.on('error', (err) => {
        if (attempts < maxAttempts) {
          setTimeout(check, 1000);
        } else {
          reject(err);
        }
      });
    };
    
    check();
  });
};

checkServer(process.argv[2]).catch(console.error);
EOF
        
        # Start Vite in background
        print_status "Launching Vite development server..."
        
        # Set environment variables for Vite
        export VITE_API_URL="${VITE_API_BASE_URL}"
        export VITE_APP_NAME="${VITE_APP_NAME}"
        export VITE_APP_VERSION="${VITE_APP_VERSION}"
        export VITE_ENABLE_DEBUG="${VITE_ENABLE_DEBUG}"
        
        # Start Vite development server
        nohup npm run dev -- --host 0.0.0.0 --port $frontend_port > "$PROJECT_ROOT/.frontend.log" 2>&1 &
        local vite_pid=$!
        
        # Save PID for cleanup
        echo $vite_pid > "$PROJECT_ROOT/.frontend.pid"
        
        print_status "Vite development server started (PID: $vite_pid)"
        print_status "Waiting for server to be ready..."
        
        # Wait for server to be ready
        sleep 3
        
        if node "$PROJECT_ROOT/.frontend_startup_check.js" $frontend_port; then
            print_success "Frontend development server is ready!"
        else
            print_error "Frontend server failed to start properly"
            print_status "Checking logs..."
            tail -20 "$PROJECT_ROOT/.frontend.log"
            exit 1
        fi
        
        # Clean up check script
        rm -f "$PROJECT_ROOT/.frontend_startup_check.js"
    fi
    
    cd "$PROJECT_ROOT"
}

# Function to test frontend connectivity
test_frontend_connectivity() {
    print_header "Frontend Connectivity Test"
    
    local machine_ip="${MACHINE_IP:-localhost}"
    local frontend_port="${FRONTEND_PORT:-3000}"
    local frontend_url="http://$machine_ip:$frontend_port"
    local backend_url="${BACKEND_URL:-http://localhost:8000}"
    
    print_status "Testing frontend accessibility..."
    
    # Test frontend homepage
    if curl -f -s "$frontend_url" >/dev/null 2>&1; then
        print_success "Frontend is accessible at $frontend_url"
    else
        print_warning "Frontend may not be fully ready yet"
    fi
    
    # Test if frontend can reach backend (this would need to be tested in browser)
    print_status "Backend API available at: $backend_url"
    
    print_success "Connectivity tests completed"
}

# Function to save frontend status
save_frontend_status() {
    local machine_ip="${MACHINE_IP:-localhost}"
    local frontend_port="${FRONTEND_PORT:-3000}"
    
    # Create frontend status file
    cat > "$FRONTEND_STATUS_FILE" << EOF
# Frontend Status - Generated by launch-frontend.sh
FRONTEND_READY=true
MACHINE_IP=$machine_ip
FRONTEND_PORT=$frontend_port
FRONTEND_URL=http://$machine_ip:$frontend_port
BACKEND_URL=${BACKEND_URL:-http://localhost:8000}
USE_DOCKER=$USE_DOCKER
STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

    if [ "$USE_DOCKER" = false ] && [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
        echo "FRONTEND_PID=$(cat $PROJECT_ROOT/.frontend.pid)" >> "$FRONTEND_STATUS_FILE"
    fi
    
    print_success "Frontend status saved to $FRONTEND_STATUS_FILE"
}

# Function to display final status
display_status() {
    local machine_ip="${MACHINE_IP:-localhost}"
    local frontend_port="${FRONTEND_PORT:-3000}"
    local backend_url="${BACKEND_URL:-http://localhost:8000}"
    
    print_header "LEGAL AI PLATFORM READY"
    
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    🎉 PLATFORM FULLY OPERATIONAL 🎉            ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}  🌐 Main Application:${NC}"
    echo -e "     ${GREEN}http://$machine_ip:$frontend_port${NC}"
    if [ "$machine_ip" != "localhost" ]; then
        echo -e "     ${BLUE}http://localhost:$frontend_port${NC} (local)"
    fi
    echo ""
    echo -e "${CYAN}  🚀 Backend API:${NC}"
    echo -e "     ${GREEN}$backend_url${NC}"
    echo -e "     ${GREEN}$backend_url/docs${NC} (documentation)"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    print_info "Access your application:"
    echo "  • Main App:         http://$machine_ip:$frontend_port"
    echo "  • API Docs:         $backend_url/docs"
    echo "  • Health Check:     $backend_url/api/v1/health/ready"
    echo ""
    
    if [ "$USE_DOCKER" = false ]; then
        print_info "Development Server Info:"
        echo "  • Frontend logs:    tail -f .frontend.log"
        echo "  • Frontend PID:     $(cat .frontend.pid 2>/dev/null || echo 'unknown')"
        echo "  • Stop frontend:    kill \$(cat .frontend.pid)"
        echo ""
    fi
    
    print_info "Management Commands:"
    echo "  • View all logs:    docker compose logs -f"
    echo "  • Stop all:         docker compose down"
    echo "  • Restart backend:  ./launch-backend.sh"
    echo "  • Restart frontend: ./launch-frontend.sh"
    echo ""
    
    print_success "Legal AI Platform is ready for development!"
}

# Function to handle cleanup on script exit
cleanup_on_exit() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        print_error "Frontend startup failed"
        
        # Clean up PID file and status
        rm -f "$PROJECT_ROOT/.frontend.pid"
        rm -f "$PROJECT_ROOT/.frontend_startup_check.js"
        rm -f "$FRONTEND_STATUS_FILE"
        
        # Show logs if available
        if [ -f "$PROJECT_ROOT/.frontend.log" ]; then
            print_status "Frontend logs:"
            tail -20 "$PROJECT_ROOT/.frontend.log"
        fi
    fi
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto-port|-a)
                AUTO_PORT=true
                shift
                ;;
            --port|-p)
                FRONTEND_PORT="$2"
                shift 2
                ;;
            --docker|-d)
                USE_DOCKER=true
                shift
                ;;
            --skip-backend-check)
                SKIP_BACKEND_CHECK=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Frontend launch script for Legal AI Platform"
                echo ""
                echo "Options:"
                echo "  --auto-port, -a         Automatically find available port"
                echo "  --port PORT, -p PORT    Use specific port for frontend"
                echo "  --docker, -d            Use Docker Compose instead of local Vite"
                echo "  --skip-backend-check    Skip backend readiness verification"
                echo "  --verbose, -v           Verbose output"
                echo "  --help, -h              Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                      Normal frontend launch"
                echo "  $0 --auto-port          Auto-find available port"
                echo "  $0 --port 3001          Use port 3001"
                echo "  $0 --docker             Use Docker instead of local Node.js"
                echo ""
                echo "Prerequisites:"
                echo "  1. Backend services must be running (./launch-backend.sh)"
                echo "  2. Node.js 18+ and npm installed (unless using --docker)"
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
    
    print_header "Legal AI Platform - Frontend Launch"
    
    # Set up cleanup trap
    trap cleanup_on_exit EXIT
    
    # Load environment
    load_environment
    
    # Check backend readiness
    check_backend_status
    
    # Configure frontend port
    configure_frontend_port
    
    # Update frontend environment
    update_frontend_env
    
    if [ "$USE_DOCKER" = true ]; then
        print_status "Using Docker Compose for frontend"
    else
        # Check Node.js for local development
        check_nodejs
        
        # Install dependencies
        install_dependencies
    fi
    
    # Start frontend server
    start_frontend_server
    
    # Test connectivity
    test_frontend_connectivity
    
    # Save status
    save_frontend_status
    
    # Display final status
    display_status
    
    # Remove the error trap since we succeeded
    trap - EXIT
    
    if [ "$USE_DOCKER" = false ]; then
        print_status "Frontend development server is running in the background"
        print_status "Press Ctrl+C to stop this script (server will continue running)"
        print_status "To stop the server: kill \$(cat .frontend.pid)"
        
        # Keep script alive to show it's managing the frontend
        while true; do
            sleep 60
            # Check if frontend process is still running
            if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
                local pid=$(cat "$PROJECT_ROOT/.frontend.pid")
                if ! kill -0 "$pid" 2>/dev/null; then
                    print_error "Frontend server process died unexpectedly"
                    break
                fi
            else
                print_error "Frontend PID file disappeared"
                break
            fi
        done
    fi
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
