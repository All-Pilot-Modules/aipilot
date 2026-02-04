"""
Mock Supabase storage for testing file operations.
"""
from typing import Dict, List, Optional, Any
from unittest.mock import MagicMock, patch
import io


class MockSupabaseStorage:
    """Mock Supabase storage bucket for testing."""

    def __init__(self):
        self.files: Dict[str, bytes] = {}
        self.upload_calls: List[Dict] = []
        self.download_calls: List[str] = []

    def upload(self, path: str, file: bytes, file_options: Optional[Dict] = None) -> Dict:
        """Mock file upload."""
        self.files[path] = file
        self.upload_calls.append({"path": path, "size": len(file), "options": file_options})
        return {"Key": path, "path": path}

    def download(self, path: str) -> bytes:
        """Mock file download."""
        self.download_calls.append(path)
        if path in self.files:
            return self.files[path]
        return b"mock file content for " + path.encode()

    def list(self, folder: str = "") -> List[Dict]:
        """Mock list files in folder."""
        results = []
        for path in self.files:
            if path.startswith(folder):
                results.append({
                    "name": path.split("/")[-1],
                    "id": f"id_{path}",
                    "metadata": {"size": len(self.files[path])}
                })
        return results

    def remove(self, paths: List[str]) -> Dict:
        """Mock file deletion."""
        removed = []
        for path in paths:
            if path in self.files:
                del self.files[path]
                removed.append(path)
        return {"removed": removed}

    def get_public_url(self, path: str) -> str:
        """Mock get public URL."""
        return f"https://test.supabase.co/storage/v1/object/public/documents/{path}"

    def create_signed_url(self, path: str, expires_in: int = 3600) -> Dict:
        """Mock create signed URL."""
        return {
            "signedURL": f"https://test.supabase.co/storage/v1/object/sign/documents/{path}?token=mock_token",
            "path": path
        }


class MockSupabaseClient:
    """Mock Supabase client."""

    def __init__(self):
        self._storage_buckets: Dict[str, MockSupabaseStorage] = {}

    def storage_from(self, bucket_name: str) -> MockSupabaseStorage:
        """Get or create a mock storage bucket."""
        if bucket_name not in self._storage_buckets:
            self._storage_buckets[bucket_name] = MockSupabaseStorage()
        return self._storage_buckets[bucket_name]

    @property
    def storage(self):
        """Return storage interface."""
        mock = MagicMock()
        mock.from_ = self.storage_from
        return mock


def create_mock_supabase_client() -> MockSupabaseClient:
    """Factory function to create a mock Supabase client."""
    return MockSupabaseClient()


def patch_supabase_storage():
    """Context manager to patch Supabase storage globally."""
    mock_client = create_mock_supabase_client()

    def mock_create_client(*args, **kwargs):
        return mock_client

    return patch("supabase.create_client", mock_create_client), mock_client


def create_mock_pdf_content(text: str = "Sample PDF content for testing.") -> bytes:
    """Create mock PDF-like bytes for testing uploads."""
    # PDF magic bytes + minimal structure
    pdf_header = b"%PDF-1.4\n"
    pdf_content = f"1 0 obj\n<<>>\nstream\n{text}\nendstream\nendobj\n".encode()
    pdf_footer = b"%%EOF"
    return pdf_header + pdf_content + pdf_footer


def create_mock_docx_content(text: str = "Sample DOCX content.") -> bytes:
    """Create mock DOCX-like bytes for testing uploads."""
    # DOCX files are ZIP archives, this is a minimal mock
    return b"PK" + text.encode() + b"\x00" * 100


def create_mock_pptx_content(text: str = "Sample PPTX content.") -> bytes:
    """Create mock PPTX-like bytes for testing uploads."""
    # PPTX files are ZIP archives
    return b"PK" + text.encode() + b"\x00" * 100
