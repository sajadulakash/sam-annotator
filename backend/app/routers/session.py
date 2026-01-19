"""
Session Router - Dataset initialization and session management
"""

import uuid
from typing import Dict

from fastapi import APIRouter, HTTPException

from app.models.schemas import SessionInitRequest, SessionInitResponse, ImageInfo
from app.services.image_service import ImageService
from app.services.label_service import LabelService


router = APIRouter()

# In-memory session storage (for MVP; use Redis/DB in production)
sessions: Dict[str, dict] = {}
image_service = ImageService()


@router.post("/init", response_model=SessionInitResponse)
async def init_session(request: SessionInitRequest):
    """
    Initialize a new annotation session
    
    Sets up the dataset path, classes, and scans for images.
    """
    # Validate path
    if not image_service.validate_path(request.dataset_path):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid or inaccessible dataset path: {request.dataset_path}"
        )
    
    # Validate classes
    if not request.classes or len(request.classes) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one class must be provided"
        )
    
    # Scan for images
    images = image_service.scan_images(
        request.dataset_path,
        request.images_subfolder
    )
    
    if not images:
        raise HTTPException(
            status_code=400,
            detail="No supported images found in the dataset path"
        )
    
    # Create session
    session_id = str(uuid.uuid4())[:8]
    
    # Initialize label service
    label_service = LabelService(
        request.dataset_path,
        request.labels_subfolder
    )
    
    # Count labeled images
    labeled_count = sum(1 for img in images if img.has_labels)
    
    # Store session
    sessions[session_id] = {
        "dataset_path": request.dataset_path,
        "classes": request.classes,
        "images": {img.id: img for img in images},
        "images_subfolder": request.images_subfolder,
        "labels_subfolder": request.labels_subfolder,
        "label_service": label_service
    }
    
    return SessionInitResponse(
        session_id=session_id,
        dataset_path=request.dataset_path,
        classes=request.classes,
        images=images,
        total_images=len(images),
        labeled_count=labeled_count
    )


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Get session details"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    images = list(session["images"].values())
    
    return {
        "session_id": session_id,
        "dataset_path": session["dataset_path"],
        "classes": session["classes"],
        "total_images": len(images),
        "images": images
    }


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del sessions[session_id]
    return {"success": True, "message": "Session deleted"}


def get_session_data(session_id: str) -> dict:
    """Helper to get session data (used by other routers)"""
    if session_id not in sessions:
        return None
    return sessions[session_id]
