# API Reference

## Base URL
```
http://localhost:8000/api
```

---

## Session Endpoints

### Initialize Session
`POST /session/init`

Initialize a new annotation session with dataset path and classes.

**Request Body:**
```json
{
  "dataset_path": "/path/to/dataset",
  "classes": ["person", "car", "bicycle"],
  "images_subfolder": "images",
  "labels_subfolder": "labels"
}
```

**Response:**
```json
{
  "session_id": "a1b2c3d4",
  "dataset_path": "/path/to/dataset",
  "classes": ["person", "car", "bicycle"],
  "images": [
    {
      "id": "abc123def456",
      "filename": "image001.jpg",
      "path": "/path/to/dataset/images/image001.jpg",
      "width": 1920,
      "height": 1080,
      "has_labels": false
    }
  ],
  "total_images": 100,
  "labeled_count": 25
}
```

### Get Session
`GET /session/{session_id}`

Get session details and image list.

---

## Image Endpoints

### Get Image
`GET /images/{session_id}/{image_id}`

Returns the image file for display.

**Response:** Image file (JPEG/PNG)

### Get Image Info
`GET /images/{session_id}/{image_id}/info`

Get metadata for a specific image.

**Response:**
```json
{
  "id": "abc123def456",
  "filename": "image001.jpg",
  "path": "/path/to/dataset/images/image001.jpg",
  "width": 1920,
  "height": 1080,
  "has_labels": true
}
```

### List Images
`GET /images/{session_id}/list?offset=0&limit=100`

Get paginated list of images.

---

## SAM Prediction Endpoints

### Predict Mask
`POST /sam/predict/{session_id}`

Run SAM3 prediction with bounding box and points.

**Request Body:**
```json
{
  "image_id": "abc123def456",
  "bbox": {
    "x_min": 100,
    "y_min": 100,
    "x_max": 500,
    "y_max": 400
  },
  "points_pos": [
    {"x": 300, "y": 250}
  ],
  "points_neg": [
    {"x": 150, "y": 350}
  ],
  "simplification_epsilon": 2.0,
  "return_mask": false
}
```

**Response:**
```json
{
  "polygon": {
    "points": [[120, 110], [480, 115], [490, 390], [115, 385]],
    "area": 105000.5,
    "is_valid": true
  },
  "polygon_normalized": [[0.0625, 0.102], [0.25, 0.106], [0.255, 0.361], [0.06, 0.356]],
  "score": 0.95,
  "mask_base64": "iVBORw0KGgo...",
  "inference_time_ms": 45.2
}
```

### Get SAM Status
`GET /sam/status`

Check SAM service status.

**Response:**
```json
{
  "loaded": true,
  "device": "cuda",
  "cache_size": 10,
  "model_path": "./models/sam3_vit_h.pth"
}
```

---

## Label Endpoints

### Save Labels
`POST /labels/save/{session_id}`

Save annotations for an image in YOLO segmentation format.

**Request Body:**
```json
{
  "image_id": "abc123def456",
  "objects": [
    {
      "id": "obj_1",
      "class_id": 0,
      "class_name": "person",
      "bbox": {"x_min": 100, "y_min": 100, "x_max": 500, "y_max": 400},
      "points_pos": [{"x": 300, "y": 250}],
      "points_neg": [],
      "polygon": [[120, 110], [480, 115], [490, 390], [115, 385]],
      "polygon_normalized": [[0.0625, 0.102], [0.25, 0.106], [0.255, 0.361], [0.06, 0.356]],
      "score": 0.95
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "filepath": "/path/to/dataset/labels/image001.txt",
  "objects_saved": 1
}
```

### Load Labels
`GET /labels/load/{session_id}/{image_id}`

Load existing annotations for an image.

**Response:**
```json
{
  "image_id": "abc123def456",
  "exists": true,
  "objects": [
    {
      "id": "obj_0_0",
      "class_id": 0,
      "class_name": "person",
      "bbox": {"x_min": 120, "y_min": 110, "x_max": 490, "y_max": 390},
      "points_pos": [],
      "points_neg": [],
      "polygon": [[120, 110], [480, 115], [490, 390], [115, 385]],
      "polygon_normalized": [[0.0625, 0.102], [0.25, 0.106], [0.255, 0.361], [0.06, 0.356]]
    }
  ]
}
```

### Delete Labels
`DELETE /labels/delete/{session_id}/{image_id}`

Delete labels for an image.

---

## Data Models

### Point
```typescript
interface Point {
  x: number;
  y: number;
}
```

### BoundingBox
```typescript
interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}
```

### AnnotationObject
```typescript
interface AnnotationObject {
  id: string;
  class_id: number;
  class_name: string;
  bbox: BoundingBox;
  points_pos: Point[];
  points_neg: Point[];
  polygon: [number, number][];
  polygon_normalized: [number, number][];
  score?: number;
}
```

---

## Error Responses

All endpoints may return error responses:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400`: Bad Request (invalid input)
- `404`: Not Found (session/image not found)
- `500`: Internal Server Error (processing error)
