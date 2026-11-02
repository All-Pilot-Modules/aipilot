"""Storage cleanup shared by document and module deletion.

Rows remain in 'deleting' state if storage is unavailable, preserving the keys
needed for an idempotent retry. Database deletion then commits in one transaction.
"""
from fastapi import HTTPException
from app.services.document_storage import document_storage


def remove_references(references):
    for reference in sorted(set(references)):
        try:
            if not document_storage.delete_file(reference):
                raise RuntimeError('Storage removal failed')
        except Exception:
            raise HTTPException(503, 'Storage cleanup is incomplete. Retry deletion; related records have been retained.')
