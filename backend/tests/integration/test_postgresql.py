"""
Integration tests for PostgreSQL database connection and operations.
Following TDD methodology - tests written before implementation.
"""
import asyncio
import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from datetime import datetime
from typing import Optional

from app.core.database import (
    get_async_session,
    init_database,
    get_database_url,
    async_engine,
    AsyncSessionLocal
)
from app.models.base import Base
from app.models.tenant import Tenant
from app.models.user import User
from app.models.contract import Contract


@pytest.fixture
async def test_db_session():
    """Create a test database session."""
    test_engine = create_async_engine(
        get_database_url(test=True),
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
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


class TestPostgreSQLConnection:
    """Test PostgreSQL connection and basic operations."""
    
    @pytest.mark.asyncio
    async def test_database_connection(self, test_db_session: AsyncSession):
        """Test that we can connect to the PostgreSQL database."""
        result = await test_db_session.execute(text("SELECT 1"))
        assert result.scalar() == 1
    
    @pytest.mark.asyncio
    async def test_database_version(self, test_db_session: AsyncSession):
        """Test that PostgreSQL version is 15 or higher."""
        result = await test_db_session.execute(
            text("SELECT version()")
        )
        version_string = result.scalar()
        assert "PostgreSQL" in version_string
        version_parts = version_string.split()[1].split(".")
        major_version = int(version_parts[0])
        assert major_version >= 15
    
    @pytest.mark.asyncio
    async def test_create_tenant(self, test_db_session: AsyncSession):
        """Test creating a tenant with proper isolation."""
        tenant = Tenant(
            name="Test Corporation",
            slug="test-corp",
            is_active=True,
            settings={"theme": "default", "language": "en"},
            created_at=datetime.utcnow()
        )
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        result = await test_db_session.execute(
            select(Tenant).where(Tenant.slug == "test-corp")
        )
        saved_tenant = result.scalar_one_or_none()
        
        assert saved_tenant is not None
        assert saved_tenant.name == "Test Corporation"
        assert saved_tenant.is_active is True
        assert saved_tenant.id is not None
    
    @pytest.mark.asyncio
    async def test_create_user_with_tenant(self, test_db_session: AsyncSession):
        """Test creating a user associated with a tenant."""
        tenant = Tenant(
            name="User Test Corp",
            slug="user-test-corp",
            is_active=True
        )
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hashed_password_here",
            tenant_id=tenant.id,
            is_active=True,
            is_superuser=False,
            created_at=datetime.utcnow()
        )
        test_db_session.add(user)
        await test_db_session.commit()
        
        result = await test_db_session.execute(
            select(User).where(User.email == "test@example.com")
        )
        saved_user = result.scalar_one_or_none()
        
        assert saved_user is not None
        assert saved_user.tenant_id == tenant.id
        assert saved_user.username == "testuser"
    
    @pytest.mark.asyncio
    async def test_multi_tenant_isolation(self, test_db_session: AsyncSession):
        """Test that data is properly isolated between tenants."""
        tenant1 = Tenant(name="Tenant 1", slug="tenant-1", is_active=True)
        tenant2 = Tenant(name="Tenant 2", slug="tenant-2", is_active=True)
        test_db_session.add_all([tenant1, tenant2])
        await test_db_session.commit()
        
        user1 = User(
            email="user1@tenant1.com",
            username="user1",
            hashed_password="password",
            tenant_id=tenant1.id
        )
        user2 = User(
            email="user2@tenant2.com",
            username="user2",
            hashed_password="password",
            tenant_id=tenant2.id
        )
        test_db_session.add_all([user1, user2])
        await test_db_session.commit()
        
        result = await test_db_session.execute(
            select(User).where(User.tenant_id == tenant1.id)
        )
        tenant1_users = result.scalars().all()
        
        assert len(tenant1_users) == 1
        assert tenant1_users[0].email == "user1@tenant1.com"
        assert all(user.tenant_id == tenant1.id for user in tenant1_users)
    
    @pytest.mark.asyncio
    async def test_cascade_delete(self, test_db_session: AsyncSession):
        """Test cascade delete operations maintain referential integrity."""
        tenant = Tenant(name="Delete Test", slug="delete-test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        contract = Contract(
            title="Test Contract",
            tenant_id=tenant.id,
            status="draft",
            created_at=datetime.utcnow()
        )
        test_db_session.add(contract)
        await test_db_session.commit()
        
        await test_db_session.delete(tenant)
        await test_db_session.commit()
        
        result = await test_db_session.execute(
            select(Contract).where(Contract.tenant_id == tenant.id)
        )
        contracts = result.scalars().all()
        assert len(contracts) == 0
    
    @pytest.mark.asyncio
    async def test_transaction_rollback(self, test_db_session: AsyncSession):
        """Test that transactions can be rolled back properly."""
        tenant = Tenant(name="Rollback Test", slug="rollback-test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        initial_id = tenant.id
        
        try:
            tenant.name = "Updated Name"
            test_db_session.add(tenant)
            raise Exception("Simulated error")
            await test_db_session.commit()
        except Exception:
            await test_db_session.rollback()
        
        result = await test_db_session.execute(
            select(Tenant).where(Tenant.id == initial_id)
        )
        rolled_back_tenant = result.scalar_one_or_none()
        assert rolled_back_tenant.name == "Rollback Test"
    
    @pytest.mark.asyncio
    async def test_concurrent_connections(self, test_db_session: AsyncSession):
        """Test that multiple concurrent connections work properly."""
        async def create_tenant(name: str, slug: str):
            tenant = Tenant(name=name, slug=slug, is_active=True)
            test_db_session.add(tenant)
            await test_db_session.commit()
            return tenant
        
        tasks = [
            create_tenant(f"Tenant {i}", f"tenant-{i}")
            for i in range(5)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful_creates = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_creates) >= 1
    
    @pytest.mark.asyncio
    async def test_connection_pool_limits(self, test_db_session: AsyncSession):
        """Test connection pool configuration and limits."""
        from app.core.database import async_engine
        
        pool_status = async_engine.pool.status()
        assert "Pool size" in pool_status
        assert async_engine.pool.size() <= 15
        assert async_engine.pool.overflow() <= 10


class TestPostgreSQLPerformance:
    """Test PostgreSQL performance characteristics."""
    
    @pytest.mark.asyncio
    async def test_bulk_insert_performance(self, test_db_session: AsyncSession):
        """Test bulk insert operations complete within acceptable time."""
        import time
        
        tenant = Tenant(name="Bulk Test", slug="bulk-test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        contracts = [
            Contract(
                title=f"Contract {i}",
                tenant_id=tenant.id,
                status="draft",
                content=f"Content for contract {i}" * 100,
                created_at=datetime.utcnow()
            )
            for i in range(100)
        ]
        
        start_time = time.time()
        test_db_session.add_all(contracts)
        await test_db_session.commit()
        elapsed_time = time.time() - start_time
        
        assert elapsed_time < 5.0
        
        result = await test_db_session.execute(
            select(Contract).where(Contract.tenant_id == tenant.id)
        )
        saved_contracts = result.scalars().all()
        assert len(saved_contracts) == 100
    
    @pytest.mark.asyncio
    async def test_query_performance(self, test_db_session: AsyncSession):
        """Test query performance with indexes."""
        import time
        
        tenant = Tenant(name="Query Test", slug="query-test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        users = [
            User(
                email=f"user{i}@test.com",
                username=f"user{i}",
                hashed_password="password",
                tenant_id=tenant.id
            )
            for i in range(50)
        ]
        test_db_session.add_all(users)
        await test_db_session.commit()
        
        start_time = time.time()
        result = await test_db_session.execute(
            select(User).where(
                User.tenant_id == tenant.id,
                User.email.like("%user2%")
            )
        )
        users = result.scalars().all()
        elapsed_time = time.time() - start_time
        
        assert elapsed_time < 0.5
        assert len(users) == 11