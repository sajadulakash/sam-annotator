/**
 * Left Panel - Dataset info, class list, and image navigation
 */

import { useStore } from '../store/useStore';
import { FolderOpen, Image, Check, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export function LeftPanel() {
  const {
    datasetPath,
    classes,
    images,
    currentImageIndex,
    setCurrentImageIndex,
    hasUnsavedChanges,
  } = useStore();

  const labeledCount = images.filter((img) => img.has_labels).length;
  const progress = images.length > 0 ? (labeledCount / images.length) * 100 : 0;

  const handleImageSelect = (index: number) => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Continue without saving?')) {
        return;
      }
    }
    setCurrentImageIndex(index);
  };

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Dataset info */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
          <FolderOpen className="w-4 h-4" />
          Dataset
        </div>
        <div className="text-white text-sm truncate" title={datasetPath}>
          {datasetPath.split('/').pop() || datasetPath}
        </div>
      </div>

      {/* Progress */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">Progress</span>
          <span className="text-white">
            {labeledCount} / {images.length}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Classes */}
      <div className="p-4 border-b border-gray-700">
        <div className="text-gray-400 text-sm mb-2">Classes ({classes.length})</div>
        <div className="flex flex-wrap gap-1">
          {classes.map((cls, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
              title={`Press ${index + 1} to select`}
            >
              <span className="text-gray-500 mr-1">{index + 1}.</span>
              {cls}
            </span>
          ))}
        </div>
      </div>

      {/* Image list */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-2 text-gray-400 text-sm">
          <Image className="w-4 h-4" />
          Images ({images.length})
        </div>
        <div className="flex-1 overflow-y-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => handleImageSelect(index)}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors',
                index === currentImageIndex && 'bg-blue-900/50 border-l-2 border-blue-500'
              )}
            >
              <span className="flex-1 truncate">
                {image.filename}
              </span>
              {image.has_labels && (
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              )}
              {index === currentImageIndex && (
                <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
