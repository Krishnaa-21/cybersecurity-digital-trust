from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Officer
from app.schemas.officer import OfficerLogin, OfficerRead, TokenResponse
from app.core.security import verify_password, create_access_token, decode_access_token

router = APIRouter(tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_officer(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Officer:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    badge_id: str = payload.get("sub")
    if badge_id is None:
        raise credentials_exception

    officer = db.query(Officer).filter(Officer.badge_id == badge_id).first()
    if officer is None:
        raise credentials_exception

    return officer


@router.post("/login", response_model=TokenResponse)
def login(credentials: OfficerLogin, db: Session = Depends(get_db)):
    officer = db.query(Officer).filter(Officer.badge_id == credentials.badge_id).first()
    if not officer or not verify_password(credentials.password, officer.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid badge ID or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": officer.badge_id})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        officer=officer,
    )


@router.get("/me", response_model=OfficerRead)
def get_me(current_officer: Officer = Depends(get_current_officer)):
    return current_officer
