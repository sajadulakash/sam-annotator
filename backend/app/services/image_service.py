"""
Image Service - Handles image loading, validation, and serving
"""

import os
from pathlib import Path
from typing import List, Optional, Tuple
import hashlib

from PIL import Image
import numpy as np

from app.core.config import settings
from app.models.schemas import ImageInfo


class ImageService:
    """Service for image file operations"""
    
    def __init__(self):
        self.supported_formats = set(settings.SUPPORTED_FORMATS)
    
    def validate_path(self, path: str) -> bool:
        """
        Validate that path is allowed and exists
        
        Args:
            path: Filesystem path to validate
            
        Returns:
            True if path is valid and allowed
        """
        path = os.path.abspath(path)
        
        # Check if path is under allowed directories
        is_allowed = any(
            path.startswith(os.path.abspath(allowed))
            for allowed in settings.ALLOWED_PATHS
        )
        
        # For development, also allow home directories
        if not is_allowed:
            home = os.path.expanduser("~")
            is_allowed = path.startswith(home)
        
        return is_allowed and os.path.exists(path)
    
    def scan_images(self, dataset_path: str, images_subfolder: str = "images") -> List[ImageInfo]:
        """
        Scan directory for images
        
        Args:
            dataset_path: Root dataset path
            images_subfolder: Subfolder containing images (or empty for root)
            
        Returns:
            List of ImageInfo objects
        """
        images = []
        
        # Determine image directory
        if images_subfolder:
            image_dir = os.path.join(dataset_path, images_subfolder)
            if not os.path.exists(image_dir):
                # Fall back to root if subfolder doesn't exist
                image_dir = dataset_path
        else:
            image_dir = dataset_path
        
        # Determine labels directory for checking existing labels
        labels_dir = os.path.join(dataset_path, "labels")
        
        # Scan for images
        for filename in sorted(os.listdir(image_dir)):
            filepath = os.path.join(image_dir, filename)
            
            if not os.path.isfile(filepath):
                continue
            
            ext = os.path.splitext(filename)[1].lower()
            if ext not in self.supported_formats:
                continue
            
            # Get image dimensions
            try:
                with Image.open(filepath) as img:
                    width, height = img.size
            except Exception:
                continue
            
            # Generate unique ID
            image_id = self._generate_id(filepath)
            
            # Check if labels exist
            label_filename = os.path.splitext(filename)[0] + ".txt"
            has_labels = os.path.exists(os.path.join(labels_dir, label_filename))
            
            images.append(ImageInfo(
                id=image_id,
                filename=filename,
                path=filepath,
                width=width,
                height=height,
                has_labels=has_labels
            ))
        
        return images
    
    def _generate_id(self, filepath: str) -> str:
        """Generate unique ID for an image"""
        return hashlib.md5(filepath.encode()).hexdigest()[:12]
    
    def load_image(self, filepath: str) -> Tuple[np.ndarray, int, int]:
        """
        Load image as numpy array
        
        Args:
            filepath: Path to image file
            
        Returns:
            Tuple of (RGB numpy array, width, height)
        """
        with Image.open(filepath) as img:
            # Convert to RGB
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize if too large
            w, h = img.size
            max_size = settings.MAX_IMAGE_SIZE
            
            if max(w, h) > max_size:
                scale = max_size / max(w, h)
                new_w, new_h = int(w * scale), int(h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                w, h = new_w, new_h
            
            return np.array(img), w, h
    
    def get_image_bytes(self, filepath: str) -> bytes:
        """Get raw image bytes for serving"""
        with open(filepath, 'rb') as f:
            return f.read()
    
    def get_image_info(self, filepath: str) -> Optional[ImageInfo]:
        """Get ImageInfo for a single file"""
        if not os.path.exists(filepath):
            return None
        
        try:
            with Image.open(filepath) as img:
                width, height = img.size
            
            return ImageInfo(
                id=self._generate_id(filepath),
                filename=os.path.basename(filepath),
                path=filepath,
                width=width,
                height=height
            )
        except Exception:
            return None
