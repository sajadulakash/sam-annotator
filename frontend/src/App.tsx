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
import { loadLabels, saveLabels, predictText } from './services/api';
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

      const { setToolMode, setPointType, undo, redo, deleteObject, selectedObjectId } = useStore.getState();

      // Tool shortcuts
      if (e.key === 'b' || e.key === 'B') {
        setToolMode('bbox');
      } else if (e.key === 'p' || e.key === 'P') {
        setToolMode('point');
      } else if (e.key === 'v' || e.key === 'V') {
        setToolMode('select');
      }

      // Point type
      if (e.key === '+' || e.key === '=') {
        setPointType('positive');
      } else if (e.key === '-' || e.key === '_') {
        setPointType('negative');
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

  // Handle SAM3 text prompt prediction
  const handleTextPredict = useCallback(async (textPrompt: string) => {
    if (!sessionId || !currentImage) return;
    
    try {
      const response = await predictText(sessionId, {
        image_id: currentImage.id,
        text_prompt: textPrompt,
        return_mask: false,
      });
      
      if (response.results.length === 0) {
        alert(`No "${textPrompt}" found in this image.`);
        return;
      }
      
      // Find class that matches the text prompt (case-insensitive)
      let classId = 0;
      let className = classes[0] || textPrompt;
      
      const matchingClassIndex = classes.findIndex(
        c => c.toLowerCase() === textPrompt.toLowerCase()
      );
      if (matchingClassIndex >= 0) {
        classId = matchingClassIndex;
        className = classes[matchingClassIndex];
      }
      
      // Create annotation objects from results
      const newObjects: AnnotationObject[] = response.results.map((result) => {
        // Compute bounding box from polygon
        const xs = result.polygon.points.map(p => p[0]);
        const ys = result.polygon.points.map(p => p[1]);
        const bbox = {
          x_min: Math.min(...xs),
          y_min: Math.min(...ys),
          x_max: Math.max(...xs),
          y_max: Math.max(...ys),
        };
        
        return {
          id: generateUUID(),
          class_id: classId,
          class_name: className,
          bbox,
          points_pos: [],
          points_neg: [],
          polygon: result.polygon.points,
          polygon_normalized: result.polygon_normalized,
          score: result.score,
        };
      });
      
      // Add all new objects
      const { addObject } = useStore.getState();
      newObjects.forEach(obj => addObject(obj));
      
      console.log(`Found ${newObjects.length} "${textPrompt}" instances`);
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Text prediction failed';
      alert(message);
    }
  }, [sessionId, currentImage, classes]);

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
        onTextPredict={handleTextPredict}
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
