"""
Chat API routes for AI Tutor chatbot
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.schemas.chat import (
    ChatConversationCreate,
    ChatConversationOut,
    ChatConversationWithMessages,
    SendMessageRequest,
    SendMessageResponse,
    ChatMessageCreate,
    ChatMessageOut
)
from app.crud import chat as chat_crud
from app.services.chatbot import get_chatbot_response, validate_message_content

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/conversations", response_model=ChatConversationOut)
def create_conversation(
    conversation_data: ChatConversationCreate,
    db: Session = Depends(get_db)
):
    """Create a new chat conversation"""
    conversation = chat_crud.create_conversation(db, conversation_data)
    return conversation


@router.get("/conversations", response_model=List[ChatConversationOut])
def list_conversations(
    student_id: str = Query(..., description="Student ID"),
    module_id: UUID = Query(..., description="Module ID"),
    db: Session = Depends(get_db)
):
    """Get all conversations for a student in a module"""
    conversations = chat_crud.get_conversations_by_student_module(
        db, student_id, module_id
    )

    # Add metadata
    result = []
    for conv in conversations:
        conv_dict = {
            "id": conv.id,
            "student_id": conv.student_id,
            "module_id": conv.module_id,
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": chat_crud.get_message_count(db, conv.id),
            "last_message_preview": None
        }

        # Get last message preview
        last_msg = chat_crud.get_last_message(db, conv.id)
        if last_msg:
            preview = last_msg.content[:60] + "..." if len(last_msg.content) > 60 else last_msg.content
            conv_dict["last_message_preview"] = preview

        result.append(ChatConversationOut(**conv_dict))

    return result


@router.get("/conversations/{conversation_id}", response_model=ChatConversationWithMessages)
def get_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db)
):
    """Get a conversation with all its messages"""
    conversation = chat_crud.get_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = chat_crud.get_conversation_messages(db, conversation_id)

    return ChatConversationWithMessages(
        id=conversation.id,
        student_id=conversation.student_id,
        module_id=conversation.module_id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[ChatMessageOut.from_orm(msg) for msg in messages]
    )


@router.post("/conversations/{conversation_id}/message", response_model=SendMessageResponse)
def send_message(
    conversation_id: UUID,
    request: SendMessageRequest,
    db: Session = Depends(get_db)
):
    """Send a message and get AI response"""
    # Validate conversation exists
    conversation = chat_crud.get_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Validate message content
    if not validate_message_content(request.message):
        raise HTTPException(status_code=400, detail="Invalid message content")

    # Save student message
    student_msg_data = ChatMessageCreate(
        conversation_id=conversation_id,
        role="student",
        content=request.message,
        context_used=None
    )
    student_message = chat_crud.create_message(db, student_msg_data)

    # Get conversation history
    history = chat_crud.get_conversation_messages(db, conversation_id)

    # Generate AI response
    try:
        ai_result = get_chatbot_response(
            db=db,
            module_id=str(conversation.module_id),
            student_question=request.message,
            conversation_history=history[:-1],  # Exclude the message we just added
            student_id=conversation.student_id
        )

        # Save AI response
        assistant_msg_data = ChatMessageCreate(
            conversation_id=conversation_id,
            role="assistant",
            content=ai_result['response'],
            context_used=ai_result.get('context_used')
        )
        assistant_message = chat_crud.create_message(db, assistant_msg_data)

        return SendMessageResponse(
            student_message=ChatMessageOut.from_orm(student_message),
            assistant_message=ChatMessageOut.from_orm(assistant_message),
            conversation_id=conversation_id
        )

    except Exception as e:
        print(f"❌ Error generating AI response: {str(e)}")
        # A failed flush (e.g. the earlier create_message) leaves the session
        # unusable until rolled back, otherwise this fallback write fails too.
        db.rollback()
        # Save error message
        error_msg_data = ChatMessageCreate(
            conversation_id=conversation_id,
            role="assistant",
            content="I'm sorry, I encountered an error. Please try again or contact your instructor.",
            context_used=None
        )
        assistant_message = chat_crud.create_message(db, error_msg_data)

        return SendMessageResponse(
            student_message=ChatMessageOut.from_orm(student_message),
            assistant_message=ChatMessageOut.from_orm(assistant_message),
            conversation_id=conversation_id
        )


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a conversation and all its messages"""
    success = chat_crud.delete_conversation(db, conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {"success": True, "message": "Conversation deleted successfully"}
