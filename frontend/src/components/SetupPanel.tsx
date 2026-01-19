/**
 * Setup Panel - Initial configuration for dataset and classes
 */

import { useState } from 'react';
import { FolderOpen, Tag, ArrowRight, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { initSession } from '../services/api';

interface SetupPanelProps {
  onComplete: () => void;
}

export function SetupPanel({ onComplete }: SetupPanelProps) {
  const [datasetPath, setDatasetPath] = useState('');
  const [classesInput, setClassesInput] = useState('');
  const [imagesSubfolder, setImagesSubfolder] = useState('images');
  const [labelsSubfolder, setLabelsSubfolder] = useState('labels');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setSession } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Parse classes
    const classes = classesInput
      .split(/[,\n]/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (!datasetPath.trim()) {
      setError('Please enter a dataset path');
      return;
    }

    if (classes.length === 0) {
      setError('Please enter at least one class');
      return;
    }

    setIsLoading(true);

    try {
      const response = await initSession({
        dataset_path: datasetPath.trim(),
        classes,
        images_subfolder: imagesSubfolder || undefined,
        labels_subfolder: labelsSubfolder || undefined,
      });

      setSession(
        response.session_id,
        response.dataset_path,
        response.classes,
        response.images
      );

      onComplete();
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to initialize session';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">
            SAM3 <span className="text-blue-400">Annotator</span>
          </h1>
          <p className="text-sm text-gray-500 mb-3">
            by sajadulakash
          </p>
          <p className="text-gray-400">
            Configure your dataset to start annotating
          </p>
        </div>

        {/* Setup form */}
        <div className="panel">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Dataset path */}
            <div>
              <label className="input-label flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Dataset Path
              </label>
              <input
                type="text"
                value={datasetPath}
                onChange={(e) => setDatasetPath(e.target.value)}
                placeholder="/path/to/your/dataset"
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                Absolute path to your dataset folder
              </p>
            </div>

            {/* Subfolders */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Images Subfolder</label>
                <input
                  type="text"
                  value={imagesSubfolder}
                  onChange={(e) => setImagesSubfolder(e.target.value)}
                  placeholder="images"
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">Labels Subfolder</label>
                <input
                  type="text"
                  value={labelsSubfolder}
                  onChange={(e) => setLabelsSubfolder(e.target.value)}
                  placeholder="labels"
                  className="input"
                />
              </div>
            </div>

            {/* Classes */}
            <div>
              <label className="input-label flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Class Names
              </label>
              <textarea
                value={classesInput}
                onChange={(e) => setClassesInput(e.target.value)}
                placeholder="person&#10;car&#10;bicycle&#10;dog"
                rows={5}
                className="input resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter class names separated by commas or new lines
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading Dataset...
                </>
              ) : (
                <>
                  Start Annotating
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Help text */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Expected structure:</p>
          <pre className="mt-2 text-xs bg-gray-800 rounded p-3 text-left inline-block">
{`dataset/
  images/
    img001.jpg
    img002.png
  labels/  (will be created)`}
          </pre>
        </div>
      </div>
    </div>
  );
}
