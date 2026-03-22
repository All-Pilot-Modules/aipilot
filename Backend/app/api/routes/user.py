import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.services import user as user_service
from app.database import get_db
from app.services.storage import SupabaseStorageService
from app.core.config import SUPABASE_USER_BUCKET

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserOut)
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        return user_service.create_user(db, user_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(user_service.User).filter(user_service.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(user_service.User).all()

@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: str, update_data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(user_service.User).filter(user_service.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user

@router.post("/{user_id}/profile-image", response_model=UserOut)
def upload_profile_image(user_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = db.query(user_service.User).filter(user_service.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only image files are allowed (jpeg, png, gif, webp)")

    file_bytes = file.file.read()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    file_path = f"profile-images/{user_id}/{uuid.uuid4()}.{ext}"

    storage = SupabaseStorageService(bucket_name=SUPABASE_USER_BUCKET)
    public_url = storage.upload_file(file_bytes, file_path)

    user.profile_image = public_url
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/role", response_model=UserOut)
def change_role(user_id: str, role: str, db: Session = Depends(get_db)):
    user = db.query(user_service.User).filter(user_service.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = role
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(user_service.User).filter(user_service.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"detail": f"User {user_id} deleted successfully"}