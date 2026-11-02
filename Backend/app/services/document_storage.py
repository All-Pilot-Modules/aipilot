"""Private document storage. Database references are immutable bucket/key URIs."""
import os
import tempfile
from functools import cached_property
from urllib.parse import urlparse, unquote
import httpx
from storage3 import SyncStorageClient
from storage3.utils import SyncClient
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_STORAGE_BUCKET

PRIVATE_BUCKET = os.getenv('SUPABASE_PRIVATE_STORAGE_BUCKET', 'documents-private')


class _Http1StorageClient(SyncStorageClient):
    # storage3 hardcodes HTTP/2, whose pooled connections can stall until the
    # read timeout after idling. HTTP/1.1 opens a fresh stream per request.
    def _create_session(self, base_url, headers, timeout, verify=True, proxy=None):
        return SyncClient(base_url=base_url, headers=headers, timeout=timeout, proxy=proxy,
                          verify=bool(verify), follow_redirects=True, http2=False)


class DocumentStorage:
    @cached_property
    def storage(self):
        return _Http1StorageClient(f"{SUPABASE_URL.rstrip('/')}/storage/v1/", {
            'apikey': SUPABASE_SERVICE_KEY, 'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'}, timeout=60)

    def resolve(self, reference):
        parsed = urlparse(reference)
        if parsed.scheme == 'supabase':
            bucket, key = parsed.netloc, unquote(parsed.path.lstrip('/'))
        elif parsed.scheme == 'https' and parsed.netloc == urlparse(SUPABASE_URL).netloc:
            parts = parsed.path.split('/', 6)
            if len(parts) != 7 or '/'.join(parts[:4]) != '/storage/v1/object' or parts[4] not in ('public', 'sign', 'authenticated'):
                raise ValueError('Invalid storage URL')
            bucket, key = parts[5], unquote(parts[6])
        else:
            raise ValueError('Document must reference managed storage, not a local path')
        if bucket not in {PRIVATE_BUCKET, SUPABASE_STORAGE_BUCKET, 'uploads', 'documents', 'question-images'}:
            raise ValueError('Unrecognized storage bucket')
        if not key or any(p in ('', '.', '..') for p in key.split('/')) or '\\' in key:
            raise ValueError('Invalid storage key')
        return bucket, key

    def _find_bucket(self):
        # get_bucket() breaks when the API adds fields the installed storage3
        # model doesn't know (e.g. versioning_status); list_buckets() tolerates them.
        buckets = self.storage.list_buckets()
        return next((b for b in buckets if (b.get('id') if isinstance(b, dict) else b.id) == PRIVATE_BUCKET), None)

    def ensure_private_bucket(self):
        bucket = self._find_bucket()
        if bucket is None:
            try:
                self.storage.create_bucket(PRIVATE_BUCKET, options={'public': False})
            except Exception:
                # Another replica may have created it concurrently; verify below.
                pass
            bucket = self._find_bucket()
        if bucket is None:
            raise RuntimeError('Document bucket is unavailable')
        public = bucket.get('public') if isinstance(bucket, dict) else bucket.public
        if public is not False:
            raise RuntimeError('Document bucket must be private')

    def upload_file(self, content, key):
        self.ensure_private_bucket()
        reference = f'supabase://{PRIVATE_BUCKET}/{key}'
        self.resolve(reference)
        # Immutable UUID keys: never delete or overwrite an existing upload.
        try:
            try:
                self.storage.from_(PRIVATE_BUCKET).upload(key, content, {'content-type': 'application/octet-stream'})
            except httpx.TransportError:
                # One retry; if the first attempt landed, the 409 path below verifies it.
                self.storage.from_(PRIVATE_BUCKET).upload(key, content, {'content-type': 'application/octet-stream'})
        except Exception as error:
            # Resume a prior interrupted upload without overwriting anything.
            if getattr(error, 'statusCode', None) not in (409, '409') and not any(
                    token in str(error).lower() for token in ('duplicate', 'already exists', '409')):
                raise
            from hashlib import sha256
            stored = self.storage.from_(PRIVATE_BUCKET).download(key)
            if sha256(stored).digest() != sha256(content).digest():
                raise RuntimeError('Existing storage object does not match this upload') from error
        return reference

    def download_file_temporarily(self, reference):
        bucket, key = self.resolve(reference)
        content = self.storage.from_(bucket).download(key)
        from app.services.document_validation import MAX_UPLOAD_BYTES
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError('Stored file exceeds the upload size limit')
        path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(key)[1]) as f:
                path = f.name
                f.write(content)
            return path
        except Exception:
            if path and os.path.exists(path):
                os.unlink(path)
            raise

    def signed_url(self, reference):
        bucket, key = self.resolve(reference)
        result = self.storage.from_(bucket).create_signed_url(key, 300)
        url = result.get('signedURL') or result.get('signedUrl')
        if not url:
            raise RuntimeError('Could not create download link')
        return url

    def delete_file(self, reference):
        bucket, key = self.resolve(reference)
        self.storage.from_(bucket).remove([key])
        return True


document_storage = DocumentStorage()
