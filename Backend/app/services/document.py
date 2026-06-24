import os
import json
import tempfile
from fastapi import HTTPException
from hashlib import sha256
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.question import Question
from app.models.user import User
from app.models.document import ProcessingStatus
from app.schemas.document import DocumentCreate
from app.schemas.question import QuestionCreate
from app.crud.document import create_document
from app.crud.question import bulk_create_questions
from app.crud.document_chunk import bulk_create_chunks
from app.utils.text_extractor import extract_text_from_file
from app.utils.text_chunker import chunk_text
from app.utils.question_parser import parse_testbank_text_to_questions, parse_testbank_hybrid
from app.services.module import get_or_create_module
from app.services.storage import storage_service
from app.services.document_status import update_document_status, set_document_error
from app.services.embedding import generate_embeddings_for_document
from app.core.config import EMBED_MODEL, SUPABASE_URL


def handle_document_upload(
    db: Session,
    file_bytes: bytes,
    filename: str,
    teacher_id: str,
    title: str = None,
    module_name: str = None  # ✅ Human-readable module name
):
    # 🔍 Validate teacher
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=400, detail=f"Teacher with ID '{teacher_id}' not found.")

    # ✅ Get or create module by name
    module = get_or_create_module(db, teacher_id=teacher_id, module_name=module_name)

    # 🔐 Compute hash
    file_hash = sha256(file_bytes).hexdigest()
    file_ext = filename.split('.')[-1].lower()

    # 📁 Prepare Supabase storage path: teacher_id/module_name/filename
    storage_filename = f"{os.path.splitext(filename)[0]}_{file_hash[:8]}.{file_ext}"
    supabase_folder_path = f"{teacher_id}/{module.name}"
    supabase_file_path = f"{supabase_folder_path}/{storage_filename}"

    # 🚫 Check for duplicate in Supabase storage (optional - Supabase handles with upsert)
    # Note: We'll let Supabase handle duplicates with upsert=True
    # Uncomment below if you want explicit duplicate prevention
    # if storage_service.check_duplicate_by_hash(supabase_folder_path, file_hash):
    #     raise HTTPException(
    #         status_code=409,
    #         detail=f"Duplicate detected: File with same content already exists."
    #     )

    # 💾 Upload file to Supabase Storage
    try:
        storage_url = storage_service.upload_file(file_bytes, supabase_file_path)
        print(f"✅ File uploaded successfully to Supabase: {storage_url}")
    except Exception as e:
        print(f"❌ Failed to upload file to Supabase: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file to storage: {str(e)}"
        )

    # 📦 Metadata
    index_path = f"indices/{teacher_id}/{file_hash}"
    resolved_title = title or filename
    slide_count = 0
    is_testbank = "testbank" in filename.lower()
    parse_status = "pending" if is_testbank else None

    # 🗃️ Save document in DB (storage_path now contains Supabase URL)
    print(f"📋 Creating document record with:")
    print(f"  - Title: {resolved_title}")
    print(f"  - Storage URL: {storage_url}")
    print(f"  - Module ID: {module.id}")
    print(f"  - Teacher ID: {teacher_id}")

    try:
        doc_data = DocumentCreate(
            title=resolved_title,
            file_name=filename,
            file_hash=file_hash,
            file_type=file_ext,
            teacher_id=teacher_id,
            module_id=module.id,
            storage_path=storage_url,  # Now storing Supabase URL instead of local path
            index_path=index_path,
            slide_count=slide_count,
            parse_status=parse_status,
            parse_error=None,
            is_testbank=is_testbank
        )
        print(f"📄 Document data created: {doc_data}")

        document = create_document(db, doc_data)
        print(f"✅ Document saved to database with ID: {document.id}")

    except Exception as e:
        print(f"❌ Failed to save document to database: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save document to database: {str(e)}"
        )

    # 🤖 Parse testbank if PDF or DOCX (using LlamaParse)
    if is_testbank and file_ext in ["pdf", "docx", "doc"]:
        temp_file_path = None
        try:
            # Download file temporarily from Supabase for parsing
            temp_file_path = storage_service.download_file_temporarily(supabase_file_path)

            # Extract text using LlamaParse for testbanks
            extracted_data = extract_text_from_file(temp_file_path, file_ext, is_testbank=True)
            extracted_text = extracted_data['text']

            # Debug: Log extracted text for troubleshooting
            print(f"📝 Extracted text length: {len(extracted_text)} characters")
            print(f"📝 First 500 chars: {extracted_text[:500]}")

            # Use hybrid parser (regex first, AI fallback if needed)
            parsed_questions = parse_testbank_hybrid(extracted_text, module.id, document.id, use_ai_fallback=True)

            # Save parsed questions to JSON (upload to Supabase as well)
            parsed_json = json.dumps(parsed_questions, indent=2)
            json_file_path = f"{supabase_folder_path}/parsed_questions.json"
            storage_service.upload_file(parsed_json.encode('utf-8'), json_file_path)

            # Save to DB
            question_objs = [QuestionCreate(**q) for q in parsed_questions]
            bulk_create_questions(db, question_objs)

            document.parse_status = "success"
            document.parse_error = None
            db.commit()

        except Exception as e:
            document.parse_status = "failed"
            document.parse_error = str(e)
            db.commit()
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    # 📄 Extract and chunk regular documents (non-testbanks) for RAG
    elif not is_testbank and file_ext in ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt']:
        temp_file_path = None
        try:
            # Update status: extracting
            update_document_status(db, str(document.id), ProcessingStatus.EXTRACTING)

            # Download file temporarily from Supabase
            temp_file_path = storage_service.download_file_temporarily(supabase_file_path)

            # Extract text from file
            extracted_data = extract_text_from_file(temp_file_path, file_ext)
            extracted_text = extracted_data['text']
            extraction_metadata = extracted_data['metadata']

            # Update status: extracted
            update_document_status(
                db,
                str(document.id),
                ProcessingStatus.EXTRACTED,
                {
                    'char_count': len(extracted_text),
                    **extraction_metadata
                }
            )

            # Update status: chunking
            update_document_status(db, str(document.id), ProcessingStatus.CHUNKING)

            # Chunk the text
            chunks = chunk_text(
                text=extracted_text,
                chunk_size=1000,  # ~250 tokens
                overlap=200       # Maintain context between chunks
            )

            # Save chunks to database
            if chunks:
                bulk_create_chunks(db, str(document.id), chunks, module_id=str(document.module_id))

            # Update status: chunked
            update_document_status(
                db,
                str(document.id),
                ProcessingStatus.CHUNKED,
                {
                    'chunk_count': len(chunks),
                    'total_chars': len(extracted_text),
                    'avg_chunk_size': len(extracted_text) // len(chunks) if chunks else 0
                }
            )

            print(f"✅ Document chunked successfully: {len(chunks)} chunks created")

            # 🤖 Generate embeddings for chunks
            if chunks:
                try:
                    # Update status: embedding
                    update_document_status(db, str(document.id), ProcessingStatus.EMBEDDING)

                    # Generate embeddings
                    embedding_count = generate_embeddings_for_document(
                        db=db,
                        document_id=str(document.id),
                        batch_size=100  # Process 100 chunks at a time
                    )

                    # Update status: embedded
                    update_document_status(
                        db,
                        str(document.id),
                        ProcessingStatus.EMBEDDED,
                        {
                            'embedding_count': embedding_count,
                            'embedding_model': EMBED_MODEL
                        }
                    )

                    print(f"✅ Generated {embedding_count} embeddings")

                except Exception as embedding_error:
                    print(f"❌ Failed to generate embeddings: {str(embedding_error)}")
                    try:
                        db.rollback()
                    except Exception:
                        pass
                    update_document_status(
                        db,
                        str(document.id),
                        ProcessingStatus.CHUNKED,
                        {'embedding_error': str(embedding_error)}
                    )

        except Exception as e:
            print(f"❌ Failed to extract/chunk document: {str(e)}")
            try:
                db.rollback()
            except Exception:
                pass
            set_document_error(
                db,
                str(document.id),
                f"Text extraction/chunking failed: {str(e)}",
                {'error_type': 'extraction_error', 'file_type': file_ext}
            )
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    return document


def reprocess_document(db: Session, document_id: UUID):
    """Re-trigger extraction, chunking, and embedding for a stuck/failed document."""
    from app.models.document import Document

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise ValueError(f"Document {document_id} not found")

    file_ext = document.file_type
    supabase_file_path = document.storage_path

    # Strip the Supabase public URL prefix if present, to get the storage path
    bucket_prefix = f"{SUPABASE_URL}/storage/v1/object/public/documents/"
    if supabase_file_path.startswith(bucket_prefix):
        supabase_file_path = supabase_file_path[len(bucket_prefix):]

    temp_file_path = None
    try:
        update_document_status(db, str(document.id), ProcessingStatus.EXTRACTING)

        temp_file_path = storage_service.download_file_temporarily(supabase_file_path)
        extracted_data = extract_text_from_file(temp_file_path, file_ext)
        extracted_text = extracted_data['text']
        extraction_metadata = extracted_data['metadata']

        update_document_status(db, str(document.id), ProcessingStatus.EXTRACTED, {
            'char_count': len(extracted_text),
            **extraction_metadata
        })

        update_document_status(db, str(document.id), ProcessingStatus.CHUNKING)

        # Delete any existing chunks before re-chunking
        from app.crud.document_chunk import delete_chunks_by_document
        delete_chunks_by_document(db, str(document.id))

        chunks = chunk_text(text=extracted_text, chunk_size=1000, overlap=200)

        if chunks:
            bulk_create_chunks(db, str(document.id), chunks, module_id=str(document.module_id))

        update_document_status(db, str(document.id), ProcessingStatus.CHUNKED, {
            'chunk_count': len(chunks),
            'total_chars': len(extracted_text),
            'avg_chunk_size': len(extracted_text) // len(chunks) if chunks else 0
        })

        if chunks:
            try:
                update_document_status(db, str(document.id), ProcessingStatus.EMBEDDING)
                generate_embeddings_for_document(db, str(document.id), model=EMBED_MODEL)
                update_document_status(db, str(document.id), ProcessingStatus.EMBEDDED, {
                    'embed_model': EMBED_MODEL
                })
            except Exception as embedding_error:
                print(f"⚠️ Embedding failed during reprocess: {str(embedding_error)}")
                update_document_status(db, str(document.id), ProcessingStatus.CHUNKED, {
                    'embedding_error': str(embedding_error)
                })

    except Exception as e:
        print(f"❌ Reprocess failed: {str(e)}")
        try:
            db.rollback()
        except Exception:
            pass
        set_document_error(db, str(document.id), f"Reprocess failed: {str(e)}", {
            'error_type': 'reprocess_error', 'file_type': file_ext
        })

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

    db.refresh(document)
    return document


def reparse_testbank_document(db: Session, document_id: UUID):
    from app.utils.question_parser import parse_testbank_text_to_questions, parse_testbank_hybrid
    from app.crud.question import bulk_create_questions
    from app.models.document import Document
    from app.models.question import Question
    from app.schemas.question import QuestionCreate

    # 🔎 Fetch document
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.is_testbank:
        raise HTTPException(status_code=400, detail="This document is not a testbank and cannot be re-parsed.")

    if doc.file_type.lower() not in ["pdf", "docx", "doc"]:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX testbanks can be parsed")

    # Extract file path from storage URL for Supabase
    # storage_path now contains Supabase URL, need to get the path
    try:
        # Get module info first
        from app.models.module import Module
        module = db.query(Module).filter(Module.id == doc.module_id).first()

        # Construct Supabase file path
        storage_filename = f"{os.path.splitext(doc.file_name)[0]}_{doc.file_hash[:8]}.{doc.file_type}"
        supabase_file_path = f"{doc.teacher_id}/{module.name}/{storage_filename}"

        # Download file temporarily from Supabase
        temp_file_path = storage_service.download_file_temporarily(supabase_file_path)

        try:
            # Extract text using LlamaParse for testbanks
            extracted_data = extract_text_from_file(temp_file_path, doc.file_type, is_testbank=True)
            extracted_text = extracted_data['text']

            # Debug: Log extracted text for troubleshooting
            print(f"📝 Extracted text length: {len(extracted_text)} characters")
            print(f"📝 First 500 chars: {extracted_text[:500]}")

            # Use hybrid parser (regex first, AI fallback if needed)
            parsed_questions = parse_testbank_hybrid(extracted_text, module.id, doc.id, use_ai_fallback=True)

            # Save parsed questions JSON to Supabase
            parsed_json = json.dumps(parsed_questions, indent=2)
            json_file_path = f"{doc.teacher_id}/{module.name}/parsed_questions.json"
            storage_service.upload_file(parsed_json.encode('utf-8'), json_file_path)

            # 🔁 Replace old questions
            db.query(Question).filter(Question.document_id == doc.id).delete()
            bulk_create_questions(db, [QuestionCreate(**q) for q in parsed_questions])

            # ✅ Update status
            doc.parse_status = "success"
            doc.parse_error = None
            db.commit()

            return {"message": "Re-parsing and saving successful."}

        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    except Exception as e:
        doc.parse_status = "failed"
        doc.parse_error = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Re-parsing failed: {str(e)}")