"""Durable document queue using existing rows and PostgreSQL SKIP LOCKED.

A single transaction owns a module and its queued document throughout processing.
Process death releases the locks and rolls back to queued; no in-memory job is lost.
Run with always-allocated CPU (or `python -m app.services.document_worker`).
"""
import logging
import os
import threading
from app.database import SessionLocal
from app.models.document import Document
from app.models.module import Module
from app.services.document import process_document

logger = logging.getLogger(__name__)
_stop = threading.Event()
_thread = None


def run_once():
    with SessionLocal() as db:
        doc = (db.query(Document).join(Module, Document.module_id == Module.id)
               .filter(Document.processing_status == 'queued', Module.status != 'deleting')
               .order_by(Document.uploaded_at).with_for_update(skip_locked=True).first())
        if not doc:
            return False
        process_document(db, doc.id, locked_document=doc)
        return True


def _run():
    while not _stop.is_set():
        try:
            found = run_once()
        except Exception:
            logger.exception('Document worker iteration failed')
            found = False
        if not found:
            _stop.wait(3)


def start_document_worker():
    global _thread
    if os.getenv('ENV') == 'testing' or os.getenv('DOCUMENT_WORKER_ENABLED', 'true').lower() != 'true':
        return
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_run, name='document-worker', daemon=True)
    _thread.start()


def stop_document_worker():
    _stop.set()
    if _thread:
        _thread.join(timeout=5)


if __name__ == '__main__':
    _run()
