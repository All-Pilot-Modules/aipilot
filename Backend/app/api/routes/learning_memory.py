"""Teacher-owned learning journal views. No direct browser database access."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.auth import get_current_active_user
from app.models.module import Module
from app.models.learning_memory import LearningMemory
from app.services.learning_memory import memory_entries

router = APIRouter()


@router.get('/modules/{module_id}/students/{student_id}/learning-memory')
def get_learning_memory(module_id: UUID, student_id: str,
                        db: Session = Depends(get_db), user=Depends(get_current_active_user)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module or str(module.teacher_id) != str(user.id):
        raise HTTPException(status_code=403, detail='You do not own this module')
    try:
        entries = memory_entries(db, module_id, student_id, 100)
        pending = db.query(LearningMemory).filter(LearningMemory.module_id == module_id,
            LearningMemory.student_id == student_id, LearningMemory.status != 'completed',
            LearningMemory.retry_count < 3).count()
        failed = db.query(LearningMemory).filter(LearningMemory.module_id == module_id,
            LearningMemory.student_id == student_id, LearningMemory.status != 'completed',
            LearningMemory.retry_count >= 3).count()
        return {'entries':entries, 'pending_entries':pending, 'failed_entries':failed}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=503, detail='Learning memory is not available yet. Check the database migration and worker.')
