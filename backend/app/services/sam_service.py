"""
SAM2 Service - Handles model loading, inference, and mask-to-polygon conversion
"""

import time
import base64
import io
import os
from typing import List, Tuple, Optional, Dict, Any
from collections import OrderedDict
import hashlib

import numpy as np
import cv2
from PIL import Image
import torch

from app.core.config import settings


class LRUCache(OrderedDict):
    """Simple LRU cache for embeddings"""
    
    def __init__(self, maxsize: int = 100):
        super().__init__()
        self.maxsize = maxsize
    
    def get(self, key: str) -> Optional[Any]:
        if key in self:
            self.move_to_end(key)
            return self[key]
        return None
    
    def put(self, key: str, value: Any):
        if key in self:
            self.move_to_end(key)
        self[key] = value
        if len(self) > self.maxsize:
            self.popitem(last=False)


class SAMService:
    """Service for SAM2 model inference"""
    
    def __init__(self, model_path: str, device: str = "cuda", cache_size: int = 100):
        self.model_path = model_path
        self.device = device
        self.model = None
        self.predictor = None
        self.embedding_cache = LRUCache(maxsize=cache_size)
        self._current_image_id = None
        self._is_real_sam = False
        self._load_model()
    
    def _load_model(self):
        """Load SAM2 model"""
        try:
            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor
            
            # Find the model checkpoint
            model_paths = [
                self.model_path,
                "/home/sajadulakash/models/sam2_hiera_small.pt",
                os.path.expanduser("~/.cache/huggingface/hub/models--facebook--sam2-hiera-small/snapshots/e080ada8afd19df5e165abe71b006edc7f4c3d4e/sam2_hiera_small.pt"),
                os.path.expanduser("~/models/sam2_hiera_small.pt"),
            ]
            
            checkpoint_path = None
            for path in model_paths:
                if os.path.exists(path):
                    checkpoint_path = path
                    break
            
            if checkpoint_path is None:
                raise FileNotFoundError(f"No SAM2 checkpoint found. Tried: {model_paths}")
            
            print(f"Loading SAM2 model from {checkpoint_path}")
            
            # SAM2 config - use the small model config
            model_cfg = "sam2_hiera_s.yaml"
            
            # Build SAM2 model
            self.model = build_sam2(model_cfg, checkpoint_path, device=self.device)
            self.predictor = SAM2ImagePredictor(self.model)
            self._is_real_sam = True
            
            print(f"SAM2 model loaded successfully on {self.device}")
            
        except Exception as e:
            print(f"Warning: Could not load SAM2 model: {e}")
            print("Running in mock mode for development")
            import traceback
            traceback.print_exc()
            self.model = None
            self.predictor = None
            self._is_real_sam = False
    
    def _get_image_hash(self, image: np.ndarray) -> str:
        """Generate hash for image caching"""
        return hashlib.md5(image.tobytes()[:10000]).hexdigest()
    
    def set_image(self, image: np.ndarray, image_id: str) -> bool:
        """
        Set image and compute embedding (cached)
        
        Args:
            image: RGB image as numpy array
            image_id: Unique identifier for caching
            
        Returns:
            True if embedding was computed/cached
        """
        # If same image, no need to re-embed
        if self._current_image_id == image_id:
            return True
        
        if self._is_real_sam and self.predictor is not None:
            # Real SAM2 - set image (computes embedding internally)
            with torch.inference_mode():
                self.predictor.set_image(image)
            self._current_image_id = image_id
            return True
        else:
            # Mock mode
            self._current_image = image
            self._current_image_id = image_id
            return True
    
    def predict(
        self,
        image: np.ndarray,
        image_id: str,
        bbox: Tuple[float, float, float, float],
        points_pos: List[Tuple[float, float]] = None,
        points_neg: List[Tuple[float, float]] = None,
        simplification_epsilon: float = 2.0
    ) -> Dict[str, Any]:
        """
        Run SAM2 prediction with bbox and points prompts
        
        Args:
            image: RGB image as numpy array
            image_id: Image identifier for caching
            bbox: (x_min, y_min, x_max, y_max)
            points_pos: List of positive point coordinates
            points_neg: List of negative point coordinates
            simplification_epsilon: Polygon simplification factor
            
        Returns:
            Dictionary with mask, polygon, score, etc.
        """
        start_time = time.time()
        
        # Ensure image embedding is set
        self.set_image(image, image_id)
        
        points_pos = points_pos or []
        points_neg = points_neg or []
        
        h, w = image.shape[:2]
        
        if self._is_real_sam and self.predictor is not None:
            # Real SAM2 prediction
            with torch.inference_mode():
                # Prepare box prompt - SAM2 expects [x1, y1, x2, y2]
                box = np.array([bbox[0], bbox[1], bbox[2], bbox[3]])
                
                # Prepare point prompts if any
                point_coords = None
                point_labels = None
                
                if points_pos or points_neg:
                    all_points = points_pos + points_neg
                    point_coords = np.array([[p[0], p[1]] for p in all_points])
                    point_labels = np.array([1] * len(points_pos) + [0] * len(points_neg))
                
                # Run prediction
                masks, scores, logits = self.predictor.predict(
                    point_coords=point_coords,
                    point_labels=point_labels,
                    box=box,
                    multimask_output=True
                )
                
                # Select best mask
                best_idx = np.argmax(scores)
                mask = masks[best_idx]
                score = float(scores[best_idx])
                
                # Convert boolean mask to uint8
                mask = (mask * 255).astype(np.uint8)
        else:
            # Mock prediction for development
            mask, score = self._generate_mock_mask(image, bbox, points_pos, points_neg)
        
        # Convert mask to polygon
        polygon, area = self._mask_to_polygon(mask, simplification_epsilon)
        
        # Normalize polygon coordinates
        polygon_normalized = [(x / w, y / h) for x, y in polygon]
        
        # Convert mask to base64 for visualization
        mask_base64 = self._mask_to_base64(mask)
        
        inference_time = (time.time() - start_time) * 1000
        
        return {
            "mask": mask,
            "mask_base64": mask_base64,
            "polygon": polygon,
            "polygon_normalized": polygon_normalized,
            "area": area,
            "score": score,
            "inference_time_ms": inference_time,
            "is_valid": len(polygon) >= settings.MIN_POLYGON_POINTS
        }
    
    def _generate_mock_mask(
        self,
        image: np.ndarray,
        bbox: Tuple[float, float, float, float],
        points_pos: List[Tuple[float, float]],
        points_neg: List[Tuple[float, float]]
    ) -> Tuple[np.ndarray, float]:
        """
        Generate a mock mask for development/testing
        Creates an ellipse within the bbox
        """
        h, w = image.shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)
        
        x_min, y_min, x_max, y_max = map(int, bbox)
        
        # Create ellipse in bbox
        center_x = (x_min + x_max) // 2
        center_y = (y_min + y_max) // 2
        axis_x = (x_max - x_min) // 2
        axis_y = (y_max - y_min) // 2
        
        cv2.ellipse(mask, (center_x, center_y), (axis_x, axis_y), 0, 0, 360, 255, -1)
        
        # Adjust mask based on positive/negative points (simplified)
        for px, py in points_pos:
            cv2.circle(mask, (int(px), int(py)), 20, 255, -1)
        
        for px, py in points_neg:
            cv2.circle(mask, (int(px), int(py)), 20, 0, -1)
        
        return mask, 0.95
    
    def _mask_to_polygon(
        self,
        mask: np.ndarray,
        epsilon: float = 2.0
    ) -> Tuple[List[Tuple[float, float]], float]:
        """
        Convert binary mask to polygon using contour extraction
        
        Args:
            mask: Binary mask (0 or 255)
            epsilon: Simplification factor for approxPolyDP
            
        Returns:
            Tuple of (polygon points, area)
        """
        # Find contours
        contours, _ = cv2.findContours(
            mask.astype(np.uint8),
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        if not contours:
            return [], 0.0
        
        # Get largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        
        # Simplify polygon
        epsilon_value = epsilon * cv2.arcLength(largest_contour, True) / 1000
        simplified = cv2.approxPolyDP(largest_contour, epsilon_value, True)
        
        # Convert to list of tuples
        polygon = [(float(pt[0][0]), float(pt[0][1])) for pt in simplified]
        
        # Ensure polygon is valid
        if len(polygon) < settings.MIN_POLYGON_POINTS:
            # Fall back to original contour points
            polygon = [(float(pt[0][0]), float(pt[0][1])) for pt in largest_contour]
        
        return polygon, float(area)
    
    def _mask_to_base64(self, mask: np.ndarray) -> str:
        """Convert mask to base64 PNG for frontend display"""
        # Create RGBA image with transparent background
        rgba = np.zeros((*mask.shape, 4), dtype=np.uint8)
        rgba[mask > 0] = [0, 120, 255, 128]  # Semi-transparent blue
        
        img = Image.fromarray(rgba, 'RGBA')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode()
    
    def clear_cache(self):
        """Clear embedding cache"""
        self.embedding_cache.clear()
        self._current_image_id = None
