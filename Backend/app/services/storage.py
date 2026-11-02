import os
import tempfile
from typing import List, Optional
from supabase import create_client, Client
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_STORAGE_BUCKET


class SupabaseStorageService:
    """Service for handling file operations with Supabase Storage"""

    def __init__(self, bucket_name: Optional[str] = None):
        print(f"Initializing Supabase storage service...")
        print(f"SUPABASE_URL: {SUPABASE_URL[:30]}..." if SUPABASE_URL else "SUPABASE_URL: None")
        print(f"SUPABASE_SERVICE_KEY: {'SET' if SUPABASE_SERVICE_KEY else 'NOT SET'}")
        print(f"SUPABASE_STORAGE_BUCKET: {SUPABASE_STORAGE_BUCKET}")

        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("Supabase configuration missing. Check SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.")

        try:
            self.client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            # Use provided bucket_name or default to SUPABASE_STORAGE_BUCKET
            self.bucket_name = bucket_name if bucket_name else SUPABASE_STORAGE_BUCKET
            print(f"Supabase client created successfully for bucket: {self.bucket_name}")
        except Exception as e:
            print(f"Failed to create Supabase client: {str(e)}")
            raise

    def upload_file(self, file_bytes: bytes, file_path: str) -> str:
        """
        Upload file to Supabase Storage

        Args:
            file_bytes: File content as bytes
            file_path: Path in bucket (e.g., "teacher123/Module1/document.pdf")

        Returns:
            Public URL of uploaded file
        """
        try:
            print(f"Attempting to upload file: {file_path} to bucket: {self.bucket_name}")
            print(f"File size: {len(file_bytes)} bytes")

            response = self.client.storage.from_(self.bucket_name).upload(
                path=file_path, file=file_bytes,
                file_options={"content-type": "application/octet-stream"}
            )

            print(f"Upload response: {response}")
            print(f"Response type: {type(response)}")

            # Check if upload was successful
            # Supabase upload() returns different response formats
            if hasattr(response, 'error') and response.error:
                print(f"Upload error: {response.error}")
                raise Exception(f"Upload failed: {response.error}")
            elif isinstance(response, dict) and 'error' in response:
                print(f"Upload error (dict): {response['error']}")
                raise Exception(f"Upload failed: {response['error']}")

            # Get public URL
            public_url = self.client.storage.from_(self.bucket_name).get_public_url(file_path)
            print(f"Public URL generated: {public_url}")
            return public_url

        except Exception as e:
            print(f"Exception during upload: {str(e)}")
            raise Exception(f"Failed to upload file to Supabase: {str(e)}")

    def download_file(self, file_path: str) -> bytes:
        """
        Download file from Supabase Storage

        Args:
            file_path: Path in bucket

        Returns:
            File content as bytes
        """
        try:
            print(f"📥 Downloading file from Supabase: {file_path}")
            response = self.client.storage.from_(self.bucket_name).download(file_path)

            print(f"Download response type: {type(response)}")
            print(f"Download response size: {len(response) if isinstance(response, bytes) else 'N/A'} bytes")

            if isinstance(response, bytes):
                return response
            else:
                print(f"Invalid response type: {type(response)}")
                raise Exception(f"Failed to download file - invalid response type: {type(response)}")

        except Exception as e:
            print(f"❌ Download error: {str(e)}")
            raise Exception(f"Failed to download file from Supabase: {str(e)}")

    def download_file_temporarily(self, file_path: str) -> str:
        """
        Download file to a temporary location for processing

        Args:
            file_path: Path in bucket

        Returns:
            Path to temporary file (caller must delete it)
        """
        try:
            print(f"📂 Creating temporary file for: {file_path}")
            file_bytes = self.download_file(file_path)

            # Create temporary file with correct extension
            suffix = os.path.splitext(file_path)[1] or '.tmp'
            print(f"Creating temp file with suffix: {suffix}")

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            temp_path = temp_file.name

            print(f"Writing {len(file_bytes)} bytes to: {temp_path}")
            temp_file.write(file_bytes)
            temp_file.close()

            print(f"✅ Temporary file created: {temp_path}")
            return temp_path

        except Exception as e:
            print(f"❌ Failed to create temporary file: {str(e)}")
            raise Exception(f"Failed to create temporary file: {str(e)}")

    def list_files(self, folder_path: str = "") -> List[dict]:
        """
        List files in a folder

        Args:
            folder_path: Folder path in bucket (e.g., "teacher123/Module1/")

        Returns:
            List of file metadata dictionaries
        """
        try:
            response = self.client.storage.from_(self.bucket_name).list(folder_path)

            if not isinstance(response, list):
                raise RuntimeError("Unexpected storage list response")
            return response

        except Exception as e:
            raise Exception(f"Failed to list files: {str(e)}")

    def file_exists(self, file_path: str) -> bool:
        """
        Check if file exists in storage

        Args:
            file_path: Path in bucket

        Returns:
            True if file exists, False otherwise
        """
        try:
            # Try to get file info
            folder_path = os.path.dirname(file_path)
            file_name = os.path.basename(file_path)

            files = self.list_files(folder_path)
            return any(f.get('name') == file_name for f in files)

        except Exception:
            return False

    def delete_file(self, file_path: str) -> bool:
        """
        Delete file from storage

        Args:
            file_path: Path in bucket

        Returns:
            True if deleted successfully
        """
        try:
            response = self.client.storage.from_(self.bucket_name).remove([file_path])

            # Supabase remove() returns a list of deleted files or an error object
            # Check if response is an error by checking its type and content
            if isinstance(response, dict) and 'error' in response:
                raise Exception(f"Delete failed: {response['error']}")
            elif hasattr(response, 'error') and response.error:
                raise Exception(f"Delete failed: {response.error}")

            # If response is a list, deletion was successful
            return True

        except Exception as e:
            print(f"Failed to delete file: {str(e)}")
            return False

    def check_duplicate_by_hash(self, folder_path: str, file_hash: str) -> bool:
        """
        Check if a file with similar hash already exists in folder

        Args:
            folder_path: Folder to check in
            file_hash: File hash to look for (first 8 characters)

        Returns:
            True if duplicate found
        """
        try:
            files = self.list_files(folder_path)
            hash_prefix = file_hash[:8]

            # Check if any filename contains the hash prefix
            return any(hash_prefix in f.get('name', '') for f in files)

        except Exception:
            return False

    def get_public_url(self, file_path: str) -> str:
        """
        Get public URL for a file

        Args:
            file_path: Path in bucket

        Returns:
            Public URL
        """
        return self.client.storage.from_(self.bucket_name).get_public_url(file_path)

    def get_signed_url(self, file_path: str, expires_in: int = 3600) -> Optional[str]:
        """
        Get a signed URL for private file access

        Args:
            file_path: Path in bucket
            expires_in: URL expiration time in seconds (default 1 hour)

        Returns:
            Signed URL or None if failed
        """
        try:
            print(f"Getting signed URL for: {file_path}, expires in {expires_in}s")
            response = self.client.storage.from_(self.bucket_name).create_signed_url(
                file_path,
                expires_in
            )

            if hasattr(response, 'error') and response.error:
                print(f"Signed URL error: {response.error}")
                return None
            elif isinstance(response, dict):
                if 'error' in response:
                    print(f"Signed URL error (dict): {response['error']}")
                    return None
                if 'signedURL' in response:
                    return response['signedURL']

            print(f"Signed URL response: {response}")
            return None

        except Exception as e:
            print(f"Failed to get signed URL: {str(e)}")
            return None


# Global instance
storage_service = SupabaseStorageService()