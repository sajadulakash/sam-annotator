/**
 * Canvas Area - Main annotation canvas with Konva
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image, Rect, Line, Circle, Group } from 'react-konva';
import useImage from 'use-image';
import { useStore } from '../store/useStore';
import { getImageUrl, predictMask } from '../services/api';
import type { Point, BoundingBox, AnnotationObject } from '../types';
import polygonClipping from 'polygon-clipping';

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  const {
    sessionId,
    currentImage,
    classes,
    objects,
    selectedObjectId,
    toolMode,
    lassoMode,
    tempBbox,
    lassoPoints,
    scale,
    position,
    maskOpacity,
    simplificationEpsilon,
    setTempBbox,
    addLassoPoint,
    clearLassoPoints,
    addObject,
    updateObject,
    selectObject,
    setScale,
    setPosition,
    setLoading,
  } = useStore();

  // State for lasso drawing
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);

  // Load image
  const imageUrl = sessionId && currentImage
    ? getImageUrl(sessionId, currentImage.id)
    : '';
  const [image] = useImage(imageUrl, 'anonymous');

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Space key handler for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpaceHeld(false);
        setIsPanning(false);
        setLastPanPoint(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Fit image to canvas on load
  useEffect(() => {
    if (image && currentImage) {
      const scaleX = (containerSize.width - 100) / currentImage.width;
      const scaleY = (containerSize.height - 100) / currentImage.height;
      const fitScale = Math.min(scaleX, scaleY, 1);
      
      setScale(fitScale);
      setPosition({
        x: (containerSize.width - currentImage.width * fitScale) / 2,
        y: (containerSize.height - currentImage.height * fitScale) / 2,
      });
    }
  }, [image, currentImage, containerSize]);

  // Get mouse position relative to image
  const getImagePosition = useCallback((e: any): Point | null => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    return {
      x: (pointer.x - position.x) / scale,
      y: (pointer.y - position.y) / scale,
    };
  }, [position, scale]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    
    const oldScale = scale;
    const newScale = e.evt.deltaY > 0 
      ? oldScale / scaleBy 
      : oldScale * scaleBy;
    
    // Limit scale
    const clampedScale = Math.max(0.1, Math.min(5, newScale));
    
    // Adjust position to zoom towards mouse
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    
    setScale(clampedScale);
    setPosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, [scale, position, setScale, setPosition]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: any) => {
    // Check if space is held for panning (works anywhere on canvas)
    if (e.evt.button === 0 && isSpaceHeld) {
      setIsPanning(true);
      setLastPanPoint({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }
    
    // Middle mouse button for panning
    if (e.evt.button === 1) {
      setIsPanning(true);
      setLastPanPoint({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    const pos = getImagePosition(e);
    if (!pos || !currentImage) return;

    // Check bounds
    if (pos.x < 0 || pos.x > currentImage.width || pos.y < 0 || pos.y > currentImage.height) {
      return;
    }

    if (toolMode === 'bbox') {
      setTempBbox({
        x_min: pos.x,
        y_min: pos.y,
        x_max: pos.x,
        y_max: pos.y,
      });
    } else if (toolMode === 'lasso' && selectedObjectId) {
      // Start drawing lasso
      setIsDrawingLasso(true);
      clearLassoPoints();
      addLassoPoint(pos);
    }
  }, [toolMode, currentImage, getImagePosition, setTempBbox, selectedObjectId, clearLassoPoints, addLassoPoint, isSpaceHeld]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: any) => {
    if (isPanning && lastPanPoint) {
      const dx = e.evt.clientX - lastPanPoint.x;
      const dy = e.evt.clientY - lastPanPoint.y;
      setPosition({
        x: position.x + dx,
        y: position.y + dy,
      });
      setLastPanPoint({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    if (toolMode === 'bbox' && tempBbox) {
      const pos = getImagePosition(e);
      if (pos) {
        setTempBbox({
          ...tempBbox,
          x_max: pos.x,
          y_max: pos.y,
        });
      }
    }

    // Add points while drawing lasso
    if (toolMode === 'lasso' && isDrawingLasso) {
      const pos = getImagePosition(e);
      if (pos && currentImage) {
        // Only add point if within bounds
        if (pos.x >= 0 && pos.x <= currentImage.width && pos.y >= 0 && pos.y <= currentImage.height) {
          addLassoPoint(pos);
        }
      }
    }
  }, [isPanning, lastPanPoint, toolMode, tempBbox, position, getImagePosition, setPosition, setTempBbox, isDrawingLasso, addLassoPoint, currentImage]);

  // Handle mouse up
  const handleMouseUp = useCallback(async () => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (toolMode === 'bbox' && tempBbox && currentImage && sessionId) {
      // Ensure valid bbox
      const bbox: BoundingBox = {
        x_min: Math.min(tempBbox.x_min, tempBbox.x_max),
        y_min: Math.min(tempBbox.y_min, tempBbox.y_max),
        x_max: Math.max(tempBbox.x_min, tempBbox.x_max),
        y_max: Math.max(tempBbox.y_min, tempBbox.y_max),
      };

      const width = bbox.x_max - bbox.x_min;
      const height = bbox.y_max - bbox.y_min;

      // Minimum size check
      if (width > 10 && height > 10) {
        // Create new object with initial prediction
        await createObjectWithPrediction(bbox);
      }

      setTempBbox(null);
    }

    // Handle lasso completion
    if (toolMode === 'lasso' && isDrawingLasso && lassoPoints.length >= 3) {
      setIsDrawingLasso(false);
      
      // Apply lasso mask modification to selected object
      const selectedObj = objects.find(o => o.id === selectedObjectId);
      if (selectedObj && sessionId && currentImage) {
        await applyLassoMask(selectedObj, lassoPoints, lassoMode);
      }
      
      clearLassoPoints();
    } else if (toolMode === 'lasso' && isDrawingLasso) {
      // Not enough points, cancel
      setIsDrawingLasso(false);
      clearLassoPoints();
    }
  }, [isPanning, toolMode, tempBbox, currentImage, sessionId, setTempBbox, isDrawingLasso, lassoPoints, lassoMode, objects, selectedObjectId, clearLassoPoints]);

  // Create object with SAM prediction
  const createObjectWithPrediction = async (bbox: BoundingBox) => {
    if (!sessionId || !currentImage) return;

    setLoading(true);
    try {
      const response = await predictMask(sessionId, {
        image_id: currentImage.id,
        bbox,
        points_pos: [],
        points_neg: [],
        simplification_epsilon: simplificationEpsilon,
        return_mask: true,
      });

      const newObject: AnnotationObject = {
        id: generateId(),
        class_id: 0,
        class_name: classes[0] || 'object',
        bbox,
        points_pos: [],
        points_neg: [],
        polygon: response.polygon.points,
        polygon_normalized: response.polygon_normalized,
        score: response.score,
      };

      addObject(newObject);
      clearLassoPoints();
    } catch (error) {
      console.error('Prediction failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply lasso mask modification to an object's polygon
  const applyLassoMask = async (
    obj: AnnotationObject,
    lasso: Point[],
    mode: 'add' | 'subtract'
  ) => {
    if (!currentImage) return;
    
    setLoading(true);
    try {
      // Convert lasso points to polygon format
      const lassoPolygon: [number, number][] = lasso.map(p => [p.x, p.y]);
      
      // Use polygon boolean operations
      const originalPolygon = obj.polygon;
      let newPolygon: [number, number][];
      
      if (mode === 'add') {
        // Union of original and lasso polygons
        newPolygon = polygonUnion(originalPolygon, lassoPolygon);
      } else {
        // Subtract lasso from original
        newPolygon = polygonDifference(originalPolygon, lassoPolygon);
      }
      
      // Update bounding box
      const xs = newPolygon.map(p => p[0]);
      const ys = newPolygon.map(p => p[1]);
      const newBbox: BoundingBox = {
        x_min: Math.max(0, Math.min(...xs)),
        y_min: Math.max(0, Math.min(...ys)),
        x_max: Math.min(currentImage.width, Math.max(...xs)),
        y_max: Math.min(currentImage.height, Math.max(...ys)),
      };
      
      // Normalize polygon
      const newPolygonNormalized: [number, number][] = newPolygon.map(([x, y]) => [
        x / currentImage.width,
        y / currentImage.height,
      ]);
      
      updateObject(obj.id, {
        polygon: newPolygon,
        polygon_normalized: newPolygonNormalized,
        bbox: newBbox,
      });
    } catch (error) {
      console.error('Lasso mask operation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prevent context menu
  const handleContextMenu = (e: any) => {
    e.evt.preventDefault();
  };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 bg-gray-900 overflow-hidden"
      style={{ cursor: getCursor(toolMode, isPanning, isSpaceHeld) }}
    >
      <Stage
        width={containerSize.width}
        height={containerSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <Layer>
          {/* Image */}
          {image && (
            <Image
              image={image}
              x={position.x}
              y={position.y}
              scaleX={scale}
              scaleY={scale}
            />
          )}

          {/* Existing objects */}
          {objects.map((obj) => (
            <ObjectOverlay
              key={obj.id}
              object={obj}
              isSelected={obj.id === selectedObjectId}
              scale={scale}
              position={position}
              maskOpacity={maskOpacity}
              onClick={() => selectObject(obj.id)}
            />
          ))}

          {/* Temp bbox */}
          {tempBbox && (
            <Rect
              x={position.x + Math.min(tempBbox.x_min, tempBbox.x_max) * scale}
              y={position.y + Math.min(tempBbox.y_min, tempBbox.y_max) * scale}
              width={Math.abs(tempBbox.x_max - tempBbox.x_min) * scale}
              height={Math.abs(tempBbox.y_max - tempBbox.y_min) * scale}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[5, 5]}
              fill="rgba(59, 130, 246, 0.1)"
            />
          )}

          {/* Lasso drawing */}
          {isDrawingLasso && lassoPoints.length >= 2 && (
            <Line
              points={lassoPoints.flatMap(p => [
                position.x + p.x * scale,
                position.y + p.y * scale,
              ])}
              stroke={lassoMode === 'add' ? '#22c55e' : '#ef4444'}
              strokeWidth={2}
              dash={[5, 5]}
              closed={false}
            />
          )}
          {isDrawingLasso && lassoPoints.length >= 1 && lassoPoints.map((point, i) => (
            <Circle
              key={`lasso-${i}`}
              x={position.x + point.x * scale}
              y={position.y + point.y * scale}
              radius={3}
              fill={lassoMode === 'add' ? '#22c55e' : '#ef4444'}
            />
          ))}
        </Layer>
      </Stage>

      {/* Empty state */}
      {!currentImage && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No image loaded
        </div>
      )}
    </div>
  );
}

// Object overlay component
interface ObjectOverlayProps {
  object: AnnotationObject;
  isSelected: boolean;
  scale: number;
  position: Point;
  maskOpacity: number;
  onClick: () => void;
}

function ObjectOverlay({
  object,
  isSelected,
  scale,
  position,
  maskOpacity,
  onClick,
}: ObjectOverlayProps) {
  const color = getClassColor(object.class_id);
  
  // Convert polygon to flat array for Line component
  const polygonPoints = object.polygon.flatMap(([x, y]) => [
    position.x + x * scale,
    position.y + y * scale,
  ]);

  return (
    <Group onClick={onClick}>
      {/* Polygon fill */}
      {polygonPoints.length >= 6 && (
        <Line
          points={polygonPoints}
          closed
          fill={`${color}${Math.round(maskOpacity * 255).toString(16).padStart(2, '0')}`}
          stroke={isSelected ? '#fff' : color}
          strokeWidth={isSelected ? 3 : 2}
        />
      )}

      {/* Bounding box */}
      <Rect
        x={position.x + object.bbox.x_min * scale}
        y={position.y + object.bbox.y_min * scale}
        width={(object.bbox.x_max - object.bbox.x_min) * scale}
        height={(object.bbox.y_max - object.bbox.y_min) * scale}
        stroke={color}
        strokeWidth={isSelected ? 2 : 1}
        dash={isSelected ? undefined : [3, 3]}
      />

      {/* Points */}
      {object.points_pos.map((point, i) => (
        <Circle
          key={`pos-${i}`}
          x={position.x + point.x * scale}
          y={position.y + point.y * scale}
          radius={5}
          fill="#22c55e"
          stroke="#fff"
          strokeWidth={1}
        />
      ))}
      {object.points_neg.map((point, i) => (
        <Circle
          key={`neg-${i}`}
          x={position.x + point.x * scale}
          y={position.y + point.y * scale}
          radius={5}
          fill="#ef4444"
          stroke="#fff"
          strokeWidth={1}
        />
      ))}
    </Group>
  );
}

// Helper functions
function getClassColor(classId: number): string {
  const colors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16',
  ];
  return colors[classId % colors.length];
}

function getCursor(toolMode: string, isPanning: boolean, isSpaceHeld: boolean): string {
  if (isPanning) return 'grabbing';
  if (isSpaceHeld) return 'grab';
  switch (toolMode) {
    case 'bbox': return 'crosshair';
    case 'lasso': return 'crosshair';
    default: return 'default';
  }
}

function generateId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Type for polygon ring (array of [x, y] pairs)
type Ring = [number, number][];
type Polygon = Ring[];

// Polygon boolean operations using polygon-clipping library
function polygonUnion(
  poly1: [number, number][],
  poly2: [number, number][]
): [number, number][] {
  try {
    // Convert to polygon-clipping format (Polygon = array of rings)
    const p1: Polygon = [poly1];
    const p2: Polygon = [poly2];
    
    const result = polygonClipping.union(p1, p2);
    
    // Return the largest polygon from the result
    if (result.length > 0 && result[0].length > 0) {
      // Find the largest polygon by area
      let largestPoly = result[0][0];
      let maxArea = Math.abs(polygonArea(largestPoly));
      
      for (const multiPoly of result) {
        for (const ring of multiPoly) {
          const area = Math.abs(polygonArea(ring));
          if (area > maxArea) {
            maxArea = area;
            largestPoly = ring;
          }
        }
      }
      
      return largestPoly as [number, number][];
    }
    
    return poly1; // Fallback to original
  } catch (error) {
    console.error('Polygon union failed:', error);
    return poly1;
  }
}

function polygonDifference(
  poly1: [number, number][],
  poly2: [number, number][]
): [number, number][] {
  try {
    // Convert to polygon-clipping format
    const p1: Polygon = [poly1];
    const p2: Polygon = [poly2];
    
    const result = polygonClipping.difference(p1, p2);
    
    // Return the largest polygon from the result
    if (result.length > 0 && result[0].length > 0) {
      // Find the largest polygon by area
      let largestPoly = result[0][0];
      let maxArea = Math.abs(polygonArea(largestPoly));
      
      for (const multiPoly of result) {
        for (const ring of multiPoly) {
          const area = Math.abs(polygonArea(ring));
          if (area > maxArea) {
            maxArea = area;
            largestPoly = ring;
          }
        }
      }
      
      return largestPoly as [number, number][];
    }
    
    return poly1; // Fallback to original if difference results in nothing
  } catch (error) {
    console.error('Polygon difference failed:', error);
    return poly1;
  }
}

// Calculate polygon area using shoelace formula
function polygonArea(polygon: Ring): number {
  let area = 0;
  const n = polygon.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  
  return area / 2;
}
