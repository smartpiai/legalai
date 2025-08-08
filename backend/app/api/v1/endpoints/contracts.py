"""
Contract management endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.contract import ContractCreate, ContractResponse
from app.services.clm.contract_service import ContractService

router = APIRouter()

@router.post("/upload", response_model=ContractResponse)
async def upload_contract(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload and process a new contract"""
    service = ContractService(db)
    contract = await service.process_upload(file)
    return contract

@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get contract details"""
    service = ContractService(db)
    contract = await service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract

@router.post("/{contract_id}/analyze")
async def analyze_contract(
    contract_id: str,
    analysis_type: str = "full",
    db: AsyncSession = Depends(get_db)
):
    """Run AI analysis on contract"""
    service = ContractService(db)
    analysis = await service.analyze_contract(contract_id, analysis_type)
    return analysis
