"""
SAM Router - SAM3 prediction endpoint
"""

from fastapi import APIRouter, HTTPException, Request

from app.models.schemas import SAMPredictRequest, SAMPredictResponse, PolygonResult
from app.services.image_service import ImageService
from app.routers.session import get_session_data


router = APIRouter()
image_service = ImageService()


@router.post("/predict", response_model=SAMPredictResponse)
async def predict_mask(request: Request, predict_request: SAMPredictRequest):
    """
    Run SAM3 prediction with bbox and points
    
    Takes a bounding box and optional positive/negative points,
    returns the predicted mask as a polygon.
    """
    # Get SAM service from app state
    sam_service = request.app.state.sam_service
    
    # Find image across all sessions (simplified; in production, include session_id)
    image_info = None
    session_data = None
    
    from app.routers.session import sessions
    for sid, session in sessions.items():
        if predict_request.image_id in session["images"]:
            image_info = session["images"][predict_request.image_id]
            session_data = session
            break
    
    if not image_info:
        raise HTTPException(status_code=404, detail="Image not found in any session")
    
    # Load image
    try:
        image, width, height = image_service.load_image(image_info.path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load image: {str(e)}")
    
    # Prepare points
    points_pos = [(p.x, p.y) for p in predict_request.points_pos]
    points_neg = [(p.x, p.y) for p in predict_request.points_neg]
    
    # Prepare bbox
    bbox = (
        predict_request.bbox.x_min,
        predict_request.bbox.y_min,
        predict_request.bbox.x_max,
        predict_request.bbox.y_max
    )
    
    # Run prediction
    try:
        result = sam_service.predict(
            image=image,
            image_id=predict_request.image_id,
            bbox=bbox,
            points_pos=points_pos,
            points_neg=points_neg,
            simplification_epsilon=predict_request.simplification_epsilon
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SAM prediction failed: {str(e)}")
    
    # Build response
    polygon_result = PolygonResult(
        points=result["polygon"],
        area=result["area"],
        is_valid=result["is_valid"]
    )
    
    response = SAMPredictResponse(
        polygon=polygon_result,
        polygon_normalized=result["polygon_normalized"],
        score=result["score"],
        inference_time_ms=result["inference_time_ms"]
    )
    
    if predict_request.return_mask:
        response.mask_base64 = result["mask_base64"]
    
    return response


@router.post("/predict/{session_id}", response_model=SAMPredictResponse)
async def predict_mask_with_session(
    request: Request,
    session_id: str,
    predict_request: SAMPredictRequest
):
    """
    Run SAM3 prediction with explicit session ID
    """
    session = get_session_data(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if predict_request.image_id not in session["images"]:
        raise HTTPException(status_code=404, detail="Image not found in session")
    
    # Delegate to main predict function
    return await predict_mask(request, predict_request)


@router.get("/status")
async def sam_status(request: Request):
    """Check SAM service status"""
    sam_service = request.app.state.sam_service
    
    return {
        "loaded": sam_service.model is not None,
        "device": sam_service.device,
        "cache_size": len(sam_service.embedding_cache),
        "model_path": sam_service.model_path
    }
