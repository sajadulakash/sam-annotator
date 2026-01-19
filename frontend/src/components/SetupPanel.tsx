/**
 * Setup Panel - Initial configuration for dataset and classes
 */

import { useState, useEffect } from 'react';
import { FolderOpen, Tag, ArrowRight, Loader2, Cpu, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { initSession, getAvailableModels, switchModel, type ModelInfo } from '../services/api';

// LocalStorage key for persisting configuration
const CONFIG_STORAGE_KEY = 'sam-annotator-config';

interface SavedConfig {
  datasetPath: string;
  classesInput: string;
  imagesSubfolder: string;
  labelsSubfolder: string;
  selectedModelId: string;
}

interface SetupPanelProps {
  onComplete: () => void;
}

export function SetupPanel({ onComplete }: SetupPanelProps) {
  // Load saved config from localStorage
  const loadSavedConfig = (): SavedConfig => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load saved config:', e);
    }
    return {
      datasetPath: '',
      classesInput: '',
      imagesSubfolder: 'images',
      labelsSubfolder: 'labels',
      selectedModelId: 'sam2_small',
    };
  };

  const savedConfig = loadSavedConfig();

  const [datasetPath, setDatasetPath] = useState(savedConfig.datasetPath);
  const [classesInput, setClassesInput] = useState(savedConfig.classesInput);
  const [imagesSubfolder, setImagesSubfolder] = useState(savedConfig.imagesSubfolder);
  const [labelsSubfolder, setLabelsSubfolder] = useState(savedConfig.labelsSubfolder);
  const [selectedModelId, setSelectedModelId] = useState(savedConfig.selectedModelId);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Model state
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [modelsLoading, setModelsLoading] = useState(true);

  const { setSession } = useStore();

  // Load available models on mount
  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      const response = await getAvailableModels();
      setModels(response.models);
      setCurrentModel(response.current_model);
      
      // If saved model is different from current, switch to it
      if (savedConfig.selectedModelId && savedConfig.selectedModelId !== response.current_model) {
        const savedModelExists = response.models.some(m => m.id === savedConfig.selectedModelId);
        if (savedModelExists) {
          await handleModelSwitch(savedConfig.selectedModelId, false);
        }
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    } finally {
      setModelsLoading(false);
    }
  };

  // Save config to localStorage whenever it changes
  useEffect(() => {
    const config: SavedConfig = {
      datasetPath,
      classesInput,
      imagesSubfolder,
      labelsSubfolder,
      selectedModelId,
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [datasetPath, classesInput, imagesSubfolder, labelsSubfolder, selectedModelId]);

  const handleModelSwitch = async (modelId: string, showLoading = true) => {
    if (modelId === currentModel) return;
    
    if (showLoading) setIsSwitchingModel(true);
    setError(null);
    
    try {
      await switchModel(modelId);
      setCurrentModel(modelId);
      setSelectedModelId(modelId);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to switch model';
      setError(message);
    } finally {
      if (showLoading) setIsSwitchingModel(false);
    }
  };

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
            SAM <span className="text-blue-400">Annotator</span>
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
            {/* Model Selection */}
            <div>
              <label className="input-label flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                SAM Model
              </label>
              {modelsLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading models...
                </div>
              ) : (
                <div className="space-y-2">
                  {models.map((model) => (
                    <label
                      key={model.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        currentModel === model.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      } ${isSwitchingModel ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={model.id}
                        checked={currentModel === model.id}
                        onChange={() => handleModelSwitch(model.id)}
                        className="mt-1"
                        disabled={isSwitchingModel}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{model.name}</span>
                          <span className="text-xs text-gray-500">({model.size})</span>
                          {currentModel === model.id && (
                            <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{model.description}</p>
                      </div>
                      {isSwitchingModel && selectedModelId === model.id && (
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

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
              disabled={isLoading || isSwitchingModel}
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
