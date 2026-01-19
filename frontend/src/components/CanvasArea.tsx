/**
 * Canvas Area - Main annotation canvas with Konva
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image, Rect, Line, Circle, Group } from 'react-konva';
import useImage from 'use-image';
import { useStore } from '../store/useStore';
import { getImageUrl, predictMask } from '../services/api';
import type { Point, BoundingBox, AnnotationObject } from '../types';
import { v4 as uuidv4 } from './uuid';

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);

  const {
    sessionId,
    currentImage,
    classes,
    objects,
    selectedObjectId,
    toolMode,
    pointType,
    tempBbox,
    tempPoints,
    scale,
    position,
    maskOpacity,
    simplificationEpsilon,
    setTempBbox,
    addTempPoint,
    clearTempPoints,
    addObject,
    updateObject,
    selectObject,
    setScale,
    setPosition,
    setLoading,
  } = useStore();

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
    const pos = getImagePosition(e);
    if (!pos || !currentImage) return;

    // Check if space is held for panning
    if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.spaceKey)) {
      setIsPanning(true);
      setLastPanPoint({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

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
    } else if (toolMode === 'point' && selectedObjectId) {
      // Add point to selected object
      const type = e.evt.button === 2 ? 'negative' : pointType;
      addTempPoint(pos, type);
      
      // Trigger prediction
      const obj = objects.find(o => o.id === selectedObjectId);
      if (obj) {
        runPrediction(obj, type === 'positive' 
          ? [...tempPoints.pos, pos]
          : tempPoints.pos,
          type === 'negative'
            ? [...tempPoints.neg, pos]
            : tempPoints.neg
        );
      }
    }
  }, [toolMode, pointType, currentImage, getImagePosition, setTempBbox, selectedObjectId, objects, tempPoints]);

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
          x_max: Math.max(tempBbox.x_min, pos.x),
          y_max: Math.max(tempBbox.y_min, pos.y),
        });
      }
    }
  }, [isPanning, lastPanPoint, toolMode, tempBbox, position, getImagePosition, setPosition, setTempBbox]);

  // Handle mouse up
  const handleMouseUp = useCallback(async (e: any) => {
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
  }, [isPanning, toolMode, tempBbox, currentImage, sessionId, setTempBbox]);

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
      clearTempPoints();
    } catch (error) {
      console.error('Prediction failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Run prediction with points
  const runPrediction = async (
    obj: AnnotationObject,
    pointsPos: Point[],
    pointsNeg: Point[]
  ) => {
    if (!sessionId || !currentImage) return;

    setLoading(true);
    try {
      const response = await predictMask(sessionId, {
        image_id: currentImage.id,
        bbox: obj.bbox,
        points_pos: pointsPos,
        points_neg: pointsNeg,
        simplification_epsilon: simplificationEpsilon,
        return_mask: true,
      });

      updateObject(obj.id, {
        points_pos: pointsPos,
        points_neg: pointsNeg,
        polygon: response.polygon.points,
        polygon_normalized: response.polygon_normalized,
        score: response.score,
      });
    } catch (error) {
      console.error('Prediction failed:', error);
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
      style={{ cursor: getCursor(toolMode, isPanning) }}
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
              x={position.x + tempBbox.x_min * scale}
              y={position.y + tempBbox.y_min * scale}
              width={(tempBbox.x_max - tempBbox.x_min) * scale}
              height={(tempBbox.y_max - tempBbox.y_min) * scale}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[5, 5]}
              fill="rgba(59, 130, 246, 0.1)"
            />
          )}

          {/* Temp points */}
          {tempPoints.pos.map((point, i) => (
            <Circle
              key={`pos-${i}`}
              x={position.x + point.x * scale}
              y={position.y + point.y * scale}
              radius={6}
              fill="#22c55e"
              stroke="#fff"
              strokeWidth={2}
            />
          ))}
          {tempPoints.neg.map((point, i) => (
            <Circle
              key={`neg-${i}`}
              x={position.x + point.x * scale}
              y={position.y + point.y * scale}
              radius={6}
              fill="#ef4444"
              stroke="#fff"
              strokeWidth={2}
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

function getCursor(toolMode: string, isPanning: boolean): string {
  if (isPanning) return 'grabbing';
  switch (toolMode) {
    case 'bbox': return 'crosshair';
    case 'point': return 'crosshair';
    default: return 'default';
  }
}

function generateId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
