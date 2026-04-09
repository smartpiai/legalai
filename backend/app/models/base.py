"""Stable import path for the SQLAlchemy declarative Base.

Re-exports Base from app.core.database so future models can import from
app.models.base without us having to move the declarative_base itself.
"""
from app.core.database import Base

__all__ = ["Base"]
