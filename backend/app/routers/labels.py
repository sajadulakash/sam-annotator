"""
Labels Router - Save and load annotation labels
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    SaveLabelsRequest, SaveLabelsResponse,
    LoadLabelsResponse, AnnotationObject
)
from app.routers.session import get_session_data


router = APIRouter()


@router.post("/save/{session_id}", response_model=SaveLabelsResponse)
async def save_labels(session_id: str, request: SaveLabelsRequest):
    """
    Save annotations for an image in YOLO segmentation format
    
    Creates/overwrites a .txt file in the labels/ folder.
    """
    session = get_session_data(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if request.image_id not in session["images"]:
        raise HTTPException(status_code=404, detail="Image not found in session")
    
    image_info = session["images"][request.image_id]
    label_service = session["label_service"]
    
    try:
        filepath = label_service.save_labels(
            image_filename=image_info.filename,
            objects=request.objects,
            image_width=image_info.width,
            image_height=image_info.height
        )
        
        # Update image info to reflect labels exist
        image_info.has_labels = True
        
        return SaveLabelsResponse(
            success=True,
            filepath=filepath,
            objects_saved=len(request.objects)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save labels: {str(e)}")


@router.get("/load/{session_id}/{image_id}", response_model=LoadLabelsResponse)
async def load_labels(session_id: str, image_id: str):
    """
    Load existing annotations for an image
    
    Reads from the .txt file in the labels/ folder if it exists.
    """
    session = get_session_data(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if image_id not in session["images"]:
        raise HTTPException(status_code=404, detail="Image not found in session")
    
    image_info = session["images"][image_id]
    label_service = session["label_service"]
    
    try:
        exists, objects = label_service.load_labels(
            image_filename=image_info.filename,
            image_width=image_info.width,
            image_height=image_info.height,
            classes=session["classes"]
        )
        
        return LoadLabelsResponse(
            image_id=image_id,
            exists=exists,
            objects=objects
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load labels: {str(e)}")


@router.delete("/delete/{session_id}/{image_id}")
async def delete_labels(session_id: str, image_id: str):
    """Delete labels for an image"""
    session = get_session_data(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if image_id not in session["images"]:
        raise HTTPException(status_code=404, detail="Image not found in session")
    
    image_info = session["images"][image_id]
    label_service = session["label_service"]
    
    deleted = label_service.delete_labels(image_info.filename)
    
    if deleted:
        image_info.has_labels = False
    
    return {"success": deleted, "image_id": image_id}
