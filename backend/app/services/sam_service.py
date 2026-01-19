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


# Available SAM2 models configuration
AVAILABLE_MODELS = {
    "sam3": {
        "name": "SAM3 (Ultralytics)",
        "size": "3.3 GB",
        "description": "Best accuracy with text prompt support",
        "checkpoint": "sam3.pt",
        "config": None,
        "is_sam3": True
    },
    "sam2_tiny": {
        "name": "SAM2 Hiera Tiny",
        "size": "149 MB",
        "description": "Fastest model, good for quick annotations",
        "checkpoint": "sam2_hiera_tiny.pt",
        "config": "sam2_hiera_t.yaml",
        "is_sam3": False
    },
    "sam2_small": {
        "name": "SAM2 Hiera Small",
        "size": "176 MB",
        "description": "Balanced speed and accuracy",
        "checkpoint": "sam2_hiera_small.pt",
        "config": "sam2_hiera_s.yaml",
        "is_sam3": False
    },
    "sam2_base_plus": {
        "name": "SAM2 Hiera Base+",
        "size": "309 MB",
        "description": "Better accuracy, moderate speed",
        "checkpoint": "sam2_hiera_base_plus.pt",
        "config": "sam2_hiera_b+.yaml",
        "is_sam3": False
    },
    "sam2_large": {
        "name": "SAM2 Hiera Large",
        "size": "857 MB",
        "description": "Best SAM2 accuracy, slower inference",
        "checkpoint": "sam2_hiera_large.pt",
        "config": "sam2_hiera_l.yaml",
        "is_sam3": False
    }
}

MODELS_DIR = "/home/sajadulakash/models"


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
    """Service for SAM2/SAM3 model inference with multi-model support"""
    
    def __init__(self, model_id: str = "sam3", device: str = "cuda", cache_size: int = 100):
        self.models_dir = MODELS_DIR
        self.device = device
        self.model = None
        self.predictor = None
        self.sam3_predictor = None  # SAM3 semantic predictor for text prompts
        self.embedding_cache = LRUCache(maxsize=cache_size)
        self._current_image_id = None
        self._current_model_id = None
        self._is_real_sam = False
        self._is_sam3 = False
        
        # Load the specified model
        self.load_model(model_id)
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available models with their status"""
        models = []
        for model_id, info in AVAILABLE_MODELS.items():
            checkpoint_path = os.path.join(self.models_dir, info["checkpoint"])
            is_available = os.path.exists(checkpoint_path)
            models.append({
                "id": model_id,
                "name": info["name"],
                "size": info["size"],
                "description": info["description"],
                "is_available": is_available,
                "is_loaded": model_id == self._current_model_id
            })
        return models
    
    def get_current_model(self) -> str:
        """Get currently loaded model ID"""
        return self._current_model_id or "none"
    
    def load_model(self, model_id: str) -> bool:
        """
        Load a specific SAM2 or SAM3 model
        
        Args:
            model_id: One of sam3, sam2_tiny, sam2_small, sam2_base_plus, sam2_large
            
        Returns:
            True if model loaded successfully
        """
        if model_id not in AVAILABLE_MODELS:
            print(f"Unknown model: {model_id}")
            return False
        
        model_info = AVAILABLE_MODELS[model_id]
        checkpoint_path = os.path.join(self.models_dir, model_info["checkpoint"])
        
        if not os.path.exists(checkpoint_path):
            print(f"Model checkpoint not found: {checkpoint_path}")
            return False
        
        # Free previous model memory
        if self.model is not None:
            del self.model
            self.model = None
        if self.predictor is not None:
            del self.predictor
            self.predictor = None
        if self.sam3_predictor is not None:
            del self.sam3_predictor
            self.sam3_predictor = None
        torch.cuda.empty_cache()
        
        try:
            if model_info.get("is_sam3", False):
                # Load SAM3 using Ultralytics
                return self._load_sam3(checkpoint_path, model_info)
            else:
                # Load SAM2 using sam2 library
                return self._load_sam2(checkpoint_path, model_info, model_id)
                
        except Exception as e:
            print(f"Warning: Could not load model: {e}")
            print("Running in mock mode for development")
            import traceback
            traceback.print_exc()
            self.model = None
            self.predictor = None
            self.sam3_predictor = None
            self._is_real_sam = False
            self._is_sam3 = False
            self._current_model_id = None
            return False
    
    def _load_sam3(self, checkpoint_path: str, model_info: dict) -> bool:
        """Load SAM3 model using Ultralytics"""
        from ultralytics import SAM
        from ultralytics.models.sam import SAM3SemanticPredictor
        
        print(f"Loading {model_info['name']} from {checkpoint_path}...")
        
        # Load SAM3 model for bbox-based prediction (SAM2-style)
        self.model = SAM(checkpoint_path)
        
        # Also create semantic predictor for text prompts
        overrides = dict(
            conf=0.25,
            task="segment",
            mode="predict",
            model=checkpoint_path,
            half=True,
            verbose=False
        )
        self.sam3_predictor = SAM3SemanticPredictor(overrides=overrides)
        
        self._is_real_sam = True
        self._is_sam3 = True
        self._current_model_id = "sam3"
        
        # Clear embedding cache when switching models
        self.clear_cache()
        
        print(f"{model_info['name']} loaded successfully on {self.device}")
        return True
    
    def _load_sam2(self, checkpoint_path: str, model_info: dict, model_id: str) -> bool:
        """Load SAM2 model using sam2 library"""
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        
        print(f"Loading {model_info['name']} from {checkpoint_path}...")
        
        # Build SAM2 model
        self.model = build_sam2(model_info["config"], checkpoint_path, device=self.device)
        self.predictor = SAM2ImagePredictor(self.model)
        self._is_real_sam = True
        self._is_sam3 = False
        self._current_model_id = model_id
        
        # Clear embedding cache when switching models
        self.clear_cache()
        
        print(f"{model_info['name']} loaded successfully on {self.device}")
        return True
    
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
        
        self._current_image = image
        self._current_image_id = image_id
        
        if self._is_sam3:
            # SAM3 - set image on semantic predictor if needed
            # (handled per-prediction)
            return True
        elif self._is_real_sam and self.predictor is not None:
            # Real SAM2 - set image (computes embedding internally)
            with torch.inference_mode():
                self.predictor.set_image(image)
            return True
        else:
            # Mock mode
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
        Run SAM2/SAM3 prediction with bbox and points prompts
        
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
        
        if self._is_sam3 and self.model is not None:
            # SAM3 prediction using Ultralytics
            return self._predict_sam3_bbox(image, bbox, points_pos, points_neg, h, w, start_time, simplification_epsilon)
        elif self._is_real_sam and self.predictor is not None:
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
    
    def _predict_sam3_bbox(
        self,
        image: np.ndarray,
        bbox: Tuple[float, float, float, float],
        points_pos: List[Tuple[float, float]],
        points_neg: List[Tuple[float, float]],
        h: int,
        w: int,
        start_time: float,
        simplification_epsilon: float
    ) -> Dict[str, Any]:
        """
        SAM3 prediction using Ultralytics SAM with bbox prompt
        """
        try:
            # SAM3 uses Ultralytics predict API with bboxes
            results = self.model.predict(
                source=image,
                bboxes=[list(bbox)],
                verbose=False
            )
            
            if results and len(results) > 0 and results[0].masks is not None:
                # Get the mask from results
                mask_data = results[0].masks.data[0].cpu().numpy()
                
                # Resize mask to original image size if needed
                if mask_data.shape != (h, w):
                    mask = cv2.resize(mask_data.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                    mask = (mask > 0.5).astype(np.uint8) * 255
                else:
                    mask = (mask_data * 255).astype(np.uint8)
                
                # Get confidence score if available
                if results[0].boxes is not None and len(results[0].boxes.conf) > 0:
                    score = float(results[0].boxes.conf[0])
                else:
                    score = 0.9
            else:
                # Fallback to mock if no results
                mask, score = self._generate_mock_mask(image, bbox, points_pos, points_neg)
                
        except Exception as e:
            print(f"SAM3 prediction error: {e}")
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
    
    def predict_text(
        self,
        image: np.ndarray,
        image_id: str,
        text_prompt: str,
        simplification_epsilon: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        SAM3-only: Predict masks using text prompt for semantic segmentation
        
        Args:
            image: RGB image as numpy array
            image_id: Image identifier
            text_prompt: Text describing what to segment (e.g., "dog", "person", "car")
            simplification_epsilon: Polygon simplification factor
            
        Returns:
            List of dictionaries with mask, polygon, score for each detected instance
        """
        if not self._is_sam3:
            return [{
                "error": "Text prompts are only supported with SAM3 model",
                "is_valid": False
            }]
        
        start_time = time.time()
        h, w = image.shape[:2]
        results_list = []
        
        try:
            if self.sam3_predictor is not None:
                # Use SAM3SemanticPredictor for text-based segmentation
                self.sam3_predictor.set_image(image)
                masks = self.sam3_predictor.set_text(text_prompt)
                
                if masks is not None:
                    # Handle multiple masks
                    if len(masks.shape) == 2:
                        masks = masks[np.newaxis, ...]
                    
                    for i, mask_data in enumerate(masks):
                        # Resize if needed
                        if mask_data.shape != (h, w):
                            mask = cv2.resize(mask_data.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                            mask = (mask > 0.5).astype(np.uint8) * 255
                        else:
                            mask = (mask_data * 255).astype(np.uint8)
                        
                        # Convert to polygon
                        polygon, area = self._mask_to_polygon(mask, simplification_epsilon)
                        polygon_normalized = [(x / w, y / h) for x, y in polygon]
                        mask_base64 = self._mask_to_base64(mask)
                        
                        results_list.append({
                            "mask": mask,
                            "mask_base64": mask_base64,
                            "polygon": polygon,
                            "polygon_normalized": polygon_normalized,
                            "area": area,
                            "score": 0.9,
                            "inference_time_ms": (time.time() - start_time) * 1000,
                            "is_valid": len(polygon) >= settings.MIN_POLYGON_POINTS,
                            "text_prompt": text_prompt,
                            "instance_id": i
                        })
            
            # Fallback to model.predict with texts if semantic predictor fails
            if not results_list and self.model is not None:
                results = self.model.predict(
                    source=image,
                    texts=[text_prompt],
                    verbose=False
                )
                
                if results and len(results) > 0 and results[0].masks is not None:
                    for i, mask_data in enumerate(results[0].masks.data.cpu().numpy()):
                        if mask_data.shape != (h, w):
                            mask = cv2.resize(mask_data.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                            mask = (mask > 0.5).astype(np.uint8) * 255
                        else:
                            mask = (mask_data * 255).astype(np.uint8)
                        
                        polygon, area = self._mask_to_polygon(mask, simplification_epsilon)
                        polygon_normalized = [(x / w, y / h) for x, y in polygon]
                        mask_base64 = self._mask_to_base64(mask)
                        
                        score = float(results[0].boxes.conf[i]) if results[0].boxes is not None and i < len(results[0].boxes.conf) else 0.9
                        
                        results_list.append({
                            "mask": mask,
                            "mask_base64": mask_base64,
                            "polygon": polygon,
                            "polygon_normalized": polygon_normalized,
                            "area": area,
                            "score": score,
                            "inference_time_ms": (time.time() - start_time) * 1000,
                            "is_valid": len(polygon) >= settings.MIN_POLYGON_POINTS,
                            "text_prompt": text_prompt,
                            "instance_id": i
                        })
                        
        except Exception as e:
            print(f"SAM3 text prediction error: {e}")
            return [{
                "error": str(e),
                "is_valid": False
            }]
        
        if not results_list:
            return [{
                "error": f"No objects found matching '{text_prompt}'",
                "is_valid": False
            }]
        
        return results_list
    
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
