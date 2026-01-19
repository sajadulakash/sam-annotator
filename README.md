# SAM3 Polygon Annotation Tool

A web-based image annotation tool that uses **SAM 3** (Segment Anything Model) for efficient polygon segmentation annotations.

## Features

- **Interactive Segmentation**: Draw bounding boxes and refine with positive/negative points
- **SAM 3 Integration**: Fast, accurate mask predictions
- **Multi-object Support**: Annotate multiple objects per image
- **YOLO Export**: Saves annotations in YOLO segmentation format (.txt)
- **Keyboard Shortcuts**: Efficient annotation workflow
- **Undo/Redo**: Full history support per image

## Architecture

```
sam3/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI application
│   │   ├── routers/        # API endpoints
│   │   ├── services/       # SAM3, label, image services
│   │   ├── models/         # Pydantic models
│   │   └── utils/          # Utility functions
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API service
│   │   ├── store/          # State management
│   │   └── types/          # TypeScript types
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- CUDA-capable GPU (recommended for SAM3)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Download SAM3 model weights (place in backend/models/)
# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Docker Setup (Recommended)

```bash
docker-compose up --build
```

Access the application at `http://localhost:3000`

## Usage

1. **Configure Dataset**: Enter the path to your image folder and define class names
2. **Draw Bounding Box**: Press `B` and drag to create a bbox around an object
3. **Refine with Points**: Press `P`, then left-click for positive points, right-click for negative
4. **Assign Class**: Select from dropdown or press `1-9` for quick selection
5. **Save**: Press `S` or click Save to export annotations

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `B` | Bounding box tool |
| `P` | Point refinement tool |
| `1-9` | Select class by index |
| `N` | Next image |
| `Shift+N` | Previous image |
| `S` | Save annotations |
| `Del` | Delete selected object |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Space+Drag` | Pan canvas |
| `Scroll` | Zoom |

## Output Format

Annotations are saved in YOLO segmentation format:

```
# labels/image001.txt
0 0.123 0.456 0.234 0.567 0.345 0.678 ...
1 0.111 0.222 0.333 0.444 0.555 0.666 ...
```

Each line: `class_id x1 y1 x2 y2 x3 y3 ...` (normalized coordinates)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session/init` | POST | Initialize dataset session |
| `/api/images/{id}` | GET | Get image by ID |
| `/api/sam/predict` | POST | Run SAM3 prediction |
| `/api/labels/save` | POST | Save annotations |
| `/api/labels/{image_id}` | GET | Load existing labels |

## Configuration

### Environment Variables

**Backend** (`.env`):
```
SAM_MODEL_PATH=./models/sam3_vit_h.pth
ALLOWED_PATHS=/data/datasets,/home/user/images
MAX_IMAGE_SIZE=4096
EMBEDDING_CACHE_SIZE=100
```

**Frontend** (`.env`):
```
VITE_API_URL=http://localhost:8000
```

## License

MIT License
