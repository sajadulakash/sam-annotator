/**
 * Toolbar Component - Main toolbar with tools and actions
 */

import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  Square,
  MousePointer,
  Lasso,
  Save,
  ChevronLeft,
  ChevronRight,
  Undo,
  Redo,
  Plus,
  Minus,
  Loader2,
  Cpu,
} from 'lucide-react';
import clsx from 'clsx';
import { getSAMStatus, getAvailableDetectors, switchDetector, getDetectorClasses, autoAnnotate } from '../services/api';
import type { DetectorInfo, DetectorClass } from '../types';

interface ToolbarProps {
  onSave: () => void;
  onPrev: () => void;
  onNext: () => void;
  onAutoAnnotate?: (results: Array<{
    class_id: number;
    class_name: string;
    polygon: [number, number][];
    polygon_normalized: [number, number][];
    bbox: { x_min: number; y_min: number; x_max: number; y_max: number };
    score: number;
  }>) => void;
  sessionId?: string;
  currentImageId?: string;
}

export function Toolbar({ onSave, onPrev, onNext, onAutoAnnotate, sessionId, currentImageId }: ToolbarProps) {
  const {
    toolMode,
    setToolMode,
    lassoMode,
    setLassoMode,
    currentImageIndex,
    images,
    hasUnsavedChanges,
    isSaving,
    history,
    historyIndex,
    undo,
    redo,
    classes: userClasses,
  } = useStore();

  const [isSam3, setIsSam3] = useState(false);
  const [isAutoAnnotating, setIsAutoAnnotating] = useState(false);
  
  // Detector state
  const [detectors, setDetectors] = useState<DetectorInfo[]>([]);
  const [currentDetector, setCurrentDetector] = useState<string | null>(null);
  const [detectorClasses, setDetectorClasses] = useState<DetectorClass[]>([]);
  const [showDetectorDropdown, setShowDetectorDropdown] = useState(false);

  // Check if SAM3 is active and load detectors
  useEffect(() => {
    const checkSAM3 = async () => {
      try {
        const status = await getSAMStatus();
        setIsSam3(status.is_sam3);
        
        if (status.is_sam3) {
          // Load detectors
          const detectorsResp = await getAvailableDetectors();
          setDetectors(detectorsResp.detectors);
          setCurrentDetector(detectorsResp.current_detector);
          
          // Load classes if detector is loaded
          if (detectorsResp.current_detector) {
            const classesResp = await getDetectorClasses();
            setDetectorClasses(classesResp.classes);
          }
        }
      } catch (e) {
        console.error('Failed to get SAM status:', e);
      }
    };
    checkSAM3();
    
    const interval = setInterval(checkSAM3, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDetectorSwitch = async (detectorId: string) => {
    try {
      const resp = await switchDetector(detectorId);
      if (resp.success) {
        setCurrentDetector(resp.detector_id);
        setDetectorClasses(resp.classes);
      }
    } catch (e) {
      console.error('Failed to switch detector:', e);
    }
    setShowDetectorDropdown(false);
  };

  const handleAutoAnnotate = async () => {
    if (!sessionId || !currentImageId || !currentDetector) {
      console.error('Missing sessionId, currentImageId, or detector');
      return;
    }
    
    setIsAutoAnnotating(true);
    try {
      const response = await autoAnnotate(sessionId, {
        image_id: currentImageId,
        detector_id: currentDetector,
        confidence: 0.25, // Lower confidence to detect more objects
      });
      
      if (response.results.length === 0) {
        alert('No objects detected in this image.');
        return;
      }
      
      // Assign class 0 (first user class) to all detected objects
      const firstClassName = userClasses[0] || 'item';
      const mappedResults = response.results.map(r => ({
        class_id: 0,
        class_name: firstClassName,
        polygon: r.polygon.points,
        polygon_normalized: r.polygon_normalized,
        bbox: r.bbox || { x_min: 0, y_min: 0, x_max: 0, y_max: 0 },
        score: r.score,
      }));
      
      if (onAutoAnnotate) {
        onAutoAnnotate(mappedResults);
      }
      
      console.log(`Auto-annotated ${response.total_instances} objects`);
    } catch (error: any) {
      console.error('Auto-annotation failed:', error);
      const message = error.response?.data?.detail || error.message || 'Auto-annotation failed';
      alert(message);
    } finally {
      setIsAutoAnnotating(false);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="mr-4">
        <div className="font-bold text-lg text-white leading-tight">
          SAM <span className="text-blue-400">Annotator</span>
        </div>
        <div className="text-xs text-gray-500 leading-none">
          by sajadulakash
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700" />

      {/* Tool selection */}
      <div className="flex items-center gap-1">
        <ToolButton
          icon={<MousePointer className="w-5 h-5" />}
          label="Select (V)"
          active={toolMode === 'select'}
          onClick={() => setToolMode('select')}
        />
        <ToolButton
          icon={<Square className="w-5 h-5" />}
          label="BBox (B)"
          active={toolMode === 'bbox'}
          onClick={() => setToolMode('bbox')}
        />
        <ToolButton
          icon={<Lasso className="w-5 h-5" />}
          label="Lasso (L)"
          active={toolMode === 'lasso'}
          onClick={() => setToolMode('lasso')}
        />
      </div>

      {/* Lasso mode toggle (shown when lasso tool is active) */}
      {toolMode === 'lasso' && (
        <>
          <div className="w-px h-8 bg-gray-700" />
          <div className="flex items-center gap-1">
            <ToolButton
              icon={<Plus className="w-5 h-5 text-green-400" />}
              label="Add Mask"
              active={lassoMode === 'add'}
              onClick={() => setLassoMode('add')}
            />
            <ToolButton
              icon={<Minus className="w-5 h-5 text-red-400" />}
              label="Subtract Mask"
              active={lassoMode === 'subtract'}
              onClick={() => setLassoMode('subtract')}
            />
          </div>
        </>
      )}

      {/* SAM3 Auto Annotation (shown when SAM3 is active) */}
      {isSam3 && (
        <>
          <div className="w-px h-8 bg-gray-700" />
          
          {/* Detector selector */}
          <div className="relative">
            <button
              onClick={() => setShowDetectorDropdown(!showDetectorDropdown)}
              className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white hover:bg-gray-600"
            >
              <Cpu className="w-4 h-4 text-orange-400" />
              <span className="max-w-24 truncate">
                {currentDetector || 'No Detector'}
              </span>
            </button>
            
            {showDetectorDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg z-50 min-w-48">
                {detectors.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    No detectors found in detectors folder
                  </div>
                ) : (
                  detectors.map((detector) => (
                    <button
                      key={detector.id}
                      onClick={() => handleDetectorSwitch(detector.id)}
                      className={clsx(
                        'w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex justify-between items-center',
                        detector.is_loaded && 'bg-orange-900/30'
                      )}
                    >
                      <span className="text-white">{detector.name}</span>
                      <span className="text-gray-500 text-xs">{detector.size}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* Auto Annotate button */}
          <button
            onClick={handleAutoAnnotate}
            disabled={!currentDetector || isAutoAnnotating || !sessionId || !currentImageId}
            className="btn btn-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1 disabled:opacity-50"
            title={`Auto-annotate using ${currentDetector || 'detector'} (detects: ${detectorClasses.map(c => c.name).join(', ') || 'no classes loaded'})`}
          >
            {isAutoAnnotating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Cpu className="w-4 h-4" />
            )}
            Auto Annotate
          </button>
        </>
      )}

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <ToolButton
          icon={<Undo className="w-5 h-5" />}
          label="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={undo}
        />
        <ToolButton
          icon={<Redo className="w-5 h-5" />}
          label="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={redo}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={currentImageIndex === 0}
          className="btn btn-ghost btn-sm flex items-center gap-1 disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>
        
        <span className="text-sm text-gray-400 min-w-[80px] text-center">
          {currentImageIndex + 1} / {images.length}
        </span>
        
        <button
          onClick={onNext}
          disabled={currentImageIndex >= images.length - 1}
          className="btn btn-ghost btn-sm flex items-center gap-1 disabled:opacity-50"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700" />

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={isSaving}
        className={clsx(
          'btn btn-sm flex items-center gap-2',
          hasUnsavedChanges ? 'btn-primary' : 'btn-secondary'
        )}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Save
        {hasUnsavedChanges && <span className="w-2 h-2 bg-yellow-400 rounded-full" />}
      </button>
    </div>
  );
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, active, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={clsx(
        'p-2 rounded-md transition-colors',
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  );
}
