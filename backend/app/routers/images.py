"""
Images Router - Image serving and information
"""

import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response

from app.services.image_service import ImageService
from app.routers.session import get_session_data


router = APIRouter()
image_service = ImageService()


@router.get("/{session_id}/{image_id}")
async def get_image(session_id: str, image_id: str):
    """
    Get image file by session and image ID
    
    Returns the image file for display in the frontend.
    """
    session = get_session_data(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if image_id not in session["images"]:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image_info = session["images"][image_id]
    filepath = image_info.path
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image file not found")
    
    # Determine media type
    ext = os.path.splitext(filepath)[1].lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".bmp": "image/bmp"
    }
    media_type = media_types.get(ext, "image/jpeg")
    
    return FileResponse(filepath, media_type=media_type)


@router.get("/{session_id}/{image_id}/info")
async def get_image_info(session_id: str, image_id: str):
    """Get metadata for a specific image"""
    session = get_session_data(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if image_id not in session["images"]:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image_info = session["images"][image_id]
    
    # Check if labels exist
    label_service = session["label_service"]
    has_labels = label_service.labels_exist(image_info.filename)
    
    return {
        **image_info.model_dump(),
        "has_labels": has_labels
    }


@router.get("/{session_id}/list")
async def list_images(
    session_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """List all images in the session with pagination"""
    session = get_session_data(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    all_images = list(session["images"].values())
    total = len(all_images)
    
    # Apply pagination
    images = all_images[offset:offset + limit]
    
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "images": images
    }
