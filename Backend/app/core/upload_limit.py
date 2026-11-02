"""Reject oversized multipart uploads before Starlette spools the entire body."""
from starlette.responses import JSONResponse

class UploadBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope.get('path') != '/api/upload':
            return await self.app(scope, receive, send)
        from app.services.document_validation import MAX_UPLOAD_BYTES
        limit = MAX_UPLOAD_BYTES + 1024 * 1024  # multipart headers/form fields
        headers = dict(scope.get('headers', []))
        try:
            declared = int(headers.get(b'content-length', b'0'))
        except ValueError:
            return await JSONResponse({'detail':'Invalid Content-Length'}, status_code=400)(scope, receive, send)
        if declared > limit:
            return await JSONResponse({'detail':'Upload exceeds 20 MB'}, status_code=413)(scope, receive, send)
        size = 0
        class TooLarge(Exception): pass
        async def bounded_receive():
            nonlocal size
            message = await receive()
            size += len(message.get('body', b''))
            if size > limit:
                raise TooLarge()
            return message
        # Starlette may translate a receive exception into a 400. Either response
        # stops parsing without accepting more bytes or invoking the endpoint.
        try:
            await self.app(scope, bounded_receive, send)
        except TooLarge:
            await JSONResponse({'detail':'Upload exceeds 20 MB'}, status_code=413)(scope, receive, send)
