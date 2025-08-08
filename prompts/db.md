# Database TDD Best Practices - Legal AI Platform

## Core Principles
You are managing multiple databases (PostgreSQL, Redis, Qdrant, MinIO) for an enterprise legal AI platform. Follow TDD principles for all database operations, ensuring data integrity, performance, and multi-tenant isolation.

## TDD Cycle for Database Development

### 1. RED Phase - Write Failing Database Test First
```python
# L ALWAYS START HERE - Test database operations
import pytest
from sqlalchemy import select
from app.models import Contract
from app.repositories import ContractRepository

@pytest.mark.asyncio
async def test_multi_tenant_data_isolation(test_db, tenant1, tenant2):
    # Arrange
    repo = ContractRepository(test_db)
    
    # Create contracts for different tenants
    contract1 = await repo.create({
        "title": "Tenant 1 Contract",
        "tenant_id": tenant1.id
    })
    
    contract2 = await repo.create({
        "title": "Tenant 2 Contract", 
        "tenant_id": tenant2.id
    })
    
    # Act - Query as tenant 1
    tenant1_contracts = await repo.get_by_tenant(tenant1.id)
    
    # Assert - Should only see tenant 1's data
    assert len(tenant1_contracts) == 1
    assert tenant1_contracts[0].title == "Tenant 1 Contract"
    assert tenant2.id not in [c.tenant_id for c in tenant1_contracts]
```

### 2. GREEN Phase - Implement Database Logic
```python
#  Minimal implementation to pass
class ContractRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_tenant(self, tenant_id: str):
        stmt = select(Contract).where(
            Contract.tenant_id == tenant_id
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
```

### 3. REFACTOR Phase - Optimize and Secure
```python
# = Refactored with RLS, caching, and optimization
class ContractRepository:
    def __init__(self, db: AsyncSession, cache: Redis, tenant_id: str):
        self.db = db
        self.cache = cache
        self.tenant_id = tenant_id
    
    async def get_by_tenant(
        self, 
        filters: ContractFilters = None,
        pagination: Pagination = None
    ) -> Page[Contract]:
        # Check cache first
        cache_key = f"contracts:{self.tenant_id}:{hash(filters)}:{pagination}"
        cached = await self.cache.get(cache_key)
        if cached:
            return Page.from_cache(cached)
        
        # Build optimized query with RLS
        stmt = (
            select(Contract)
            .where(Contract.tenant_id == self.tenant_id)
            .options(
                selectinload(Contract.parties),
                selectinload(Contract.obligations)
            )
        )
        
        # Apply filters
        if filters:
            stmt = self._apply_filters(stmt, filters)
        
        # Apply pagination with window function for total count
        stmt = self._apply_pagination(stmt, pagination)
        
        # Execute with read replica
        async with self.db.execution_options(
            postgresql_readonly=True
        ).begin():
            result = await self.db.execute(stmt)
            contracts = result.scalars().unique().all()
        
        # Cache results
        page = Page(items=contracts, total=await self._count(filters))
        await self.cache.setex(cache_key, 300, page.to_cache())
        
        return page
```

## PostgreSQL Testing

### 1. Schema and Migration Testing
```python
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

class TestDatabaseSchema:
    @pytest.mark.asyncio
    async def test_migration_up_and_down(self, alembic_config):
        # Test migration up
        command.upgrade(alembic_config, "head")
        
        # Verify schema
        inspector = inspect(self.engine)
        tables = inspector.get_table_names()
        
        assert "contracts" in tables
        assert "parties" in tables
        assert "obligations" in tables
        
        # Check indexes
        indexes = inspector.get_indexes("contracts")
        assert any(idx["name"] == "ix_contracts_tenant_id" for idx in indexes)
        assert any(idx["name"] == "ix_contracts_created_at" for idx in indexes)
        
        # Test migration down
        command.downgrade(alembic_config, "-1")
        
        # Verify rollback
        tables_after = inspector.get_table_names()
        assert len(tables_after) < len(tables)
    
    @pytest.mark.asyncio
    async def test_row_level_security(self, test_db):
        # Create RLS policy
        await test_db.execute("""
            CREATE POLICY tenant_isolation ON contracts
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id')::uuid)
        """)
        
        # Set tenant context
        await test_db.execute("SET app.tenant_id = :tenant_id", 
                             {"tenant_id": "tenant-123"})
        
        # Insert data for multiple tenants
        await test_db.execute("""
            INSERT INTO contracts (id, title, tenant_id) VALUES
            ('c1', 'Contract 1', 'tenant-123'),
            ('c2', 'Contract 2', 'tenant-456')
        """)
        
        # Query should only return current tenant's data
        result = await test_db.execute("SELECT * FROM contracts")
        rows = result.fetchall()
        
        assert len(rows) == 1
        assert rows[0]["tenant_id"] == "tenant-123"
```

### 2. Query Performance Testing
```python
class TestQueryPerformance:
    @pytest.mark.asyncio
    async def test_index_usage(self, test_db):
        # Create test data
        await self._create_test_contracts(test_db, count=10000)
        
        # Analyze query plan
        explain = await test_db.execute("""
            EXPLAIN (ANALYZE, BUFFERS) 
            SELECT * FROM contracts 
            WHERE tenant_id = :tenant_id 
            AND created_at > :date
            ORDER BY created_at DESC
            LIMIT 20
        """, {
            "tenant_id": "tenant-123",
            "date": "2024-01-01"
        })
        
        plan = explain.fetchone()[0]
        
        # Verify index usage
        assert "Index Scan" in plan or "Bitmap Index Scan" in plan
        assert "Seq Scan" not in plan
        
        # Check performance
        assert "Execution Time" in plan
        exec_time = float(plan.split("Execution Time: ")[1].split(" ms")[0])
        assert exec_time < 10  # Should execute in under 10ms
    
    @pytest.mark.asyncio
    async def test_n_plus_one_prevention(self, test_db):
        # Enable query logging
        query_count = 0
        
        def count_queries(conn, cursor, statement, *args):
            nonlocal query_count
            query_count += 1
        
        event.listen(test_db.sync_engine, "before_cursor_execute", count_queries)
        
        # Fetch contracts with relationships
        contracts = await test_db.execute(
            select(Contract)
            .options(
                selectinload(Contract.parties),
                selectinload(Contract.obligations),
                selectinload(Contract.clauses)
            )
            .limit(10)
        )
        
        # Process results (should not trigger additional queries)
        for contract in contracts:
            _ = contract.parties
            _ = contract.obligations
            _ = contract.clauses
        
        # Should be 1 main query + 3 relationship queries
        assert query_count == 4
```

### 3. Transaction Testing
```python
class TestTransactions:
    @pytest.mark.asyncio
    async def test_transaction_isolation(self, test_db):
        # Start two transactions
        async with test_db.begin() as tx1:
            async with test_db.begin() as tx2:
                # Insert in tx1
                await tx1.execute(
                    "INSERT INTO contracts (id, title) VALUES ('c1', 'Contract 1')"
                )
                
                # tx2 should not see uncommitted data
                result = await tx2.execute(
                    "SELECT * FROM contracts WHERE id = 'c1'"
                )
                assert result.rowcount == 0
                
                # Commit tx1
                await tx1.commit()
                
                # tx2 still shouldn't see it (snapshot isolation)
                result = await tx2.execute(
                    "SELECT * FROM contracts WHERE id = 'c1'"
                )
                assert result.rowcount == 0
    
    @pytest.mark.asyncio
    async def test_deadlock_handling(self, test_db):
        async def update_contracts_forward():
            async with test_db.begin() as tx:
                await tx.execute("UPDATE contracts SET status = 'active' WHERE id = 'c1'")
                await asyncio.sleep(0.1)
                await tx.execute("UPDATE contracts SET status = 'active' WHERE id = 'c2'")
        
        async def update_contracts_reverse():
            async with test_db.begin() as tx:
                await tx.execute("UPDATE contracts SET status = 'active' WHERE id = 'c2'")
                await asyncio.sleep(0.1)
                await tx.execute("UPDATE contracts SET status = 'active' WHERE id = 'c1'")
        
        # One should succeed, one should retry
        results = await asyncio.gather(
            update_contracts_forward(),
            update_contracts_reverse(),
            return_exceptions=True
        )
        
        # Verify deadlock was handled
        successes = [r for r in results if not isinstance(r, Exception)]
        assert len(successes) >= 1
```

## Redis Testing

### 1. Caching Strategy Testing
```python
class TestRedisCache:
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, redis_client):
        # Set cache
        await redis_client.setex(
            "contract:123",
            300,
            json.dumps({"id": "123", "title": "Test Contract"})
        )
        
        # Verify cache exists
        cached = await redis_client.get("contract:123")
        assert cached is not None
        
        # Invalidate related caches on update
        await redis_client.delete(
            "contract:123",
            "contracts:tenant:456:*",
            "search:contracts:*"
        )
        
        # Verify invalidation
        cached = await redis_client.get("contract:123")
        assert cached is None
    
    @pytest.mark.asyncio
    async def test_distributed_locking(self, redis_client):
        lock_key = "lock:contract:123"
        lock_value = str(uuid.uuid4())
        
        # Acquire lock
        acquired = await redis_client.set(
            lock_key,
            lock_value,
            nx=True,
            ex=30
        )
        assert acquired
        
        # Try to acquire again (should fail)
        acquired2 = await redis_client.set(
            lock_key,
            "different-value",
            nx=True,
            ex=30
        )
        assert not acquired2
        
        # Release lock (with Lua script for atomicity)
        release_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        released = await redis_client.eval(
            release_script,
            1,
            lock_key,
            lock_value
        )
        assert released == 1
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, redis_client):
        user_id = "user-123"
        limit = 10
        window = 60  # seconds
        
        # Simulate requests
        for i in range(limit):
            key = f"rate_limit:{user_id}:{int(time.time() // window)}"
            count = await redis_client.incr(key)
            await redis_client.expire(key, window)
            assert count <= limit
        
        # Next request should be rate limited
        count = await redis_client.incr(key)
        assert count > limit
```

### 2. Session Management Testing
```python
class TestRedisSessions:
    @pytest.mark.asyncio
    async def test_session_storage(self, redis_client):
        session_id = "session-123"
        user_data = {
            "user_id": "user-456",
            "tenant_id": "tenant-789",
            "roles": ["admin", "user"],
            "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat()
        }
        
        # Store session
        await redis_client.setex(
            f"session:{session_id}",
            3600,
            json.dumps(user_data)
        )
        
        # Retrieve session
        stored = await redis_client.get(f"session:{session_id}")
        retrieved = json.loads(stored)
        
        assert retrieved["user_id"] == user_data["user_id"]
        assert retrieved["tenant_id"] == user_data["tenant_id"]
        assert set(retrieved["roles"]) == set(user_data["roles"])
```

## Qdrant Vector Database Testing

### 1. Vector Operations Testing
```python
class TestQdrantVectorDB:
    @pytest.mark.asyncio
    async def test_vector_indexing(self, qdrant_client):
        collection_name = "contracts"
        
        # Create collection with proper settings
        await qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=768,
                distance=Distance.COSINE
            ),
            optimizers_config=OptimizersConfigDiff(
                indexing_threshold=10000,
                memmap_threshold=50000
            )
        )
        
        # Index documents
        documents = [
            {"id": "1", "text": "Software licensing agreement", "tenant_id": "t1"},
            {"id": "2", "text": "Service level agreement", "tenant_id": "t1"},
            {"id": "3", "text": "Non-disclosure agreement", "tenant_id": "t2"}
        ]
        
        for doc in documents:
            embedding = await generate_embedding(doc["text"])
            await qdrant_client.upsert(
                collection_name=collection_name,
                points=[
                    PointStruct(
                        id=doc["id"],
                        vector=embedding,
                        payload={
                            "text": doc["text"],
                            "tenant_id": doc["tenant_id"]
                        }
                    )
                ]
            )
        
        # Test similarity search with tenant filtering
        query_embedding = await generate_embedding("software contract")
        results = await qdrant_client.search(
            collection_name=collection_name,
            query_vector=query_embedding,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="tenant_id",
                        match=MatchValue(value="t1")
                    )
                ]
            ),
            limit=2
        )
        
        assert len(results) == 2
        assert results[0].payload["tenant_id"] == "t1"
        assert "software" in results[0].payload["text"].lower()
    
    @pytest.mark.asyncio
    async def test_batch_operations(self, qdrant_client):
        collection_name = "contracts"
        batch_size = 100
        
        # Prepare batch
        points = []
        for i in range(batch_size):
            points.append(
                PointStruct(
                    id=str(i),
                    vector=[random.random() for _ in range(768)],
                    payload={"doc_id": f"doc-{i}"}
                )
            )
        
        # Batch upsert
        start_time = time.time()
        await qdrant_client.upsert(
            collection_name=collection_name,
            points=points,
            wait=True
        )
        duration = time.time() - start_time
        
        # Should complete quickly
        assert duration < 5.0
        
        # Verify all points indexed
        count = await qdrant_client.count(collection_name=collection_name)
        assert count.count == batch_size
```

## MinIO/S3 Testing

### 1. Object Storage Testing
```python
class TestMinIOStorage:
    @pytest.mark.asyncio
    async def test_secure_file_upload(self, minio_client):
        bucket = "contracts"
        tenant_id = "tenant-123"
        file_content = b"Contract content here"
        file_name = "contract.pdf"
        
        # Generate secure object name
        object_name = f"{tenant_id}/{uuid.uuid4()}/{file_name}"
        
        # Upload with encryption
        await minio_client.put_object(
            bucket_name=bucket,
            object_name=object_name,
            data=io.BytesIO(file_content),
            length=len(file_content),
            metadata={
                "tenant_id": tenant_id,
                "uploaded_at": datetime.utcnow().isoformat(),
                "content_type": "application/pdf"
            },
            sse=ServerSideEncryption()
        )
        
        # Verify upload
        stat = await minio_client.stat_object(bucket, object_name)
        assert stat.size == len(file_content)
        assert stat.metadata["tenant_id"] == tenant_id
        
        # Test presigned URL generation
        url = await minio_client.presigned_get_object(
            bucket_name=bucket,
            object_name=object_name,
            expires=timedelta(hours=1)
        )
        assert url is not None
        assert "X-Amz-Signature" in url
    
    @pytest.mark.asyncio
    async def test_multipart_upload(self, minio_client):
        bucket = "large-documents"
        object_name = "large-contract.pdf"
        
        # Simulate large file (10MB)
        part_size = 5 * 1024 * 1024  # 5MB parts
        total_size = 10 * 1024 * 1024
        
        # Initiate multipart upload
        upload_id = await minio_client.initiate_multipart_upload(
            bucket, object_name
        )
        
        parts = []
        for part_num in range(1, 3):
            part_data = b"x" * part_size
            etag = await minio_client.upload_part(
                bucket, object_name, upload_id, part_num, part_data
            )
            parts.append({"part_num": part_num, "etag": etag})
        
        # Complete upload
        await minio_client.complete_multipart_upload(
            bucket, object_name, upload_id, parts
        )
        
        # Verify
        stat = await minio_client.stat_object(bucket, object_name)
        assert stat.size == total_size
```

## Multi-Database Consistency Testing

### 1. Distributed Transaction Testing
```python
class TestDistributedConsistency:
    @pytest.mark.asyncio
    async def test_saga_pattern(self, postgres_db, redis_cache, qdrant_client, minio_client):
        """Test distributed transaction using Saga pattern."""
        saga_id = str(uuid.uuid4())
        contract_id = "contract-123"
        
        # Step 1: Create in PostgreSQL
        try:
            await postgres_db.execute(
                "INSERT INTO contracts (id, title) VALUES (:id, :title)",
                {"id": contract_id, "title": "Test Contract"}
            )
            await redis_cache.hset(f"saga:{saga_id}", "postgres", "committed")
        except Exception as e:
            await self._compensate_postgres(contract_id)
            raise
        
        # Step 2: Index in Qdrant
        try:
            embedding = await generate_embedding("Test Contract")
            await qdrant_client.upsert(
                collection_name="contracts",
                points=[PointStruct(id=contract_id, vector=embedding)]
            )
            await redis_cache.hset(f"saga:{saga_id}", "qdrant", "committed")
        except Exception as e:
            await self._compensate_qdrant(contract_id)
            await self._compensate_postgres(contract_id)
            raise
        
        # Step 3: Store file in MinIO
        try:
            await minio_client.put_object(
                bucket_name="contracts",
                object_name=f"{contract_id}/document.pdf",
                data=io.BytesIO(b"content"),
                length=7
            )
            await redis_cache.hset(f"saga:{saga_id}", "minio", "committed")
        except Exception as e:
            await self._compensate_minio(contract_id)
            await self._compensate_qdrant(contract_id)
            await self._compensate_postgres(contract_id)
            raise
        
        # Verify all steps completed
        saga_state = await redis_cache.hgetall(f"saga:{saga_id}")
        assert saga_state["postgres"] == "committed"
        assert saga_state["qdrant"] == "committed"
        assert saga_state["minio"] == "committed"
```

## Performance Benchmarking

### 1. Load Testing
```python
class TestDatabasePerformance:
    @pytest.mark.asyncio
    async def test_concurrent_load(self, test_db):
        """Test database under concurrent load."""
        num_workers = 50
        operations_per_worker = 100
        
        async def worker(worker_id):
            for i in range(operations_per_worker):
                # Mix of operations
                if i % 4 == 0:
                    # Insert
                    await test_db.execute(
                        "INSERT INTO contracts (id, title, tenant_id) VALUES (:id, :title, :tenant_id)",
                        {
                            "id": f"w{worker_id}-{i}",
                            "title": f"Contract {i}",
                            "tenant_id": f"tenant-{worker_id % 10}"
                        }
                    )
                elif i % 4 == 1:
                    # Update
                    await test_db.execute(
                        "UPDATE contracts SET status = 'active' WHERE tenant_id = :tenant_id",
                        {"tenant_id": f"tenant-{worker_id % 10}"}
                    )
                elif i % 4 == 2:
                    # Select
                    await test_db.execute(
                        "SELECT * FROM contracts WHERE tenant_id = :tenant_id LIMIT 10",
                        {"tenant_id": f"tenant-{worker_id % 10}"}
                    )
                else:
                    # Delete
                    await test_db.execute(
                        "DELETE FROM contracts WHERE id = :id",
                        {"id": f"w{worker_id}-{i-3}"}
                    )
        
        # Run concurrent workers
        start_time = time.time()
        await asyncio.gather(*[worker(i) for i in range(num_workers)])
        duration = time.time() - start_time
        
        # Calculate throughput
        total_operations = num_workers * operations_per_worker
        throughput = total_operations / duration
        
        # Should handle at least 1000 ops/sec
        assert throughput > 1000
```

## Test Fixtures and Utilities

### Database Test Fixtures
```python
# fixtures/db_fixtures.py
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

@pytest.fixture(scope="session")
async def postgres_container():
    """Spin up PostgreSQL test container."""
    with PostgresContainer("postgres:15") as postgres:
        yield postgres

@pytest.fixture
async def test_db(postgres_container):
    """Provide test database session."""
    engine = create_async_engine(
        postgres_container.get_connection_url(),
        echo=False,
        pool_pre_ping=True,
        pool_size=10
    )
    
    # Create schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Provide session
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest.fixture
async def redis_client():
    """Provide Redis test client."""
    with RedisContainer() as redis:
        client = aioredis.from_url(redis.get_connection_url())
        yield client
        await client.flushall()
        await client.close()

@pytest.fixture
async def multi_tenant_db(test_db):
    """Setup multi-tenant test environment."""
    # Create tenants
    tenants = []
    for i in range(3):
        tenant = Tenant(
            id=f"tenant-{i}",
            name=f"Test Tenant {i}",
            schema_name=f"tenant_{i}"
        )
        test_db.add(tenant)
        tenants.append(tenant)
    
    await test_db.commit()
    
    # Create schemas
    for tenant in tenants:
        await test_db.execute(f"CREATE SCHEMA IF NOT EXISTS {tenant.schema_name}")
    
    yield test_db, tenants
    
    # Cleanup
    for tenant in tenants:
        await test_db.execute(f"DROP SCHEMA IF EXISTS {tenant.schema_name} CASCADE")
```

## Common Pitfalls to Avoid

1. **Never ignore transaction boundaries** - Always use proper transaction management
2. **Don't bypass tenant isolation** - Always filter by tenant_id
3. **Avoid N+1 queries** - Use eager loading or batch fetching
4. **Never store sensitive data unencrypted** - Use encryption at rest
5. **Don't ignore connection pooling** - Configure pools properly
6. **Avoid unbounded queries** - Always use pagination
7. **Never skip indexes** - They're crucial for performance
8. **Don't ignore cache invalidation** - Keep cache consistent

## Best Practices Checklist

### Before Every Database Feature
- [ ] Write failing test first (RED)
- [ ] Implement minimal logic (GREEN)
- [ ] Optimize and secure (REFACTOR)
- [ ] Test multi-tenant isolation
- [ ] Verify index usage
- [ ] Check query performance
- [ ] Test transaction behavior
- [ ] Validate cache strategy

### Performance Targets
- [ ] Query response < 10ms for indexed queries
- [ ] Bulk insert > 1000 records/second
- [ ] Cache hit ratio > 90%
- [ ] Connection pool utilization < 80%
- [ ] Zero tenant data leakage

Remember: Every database operation must be tested for correctness, performance, and security.