"""Private document storage. Database references are immutable bucket/key URIs."""
import os
import tempfile
from urllib.parse import urlparse, unquote
from app.services.storage import storage_service
from app.core.config import SUPABASE_URL, SUPABASE_STORAGE_BUCKET

PRIVATE_BUCKET = os.getenv('SUPABASE_PRIVATE_STORAGE_BUCKET', 'documents-private')


class DocumentStorage:
    @property
    def client(self):
        return storage_service.client

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

    def ensure_private_bucket(self):
        buckets = self.client.storage.list_buckets()
        bucket = next((b for b in buckets if (b.get('id') if isinstance(b, dict) else b.id) == PRIVATE_BUCKET), None)
        if bucket is None:
            try:
                self.client.storage.create_bucket(PRIVATE_BUCKET, options={'public': False})
            except Exception:
                # Another replica may have created it concurrently; verify below.
                pass
        bucket = self.client.storage.get_bucket(PRIVATE_BUCKET)
        public = bucket.get('public') if isinstance(bucket, dict) else bucket.public
        if public is not False:
            raise RuntimeError('Document bucket must be private')

    def upload_file(self, content, key):
        self.ensure_private_bucket()
        reference = f'supabase://{PRIVATE_BUCKET}/{key}'
        self.resolve(reference)
        # Immutable UUID keys: never delete or overwrite an existing upload.
        try:
            self.client.storage.from_(PRIVATE_BUCKET).upload(key, content, {'content-type': 'application/octet-stream'})
        except Exception as error:
            # Resume a prior interrupted upload without overwriting anything.
            if getattr(error, 'statusCode', None) not in (409, '409') and not any(
                    token in str(error).lower() for token in ('duplicate', 'already exists', '409')):
                raise
            from hashlib import sha256
            stored = self.client.storage.from_(PRIVATE_BUCKET).download(key)
            if sha256(stored).digest() != sha256(content).digest():
                raise RuntimeError('Existing storage object does not match this upload') from error
        return reference

    def download_file_temporarily(self, reference):
        bucket, key = self.resolve(reference)
        content = self.client.storage.from_(bucket).download(key)
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
        result = self.client.storage.from_(bucket).create_signed_url(key, 300)
        url = result.get('signedURL') or result.get('signedUrl')
        if not url:
            raise RuntimeError('Could not create download link')
        return url

    def delete_file(self, reference):
        bucket, key = self.resolve(reference)
        self.client.storage.from_(bucket).remove([key])
        return True


document_storage = DocumentStorage()
