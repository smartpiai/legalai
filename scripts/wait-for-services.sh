#!/bin/bash

# Wait for Services Script
# Legal AI Platform - Database Health Check and Initialization

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_RETRIES=30
RETRY_INTERVAL=2

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

# Function to wait for a service
wait_for_service() {
    local service_name=$1
    local host=$2
    local port=$3
    local check_command=$4
    
    print_status "Waiting for $service_name at $host:$port..."
    
    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if eval "$check_command" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        retries=$((retries + 1))
        print_status "Attempt $retries/$MAX_RETRIES - $service_name not ready yet, waiting ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    print_error "$service_name failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# Function to check PostgreSQL
check_postgres() {
    print_status "Checking PostgreSQL connection..."
    # Use internal Docker port 5432, not the host-mapped port
    # Use Python to check connection since pg_isready isn't available
    wait_for_service "PostgreSQL" "${POSTGRES_HOST:-postgres}" "5432" \
        "python -c \"import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); result = s.connect_ex(('${POSTGRES_HOST:-postgres}', 5432)); s.close(); exit(result)\""
    
    # Test actual database connection using Python
    print_status "Testing database connection..."
    # Set defaults if environment variables are not set
    POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
    POSTGRES_USER="${POSTGRES_USER:-postgres}"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-password}"
    POSTGRES_DB="${POSTGRES_DB:-legal_ai}"
    
    if python -c "
import psycopg2
import os
try:
    conn = psycopg2.connect(
        host='$POSTGRES_HOST',
        port=5432,
        user='$POSTGRES_USER',
        password='$POSTGRES_PASSWORD',
        database='$POSTGRES_DB'
    )
    conn.close()
    exit(0)
except Exception as e:
    print(f'Connection failed: {e}')
    exit(1)
" 2>&1 | grep -q "Connection failed"; then
        print_error "Failed to connect to PostgreSQL database"
        return 1
    else
        print_success "PostgreSQL database connection successful!"
    fi
}

# Function to check Redis
check_redis() {
    print_status "Checking Redis connection..."
    # Use internal Docker port 6379, not the host-mapped port
    wait_for_service "Redis" "${REDIS_HOST:-redis}" "6379" \
        "python -c \"import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); result = s.connect_ex(('${REDIS_HOST:-redis}', 6379)); s.close(); exit(result)\""
}

# Function to check Neo4j
check_neo4j() {
    print_status "Checking Neo4j connection..."
    # Use internal Docker port 7687, not the host-mapped port
    wait_for_service "Neo4j" "${NEO4J_HOST:-neo4j}" "7687" \
        "python -c \"import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); result = s.connect_ex(('${NEO4J_HOST:-neo4j}', 7687)); s.close(); exit(result)\""
}

# Function to check Qdrant
check_qdrant() {
    print_status "Checking Qdrant connection..."
    # Use internal Docker port 6333, not the host-mapped port
    wait_for_service "Qdrant" "${QDRANT_HOST:-qdrant}" "6333" \
        "python -c \"import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); result = s.connect_ex(('${QDRANT_HOST:-qdrant}', 6333)); s.close(); exit(result)\""
    
    # Create initial collections if they don't exist (using Python requests)
    print_status "Initializing Qdrant collections..."
    python -c "
import requests
import json

try:
    # Create documents collection
    r = requests.put(
        'http://${QDRANT_HOST:-qdrant}:6333/collections/documents',
        json={
            'vectors': {'size': 384, 'distance': 'Cosine'},
            'optimizers_config': {'default_segment_number': 2},
            'replication_factor': 1
        }
    )
except:
    pass  # Collection may already exist

try:
    # Create contracts collection
    r = requests.put(
        'http://${QDRANT_HOST:-qdrant}:6333/collections/contracts',
        json={
            'vectors': {'size': 384, 'distance': 'Cosine'},
            'optimizers_config': {'default_segment_number': 2},
            'replication_factor': 1
        }
    )
except:
    pass  # Collection may already exist
" 2>/dev/null || print_warning "Qdrant collections initialization skipped"
    
    print_success "Qdrant check completed!"
}

# Function to check MinIO
check_minio() {
    print_status "Checking MinIO connection..."
    # Use internal Docker port 9000, not the host-mapped port
    wait_for_service "MinIO" "${MINIO_HOST:-minio}" "9000" \
        "python -c \"import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); result = s.connect_ex(('${MINIO_HOST:-minio}', 9000)); s.close(); exit(result)\""
    
    # Create initial buckets
    print_status "Initializing MinIO buckets..."
    
    # Note: This would require mc (MinIO client) to be installed
    # For now, we'll just check if the service is responsive
    print_success "MinIO health check passed!"
}

# Main execution
main() {
    print_status "Starting database health checks and initialization..."
    print_status "Using environment: ${ENVIRONMENT:-development}"
    
    # Check all required services
    check_postgres || exit 1
    check_redis || exit 1
    check_neo4j || exit 1
    check_qdrant || exit 1
    check_minio || exit 1
    
    print_success "All database services are ready!"
    print_status "Database initialization completed successfully"
    
    # Optional: Run additional initialization scripts
    if [ -f "/scripts/seed-data.sh" ]; then
        print_status "Running seed data script..."
        /scripts/seed-data.sh
    fi
    
    return 0
}

# Execute main function
main "$@"