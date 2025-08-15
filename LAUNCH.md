# Legal AI Platform - Quick Launch Guide

## Overview

The Legal AI Platform now includes two comprehensive launch scripts in the root directory for easy sequential startup:

1. **`./launch-backend.sh`** - Starts all backend services (databases, API, workers)
2. **`./launch-frontend.sh`** - Starts the frontend development server

## Quick Start

### Prerequisites

- **Docker & Docker Compose** (for backend services)
- **Node.js 18+** and **npm** (for frontend, unless using `--docker` flag)

### Launch Sequence

```bash
# Terminal 1 - Start Backend Services
./launch-backend.sh

# Terminal 2 - Start Frontend (after backend is ready)
./launch-frontend.sh
```

That's it! The platform will be available at the URLs displayed in the terminal.

## Backend Script: `./launch-backend.sh`

### Features

- **🔍 Automatic Port Detection**: Finds available ports for all services
- **🐳 Docker Service Management**: Starts PostgreSQL, Redis, Neo4j, Qdrant, MinIO, ClamAV
- **🏥 Health Checks**: Waits for all services to be healthy before proceeding
- **📊 Database Migrations**: Automatically runs Alembic migrations
- **🌐 IP Detection**: Automatically detects machine IP for external access
- **⚙️ Environment Setup**: Updates .env with discovered configuration

### Usage Options

```bash
# Normal launch
./launch-backend.sh

# Auto-resolve port conflicts
./launch-backend.sh --auto-ports

# Clean restart (removes existing containers)
./launch-backend.sh --clean

# Use specific IP address
./launch-backend.sh --ip 192.168.1.100

# Skip database migrations
./launch-backend.sh --skip-migrations

# Verbose output
./launch-backend.sh --verbose
```

### What It Starts

- **PostgreSQL** (Primary Database) - Default port: 5432
- **Redis** (Cache & Message Broker) - Default port: 6379  
- **Neo4j** (Graph Database) - Default ports: 7474 (HTTP), 7687 (Bolt)
- **Qdrant** (Vector Database) - Default ports: 6333 (HTTP), 6334 (gRPC)
- **MinIO** (Object Storage) - Default ports: 9000 (API), 9001 (Console)
- **ClamAV** (Antivirus Scanner) - Default port: 3310
- **FastAPI Backend** - Default port: 8000
- **Celery Worker** (Task Processing)

## Frontend Script: `./launch-frontend.sh`

### Features

- **✅ Backend Verification**: Ensures backend is ready before starting
- **🔧 Port Management**: Automatic port detection and configuration
- **⚡ Vite Development Server**: Fast development with hot reload
- **🔗 API Connectivity**: Automatic backend connection configuration
- **🐳 Docker Option**: Can use Docker Compose instead of local Node.js

### Usage Options

```bash
# Normal launch (requires Node.js)
./launch-frontend.sh

# Auto-find available port
./launch-frontend.sh --auto-port

# Use specific port
./launch-frontend.sh --port 3001

# Use Docker instead of local Node.js
./launch-frontend.sh --docker

# Skip backend verification
./launch-frontend.sh --skip-backend-check

# Verbose output  
./launch-frontend.sh --verbose
```

### Prerequisites Check

The frontend script automatically verifies:
- Backend services are running and healthy
- Node.js 18+ is installed (unless using `--docker`)
- npm is available for dependency management
- Frontend dependencies are installed

## Port Management

### Automatic Port Resolution

Both scripts automatically handle port conflicts:

1. **Check Default Ports**: Tests if standard ports are available
2. **Find Alternatives**: If busy, finds next available port
3. **Update Configuration**: Updates `.env` file with discovered ports
4. **Cross-Reference**: Frontend script reads backend port assignments

### Default Port Assignments

| Service | Default Port | Alternative |
|---------|-------------|-------------|
| PostgreSQL | 5432 | 5433+ |
| Redis | 6379 | 6380+ |
| Neo4j HTTP | 7474 | 7475+ |
| Neo4j Bolt | 7687 | 7688+ |
| Qdrant HTTP | 6333 | 6334+ |
| Qdrant gRPC | 6334 | 6335+ |
| MinIO API | 9000 | 9001+ |
| MinIO Console | 9001 | 9002+ |
| Backend API | 8000 | 8001+ |
| Frontend | 3000 | 3001+ |

## Access URLs

After successful launch, access your application at:

- **🌐 Main Application**: `http://[machine-ip]:[frontend-port]`
- **📚 API Documentation**: `http://[machine-ip]:[backend-port]/docs`
- **🔍 API Health Check**: `http://[machine-ip]:[backend-port]/api/v1/health/ready`
- **💾 Neo4j Browser**: `http://[machine-ip]:7474`
- **📦 MinIO Console**: `http://[machine-ip]:9001`

## File Outputs

The scripts generate several status files for coordination:

- **`.machine_ip`**: Detected machine IP address
- **`.backend_status`**: Backend services status and URLs
- **`.frontend_status`**: Frontend server status and configuration
- **`.frontend.pid`**: Frontend process ID (local mode)
- **`.frontend.log`**: Frontend development server logs

## Error Handling

### Backend Issues

```bash
# Check service status
docker compose ps

# View service logs
docker compose logs [service-name]

# View all logs
docker compose logs

# Clean restart
./launch-backend.sh --clean --auto-ports
```

### Frontend Issues

```bash
# Check frontend logs
tail -f .frontend.log

# Check if process is running
ps aux | grep vite

# Kill stuck frontend
kill $(cat .frontend.pid)

# Try Docker mode
./launch-frontend.sh --docker
```

## Advanced Usage

### Development Workflow

```bash
# Morning startup - clean environment
./launch-backend.sh --clean --auto-ports
./launch-frontend.sh --auto-port

# During development - quick restart
docker compose restart backend
# Frontend restarts automatically on file changes

# End of day - stop everything
docker compose down
kill $(cat .frontend.pid)  # if using local mode
```

### CI/CD Integration

```bash
# Automated testing setup
./launch-backend.sh --skip-migrations --auto-ports
# Wait for backend ready
./launch-frontend.sh --skip-backend-check --docker

# Health checks
curl -f http://localhost:8000/api/v1/health/ready
curl -f http://localhost:3000
```

### Multi-Environment Support

```bash
# Development
./launch-backend.sh

# Staging-like (different IP)
./launch-backend.sh --ip 192.168.1.100

# Testing (clean state)
./launch-backend.sh --clean --skip-migrations
```

## Integration with Existing Scripts

The new launch scripts work alongside existing infrastructure:

- **Compatible with**: `docker-compose.yml`, existing `.env` structure
- **Uses**: Port utilities from `scripts/` folder  
- **Preserves**: All existing functionality
- **Enhances**: Adds intelligent port management and status coordination

### Comparison with Previous Scripts

| Feature | Old (`scripts/launch.sh`) | New (`./launch-backend.sh`) |
|---------|---------------------------|----------------------------|
| Location | `scripts/` folder | Root directory |
| Port Detection | Basic | Advanced with auto-resolution |
| Status Files | Limited | Comprehensive status tracking |
| Error Handling | Basic | Detailed with recovery suggestions |
| Cross-Script Coordination | None | Full frontend/backend coordination |

## Troubleshooting

### Common Issues

1. **"Docker not running"**
   ```bash
   # Start Docker daemon
   sudo systemctl start docker
   ./launch-backend.sh
   ```

2. **"Port already in use"**
   ```bash
   # Use auto-resolution
   ./launch-backend.sh --auto-ports
   ./launch-frontend.sh --auto-port
   ```

3. **"Backend not ready"**
   ```bash
   # Check backend status
   docker compose ps
   docker compose logs backend
   
   # Skip check if needed
   ./launch-frontend.sh --skip-backend-check
   ```

4. **"Node.js version too old"**
   ```bash
   # Use Docker mode instead
   ./launch-frontend.sh --docker
   ```

### Log Files

- **Backend Services**: `docker compose logs [service]`
- **Frontend Local**: `.frontend.log`
- **All Services**: `docker compose logs -f`

### Clean Reset

```bash
# Nuclear option - reset everything
docker compose down -v  # Remove volumes too
rm -f .backend_status .frontend_status .machine_ip .frontend.pid
./launch-backend.sh --clean --auto-ports
./launch-frontend.sh --auto-port
```

## Support

For issues or questions:

1. Check the logs as described above
2. Verify prerequisites are installed
3. Try the clean reset procedure
4. Consult the existing documentation in `docs/` folder

---

*Generated by launch-backend.sh and launch-frontend.sh - Version 1.0.0*