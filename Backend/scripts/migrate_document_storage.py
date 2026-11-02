"""Move existing document files to private storage and repair legacy testbank flags.

Run from Backend: python -m scripts.migrate_document_storage [--apply]
Default is read-only. Pause uploads/workers during --apply. Re-running resumes
pending source cleanup recorded on each document; no question IDs are changed.
"""
import argparse
from uuid import uuid4
from hashlib import sha256
from app.database import SessionLocal
from app.models.document import Document
from app.models.question import Question
from app.models.module import Module
from app.models.user import User  # Register FK targets for standalone execution.
from app.models.module_batch import ModuleBatch
from app.services.document_storage import document_storage, PRIVATE_BUCKET


def migrate(db, apply=False):
    ids = [row.id for row in db.query(Document.id).all()]
    for document_id in ids:
        doc = db.get(Document, document_id)
        try:
            bucket, key = document_storage.resolve(doc.storage_path)
        except ValueError:
            print(f'{doc.id}: unsupported legacy reference; manual import required')
            continue
        repair_flag = ('testbank' in doc.file_name.lower() and not doc.is_testbank
                       and not (doc.processing_metadata or {}).get('explicit_document_type'))
        pending = list((doc.processing_metadata or {}).get('pending_storage_cleanup', []))
        needs_move = bucket != PRIVATE_BUCKET
        if not apply:
            print(f'{doc.id}: private_copy={needs_move}, repair_testbank={repair_flag}, cleanup_pending={len(pending)}')
            continue
        # Lock in the same order as upload processing and deletion.
        db.query(Module).filter(Module.id == doc.module_id).with_for_update().first()
        doc = db.query(Document).filter(Document.id == document_id).populate_existing().with_for_update().one()
        if needs_move:
            content = document_storage.client.storage.from_(bucket).download(key)
            if sha256(content).hexdigest() != doc.file_hash:
                print(f'{doc.id}: stored content hash mismatch; manual review required')
                db.rollback()
                continue
            new_key = f'{doc.teacher_id}/{doc.module_id}/{uuid4()}/source.{doc.file_type}'
            reserved = f'supabase://{PRIVATE_BUCKET}/{new_key}'
            doc.processing_metadata = {**(doc.processing_metadata or {}),
                                       'pending_storage_cleanup': list(set(pending + [reserved]))}
            db.commit()  # Reserve cleanup of the copy before external I/O.
            new_ref = document_storage.upload_file(content, new_key)
            pending.append(doc.storage_path)
            # Shared legacy exports must no longer expose answer keys publicly.
            pending.append(f'supabase://{bucket}/{key.rsplit("/", 1)[0]}/parsed_questions.json')
            doc.storage_path = new_ref
        if repair_flag:
            doc.is_testbank = True
            has_questions = db.query(Question.id).filter(Question.document_id == doc.id).first() is not None
            doc.parse_status = 'success' if has_questions else 'pending'
            doc.processing_status = 'parsed' if has_questions else 'queued'
            # Misclassified testbanks must not remain in the course-material index.
            from app.models.document_chunk import DocumentChunk
            db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete(synchronize_session=False)
        doc.processing_metadata = {**(doc.processing_metadata or {}), 'pending_storage_cleanup': list(set(pending))}
        db.commit()  # Save the verified new reference before removing the old source.
        remaining = []
        for reference in set(pending):
            try:
                if db.query(Document.id).filter(Document.storage_path == reference).first():
                    remaining.append(reference)
                    continue
                document_storage.delete_file(reference)
            except Exception:
                remaining.append(reference)
        doc.processing_metadata = {**(doc.processing_metadata or {}), 'pending_storage_cleanup': remaining}
        db.commit()
        print(f'{doc.id}: migrated; remaining cleanup objects={len(remaining)}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    with SessionLocal() as session:
        migrate(session, apply=args.apply)
