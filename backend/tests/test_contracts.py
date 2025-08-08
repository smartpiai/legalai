"""
Contract service tests
"""
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_upload_contract():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Test file upload
        files = {"file": ("test.pdf", b"test content", "application/pdf")}
        response = await client.post("/api/v1/contracts/upload", files=files)
        assert response.status_code == 200
        assert "id" in response.json()

@pytest.mark.asyncio
async def test_get_contract():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/contracts/test-id")
        assert response.status_code in [200, 404]
