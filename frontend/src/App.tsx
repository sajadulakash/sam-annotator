/**
 * Main App Component
 */

import { useState, useEffect, useCallback } from 'react';
import { useStore } from './store/useStore';
import { SetupPanel } from './components/SetupPanel';
import { LeftPanel } from './components/LeftPanel';
import { CanvasArea } from './components/CanvasArea';
import { RightPanel } from './components/RightPanel';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { loadLabels, saveLabels } from './services/api';
import type { AnnotationObject } from './types';
import { v4 as generateUUID } from './components/uuid';

function App() {
  const [isSetup, setIsSetup] = useState(true);
  const {
    sessionId,
    currentImage,
    currentImageIndex,
    images,
    objects,
    setObjects,
    setCurrentImageIndex,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    setSaving,
    classes,
  } = useStore();

  // Load labels when image changes
  useEffect(() => {
    if (!sessionId || !currentImage) return;

    const loadImageLabels = async () => {
      try {
        const response = await loadLabels(sessionId, currentImage.id);
        if (response.exists && response.objects.length > 0) {
          setObjects(response.objects);
        }
      } catch (error) {
        console.error('Failed to load labels:', error);
      }
    };

    loadImageLabels();
  }, [sessionId, currentImage?.id, setObjects]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const { setToolMode, setLassoMode, undo, redo, deleteObject, selectedObjectId } = useStore.getState();

      // Tool shortcuts
      if (e.key === 'b' || e.key === 'B') {
        setToolMode('bbox');
      } else if (e.key === 'l' || e.key === 'L') {
        setToolMode('lasso');
      } else if (e.key === 'v' || e.key === 'V') {
        setToolMode('select');
      }

      // Lasso mode
      if (e.key === '+' || e.key === '=') {
        setLassoMode('add');
      } else if (e.key === '-' || e.key === '_') {
        setLassoMode('subtract');
      }

      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        } else if (e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          deleteObject(selectedObjectId);
        }
      }

      // Navigation
      if (e.key === 'n' || e.key === 'N') {
        if (e.shiftKey) {
          handlePrevImage();
        } else {
          handleNextImage();
        }
      }

      // Number keys for class selection
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        // This would be handled in context of object creation
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSave = useCallback(async () => {
    if (!sessionId || !currentImage || objects.length === 0) return;

    setSaving(true);
    try {
      await saveLabels(sessionId, {
        image_id: currentImage.id,
        objects,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save labels:', error);
      alert('Failed to save labels. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [sessionId, currentImage, objects, setSaving, setHasUnsavedChanges]);

  const handleNextImage = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Continue without saving?')) {
        return;
      }
    }
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  }, [currentImageIndex, images.length, hasUnsavedChanges, setCurrentImageIndex]);

  const handlePrevImage = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Continue without saving?')) {
        return;
      }
    }
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  }, [currentImageIndex, hasUnsavedChanges, setCurrentImageIndex]);

  // Handle auto-annotation results - always assign class 0
  const handleAutoAnnotate = useCallback((results: Array<{
    class_id: number;
    class_name: string;
    polygon: [number, number][];
    polygon_normalized: [number, number][];
    bbox: { x_min: number; y_min: number; x_max: number; y_max: number };
    score: number;
  }>) => {
    // Create annotation objects - all assigned to class 0 (first user class)
    const firstClassName = classes[0] || 'item';
    
    const newObjects: AnnotationObject[] = results.map((result) => ({
      id: generateUUID(),
      class_id: 0,
      class_name: firstClassName,
      bbox: result.bbox,
      points_pos: [],
      points_neg: [],
      polygon: result.polygon,
      polygon_normalized: result.polygon_normalized,
      score: result.score,
    }));
    
    // Add all new objects
    const { addObject } = useStore.getState();
    newObjects.forEach(obj => addObject(obj));
    
    console.log(`Auto-annotated ${newObjects.length} objects with class: ${firstClassName}`);
  }, [classes]);

  if (isSetup) {
    return <SetupPanel onComplete={() => setIsSetup(false)} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Toolbar */}
      <Toolbar
        onSave={handleSave}
        onPrev={handlePrevImage}
        onNext={handleNextImage}
        onAutoAnnotate={handleAutoAnnotate}
        sessionId={sessionId || undefined}
        currentImageId={currentImage?.id}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <LeftPanel />

        {/* Canvas area */}
        <CanvasArea />

        {/* Right panel */}
        <RightPanel />
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}

export default App;
