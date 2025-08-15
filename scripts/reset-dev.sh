#!/bin/bash

# Reset Development Environment
# Resets databases and restarts development environment

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
NC='\033[0m'

# Command line options
RESET_DATA=false
RESET_DEPS=false

print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ⚠ $1"
}

echo -e "\n${PURPLE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}           Legal AI Platform - Reset Development                  ${NC}"
echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}\n"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --data)
            RESET_DATA=true
            shift
            ;;
        --deps)
            RESET_DEPS=true
            shift
            ;;
        --all)
            RESET_DATA=true
            RESET_DEPS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --data      Reset database data (removes volumes)"
            echo "  --deps      Reset dependencies (removes node_modules, venv)"
            echo "  --all       Reset everything (data + dependencies)"
            echo "  --help, -h  Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0              # Soft reset (restart services)"
            echo "  $0 --data       # Reset database data"
            echo "  $0 --all        # Complete reset"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Stop development environment
print_status "Stopping development environment..."
"$SCRIPT_DIR/stop-dev.sh"

# Reset database data if requested
if [ "$RESET_DATA" = true ]; then
    print_warning "Resetting database data (this will delete all data)..."
    read -p "Are you sure? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        docker compose -f "$PROJECT_ROOT/docker-compose.dev.yml" down -v
        print_success "Database data reset"
    else
        print_status "Database reset cancelled"
    fi
fi

# Reset dependencies if requested
if [ "$RESET_DEPS" = true ]; then
    print_warning "Resetting dependencies..."
    
    # Reset Python venv
    if [ -d "$PROJECT_ROOT/backend/venv" ]; then
        print_status "Removing Python virtual environment..."
        rm -rf "$PROJECT_ROOT/backend/venv"
    fi
    
    # Reset Node.js modules
    if [ -d "$PROJECT_ROOT/frontend/node_modules" ]; then
        print_status "Removing Node.js modules..."
        rm -rf "$PROJECT_ROOT/frontend/node_modules"
    fi
    
    # Reset package-lock
    if [ -f "$PROJECT_ROOT/frontend/package-lock.json" ]; then
        print_status "Removing package-lock.json..."
        rm -f "$PROJECT_ROOT/frontend/package-lock.json"
    fi
    
    print_success "Dependencies reset"
fi

print_success "Reset completed"

echo ""
echo -e "${GREEN}✓ Development environment has been reset${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  ./launch-dev.sh                    # Restart development environment"
echo "  ./launch-dev.sh --background       # Start in background mode"
echo ""