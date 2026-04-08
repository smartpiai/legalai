"""
Security utilities for authentication and authorization.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt truncates passwords longer than 72 bytes. We pre-truncate to make
# the behaviour explicit and avoid surprises when comparing long inputs.
_BCRYPT_MAX_PASSWORD_BYTES = 72


def _encode_password(password: str) -> bytes:
    """Encode a password to bytes, truncated to bcrypt's 72-byte limit."""
    return password.encode("utf-8")[:_BCRYPT_MAX_PASSWORD_BYTES]


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Payload data to encode
        expires_delta: Token expiration time

    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Create a JWT refresh token.

    Args:
        data: Payload data to encode

    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token to verify

    Returns:
        Decoded token payload or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its bcrypt hash.

    Args:
        plain_password: Plain text password
        hashed_password: Bcrypt-hashed password (as stored in the database)

    Returns:
        True if password matches, False otherwise
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            _encode_password(plain_password),
            hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
        )
    except (ValueError, TypeError):
        # Malformed hash -> treat as non-matching rather than raising.
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password

    Returns:
        Bcrypt hash, utf-8 decoded for storage as a string column.
    """
    hashed = bcrypt.hashpw(_encode_password(password), bcrypt.gensalt())
    return hashed.decode("utf-8")
