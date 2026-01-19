"""
Application configuration using Pydantic Settings
"""

from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache
import torch


class Settings(BaseSettings):
    """Application settings"""
    
    # SAM Model
    SAM_MODEL_PATH: str = "./models/sam3_vit_h.pth"
    SAM_MODEL_TYPE: str = "vit_h"
    DEVICE: str = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Cache settings
    EMBEDDING_CACHE_SIZE: int = 100
    
    # File paths
    ALLOWED_PATHS: List[str] = ["/data", "/home"]
    MAX_IMAGE_SIZE: int = 4096
    SUPPORTED_FORMATS: List[str] = [".jpg", ".jpeg", ".png", ".webp", ".bmp"]
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # Polygon settings
    MIN_POLYGON_POINTS: int = 3
    DEFAULT_SIMPLIFICATION_EPSILON: float = 2.0
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
