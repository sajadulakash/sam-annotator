/**
 * Right Panel - Object list and settings
 */

import { useStore } from '../store/useStore';
import { 
  Square, 
  Trash2, 
  Settings,
} from 'lucide-react';
import clsx from 'clsx';

export function RightPanel() {
  const {
    classes,
    objects,
    selectedObjectId,
    selectObject,
    updateObject,
    deleteObject,
    maskOpacity,
    setMaskOpacity,
    simplificationEpsilon,
    setSimplificationEpsilon,
  } = useStore();

  const selectedObject = objects.find((obj) => obj.id === selectedObjectId);

  return (
    <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Objects list */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-700 font-semibold text-gray-200 flex items-center justify-between">
          <span>Objects ({objects.length})</span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {objects.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm text-center">
              No objects yet.
              <br />
              Draw a bounding box to start.
            </div>
          ) : (
            objects.map((obj) => (
              <div
                key={obj.id}
                onClick={() => selectObject(obj.id)}
                className={clsx(
                  'p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700/50 transition-colors',
                  selectedObjectId === obj.id && 'bg-blue-900/30 border-l-2 border-l-blue-500'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Square
                      className="w-4 h-4"
                      style={{ color: getClassColor(obj.class_id) }}
                    />
                    <span className="font-medium text-sm">
                      {obj.class_name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteObject(obj.id);
                    }}
                    className="p-1 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  <div>Points: +{obj.points_pos.length} / -{obj.points_neg.length}</div>
                  <div>Polygon: {obj.polygon.length} vertices</div>
                  {obj.score && <div>Score: {(obj.score * 100).toFixed(1)}%</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selected object details */}
      {selectedObject && (
        <div className="border-t border-gray-700 p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">
            Edit Object
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="input-label">Class</label>
              <select
                value={selectedObject.class_id}
                onChange={(e) => {
                  const classId = parseInt(e.target.value);
                  updateObject(selectedObject.id, {
                    class_id: classId,
                    class_name: classes[classId] || `class_${classId}`,
                  });
                }}
                className="input"
              >
                {classes.map((cls, idx) => (
                  <option key={idx} value={idx}>
                    {idx + 1}. {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-3">
          <Settings className="w-4 h-4" />
          Display Settings
        </div>

        <div className="space-y-4">
          {/* Mask opacity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Mask Opacity</label>
              <span className="text-xs text-gray-500">{Math.round(maskOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={maskOpacity * 100}
              onChange={(e) => setMaskOpacity(parseInt(e.target.value) / 100)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Simplification */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Polygon Detail</label>
              <span className="text-xs text-gray-500">{simplificationEpsilon.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={simplificationEpsilon * 10}
              onChange={(e) => setSimplificationEpsilon(parseInt(e.target.value) / 10)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>More Detail</span>
              <span>Simplified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shortcuts help */}
      <div className="border-t border-gray-700 p-4 text-xs text-gray-500">
        <div className="font-medium text-gray-400 mb-2">Shortcuts</div>
        <div className="grid grid-cols-2 gap-1">
          <span><kbd className="kbd">B</kbd> BBox</span>
          <span><kbd className="kbd">P</kbd> Points</span>
          <span><kbd className="kbd">Del</kbd> Delete</span>
          <span><kbd className="kbd">S</kbd> Save</span>
          <span><kbd className="kbd">N</kbd> Next</span>
          <span><kbd className="kbd">⇧N</kbd> Prev</span>
        </div>
      </div>
    </div>
  );
}

// Helper function to get class color
function getClassColor(classId: number): string {
  const colors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#22c55e', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
  ];
  return colors[classId % colors.length];
}
