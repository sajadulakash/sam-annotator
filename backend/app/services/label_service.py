"""
Label Service - Handles reading and writing YOLO segmentation format labels
"""

import os
from typing import List, Optional, Tuple
from pathlib import Path

from app.models.schemas import AnnotationObject, Point, BoundingBox


class LabelService:
    """Service for label file operations in YOLO segmentation format"""
    
    def __init__(self, dataset_path: str, labels_subfolder: str = "labels"):
        self.dataset_path = dataset_path
        self.labels_dir = os.path.join(dataset_path, labels_subfolder)
        
        # Ensure labels directory exists
        os.makedirs(self.labels_dir, exist_ok=True)
    
    def get_label_filepath(self, image_filename: str) -> str:
        """Get the label file path for an image"""
        basename = os.path.splitext(image_filename)[0]
        return os.path.join(self.labels_dir, f"{basename}.txt")
    
    def save_labels(
        self,
        image_filename: str,
        objects: List[AnnotationObject],
        image_width: int,
        image_height: int
    ) -> str:
        """
        Save annotations in YOLO segmentation format
        
        Format: class_id x1 y1 x2 y2 x3 y3 ... (normalized coordinates)
        
        Args:
            image_filename: Name of the image file
            objects: List of annotation objects
            image_width: Image width for normalization
            image_height: Image height for normalization
            
        Returns:
            Path to the saved label file
        """
        filepath = self.get_label_filepath(image_filename)
        
        lines = []
        for obj in objects:
            # Use pre-normalized polygon if available, otherwise normalize
            if obj.polygon_normalized and len(obj.polygon_normalized) > 0:
                polygon_coords = obj.polygon_normalized
            else:
                # Normalize coordinates
                polygon_coords = [
                    (x / image_width, y / image_height)
                    for x, y in obj.polygon
                ]
            
            # Format: class_id x1 y1 x2 y2 ...
            coord_str = " ".join(
                f"{x:.6f} {y:.6f}" for x, y in polygon_coords
            )
            line = f"{obj.class_id} {coord_str}"
            lines.append(line)
        
        # Write to file
        with open(filepath, 'w') as f:
            f.write("\n".join(lines))
        
        return filepath
    
    def load_labels(
        self,
        image_filename: str,
        image_width: int,
        image_height: int,
        classes: List[str]
    ) -> Tuple[bool, List[AnnotationObject]]:
        """
        Load existing labels from YOLO segmentation format file
        
        Args:
            image_filename: Name of the image file
            image_width: Image width for denormalization
            image_height: Image height for denormalization
            classes: List of class names
            
        Returns:
            Tuple of (file_exists, list of annotation objects)
        """
        filepath = self.get_label_filepath(image_filename)
        
        if not os.path.exists(filepath):
            return False, []
        
        objects = []
        
        with open(filepath, 'r') as f:
            for idx, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                
                parts = line.split()
                if len(parts) < 7:  # class_id + at least 3 points (6 coords)
                    continue
                
                try:
                    class_id = int(parts[0])
                    coords = [float(x) for x in parts[1:]]
                    
                    # Parse polygon points (normalized)
                    polygon_normalized = [
                        (coords[i], coords[i + 1])
                        for i in range(0, len(coords), 2)
                    ]
                    
                    # Denormalize
                    polygon = [
                        (x * image_width, y * image_height)
                        for x, y in polygon_normalized
                    ]
                    
                    # Calculate bbox from polygon
                    xs = [p[0] for p in polygon]
                    ys = [p[1] for p in polygon]
                    bbox = BoundingBox(
                        x_min=min(xs),
                        y_min=min(ys),
                        x_max=max(xs),
                        y_max=max(ys)
                    )
                    
                    # Get class name
                    class_name = classes[class_id] if class_id < len(classes) else f"class_{class_id}"
                    
                    objects.append(AnnotationObject(
                        id=f"obj_{idx}_{class_id}",
                        class_id=class_id,
                        class_name=class_name,
                        bbox=bbox,
                        points_pos=[],
                        points_neg=[],
                        polygon=polygon,
                        polygon_normalized=polygon_normalized
                    ))
                    
                except (ValueError, IndexError):
                    continue
        
        return True, objects
    
    def delete_labels(self, image_filename: str) -> bool:
        """Delete label file for an image"""
        filepath = self.get_label_filepath(image_filename)
        
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False
    
    def labels_exist(self, image_filename: str) -> bool:
        """Check if labels exist for an image"""
        filepath = self.get_label_filepath(image_filename)
        return os.path.exists(filepath)
