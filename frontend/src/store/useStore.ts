/**
 * Main application store using Zustand
 */

import { create } from 'zustand';
import type {
  ImageInfo,
  AnnotationObject,
  ToolMode,
  LassoMode,
  Point,
  BoundingBox,
  HistoryEntry,
} from '../types';

interface AppState {
  // Session
  sessionId: string | null;
  datasetPath: string;
  classes: string[];
  
  // Images
  images: ImageInfo[];
  currentImageIndex: number;
  currentImage: ImageInfo | null;
  
  // Annotations
  objects: AnnotationObject[];
  selectedObjectId: string | null;
  
  // Drawing state
  toolMode: ToolMode;
  lassoMode: LassoMode;
  isDrawingBbox: boolean;
  tempBbox: BoundingBox | null;
  lassoPoints: Point[];
  
  // Canvas
  scale: number;
  position: Point;
  maskOpacity: number;
  simplificationEpsilon: number;
  
  // History
  history: HistoryEntry[];
  historyIndex: number;
  
  // UI
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  
  // Actions
  setSession: (sessionId: string, datasetPath: string, classes: string[], images: ImageInfo[]) => void;
  setCurrentImageIndex: (index: number) => void;
  setObjects: (objects: AnnotationObject[]) => void;
  addObject: (object: AnnotationObject) => void;
  updateObject: (id: string, updates: Partial<AnnotationObject>) => void;
  deleteObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  
  setToolMode: (mode: ToolMode) => void;
  setLassoMode: (mode: LassoMode) => void;
  setTempBbox: (bbox: BoundingBox | null) => void;
  addLassoPoint: (point: Point) => void;
  clearLassoPoints: () => void;
  
  setScale: (scale: number) => void;
  setPosition: (position: Point) => void;
  setMaskOpacity: (opacity: number) => void;
  setSimplificationEpsilon: (epsilon: number) => void;
  
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  
  reset: () => void;
}

const initialState = {
  sessionId: null,
  datasetPath: '',
  classes: [],
  images: [],
  currentImageIndex: 0,
  currentImage: null,
  objects: [],
  selectedObjectId: null,
  toolMode: 'bbox' as ToolMode,
  lassoMode: 'add' as LassoMode,
  isDrawingBbox: false,
  tempBbox: null,
  lassoPoints: [] as Point[],
  scale: 1,
  position: { x: 0, y: 0 },
  maskOpacity: 0.5,
  simplificationEpsilon: 2.0,
  history: [],
  historyIndex: -1,
  isLoading: false,
  isSaving: false,
  hasUnsavedChanges: false,
};

export const useStore = create<AppState>((set, get) => ({
  ...initialState,
  
  setSession: (sessionId, datasetPath, classes, images) => {
    set({
      sessionId,
      datasetPath,
      classes,
      images,
      currentImageIndex: 0,
      currentImage: images[0] || null,
      objects: [],
      history: [],
      historyIndex: -1,
    });
  },
  
  setCurrentImageIndex: (index) => {
    const { images } = get();
    if (index >= 0 && index < images.length) {
      set({
        currentImageIndex: index,
        currentImage: images[index],
        objects: [],
        selectedObjectId: null,
        tempBbox: null,
        lassoPoints: [],
        history: [],
        historyIndex: -1,
        hasUnsavedChanges: false,
      });
    }
  },
  
  setObjects: (objects) => {
    set({ objects, hasUnsavedChanges: false });
  },
  
  addObject: (object) => {
    const { objects } = get();
    get().pushHistory();
    set({
      objects: [...objects, object],
      selectedObjectId: object.id,
      hasUnsavedChanges: true,
    });
  },
  
  updateObject: (id, updates) => {
    const { objects } = get();
    get().pushHistory();
    set({
      objects: objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
      hasUnsavedChanges: true,
    });
  },
  
  deleteObject: (id) => {
    const { objects, selectedObjectId } = get();
    get().pushHistory();
    set({
      objects: objects.filter((obj) => obj.id !== id),
      selectedObjectId: selectedObjectId === id ? null : selectedObjectId,
      hasUnsavedChanges: true,
    });
  },
  
  selectObject: (id) => {
    set({ selectedObjectId: id });
  },
  
  setToolMode: (mode) => {
    set({
      toolMode: mode,
      tempBbox: null,
      isDrawingBbox: false,
      lassoPoints: [],
    });
  },
  
  setLassoMode: (mode) => {
    set({ lassoMode: mode });
  },
  
  setTempBbox: (bbox) => {
    set({ tempBbox: bbox });
  },
  
  addLassoPoint: (point) => {
    const { lassoPoints } = get();
    set({ lassoPoints: [...lassoPoints, point] });
  },
  
  clearLassoPoints: () => {
    set({ lassoPoints: [] });
  },
  
  setScale: (scale) => {
    set({ scale: Math.max(0.1, Math.min(5, scale)) });
  },
  
  setPosition: (position) => {
    set({ position });
  },
  
  setMaskOpacity: (opacity) => {
    set({ maskOpacity: Math.max(0, Math.min(1, opacity)) });
  },
  
  setSimplificationEpsilon: (epsilon) => {
    set({ simplificationEpsilon: Math.max(0, Math.min(10, epsilon)) });
  },
  
  setLoading: (loading) => {
    set({ isLoading: loading });
  },
  
  setSaving: (saving) => {
    set({ isSaving: saving });
  },
  
  setHasUnsavedChanges: (hasChanges) => {
    set({ hasUnsavedChanges: hasChanges });
  },
  
  pushHistory: () => {
    const { objects, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      objects: JSON.parse(JSON.stringify(objects)),
      timestamp: Date.now(),
    });
    
    // Limit history size
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },
  
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      set({
        objects: JSON.parse(JSON.stringify(prevState.objects)),
        historyIndex: historyIndex - 1,
        hasUnsavedChanges: true,
      });
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      set({
        objects: JSON.parse(JSON.stringify(nextState.objects)),
        historyIndex: historyIndex + 1,
        hasUnsavedChanges: true,
      });
    }
  },
  
  reset: () => {
    set(initialState);
  },
}));
