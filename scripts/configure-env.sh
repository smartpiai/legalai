#!/bin/bash

# Environment Configuration Script
# Detects IP addresses and available ports, then configures .env file
# Works for both development and production environments

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

# Configuration files
ENV_FILE="$PROJECT_ROOT/.env"
ENV_BACKUP="$PROJECT_ROOT/.env.backup.$(date +%Y%m%d_%H%M%S)"

# Default ports
DEFAULT_POSTGRES_PORT=15432
DEFAULT_REDIS_PORT=16379
DEFAULT_NEO4J_HTTP_PORT=17474
DEFAULT_NEO4J_PORT=17687
DEFAULT_QDRANT_PORT=16333
DEFAULT_QDRANT_GRPC_PORT=16334
DEFAULT_MINIO_PORT=19000
DEFAULT_MINIO_CONSOLE_PORT=19001
DEFAULT_CLAMAV_PORT=13311
DEFAULT_BACKEND_PORT=8000
DEFAULT_FRONTEND_PORT=3000

# Command line options
AUTO_DETECT=true
FORCE_IP=""
DEV_MODE=false

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

# Function to detect machine IP address (returns clean IP only)
detect_machine_ip() {
    local detected_ip=""
    
    # If IP was forced via command line, use that
    if [ -n "$FORCE_IP" ]; then
        echo "$FORCE_IP"
        return 0
    fi
    
    # Method 1: Try hostname -I (most reliable on Linux)
    if command -v hostname >/dev/null 2>&1; then
        detected_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$detected_ip" ] && [ "$detected_ip" != "127.0.0.1" ]; then
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Method 2: Try ip command
    if command -v ip >/dev/null 2>&1; then
        detected_ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
        if [ -n "$detected_ip" ]; then
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Method 3: Try to get from default route
    if command -v ip >/dev/null 2>&1; then
        detected_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
        if [ -n "$detected_ip" ] && [ "$detected_ip" != "127.0.0.1" ]; then
            echo "$detected_ip"
            return 0
        fi
    fi
    
    # Default to localhost if nothing else works
    echo "localhost"
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

# Function to backup existing .env file
backup_env_file() {
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$ENV_BACKUP"
        print_success "Environment backup created: $ENV_BACKUP"
    fi
}

# Function to update or add environment variable
update_env_var() {
    local key=$1
    local value=$2
    
    if grep -q "^$key=" "$ENV_FILE" 2>/dev/null; then
        # Update existing variable
        # Use a safer approach that handles special characters
        grep -v "^$key=" "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || touch "$ENV_FILE.tmp"
        echo "$key=\"$value\"" >> "$ENV_FILE.tmp"
        mv "$ENV_FILE.tmp" "$ENV_FILE"
    else
        # Add new variable
        echo "$key=\"$value\"" >> "$ENV_FILE"
    fi
}

# Function to configure IP addresses and ports
configure_environment() {
    print_header "Environment Configuration"
    
    # Detect machine IP
    print_status "Detecting machine IP address..."
    local machine_ip=$(detect_machine_ip)
    print_success "Detected machine IP: $machine_ip"
    
    # Backup existing .env file
    backup_env_file
    
    # Ensure .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        touch "$ENV_FILE"
        print_status "Created new .env file"
    fi
    
    print_status "Configuring IP addresses and ports..."
    
    # Find available ports
    local postgres_port=$(find_available_port $DEFAULT_POSTGRES_PORT)
    local redis_port=$(find_available_port $DEFAULT_REDIS_PORT)
    local neo4j_http_port=$(find_available_port $DEFAULT_NEO4J_HTTP_PORT)
    local neo4j_port=$(find_available_port $DEFAULT_NEO4J_PORT)
    local qdrant_port=$(find_available_port $DEFAULT_QDRANT_PORT)
    local qdrant_grpc_port=$(find_available_port $DEFAULT_QDRANT_GRPC_PORT)
    local minio_port=$(find_available_port $DEFAULT_MINIO_PORT)
    local minio_console_port=$(find_available_port $DEFAULT_MINIO_CONSOLE_PORT)
    local clamav_port=$(find_available_port $DEFAULT_CLAMAV_PORT)
    local backend_port=$(find_available_port $DEFAULT_BACKEND_PORT)
    local frontend_port=$(find_available_port $DEFAULT_FRONTEND_PORT)
    
    # Application Settings
    update_env_var "PROJECT_NAME" "Legal AI Platform"
    update_env_var "VERSION" "1.0.0"
    update_env_var "ENVIRONMENT" "development"
    update_env_var "DEBUG" "true"
    
    # Network Configuration
    update_env_var "HOST" "0.0.0.0"
    update_env_var "BACKEND_HOST" "$machine_ip"
    update_env_var "BACKEND_PORT" "$backend_port"
    update_env_var "FRONTEND_HOST" "$machine_ip"
    update_env_var "FRONTEND_PORT" "$frontend_port"
    
    # API Configuration
    update_env_var "API_V1_STR" "/api/v1"
    update_env_var "BACKEND_URL" "http://$machine_ip:$backend_port"
    update_env_var "FRONTEND_URL" "http://$machine_ip:$frontend_port"
    
    # Frontend Environment Variables
    if [ "$DEV_MODE" = true ]; then
        # For local development, use localhost
        update_env_var "VITE_API_BASE_URL" "http://localhost:$backend_port/api/v1"
    else
        # For production/network access, use machine IP
        update_env_var "VITE_API_BASE_URL" "http://$machine_ip:$backend_port/api/v1"
    fi
    update_env_var "VITE_APP_NAME" "Legal AI Platform"
    update_env_var "VITE_APP_VERSION" "1.0.0"
    update_env_var "VITE_ENABLE_ANALYTICS" "false"
    update_env_var "VITE_ENABLE_DEBUG" "true"
    
    # Security Configuration
    update_env_var "SECRET_KEY" "dev-secret-key-change-in-production-make-it-very-long-and-random"
    update_env_var "JWT_SECRET_KEY" "dev-jwt-secret-change-in-production-also-very-long-and-random"
    update_env_var "JWT_ALGORITHM" "HS256"
    update_env_var "ACCESS_TOKEN_EXPIRE_MINUTES" "30"
    update_env_var "REFRESH_TOKEN_EXPIRE_DAYS" "7"
    
    # CORS Configuration
    if [ "$DEV_MODE" = true ]; then
        # For local development
        update_env_var "BACKEND_CORS_ORIGINS" "http://localhost:$frontend_port,http://localhost:$backend_port,http://127.0.0.1:$frontend_port,http://127.0.0.1:$backend_port"
    else
        # For network access
        update_env_var "BACKEND_CORS_ORIGINS" "http://localhost:$frontend_port,http://localhost:$backend_port,http://$machine_ip:$frontend_port,http://$machine_ip:$backend_port"
    fi
    update_env_var "ALLOWED_HOSTS" "*"
    
    # Database Configuration
    update_env_var "POSTGRES_USER" "postgres"
    update_env_var "POSTGRES_PASSWORD" "dev_password_change_in_prod"
    update_env_var "POSTGRES_DB" "legal_ai"
    update_env_var "POSTGRES_HOST" "localhost"
    update_env_var "POSTGRES_PORT" "$postgres_port"
    
    if [ "$DEV_MODE" = true ]; then
        # For local development - use localhost
        update_env_var "DATABASE_URL" "postgresql://postgres:dev_password_change_in_prod@localhost:$postgres_port/legal_ai"
        update_env_var "TEST_DATABASE_URL" "postgresql://postgres:dev_password_change_in_prod@localhost:$postgres_port/legal_ai_test"
    else
        # For production - use container names
        update_env_var "DATABASE_URL" "postgresql://postgres:dev_password_change_in_prod@postgres:5432/legal_ai"
        update_env_var "TEST_DATABASE_URL" "postgresql://postgres:dev_password_change_in_prod@postgres:5432/legal_ai_test"
    fi
    
    # Redis Configuration
    update_env_var "REDIS_HOST" "localhost"
    update_env_var "REDIS_PORT" "$redis_port"
    update_env_var "REDIS_PASSWORD" ""
    update_env_var "REDIS_DB" "0"
    update_env_var "REDIS_URL" "redis://localhost:$redis_port/0"
    
    # Neo4j Configuration
    update_env_var "NEO4J_HOST" "localhost"
    update_env_var "NEO4J_PORT" "$neo4j_port"
    update_env_var "NEO4J_HTTP_PORT" "$neo4j_http_port"
    update_env_var "NEO4J_USER" "neo4j"
    update_env_var "NEO4J_PASSWORD" "dev_neo4j_password"
    update_env_var "NEO4J_URI" "bolt://localhost:$neo4j_port"
    update_env_var "NEO4J_AUTH" "neo4j/dev_neo4j_password"
    
    # Qdrant Configuration
    update_env_var "QDRANT_HOST" "localhost"
    update_env_var "QDRANT_PORT" "$qdrant_port"
    update_env_var "QDRANT_GRPC_PORT" "$qdrant_grpc_port"
    update_env_var "QDRANT_URL" "http://localhost:$qdrant_port"
    
    # MinIO Configuration
    update_env_var "MINIO_HOST" "localhost"
    update_env_var "MINIO_PORT" "$minio_port"
    update_env_var "MINIO_CONSOLE_PORT" "$minio_console_port"
    update_env_var "MINIO_ROOT_USER" "dev_minio_admin"
    update_env_var "MINIO_ROOT_PASSWORD" "dev_minio_password_123"
    update_env_var "MINIO_ACCESS_KEY" "dev_minio_admin"
    update_env_var "MINIO_SECRET_KEY" "dev_minio_password_123"
    update_env_var "MINIO_ENDPOINT" "localhost:$minio_port"
    update_env_var "MINIO_SECURE" "false"
    update_env_var "S3_ENDPOINT" "http://localhost:$minio_port"
    update_env_var "S3_ACCESS_KEY" "dev_minio_admin"
    update_env_var "S3_SECRET_KEY" "dev_minio_password_123"
    update_env_var "S3_BUCKET" "legal-documents"
    
    # ClamAV Configuration
    update_env_var "CLAMAV_HOST" "localhost"
    update_env_var "CLAMAV_PORT" "$clamav_port"
    update_env_var "CLAMAV_NO_FRESHCLAM" "false"
    update_env_var "CLAMAV_NO_CLAMD" "false"
    
    # Additional Configuration
    update_env_var "MODEL_PATH" "./models"
    update_env_var "EMBEDDING_MODEL" "sentence-transformers/all-MiniLM-L6-v2"
    update_env_var "RATE_LIMIT_ENABLED" "true"
    update_env_var "RATE_LIMIT_PER_MINUTE" "100"
    update_env_var "RATE_LIMIT_PER_HOUR" "5000"
    
    # OAuth Configuration
    if [ "$DEV_MODE" = true ]; then
        update_env_var "GOOGLE_REDIRECT_URI" "http://localhost:$backend_port/api/v1/auth/oauth/google/callback"
        update_env_var "MICROSOFT_REDIRECT_URI" "http://localhost:$backend_port/api/v1/auth/oauth/microsoft/callback"
        update_env_var "GITHUB_REDIRECT_URI" "http://localhost:$backend_port/api/v1/auth/oauth/github/callback"
    else
        update_env_var "GOOGLE_REDIRECT_URI" "http://$machine_ip:$backend_port/api/v1/auth/oauth/google/callback"
        update_env_var "MICROSOFT_REDIRECT_URI" "http://$machine_ip:$backend_port/api/v1/auth/oauth/microsoft/callback"
        update_env_var "GITHUB_REDIRECT_URI" "http://$machine_ip:$backend_port/api/v1/auth/oauth/github/callback"
    fi
    
    # Feature Flags
    update_env_var "FEATURE_FLAGS_ENABLED" "true"
    update_env_var "FEATURE_FLAGS_CACHE_TTL" "300"
    
    # API Key Configuration
    update_env_var "API_KEY_PREFIX" "lglai"
    update_env_var "API_KEY_LENGTH" "32"
    update_env_var "API_KEY_DEFAULT_RATE_LIMIT_PER_MINUTE" "60"
    update_env_var "API_KEY_DEFAULT_RATE_LIMIT_PER_HOUR" "1000"
    
    # Celery Configuration
    update_env_var "CELERY_BROKER_URL" "redis://localhost:$redis_port/1"
    update_env_var "CELERY_RESULT_BACKEND" "redis://localhost:$redis_port/2"
    
    # Logging Configuration
    update_env_var "LOG_LEVEL" "INFO"
    update_env_var "LOG_FORMAT" "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Health Check Configuration
    update_env_var "HEALTH_CHECK_TIMEOUT" "30"
    update_env_var "HEALTH_CHECK_INTERVAL" "10"
    update_env_var "HEALTH_CHECK_RETRIES" "5"
    
    # Development Tools
    update_env_var "ENABLE_PROFILING" "false"
    update_env_var "ENABLE_DEBUG_TOOLBAR" "true"
    update_env_var "RELOAD_ON_CHANGE" "true"
    
    print_success "Environment configuration completed"
}

# Function to display configuration summary
display_configuration() {
    print_header "Configuration Summary"
    
    # Load the configured values
    source "$ENV_FILE"
    
    echo -e "${CYAN}🌐 Network Configuration:${NC}"
    echo "  • Machine IP:          $BACKEND_HOST"
    echo "  • Backend Port:        $BACKEND_PORT"
    echo "  • Frontend Port:       $FRONTEND_PORT"
    echo ""
    
    echo -e "${CYAN}🗄️  Database Ports:${NC}"
    echo "  • PostgreSQL:          localhost:$POSTGRES_PORT"
    echo "  • Redis:               localhost:$REDIS_PORT"
    echo "  • Neo4j HTTP:          localhost:$NEO4J_HTTP_PORT"
    echo "  • Neo4j Bolt:          localhost:$NEO4J_PORT"
    echo "  • Qdrant:              localhost:$QDRANT_PORT"
    echo "  • MinIO API:           localhost:$MINIO_PORT"
    echo "  • MinIO Console:       localhost:$MINIO_CONSOLE_PORT"
    echo "  • ClamAV:              localhost:$CLAMAV_PORT"
    echo ""
    
    echo -e "${CYAN}🔗 Access URLs:${NC}"
    if [ "$DEV_MODE" = true ]; then
        echo "  • Frontend:            http://localhost:$FRONTEND_PORT"
        echo "  • Backend API:         http://localhost:$BACKEND_PORT"
        echo "  • API Documentation:   http://localhost:$BACKEND_PORT/docs"
    else
        echo "  • Frontend:            http://$BACKEND_HOST:$FRONTEND_PORT"
        echo "  • Backend API:         http://$BACKEND_HOST:$BACKEND_PORT"  
        echo "  • API Documentation:   http://$BACKEND_HOST:$BACKEND_PORT/docs"
    fi
    echo ""
    
    echo -e "${CYAN}📊 Database URLs:${NC}"
    echo "  • PostgreSQL:          $DATABASE_URL"
    echo "  • Redis:               $REDIS_URL"
    echo "  • Neo4j:               $NEO4J_URI"
    echo "  • Qdrant:              $QDRANT_URL"
    echo ""
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev|-d)
                DEV_MODE=true
                shift
                ;;
            --ip)
                FORCE_IP="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Environment configuration script for Legal AI Platform"
                echo ""
                echo "Options:"
                echo "  --dev, -d              Configure for local development"
                echo "  --ip IP_ADDRESS        Force specific IP address"
                echo "  --help, -h             Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                     Configure for production/network access"
                echo "  $0 --dev               Configure for local development"
                echo "  $0 --ip 192.168.1.100  Use specific IP address"
                echo ""
                echo "This script will:"
                echo "  1. Detect your machine's IP address"
                echo "  2. Find available ports for all services"
                echo "  3. Update .env file with correct configuration"
                echo "  4. Backup existing .env file before changes"
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
    
    print_header "Legal AI Platform - Environment Configuration"
    
    if [ "$DEV_MODE" = true ]; then
        print_status "Configuring for LOCAL DEVELOPMENT mode"
    else
        print_status "Configuring for PRODUCTION/NETWORK mode"
    fi
    
    # Configure environment
    configure_environment
    
    # Display configuration
    display_configuration
    
    print_success "Environment configuration completed successfully!"
    
    echo ""
    echo -e "${GREEN}✅ Next steps:${NC}"
    if [ "$DEV_MODE" = true ]; then
        echo "  • Start development:   ./launch-dev.sh"
        echo "  • Start databases:     docker compose -f docker-compose.dev.yml up -d"
    else
        echo "  • Start full stack:    ./launch-backend.sh && ./launch-frontend.sh"
        echo "  • Start with script:   ./scripts/start-dev.sh"
    fi
    echo "  • Check status:        ./scripts/status-dev.sh"
    echo ""
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi