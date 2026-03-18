from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from app.core.database import get_supabase
from app.core.auth import hash_password, verify_password, create_access_token
from app.models.schemas import UserCreate, UserLogin, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    db = get_supabase()
    existing = db.table("users").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "role": "user",
        "created_at": now,
        "updated_at": now,
    }
    db.table("users").insert(user).execute()

    token = create_access_token({"sub": user_id, "email": data.email})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=data.email, name=data.name, role="user", created_at=now),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    db = get_supabase()
    result = db.table("users").select("*").eq("email", data.email).single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user = result.data
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"], email=user["email"], name=user["name"],
            role=user["role"], created_at=user["created_at"],
        ),
    )
