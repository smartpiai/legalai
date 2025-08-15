# Legal AI Platform - Hybrid Development Environment

## 🚀 Fast Development Setup

This hybrid approach runs **databases in containers** and **apps locally** for maximum development speed.

### ⚡ Quick Start

```bash
# 1. Start everything (recommended)
./launch-dev.sh

# 2. Or start in background mode
./launch-dev.sh --background

# 3. Or start components individually
docker compose -f docker-compose.dev.yml up -d    # Databases only
./scripts/backend-dev.sh                          # Backend locally
./scripts/frontend-dev.sh                         # Frontend locally (in new terminal)
```

### 🎯 Benefits

- **⚡ Instant Hot Reload**: Frontend and backend changes apply immediately
- **🔧 Full IDE Support**: Debugging, IntelliSense, breakpoints work perfectly
- **📊 Live Databases**: Persistent data, no rebuilds needed
- **🚀 Fast Iteration**: No Docker builds for code changes

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                Frontend (Local)                  │
│            Vite Dev Server :3000                 │
│              Hot Reload ✅                       │
└─────────────┬───────────────────────────────────┘
              │ HTTP API Calls
┌─────────────▼───────────────────────────────────┐
│               Backend (Local)                    │
│           FastAPI Uvicorn :8000                  │
│              Hot Reload ✅                       │
└─────────────┬───────────────────────────────────┘
              │ Database Connections
┌─────────────▼───────────────────────────────────┐
│            Database Services (Containers)        │
│  PostgreSQL │ Redis │ Neo4j │ Qdrant │ MinIO    │
│    :15432   │ :16379│ :17474│ :16333 │ :19000   │
└─────────────────────────────────────────────────┘
```

## 📋 Available Scripts

### Main Commands
- `./launch-dev.sh` - Start full development environment
- `./scripts/stop-dev.sh` - Stop all development services
- `./scripts/status-dev.sh` - Check status of all services
- `./scripts/reset-dev.sh` - Reset environment (with options)

### Individual Services
- `./scripts/backend-dev.sh` - Start backend only
- `./scripts/frontend-dev.sh` - Start frontend only
- `./scripts/logs-dev.sh [service]` - View service logs

### Database Management
- `docker compose -f docker-compose.dev.yml up -d` - Start databases
- `docker compose -f docker-compose.dev.yml down` - Stop databases
- `docker compose -f docker-compose.dev.yml down -v` - Reset database data

## 🌐 Access URLs

### Applications (Local)
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Databases (Containerized)
- **PostgreSQL**: localhost:15432
- **Redis**: localhost:16379
- **Neo4j Browser**: http://localhost:17474
- **Qdrant**: http://localhost:16333
- **MinIO Console**: http://localhost:19001

## 🔧 Development Workflow

### Daily Development
1. **Start**: `./launch-dev.sh --background`
2. **Code**: Edit files with instant hot reload
3. **Debug**: Use IDE debugging tools directly
4. **Test**: Run tests against live backend
5. **Stop**: `./scripts/stop-dev.sh`

### When You Need Fresh Data
```bash
./scripts/reset-dev.sh --data    # Reset database data
./launch-dev.sh                  # Restart with clean data
```

### When Dependencies Change
```bash
./scripts/reset-dev.sh --deps    # Reset node_modules/venv
./launch-dev.sh                  # Reinstall and restart
```

## 🆘 Troubleshooting

### "Port already in use"
```bash
./scripts/stop-dev.sh           # Stop all services
./scripts/status-dev.sh         # Check what's running
./launch-dev.sh                 # Restart
```

### "Database connection failed"
```bash
docker compose -f docker-compose.dev.yml ps    # Check database status
docker compose -f docker-compose.dev.yml logs postgres  # Check logs
```

### "Hot reload not working"
- Frontend: Restart Vite dev server
- Backend: Restart Uvicorn (Ctrl+C and restart)

## 📊 Performance Comparison

| Task | Container Mode | Hybrid Mode | Improvement |
|------|----------------|-------------|-------------|
| Frontend change | 3-5 min rebuild | Instant | 100x faster |
| Backend change | 2-3 min rebuild | Instant | 60x faster |
| CSS/styling | Full rebuild | Live reload | 50x faster |
| Debugging | Limited | Full IDE | Native experience |

## 🎯 Perfect For

- **Rapid prototyping**
- **UI/UX development**
- **API development**
- **Database schema iteration**
- **Feature development**
- **Bug fixing and debugging**

---

**Happy coding with lightning-fast iteration! ⚡**