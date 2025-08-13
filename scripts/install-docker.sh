#!/bin/bash

# Docker Installation Script for Legal AI Platform
# Supports Ubuntu/Debian and common Linux distributions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Docker Installation for Legal AI Platform${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} ✓ $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} ✗ $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} ⚠ $1"
}

# Check if Docker is already installed
check_docker() {
    if command -v docker &> /dev/null; then
        local version=$(docker --version)
        print_success "Docker is already installed: $version"
        
        if command -v docker-compose &> /dev/null; then
            local compose_version=$(docker-compose --version 2>/dev/null || docker compose version 2>/dev/null)
            print_success "Docker Compose is already installed: $compose_version"
        fi
        
        # Check if Docker daemon is running
        if docker info &> /dev/null; then
            print_success "Docker daemon is running"
            return 0
        else
            print_warning "Docker is installed but not running"
            echo "Trying to start Docker service..."
            
            if command -v systemctl &> /dev/null; then
                sudo systemctl start docker 2>/dev/null || true
                sudo systemctl enable docker 2>/dev/null || true
            elif command -v service &> /dev/null; then
                sudo service docker start 2>/dev/null || true
            fi
            
            # Check again
            if docker info &> /dev/null; then
                print_success "Docker daemon started successfully"
                return 0
            else
                print_error "Failed to start Docker daemon"
                echo "Please start Docker manually and run the launch script again"
                return 1
            fi
        fi
    else
        return 1
    fi
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    elif [ -f /etc/debian_version ]; then
        OS=debian
        VER=$(cat /etc/debian_version)
    elif [ -f /etc/redhat-release ]; then
        OS=rhel
    else
        OS=$(uname -s)
    fi
    
    print_status "Detected OS: $OS"
}

# Install Docker on Ubuntu/Debian
install_docker_debian() {
    print_status "Installing Docker on Ubuntu/Debian..."
    
    # Update package index
    print_status "Updating package index..."
    sudo apt-get update -qq
    
    # Install prerequisites
    print_status "Installing prerequisites..."
    sudo apt-get install -y -qq \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    print_status "Adding Docker GPG key..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up the stable repository
    print_status "Setting up Docker repository..."
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    print_status "Installing Docker Engine..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    print_success "Docker installed successfully"
}

# Install Docker on RHEL/CentOS/Fedora
install_docker_rhel() {
    print_status "Installing Docker on RHEL/CentOS/Fedora..."
    
    # Install prerequisites
    sudo yum install -y yum-utils
    
    # Add Docker repository
    sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    
    # Install Docker
    sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    print_success "Docker installed successfully"
}

# Install Docker on Amazon Linux
install_docker_amazon() {
    print_status "Installing Docker on Amazon Linux..."
    
    # Update packages
    sudo yum update -y
    
    # Install Docker
    sudo yum install -y docker
    
    # Start Docker
    sudo service docker start
    sudo systemctl enable docker
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    print_success "Docker installed successfully"
}

# Generic Docker installation using get-docker script
install_docker_generic() {
    print_status "Installing Docker using official script..."
    
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # Install Docker Compose
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    print_success "Docker installed successfully"
}

# Add current user to docker group
setup_docker_user() {
    print_status "Adding current user to docker group..."
    
    # Create docker group if it doesn't exist
    sudo groupadd docker 2>/dev/null || true
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    print_success "User added to docker group"
    print_warning "You may need to log out and back in for group changes to take effect"
    print_warning "Or run: newgrp docker"
}

# Main installation flow
main() {
    print_header
    
    # Check if Docker is already installed
    if check_docker; then
        echo ""
        print_success "Docker is ready to use!"
        echo ""
        echo "You can now run: ./scripts/launch.sh"
        exit 0
    fi
    
    # Detect OS
    detect_os
    
    # Install based on OS
    case "$OS" in
        ubuntu|debian)
            install_docker_debian
            ;;
        rhel|centos|fedora)
            install_docker_rhel
            ;;
        amzn)
            install_docker_amazon
            ;;
        *)
            print_warning "OS $OS not specifically supported, trying generic installation..."
            install_docker_generic
            ;;
    esac
    
    # Start Docker service
    print_status "Starting Docker service..."
    if command -v systemctl &> /dev/null; then
        sudo systemctl start docker
        sudo systemctl enable docker
    elif command -v service &> /dev/null; then
        sudo service docker start
    fi
    
    # Setup user permissions
    setup_docker_user
    
    # Verify installation
    print_status "Verifying Docker installation..."
    if sudo docker run hello-world &> /dev/null; then
        print_success "Docker is working correctly!"
    else
        print_error "Docker installation verification failed"
        exit 1
    fi
    
    echo ""
    print_success "Docker installation complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Run: newgrp docker (to apply group changes)"
    echo "  2. Run: ./scripts/launch.sh (to start the application)"
    echo ""
}

# Run main function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi