"""Authorization for document operations, including module-scoped student downloads."""
from uuid import UUID
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.auth import security, get_current_active_user, get_current_user, _decode_student_token
from app.database import get_db
from app.models.document import Document
from app.models.module import Module
from app.models.student_enrollment import StudentEnrollment


def authorize_document_request(request: Request,
                               credentials: HTTPAuthorizationCredentials = Depends(security),
                               db: Session = Depends(get_db)):
    doc_id = request.path_params.get('doc_id')
    try:
        doc = db.get(Document, UUID(str(doc_id))) if doc_id else None
    except ValueError:
        raise HTTPException(422, "Invalid document ID")
    if doc_id and not doc:
        raise HTTPException(404, 'Document not found')
    # Student session tokens are only accepted for non-testbank downloads.
    if doc and request.method == 'GET' and request.url.path.endswith(('/download', '/download-url')):
        try:
            identity = _decode_student_token(credentials.credentials)
        except HTTPException:
            identity = None
        if identity:
            enrolled = db.query(StudentEnrollment).filter_by(
                module_id=doc.module_id, student_id=identity.student_id).first()
            if (str(doc.module_id) != identity.module_id or not enrolled or doc.is_testbank
                    or 'testbank' in doc.file_name.lower()):
                raise HTTPException(403, 'Document access denied')
            return
    user = get_current_active_user(get_current_user(credentials, db))
    if doc:
        module = db.get(Module, doc.module_id)
        if not module or module.teacher_id != user.id or doc.teacher_id != user.id:
            raise HTTPException(403, 'Document access denied')
    teacher_id = request.query_params.get('teacher_id')
    if teacher_id and teacher_id != user.id:
        raise HTTPException(403, 'Document access denied')
    module_id = request.query_params.get('module_id')
    if module_id:
        try:
            module = db.get(Module, UUID(module_id))
        except ValueError:
            raise HTTPException(422, 'Invalid module ID')
        if not module or module.teacher_id != user.id:
            raise HTTPException(403, 'Module access denied')


def authorize_module_mutation(request: Request, db: Session = Depends(get_db),
                              credentials: HTTPAuthorizationCredentials = Depends(security)):
    from app.core.auth import get_current_user
    user = get_current_active_user(get_current_user(credentials, db))
    module_id = request.path_params.get('module_id')
    if module_id:
        module = db.get(Module, UUID(str(module_id)))
        if not module:
            raise HTTPException(404, 'Module not found')
        if module.status == 'deleting' and request.method != 'DELETE':
            raise HTTPException(409, 'Module is being deleted')
        if module.teacher_id != user.id:
            raise HTTPException(403, 'Only the module owner can change this module')
    return user
