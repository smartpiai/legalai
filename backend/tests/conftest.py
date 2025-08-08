"""
Pytest configuration and fixtures for all tests.
"""
import asyncio
import os
import pytest
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:password@localhost:5432/legal_ai_test"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["NEO4J_URI"] = "bolt://localhost:7687"
os.environ["NEO4J_USER"] = "neo4j"
os.environ["NEO4J_PASSWORD"] = "password"
os.environ["QDRANT_HOST"] = "localhost"
os.environ["QDRANT_PORT"] = "6333"
os.environ["MINIO_ENDPOINT"] = "localhost:9000"
os.environ["MINIO_ACCESS_KEY"] = "minioadmin"
os.environ["MINIO_SECRET_KEY"] = "minioadmin"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def async_client():
    """Create an async test client."""
    from httpx import AsyncClient
    from app.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def authenticated_client(async_client):
    """Create an authenticated async test client."""
    from app.core.security import create_access_token
    
    access_token = create_access_token(
        data={"sub": "testuser@example.com", "tenant_id": 1}
    )
    async_client.headers["Authorization"] = f"Bearer {access_token}"
    return async_client


@pytest.fixture
async def test_db_session():
    """Create a test database session."""
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from app.models.base import Base
    from app.core.database import get_database_url
    
    test_engine = create_async_engine(
        get_database_url(test=True),
        echo=False,
        pool_pre_ping=True
    )
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    TestSessionLocal = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()
    
    await test_engine.dispose()


@pytest.fixture(autouse=True)
async def setup_test_database():
    """Setup and teardown test database for each test."""
    from app.models.base import Base
    from app.core.database import async_engine
    
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)