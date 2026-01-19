/**
 * Type definitions for the annotation tool
 */

// ============ Basic Types ============

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

// ============ Image Types ============

export interface ImageInfo {
  id: string;
  filename: string;
  path: string;
  width: number;
  height: number;
  has_labels: boolean;
}

// ============ Annotation Types ============

export interface AnnotationObject {
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

// ============ Session Types ============

export interface SessionInitRequest {
  dataset_path: string;
  classes: string[];
  images_subfolder?: string;
  labels_subfolder?: string;
}

export interface SessionInitResponse {
  session_id: string;
  dataset_path: string;
  classes: string[];
  images: ImageInfo[];
  total_images: number;
  labeled_count: number;
}

// ============ SAM Types ============

export interface SAMPredictRequest {
  image_id: string;
  bbox: BoundingBox;
  points_pos: Point[];
  points_neg: Point[];
  simplification_epsilon?: number;
  return_mask?: boolean;
}

export interface PolygonResult {
  points: [number, number][];
  area: number;
  is_valid: boolean;
}

export interface SAMPredictResponse {
  polygon: PolygonResult;
  polygon_normalized: [number, number][];
  score: number;
  mask_base64?: string;
  inference_time_ms: number;
}

// ============ SAM3 Text Prediction Types ============

export interface SAM3TextPredictRequest {
  image_id: string;
  text_prompt: string;
  simplification_epsilon?: number;
  return_mask?: boolean;
}

export interface SAM3TextPredictResult {
  polygon: PolygonResult;
  polygon_normalized: [number, number][];
  score: number;
  mask_base64?: string;
  instance_id: number;
  text_prompt: string;
}

export interface SAM3TextPredictResponse {
  results: SAM3TextPredictResult[];
  total_instances: number;
  inference_time_ms: number;
  is_sam3: boolean;
}

// ============ Label Types ============

export interface SaveLabelsRequest {
  image_id: string;
  objects: AnnotationObject[];
}

export interface SaveLabelsResponse {
  success: boolean;
  filepath: string;
  objects_saved: number;
}

export interface LoadLabelsResponse {
  image_id: string;
  exists: boolean;
  objects: AnnotationObject[];
}

// ============ UI State Types ============

export type ToolMode = 'select' | 'bbox' | 'point';
export type PointType = 'positive' | 'negative';

export interface CanvasState {
  scale: number;
  position: Point;
}

export interface DrawingState {
  isDrawing: boolean;
  startPoint: Point | null;
  currentPoint: Point | null;
}

// ============ History Types ============

export interface HistoryEntry {
  objects: AnnotationObject[];
  timestamp: number;
}
