#!/bin/bash

# Wait for Backend Script
# Legal AI Platform - Frontend Service Health Check

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_RETRIES=60
RETRY_INTERVAL=2
BACKEND_HOST="${BACKEND_HOST:-localhost}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"

# Function to print colored output
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

# Function to check backend health
check_backend_health() {
    print_status "Checking backend health at $BACKEND_URL..."
    
    # First check basic connectivity
    if curl -f -s "$BACKEND_URL/api/v1/health" >/dev/null 2>&1; then
        print_success "Backend basic health check passed"
        
        # Check readiness probe for full startup validation
        if curl -f -s "$BACKEND_URL/api/v1/health/ready" >/dev/null 2>&1; then
            print_success "Backend readiness check passed"
            return 0
        else
            print_warning "Backend is running but not ready (dependencies may still be initializing)"
            return 1
        fi
    else
        return 1
    fi
}

# Function to wait for backend
wait_for_backend() {
    print_status "Waiting for backend to be ready at $BACKEND_URL..."
    print_status "Max retries: $MAX_RETRIES, Retry interval: ${RETRY_INTERVAL}s"
    
    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if check_backend_health; then
            print_success "Backend is ready!"
            return 0
        fi
        
        retries=$((retries + 1))
        print_status "Attempt $retries/$MAX_RETRIES - Backend not ready yet, waiting ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    print_error "Backend failed to become ready after $MAX_RETRIES attempts"
    print_error "Please check backend logs: docker compose logs backend"
    return 1
}

# Function to verify API endpoints
verify_api_endpoints() {
    print_status "Verifying critical API endpoints..."
    
    # Test authentication endpoint
    if curl -f -s "$BACKEND_URL/api/v1/auth/me" >/dev/null 2>&1; then
        print_success "Auth endpoint is accessible"
    else
        print_warning "Auth endpoint check failed (this may be expected without authentication)"
    fi
    
    # Test OpenAPI docs
    if curl -f -s "$BACKEND_URL/docs" >/dev/null 2>&1; then
        print_success "API documentation is accessible"
    else
        print_warning "API documentation endpoint not accessible"
    fi
    
    # Test health endpoints
    if curl -f -s "$BACKEND_URL/api/v1/health" >/dev/null 2>&1; then
        print_success "Health monitoring is accessible"
    else
        print_error "Health monitoring endpoint failed"
        return 1
    fi
    
    return 0
}

# Function to display backend information
display_backend_info() {
    print_status "Backend service information:"
    
    # Get service version and status
    local health_response
    health_response=$(curl -s "$BACKEND_URL/api/v1/health" 2>/dev/null || echo '{}')
    
    echo "  • Backend URL: $BACKEND_URL"
    echo "  • API Documentation: $BACKEND_URL/docs"
    echo "  • Health Check: $BACKEND_URL/api/v1/health"
    echo "  • Readiness Check: $BACKEND_URL/api/v1/health/ready"
    
    # Extract version if available
    local version
    version=$(echo "$health_response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
    echo "  • Service Version: $version"
    
    # Extract environment if available
    local environment
    environment=$(echo "$health_response" | grep -o '"environment":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
    echo "  • Environment: $environment"
}

# Main execution
main() {
    print_status "Starting backend health check for frontend startup..."
    print_status "Target backend: $BACKEND_URL"
    
    if wait_for_backend; then
        if verify_api_endpoints; then
            display_backend_info
            print_success "Backend is fully ready for frontend connection!"
            return 0
        else
            print_error "Backend API endpoint verification failed"
            return 1
        fi
    else
        print_error "Backend health check failed"
        print_status "Troubleshooting tips:"
        echo "  1. Check if backend container is running: docker compose ps backend"
        echo "  2. Check backend logs: docker compose logs backend"
        echo "  3. Check if backend port $BACKEND_PORT is accessible"
        echo "  4. Verify environment variables in .env file"
        return 1
    fi
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi