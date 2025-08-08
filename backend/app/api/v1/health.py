"""
Health check endpoints for monitoring service status.
"""
import time
import psutil
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.core.database import async_engine, get_redis, get_neo4j, get_qdrant
from app.core.cache import get_redis_client
from app.core.graph import get_neo4j_client
from app.core.vector_store import get_qdrant_client
from app.core.storage import get_storage_client
from app.core.config import settings

router = APIRouter()

# Store app start time for uptime calculation
APP_START_TIME = datetime.utcnow()

# Health check history (in-memory for simplicity)
HEALTH_HISTORY: List[Dict[str, Any]] = []
MAX_HISTORY_SIZE = 100


async def check_postgresql() -> Dict[str, Any]:
    """Check PostgreSQL health."""
    start_time = time.time()
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            
            # For async pools, we'll just report the pool size
            # AsyncAdaptedQueuePool doesn't have the same attributes as sync pools
            pool_info = {
                "size": async_engine.pool.size() if hasattr(async_engine.pool, 'size') else "unknown",
            }
            
            # Try to get additional pool info if available
            if hasattr(async_engine.pool, 'checked_out_connections'):
                pool_info["checked_out"] = async_engine.pool.checked_out_connections
            
        return {
            "status": "healthy",
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "version": version.split()[1] if version else "unknown",
            "connection_pool": pool_info
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "error": str(e)
        }


async def check_redis() -> Dict[str, Any]:
    """Check Redis health."""
    start_time = time.time()
    try:
        redis = await get_redis_client()
        is_alive = await redis.ping()
        
        if is_alive:
            # Get Redis info
            info = await redis.client.info()
            
            return {
                "status": "healthy",
                "response_time_ms": round((time.time() - start_time) * 1000, 2),
                "version": info.get("redis_version", "unknown"),
                "used_memory": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0)
            }
        else:
            raise Exception("Redis ping failed")
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "error": str(e)
        }


async def check_neo4j() -> Dict[str, Any]:
    """Check Neo4j health."""
    start_time = time.time()
    try:
        neo4j = await get_neo4j_client()
        result = await neo4j.execute("CALL dbms.components() YIELD name, versions RETURN name, versions[0] as version")
        
        if result:
            return {
                "status": "healthy",
                "response_time_ms": round((time.time() - start_time) * 1000, 2),
                "version": result[0].get("version", "unknown"),
                "database": "neo4j"
            }
        else:
            raise Exception("Neo4j query failed")
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "error": str(e)
        }


async def check_qdrant() -> Dict[str, Any]:
    """Check Qdrant health."""
    start_time = time.time()
    try:
        qdrant = await get_qdrant_client()
        
        # Simple health check - try to list collections
        # This is more reliable than get_cluster_info which may not exist
        collections = await qdrant.list_collections()
        
        # If we can list collections, Qdrant is healthy
        return {
            "status": "healthy",
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "collections_count": len(collections) if collections else 0
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "error": str(e)
        }


async def check_minio() -> Dict[str, Any]:
    """Check MinIO health."""
    start_time = time.time()
    try:
        minio = await get_storage_client()
        buckets = await minio.list_buckets()
        
        return {
            "status": "healthy",
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "buckets_count": len(buckets)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_time_ms": round((time.time() - start_time) * 1000, 2),
            "error": str(e)
        }


@router.get("/")
async def root_health():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": "Legal AI Platform",
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/simple")
async def simple_health():
    """Simple health check that just confirms the service is running."""
    return {"status": "ok"}


@router.get("/health")
async def detailed_health():
    """Detailed health check with all service statuses."""
    services = {
        "postgresql": await check_postgresql(),
        "redis": await check_redis(),
        "neo4j": await check_neo4j(),
        "qdrant": await check_qdrant(),
        "minio": await check_minio()
    }
    
    # Determine overall status
    unhealthy_count = sum(1 for s in services.values() if s["status"] == "unhealthy")
    if unhealthy_count == 0:
        overall_status = "healthy"
    elif unhealthy_count < len(services) / 2:
        overall_status = "degraded"
    else:
        overall_status = "unhealthy"
    
    # Calculate uptime
    uptime = datetime.utcnow() - APP_START_TIME
    
    health_data = {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": str(uptime),
        "services": services
    }
    
    # Store in history
    global HEALTH_HISTORY
    HEALTH_HISTORY.append({
        "timestamp": datetime.utcnow().isoformat(),
        "status": overall_status,
        "services": {k: v["status"] for k, v in services.items()}
    })
    if len(HEALTH_HISTORY) > MAX_HISTORY_SIZE:
        HEALTH_HISTORY.pop(0)
    
    return health_data


@router.get("/health/live")
async def liveness_probe():
    """Kubernetes liveness probe endpoint."""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/ready")
async def readiness_probe():
    """Comprehensive readiness probe - checks all dependencies for startup orchestration."""
    # Check all critical services required for application startup
    services_health = {
        "postgresql": await check_postgresql(),
        "redis": await check_redis(),
        "neo4j": await check_neo4j(),
        "qdrant": await check_qdrant(),
        "minio": await check_minio()
    }
    
    # Determine service readiness
    checks = {
        "database": services_health["postgresql"]["status"] == "healthy",
        "cache": services_health["redis"]["status"] == "healthy",
        "graph_database": services_health["neo4j"]["status"] == "healthy",
        "vector_database": services_health["qdrant"]["status"] == "healthy",
        "object_storage": services_health["minio"]["status"] == "healthy"
    }
    
    # Additional application-level checks
    app_checks = {
        "migrations_applied": await check_database_migrations(),
        "collections_initialized": await check_vector_collections(),
        "storage_buckets_ready": await check_storage_buckets(),
        "configuration_valid": check_configuration()
    }
    
    # Combine all checks
    all_checks = {**checks, **app_checks}
    
    # Calculate readiness score
    healthy_count = sum(1 for status in all_checks.values() if status)
    total_checks = len(all_checks)
    readiness_score = healthy_count / total_checks if total_checks > 0 else 0
    
    # Determine overall readiness (require 100% for startup orchestration)
    is_ready = all(all_checks.values())
    
    response_data = {
        "status": "ready" if is_ready else "not_ready",
        "readiness_score": round(readiness_score, 3),
        "checks": all_checks,
        "services": {k: {"status": v["status"], "response_time_ms": v.get("response_time_ms", 0)} 
                    for k, v in services_health.items()},
        "timestamp": datetime.utcnow().isoformat(),
        "environment": getattr(settings, 'ENVIRONMENT', 'development')
    }
    
    if is_ready:
        return response_data
    else:
        # Provide detailed failure information for debugging
        failed_checks = [k for k, v in all_checks.items() if not v]
        response_data.update({
            "reason": "One or more critical services are not ready",
            "failed_checks": failed_checks,
            "recommendation": get_readiness_recommendations(failed_checks)
        })
        
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=response_data
        )


async def check_database_migrations() -> bool:
    """Check if database migrations have been applied."""
    try:
        async with async_engine.connect() as conn:
            # Check if alembic_version table exists and has current version
            result = await conn.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            )
            version = result.scalar()
            return version is not None
    except Exception:
        return False


async def check_vector_collections() -> bool:
    """Check if required vector collections are initialized."""
    try:
        qdrant = await get_qdrant_client()
        collections = await qdrant.list_collections()
        required_collections = {"documents", "contracts"}
        existing_collections = {c['name'] for c in collections}
        return required_collections.issubset(existing_collections)
    except Exception:
        return False


async def check_storage_buckets() -> bool:
    """Check if required storage buckets exist."""
    try:
        minio = await get_storage_client()
        buckets = await minio.list_buckets()
        bucket_names = {b['name'] for b in buckets}
        required_buckets = {settings.S3_BUCKET, "legal-documents"}
        return bool(bucket_names.intersection(required_buckets))
    except Exception:
        return False


def check_configuration() -> bool:
    """Check if critical configuration is valid."""
    try:
        # Validate required settings
        required_settings = [
            settings.DATABASE_URL,
            settings.REDIS_URL,
            settings.NEO4J_URI,
            settings.SECRET_KEY,
            settings.JWT_SECRET_KEY
        ]
        
        # Check that all required settings are not None or empty
        return all(setting and setting != "change-me" for setting in required_settings)
    except Exception:
        return False


def get_readiness_recommendations(failed_checks: List[str]) -> List[str]:
    """Provide recommendations for failed readiness checks."""
    recommendations = []
    
    if "database" in failed_checks:
        recommendations.append("Check PostgreSQL connection and ensure database is running")
    if "cache" in failed_checks:
        recommendations.append("Check Redis connection and ensure Redis is running")
    if "graph_database" in failed_checks:
        recommendations.append("Check Neo4j connection and ensure Neo4j is running")
    if "vector_database" in failed_checks:
        recommendations.append("Check Qdrant connection and ensure Qdrant is running")
    if "object_storage" in failed_checks:
        recommendations.append("Check MinIO connection and ensure MinIO is running")
    if "migrations_applied" in failed_checks:
        recommendations.append("Run database migrations: alembic upgrade head")
    if "collections_initialized" in failed_checks:
        recommendations.append("Initialize vector collections in Qdrant")
    if "storage_buckets_ready" in failed_checks:
        recommendations.append("Create required storage buckets in MinIO")
    if "configuration_valid" in failed_checks:
        recommendations.append("Check environment variables and configuration settings")
    
    return recommendations


@router.get("/health/postgresql")
async def postgresql_health():
    """PostgreSQL specific health check."""
    health = await check_postgresql()
    
    if health["status"] == "unhealthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health
        )
    
    return health


@router.get("/health/redis")
async def redis_health():
    """Redis specific health check."""
    health = await check_redis()
    
    if health["status"] == "unhealthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health
        )
    
    return health


@router.get("/health/neo4j")
async def neo4j_health():
    """Neo4j specific health check."""
    health = await check_neo4j()
    
    if health["status"] == "unhealthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health
        )
    
    return health


@router.get("/health/qdrant")
async def qdrant_health():
    """Qdrant specific health check."""
    health = await check_qdrant()
    
    if health["status"] == "unhealthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health
        )
    
    return health


@router.get("/health/minio")
async def minio_health():
    """MinIO specific health check."""
    health = await check_minio()
    
    if health["status"] == "unhealthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health
        )
    
    return health


@router.get("/health/metrics")
async def health_metrics():
    """System and application metrics."""
    # System metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Database metrics
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(
                text("SELECT count(*) FROM pg_stat_activity")
            )
            active_connections = result.scalar()
    except:
        active_connections = 0
    
    return {
        "system": {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "disk_usage_percent": disk.percent
        },
        "application": {
            "requests_per_minute": 0,  # Would need proper metrics tracking
            "average_response_time_ms": 0,
            "error_rate": 0
        },
        "database": {
            "connection_pool_size": async_engine.pool.size() if hasattr(async_engine.pool, 'size') else "unknown",
            "active_connections": active_connections,
            "slow_queries_count": 0  # Would need query monitoring
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/history")
async def health_history(hours: int = 1):
    """Get health check history."""
    global HEALTH_HISTORY
    
    # Filter history by time range
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    filtered_history = [
        entry for entry in HEALTH_HISTORY
        if datetime.fromisoformat(entry["timestamp"]) > cutoff_time
    ]
    
    return {
        "history": filtered_history,
        "hours": hours,
        "total_entries": len(filtered_history)
    }