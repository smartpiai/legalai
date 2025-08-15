#!/bin/bash

# Backend Local Development Script
# Runs FastAPI backend locally with hot reload against containerized databases

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
BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_DIR="$BACKEND_DIR/venv"
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

# Function to check Python installation
check_python() {
    print_status "Checking Python installation..."
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed!"
        echo "Please install Python 3.11 or higher"
        exit 1
    fi
    
    python_version=$(python3 --version | cut -d' ' -f2)
    major_version=$(echo $python_version | cut -d'.' -f1)
    minor_version=$(echo $python_version | cut -d'.' -f2)
    
    if [ "$major_version" -lt 3 ] || ([ "$major_version" -eq 3 ] && [ "$minor_version" -lt 11 ]); then
        print_warning "Python version $python_version detected. Python 3.11+ recommended."
    else
        print_success "Python version $python_version detected"
    fi
}

# Function to setup virtual environment
setup_venv() {
    print_status "Setting up Python virtual environment..."
    
    cd "$BACKEND_DIR"
    
    if [ ! -d "$VENV_DIR" ]; then
        print_status "Creating virtual environment..."
        python3 -m venv venv
        print_success "Virtual environment created"
    else
        print_status "Virtual environment already exists"
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    print_status "Upgrading pip..."
    pip install --upgrade pip > /dev/null 2>&1
    
    # Install requirements
    print_status "Installing Python dependencies..."
    if pip install -r requirements.txt > /dev/null 2>&1; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Function to check database connectivity
check_databases() {
    print_status "Checking database connectivity..."
    
    # Load environment variables
    source "$ENV_FILE"
    
    # Check PostgreSQL
    if nc -z localhost ${POSTGRES_PORT} 2>/dev/null; then
        print_success "PostgreSQL is available on port ${POSTGRES_PORT}"
    else
        print_error "PostgreSQL is not available on port ${POSTGRES_PORT}"
        echo "Please ensure databases are running with: docker compose -f docker-compose.dev.yml up -d"
        exit 1
    fi
    
    # Check Redis
    if nc -z localhost ${REDIS_PORT} 2>/dev/null; then
        print_success "Redis is available on port ${REDIS_PORT}"
    else
        print_warning "Redis is not available on port ${REDIS_PORT}"
    fi
    
    # Check Neo4j
    if nc -z localhost ${NEO4J_HTTP_PORT} 2>/dev/null; then
        print_success "Neo4j is available on port ${NEO4J_HTTP_PORT}"
    else
        print_warning "Neo4j is not available on port ${NEO4J_HTTP_PORT}"
    fi
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Ensure environment variables are available for Alembic
    print_status "Testing database connection before migration..."
    local db_uri="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
    if psql "$db_uri" -c "SELECT 1;" >/dev/null 2>&1; then
        print_success "Database connection verified"
    else
        print_error "Cannot connect to database. Check if PostgreSQL container is running."
        return 1
    fi
    
    # Run migrations with environment variables
    print_status "Running Alembic migrations..."
    print_status "Using DATABASE_URL: $DATABASE_URL"
    
    # Explicitly set the environment for Alembic
    export DATABASE_URL="$DATABASE_URL"
    
    if alembic upgrade head; then
        print_success "Database migrations completed"
    else
        print_error "Migration failed"
        print_error "Database URL used: $DATABASE_URL"
        return 1
    fi
}

# Function to start backend server
start_backend() {
    print_header "Starting Backend Development Server"
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Load environment configuration
    print_status "Loading environment configuration..."
    
    # Use safer method to load environment variables
    set -a  # Automatically export all variables
    source "$ENV_FILE"
    set +a  # Stop automatic export
    
    print_success "Loaded environment configuration"
    print_status "Database URL: $DATABASE_URL"
    print_status "ALLOWED_HOSTS: $ALLOWED_HOSTS"
    
    print_status "Starting FastAPI backend with hot reload..."
    print_status "Backend will be available at: http://localhost:8000"
    print_status "API documentation: http://localhost:8000/docs"
    print_status "Press Ctrl+C to stop the server"
    
    echo ""
    
    # Start Uvicorn with hot reload
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --reload-dir app
}

# Main execution function
main() {
    print_header "Legal AI Platform - Backend Local Development"
    
    # Load environment at the top level
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found: $ENV_FILE"
        echo "Please run the main './launch-dev.sh' script first."
        exit 1
    fi
    set -a # Automatically export all variables from the .env file
    source "$ENV_FILE"
    set +a

    # Pre-flight checks
    check_python
    
    # Setup development environment
    setup_venv
    
    # Check database connectivity
    check_databases
    
    # Run migrations
    run_migrations
    
    # Start backend server
    start_backend
}

# Handle cleanup on script exit
cleanup() {
    print_status "Shutting down backend development server..."
    # Kill any uvicorn processes
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
}

trap cleanup EXIT

# Run main function
main "$@"
