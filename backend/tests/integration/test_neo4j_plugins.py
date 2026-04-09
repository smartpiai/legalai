"""
Integration tests for Neo4j 5.26 plugin compatibility (PR 1.5.2).

Acceptance criteria from docs/phase-1/1.0_test-spec_infrastructure-upgrades.md:
  - IT-NJ-02: APOC plugin loaded and callable (`CALL apoc.help("apoc")`)
  - IT-NJ-03: GDS plugin loaded and callable (`CALL gds.version()`)
  - IT-NJ-05: Python `neo4j` driver connects and runs a Cypher query

Plugin matrix per docs/phase-1/1.5.1_dep-review_neo4j.md:
  Server: neo4j:5.26-community
  APOC Core: 5.26.x (must match server)
  GDS:       2.13.x  (compatible with server 5.26)
  Driver:    neo4j==5.26.0
"""
from __future__ import annotations

import os

import pytest
from neo4j import AsyncGraphDatabase
from neo4j.exceptions import ServiceUnavailable

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "neo4jpassword")

# Skip the whole module if Neo4j isn't reachable (CI without service container).
pytestmark = pytest.mark.integration


@pytest.fixture
async def driver():
    drv = AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        await drv.verify_connectivity()
    except (ServiceUnavailable, OSError) as exc:
        await drv.close()
        pytest.skip(f"Neo4j not reachable at {NEO4J_URI}: {exc}")
    yield drv
    await drv.close()


class TestNeo4jPluginCompatibility:
    """PR 1.5.2 — verify APOC + GDS plugins match server 5.26."""

    @pytest.mark.asyncio
    async def test_it_nj_05_driver_basic_cypher(self, driver):
        """IT-NJ-05: driver connects and runs a basic Cypher query."""
        async with driver.session() as session:
            result = await session.run("MATCH (n) RETURN count(n) AS c")
            record = await result.single()
            assert record is not None
            assert isinstance(record["c"], int)

    @pytest.mark.asyncio
    async def test_it_nj_01_server_version_5_26(self, driver):
        """Sanity: server reports 5.26.x (PR 1.5.1 pin)."""
        async with driver.session() as session:
            result = await session.run("CALL dbms.components() YIELD versions RETURN versions")
            record = await result.single()
            assert record is not None
            versions = record["versions"]
            assert any(v.startswith("5.26") for v in versions), f"Expected 5.26.x, got {versions}"

    @pytest.mark.asyncio
    async def test_it_nj_02_apoc_help_callable(self, driver):
        """IT-NJ-02: `CALL apoc.help("apoc")` returns rows."""
        async with driver.session() as session:
            result = await session.run('CALL apoc.help("apoc")')
            rows = [r async for r in result]
            assert len(rows) > 0, "APOC plugin not loaded or apoc.help returned no rows"

    @pytest.mark.asyncio
    async def test_it_nj_03_gds_version_matches_server(self, driver):
        """IT-NJ-03: `CALL gds.version()` succeeds and reports a 2.13.x build."""
        async with driver.session() as session:
            result = await session.run("CALL gds.version() YIELD gdsVersion RETURN gdsVersion")
            record = await result.single()
            assert record is not None, "GDS plugin not loaded"
            gds_version = record["gdsVersion"]
            assert gds_version.startswith("2.13"), (
                f"GDS version {gds_version} not aligned with server 5.26 "
                "(expected 2.13.x per dep-review plugin matrix)"
            )
