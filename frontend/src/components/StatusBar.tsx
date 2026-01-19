/**
 * Status Bar Component - Bottom status bar
 */

import { useStore } from '../store/useStore';
import { Cpu, Clock } from 'lucide-react';

export function StatusBar() {
  const {
    currentImage,
    toolMode,
    pointType,
    scale,
    objects,
    isLoading,
  } = useStore();

  return (
    <div className="h-8 bg-gray-800 border-t border-gray-700 flex items-center px-4 text-xs text-gray-400">
      {/* Current image info */}
      {currentImage && (
        <div className="flex items-center gap-4">
          <span>{currentImage.filename}</span>
          <span>{currentImage.width} × {currentImage.height}</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Tool info */}
      <div className="flex items-center gap-4">
        <span>
          Tool: <span className="text-white capitalize">{toolMode}</span>
          {toolMode === 'point' && (
            <span className={pointType === 'positive' ? 'text-green-400' : 'text-red-400'}>
              {' '}({pointType})
            </span>
          )}
        </span>

        <span>
          Zoom: <span className="text-white">{Math.round(scale * 100)}%</span>
        </span>

        <span>
          Objects: <span className="text-white">{objects.length}</span>
        </span>

        {isLoading && (
          <span className="flex items-center gap-1 text-blue-400">
            <Cpu className="w-3 h-3 animate-pulse" />
            Processing...
          </span>
        )}
      </div>
    </div>
  );
}
