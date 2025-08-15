#!/bin/bash

# Frontend Local Development Script
# Runs Vite frontend locally with hot reload against local backend

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

# Configuration
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ENV_FILE="$PROJECT_ROOT/.env"

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

# Function to check Node.js installation
check_nodejs() {
    print_status "Checking Node.js installation..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        echo "Please install Node.js 18+ from: https://nodejs.org/"
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
        exit 1
    fi
    
    print_success "Node.js and npm are available"
}

# Function to install frontend dependencies
install_dependencies() {
    print_status "Installing frontend dependencies..."
    
    cd "$FRONTEND_DIR"
    
    # Check if node_modules exists and is up to date
    if [ -f "package-lock.json" ] && [ -d "node_modules" ]; then
        if [ "package-lock.json" -nt "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
            print_status "Dependencies are outdated, reinstalling..."
            rm -rf node_modules
        fi
    fi
    
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        if npm install; then
            print_success "Dependencies installed successfully"
        else
            print_error "Failed to install dependencies"
            exit 1
        fi
    else
        print_success "Dependencies are up to date"
    fi
}

# Function to check backend connectivity
check_backend() {
    print_status "Checking backend connectivity..."
    
    # Load environment
    source "$ENV_FILE"
    
    # Extract host and port from VITE_API_BASE_URL
    local api_url=$(grep "^VITE_API_BASE_URL=" "$ENV_FILE" | cut -d'=' -f2)
    # Remove /api/v1 suffix
    local backend_base_url=${api_url%/api/v1}

    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for backend at $backend_base_url..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$backend_base_url/api/v1/health/ready" >/dev/null 2>&1; then
            print_success "Backend is ready and responding at $backend_base_url"
            return 0
        fi
        
        if [ $((attempt % 10)) -eq 0 ]; then
            print_status "Still waiting for backend... (attempt $attempt/$max_attempts)"
        fi
        
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_warning "Backend not ready yet, but continuing with frontend startup"
    print_status "You may need to start the backend separately with: ./scripts/backend-dev.sh"
}

# Function to start frontend development server
start_frontend() {
    print_header "Starting Frontend Development Server"
    
    cd "$FRONTEND_DIR"
    
    # Load environment
    source "$ENV_FILE"
    
    local api_url=$(grep "^VITE_API_BASE_URL=" "$ENV_FILE" | cut -d'=' -f2)

    print_status "Starting Vite development server with hot reload..."
    print_status "Frontend will be available at: http://localhost:3000"
    print_status "Backend API: $api_url"
    print_status "Press Ctrl+C to stop the server"
    
    echo ""
    
    # Set environment variables for Vite
    # VITE_API_BASE_URL is now set by the parent launch-dev.sh script
    export VITE_APP_NAME="Legal AI Platform"
    export VITE_APP_VERSION="1.0.0"
    export VITE_ENABLE_DEBUG="true"
    
    # Start Vite development server with hot reload
    exec npm run dev -- --host 0.0.0.0 --port 3000
}

# Main execution function
main() {
    print_header "Legal AI Platform - Frontend Local Development"
    
    # Pre-flight checks
    check_nodejs
    
    # Load environment
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found: $ENV_FILE"
        echo "Please ensure .env file exists in the project root"
        exit 1
    fi
    
    # Install dependencies
    install_dependencies
    
    # Check backend (optional)
    check_backend
    
    # Start frontend server
    start_frontend
}

# Handle cleanup on script exit
cleanup() {
    print_status "Shutting down frontend development server..."
    # Cleanup handled by npm/vite automatically
}

trap cleanup EXIT

# Command line argument parsing
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Frontend local development script for Legal AI Platform"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo ""
        echo "Prerequisites:"
        echo "  1. Node.js 18+ installed"
        echo "  2. Backend running (./scripts/backend-dev.sh)"
        echo "  3. Databases running (docker compose -f docker-compose.dev.yml up -d)"
        echo ""
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
