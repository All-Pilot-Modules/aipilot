"""Bounded, content-aware validation before any storage mutation."""
import io
import zipfile
from pathlib import PurePath
from fastapi import HTTPException

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_EXPANDED_BYTES = 100 * 1024 * 1024
MAX_EXTRACTED_CHARS = 500_000
MAX_PAGES = 500
SUPPORTED_TYPES = {'pdf', 'docx', 'pptx', 'txt'}


def validate_upload(content, filename, is_testbank):
    if not filename or len(filename) > 255 or '/' in filename or '\\' in filename or any(ord(c) < 32 for c in filename):
        raise HTTPException(422, 'Invalid filename')
    extension = PurePath(filename).suffix.lower().lstrip('.')
    allowed = SUPPORTED_TYPES - ({'pptx'} if is_testbank else set())
    if extension not in allowed:
        raise HTTPException(415, 'Supported formats: ' + ', '.join(sorted(allowed)) + '. Convert legacy DOC/PPT files first.')
    if not content:
        raise HTTPException(422, 'File is empty')
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, 'File must be 20 MB or smaller')
    if extension == 'pdf':
        if not content.startswith(b'%PDF-'):
            raise HTTPException(422, 'File content is not a PDF')
        import fitz
        try:
            with fitz.open(stream=content, filetype='pdf') as pdf:
                if pdf.needs_pass:
                    raise HTTPException(422, 'Remove the PDF password before uploading')
                if len(pdf) > MAX_PAGES:
                    raise HTTPException(413, 'PDF must contain 500 pages or fewer')
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(422, 'PDF is corrupt or unreadable')
    if extension in ('docx', 'pptx'):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                entries = archive.infolist()
                if len(entries) > 10000 or sum(e.file_size for e in entries) > MAX_EXPANDED_BYTES:
                    raise HTTPException(413, 'Expanded document is too large')
                root = 'word/document.xml' if extension == 'docx' else 'ppt/presentation.xml'
                if root not in archive.namelist() or '[Content_Types].xml' not in archive.namelist():
                    raise ValueError('Invalid Office document')
        except (zipfile.BadZipFile, ValueError):
            raise HTTPException(422, 'File content does not match its Office extension')
    if extension == 'txt':
        try:
            text = decode_text(content)
        except UnicodeError:
            raise HTTPException(422, 'Save text files as UTF-8 or UTF-16 with a byte-order mark')
        if not text.strip() or '\x00' in text:
            raise HTTPException(422, 'Text file is empty or contains binary data')
    return extension


def decode_text(content):
    encoding = 'utf-16' if content.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig'
    return content.decode(encoding)
