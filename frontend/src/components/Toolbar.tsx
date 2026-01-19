/**
 * Toolbar Component - Main toolbar with tools and actions
 */

import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  Square,
  MousePointer,
  CircleDot,
  Save,
  ChevronLeft,
  ChevronRight,
  Undo,
  Redo,
  Plus,
  Minus,
  Loader2,
  Type,
  Search,
} from 'lucide-react';
import clsx from 'clsx';
import { getSAMStatus } from '../services/api';

interface ToolbarProps {
  onSave: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTextPredict?: (textPrompt: string) => void;
}

export function Toolbar({ onSave, onPrev, onNext, onTextPredict }: ToolbarProps) {
  const {
    toolMode,
    setToolMode,
    pointType,
    setPointType,
    currentImageIndex,
    images,
    hasUnsavedChanges,
    isSaving,
    history,
    historyIndex,
    undo,
    redo,
  } = useStore();

  const [isSam3, setIsSam3] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');
  const [isTextPredicting, setIsTextPredicting] = useState(false);

  // Check if SAM3 is active
  useEffect(() => {
    const checkSAM3 = async () => {
      try {
        const status = await getSAMStatus();
        setIsSam3(status.is_sam3);
      } catch (e) {
        console.error('Failed to get SAM status:', e);
      }
    };
    checkSAM3();
    
    // Periodically check (in case model is switched)
    const interval = setInterval(checkSAM3, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTextPredict = async () => {
    if (!textPrompt.trim() || !onTextPredict) return;
    setIsTextPredicting(true);
    try {
      await onTextPredict(textPrompt.trim());
    } finally {
      setIsTextPredicting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextPredict();
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
          icon={<CircleDot className="w-5 h-5" />}
          label="Points (P)"
          active={toolMode === 'point'}
          onClick={() => setToolMode('point')}
        />
      </div>

      {/* Point type toggle (shown when point tool is active) */}
      {toolMode === 'point' && (
        <>
          <div className="w-px h-8 bg-gray-700" />
          <div className="flex items-center gap-1">
            <ToolButton
              icon={<Plus className="w-5 h-5 text-green-400" />}
              label="Positive (+)"
              active={pointType === 'positive'}
              onClick={() => setPointType('positive')}
            />
            <ToolButton
              icon={<Minus className="w-5 h-5 text-red-400" />}
              label="Negative (-)"
              active={pointType === 'negative'}
              onClick={() => setPointType('negative')}
            />
          </div>
        </>
      )}

      {/* SAM3 Text Prompt (shown when SAM3 is active) */}
      {isSam3 && (
        <>
          <div className="w-px h-8 bg-gray-700" />
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-purple-400" />
            <input
              type="text"
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., person, dog, car..."
              className="w-40 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              disabled={isTextPredicting}
            />
            <button
              onClick={handleTextPredict}
              disabled={!textPrompt.trim() || isTextPredicting}
              className="btn btn-sm bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 disabled:opacity-50"
              title="Segment all matching objects (Enter)"
            >
              {isTextPredicting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Find
            </button>
          </div>
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
