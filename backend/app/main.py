"""
SAM3 Polygon Annotation Tool - Backend
FastAPI application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import session, images, sam, labels
from app.services.sam_service import SAMService
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - load SAM model on startup"""
    # Initialize SAM service
    app.state.sam_service = SAMService(
        model_path=settings.SAM_MODEL_PATH,
        device=settings.DEVICE,
        cache_size=settings.EMBEDDING_CACHE_SIZE
    )
    print(f"SAM3 model loaded on {settings.DEVICE}")
    yield
    # Cleanup
    if hasattr(app.state, 'sam_service'):
        app.state.sam_service.clear_cache()


app = FastAPI(
    title="SAM3 Annotation Tool API",
    description="Backend API for SAM3-powered polygon annotation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(session.router, prefix="/api/session", tags=["Session"])
app.include_router(images.router, prefix="/api/images", tags=["Images"])
app.include_router(sam.router, prefix="/api/sam", tags=["SAM"])
app.include_router(labels.router, prefix="/api/labels", tags=["Labels"])


@app.get("/")
async def root():
    return {"message": "SAM3 Annotation Tool API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
