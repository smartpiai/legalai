"""
Database configuration and session management
"""
import os
from typing import AsyncGenerator, Optional
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
import redis.asyncio as redis
from neo4j import AsyncGraphDatabase
from qdrant_client import QdrantClient

from app.core.config import settings


def get_database_url(test: bool = False) -> str:
    """Get the database URL, optionally for testing."""
    if test or os.getenv("TESTING"):
        db_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
        if "test" not in db_url:
            db_url = db_url.replace("/legal_ai", "/legal_ai_test")
        return db_url.replace("postgresql://", "postgresql+asyncpg://")
    return settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


# PostgreSQL
async_engine = create_async_engine(
    get_database_url(),
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    poolclass=NullPool if os.getenv("TESTING") else None,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

# Redis
redis_client = None

async def get_redis():
    global redis_client
    if not redis_client:
        redis_client = await redis.from_url(settings.REDIS_URL)
    return redis_client

# Neo4j
neo4j_driver = None

def get_neo4j():
    global neo4j_driver
    if not neo4j_driver:
        neo4j_driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
    return neo4j_driver

# Qdrant
qdrant_client = None

def get_qdrant():
    global qdrant_client
    if not qdrant_client:
        qdrant_client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT
        )
    return qdrant_client

# Database session dependency
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Backwards compatibility
get_db = get_async_session

# Initialize databases
async def init_database():
    """Initialize all database connections"""
    # Create tables
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Initialize other connections
    await get_redis()
    get_neo4j()
    get_qdrant()
    
    print("All databases initialized successfully")


# Backwards compatibility
init_db = init_database
