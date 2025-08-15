#!/bin/bash

# Comprehensive Development Environment Cleanup Script
# Legal AI Platform

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
DEV_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
BACKEND_PID_FILE="$PROJECT_ROOT/.backend-dev.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/.frontend-dev.pid"

# Command line options
DEEP_CLEAN=false

print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

print_header() {
    echo -e "\n${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}\n"
}

# Function to stop and remove Docker containers
cleanup_docker() {
    print_header "PHASE 1: Cleaning Up Docker Services"
    
    print_status "Checking for running dev containers..."
    if [ -f "$DEV_COMPOSE_FILE" ] && [ "$(docker compose -f "$DEV_COMPOSE_FILE" ps -q)" ]; then
        print_status "Stopping and removing dev containers..."
        if [ "$DEEP_CLEAN" = true ]; then
            print_status "Performing deep clean: removing volumes..."
            docker compose -f "$DEV_COMPOSE_FILE" down -v --remove-orphans
        else
            docker compose -f "$DEV_COMPOSE_FILE" down --remove-orphans
        fi
        print_success "Docker services cleaned up."
    else
        print_success "No running dev containers found."
    fi
}

# Function to stop local processes
cleanup_processes() {
    print_header "PHASE 2: Stopping Local Processes"

    # Stop backend process
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        print_status "Stopping backend process (PID: $pid)..."
        if kill "$pid" > /dev/null 2>&1; then
            print_success "Backend process stopped."
        else
            print_status "Backend process not found, already stopped."
        fi
        rm "$BACKEND_PID_FILE"
    else
        print_success "No backend PID file found."
    fi

    # Stop frontend process
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        print_status "Stopping frontend process (PID: $pid)..."
        if kill "$pid" > /dev/null 2>&1; then
            print_success "Frontend process stopped."
        else
            print_status "Frontend process not found, already stopped."
        fi
        rm "$FRONTEND_PID_FILE"
    else
        print_success "No frontend PID file found."
    fi
    
    # Kill any lingering processes
    print_status "Searching for and stopping any lingering dev processes..."
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    print_success "Lingering processes stopped."
}

# Function for deep cleaning of files
deep_clean_files() {
    if [ "$DEEP_CLEAN" = true ]; then
        print_header "PHASE 3: Deep Cleaning Filesystem"

        print_status "Removing Python virtual environment..."
        rm -rf "$PROJECT_ROOT/backend/venv"
        print_success "Python virtual environment removed."

        print_status "Removing frontend node_modules..."
        rm -rf "$PROJECT_ROOT/frontend/node_modules"
        print_success "Frontend node_modules removed."
        
        print_status "Removing dashboard node_modules..."
        rm -rf "$PROJECT_ROOT/dashboard/node_modules"
        print_success "Dashboard node_modules removed."

        print_status "Removing Python cache files..."
        find "$PROJECT_ROOT" -type d -name "__pycache__" -exec rm -rf {} +
        find "$PROJECT_ROOT" -type f -name "*.pyc" -delete
        print_success "Python cache files removed."

        print_status "Removing test coverage reports..."
        rm -rf "$PROJECT_ROOT/.coverage"
        rm -rf "$PROJECT_ROOT/coverage"
        rm -rf "$PROJECT_ROOT/htmlcov"
        print_success "Test coverage reports removed."
        
        print_status "Removing .env file..."
        rm -f "$PROJECT_ROOT/.env"
        print_success ".env file removed."
    fi
}

# Function to remove log files
cleanup_logs() {
    print_header "PHASE 4: Removing Log Files"
    print_status "Removing .log files from project root..."
    rm -f "$PROJECT_ROOT"/*.log
    print_success "Log files removed."
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                DEEP_CLEAN=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Comprehensive cleanup script for the Legal AI Platform dev environment."
                echo ""
                echo "Options:"
                echo "  --all        Perform a deep clean: removes Docker volumes, venv, node_modules, and .env file."
                echo "  --help, -h   Show this help message"
                echo ""
                echo "Default behavior (no flags):"
                echo "  - Stops all Docker containers and local processes."
                echo "  - Removes log files."
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
    
    print_header "Legal AI Platform - Development Environment Cleanup"
    
    cleanup_docker
    cleanup_processes
    deep_clean_files
    cleanup_logs
    
    print_header "Cleanup Complete"
    if [ "$DEEP_CLEAN" = true ]; then
        print_success "Deep clean finished. The environment is reset to a pristine state."
        print_status "Run './launch-dev.sh' to re-initialize everything."
    else
        print_success "Standard cleanup finished. Docker containers and processes have been stopped."
        print_status "Run './launch-dev.sh' to restart the environment."
    fi
    echo ""
}

# Script entry point
main "$@"
