/**
 * ImportWizard Component
 *
 * A step-by-step wizard for importing collections from various sources:
 * - Postman
 * - Insomnia
 * - OpenAPI/Swagger
 * - cURL
 * - HAR (coming soon)
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  detectImportFormat,
  importFile,
  getSupportedFormats,
} from '../../services/import';
import { trackEvent } from '../../services/analytics';

// Types
interface ImportWarning {
  type: string;
  message: string;
  resourceId?: string;
  resourceName?: string;
}

interface ParsedEnvironment {
  id: string;
  name: string;
  variables: Array<{ key: string; value: string; enabled: boolean }>;
}

interface ImportWizardProps {
  onImportComplete?: (result: ImportResult) => void;
  onCancel?: () => void;
}

interface ImportResult {
  type: 'collection' | 'environment' | 'request' | 'requests';
  data: unknown;
  warnings?: ImportWarning[];
  environments?: ParsedEnvironment[];
}

type WizardStep = 'select-source' | 'upload' | 'preview' | 'configure' | 'complete';

export const ImportWizard: React.FC<ImportWizardProps> = ({
  onImportComplete,
  onCancel,
}) => {
  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>('select-source');
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importOptions, setImportOptions] = useState({
    importEnvironments: true,
    createNewCollection: true,
    collectionName: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supportedFormats = getSupportedFormats();

  // Handle format selection
  const handleFormatSelect = useCallback((formatId: string) => {
    setSelectedFormat(formatId);
    setCurrentStep('upload');
    setError(null);
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      setError(null);

      try {
        const content = await file.text();
        setFileContent(content);
        setFileName(file.name);

        // Auto-detect format if not selected
        const detectedFormat = detectImportFormat(content);
        if (!selectedFormat && detectedFormat !== 'unknown') {
          setSelectedFormat(detectedFormat);
        }

        // Parse the file
        const result = await importFile(content, selectedFormat as any);
        setImportResult(result);

        // Set default collection name from file
        setImportOptions((prev) => ({
          ...prev,
          collectionName: file.name.replace(/\.[^/.]+$/, ''),
        }));

        setCurrentStep('preview');

        // Track import event
        trackEvent('import_started', {
          format: selectedFormat || detectedFormat,
          file_size: content.length,
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedFormat]
  );

  // Handle drag and drop
  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const file = event.dataTransfer.files[0];
      if (!file) return;

      // Create a synthetic event for the file input handler
      const syntheticEvent = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      await handleFileUpload(syntheticEvent);
    },
    [handleFileUpload]
  );

  // Handle paste
  const handlePaste = useCallback(
    async (content: string) => {
      setIsLoading(true);
      setError(null);

      try {
        setFileContent(content);
        setFileName('Pasted content');

        const detectedFormat = detectImportFormat(content);
        if (!selectedFormat && detectedFormat !== 'unknown') {
          setSelectedFormat(detectedFormat);
        }

        const result = await importFile(content, selectedFormat as any);
        setImportResult(result);

        setImportOptions((prev) => ({
          ...prev,
          collectionName: 'Imported Collection',
        }));

        setCurrentStep('preview');
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedFormat]
  );

  // Handle import confirmation
  const handleConfirmImport = useCallback(async () => {
    if (!importResult) return;

    setIsLoading(true);

    try {
      // Track completion
      trackEvent('import_completed', {
        format: selectedFormat || 'unknown',
        type: importResult.type,
        warnings_count: importResult.warnings?.length || 0,
      });

      onImportComplete?.(importResult);
      setCurrentStep('complete');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [importResult, selectedFormat, onImportComplete]);

  // Reset wizard
  const handleReset = useCallback(() => {
    setCurrentStep('select-source');
    setSelectedFormat(null);
    setFileContent(null);
    setFileName(null);
    setImportResult(null);
    setError(null);
    setImportOptions({
      importEnvironments: true,
      createNewCollection: true,
      collectionName: '',
    });
  }, []);

  // Render step indicator
  const renderStepIndicator = () => {
    const steps = [
      { id: 'select-source', label: 'Source' },
      { id: 'upload', label: 'Upload' },
      { id: 'preview', label: 'Preview' },
      { id: 'complete', label: 'Complete' },
    ];

    const currentIndex = steps.findIndex((s) => s.id === currentStep);

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                index <= currentIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`ml-2 text-sm ${
                index <= currentIndex ? 'text-white' : 'text-gray-500'
              }`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-4 ${
                  index < currentIndex ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Render source selection step
  const renderSourceSelection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-center mb-6">
        Select Import Source
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {supportedFormats.map((format) => (
          <button
            key={format.id}
            onClick={() => handleFormatSelect(format.id)}
            disabled={format.id === 'har'}
            className={`p-4 rounded-lg border text-left transition-colors ${
              format.id === 'har'
                ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                : 'border-gray-600 bg-gray-800 hover:border-blue-500 hover:bg-gray-700'
            }`}
          >
            <div className="font-medium text-white">{format.name}</div>
            <div className="text-sm text-gray-400 mt-1">{format.description}</div>
            <div className="text-xs text-gray-500 mt-2">
              {format.extensions.join(', ')}
            </div>
          </button>
        ))}
      </div>
      <div className="text-center mt-6">
        <button
          onClick={() => {
            setSelectedFormat(null);
            setCurrentStep('upload');
          }}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Or upload a file and auto-detect format
        </button>
      </div>
    </div>
  );

  // Render upload step
  const renderUploadStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-center">
        {selectedFormat
          ? `Import ${supportedFormats.find((f) => f.id === selectedFormat)?.name}`
          : 'Upload File'}
      </h3>

      {/* Drag and drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          accept={
            selectedFormat
              ? supportedFormats
                  .find((f) => f.id === selectedFormat)
                  ?.extensions.join(',')
              : '.json,.yaml,.yml,.txt,.sh,.har'
          }
          className="hidden"
        />
        <div className="text-4xl mb-4">📁</div>
        <div className="text-white font-medium">
          Drop file here or click to browse
        </div>
        <div className="text-gray-400 text-sm mt-2">
          {selectedFormat
            ? `Supported: ${supportedFormats.find((f) => f.id === selectedFormat)?.extensions.join(', ')}`
            : 'JSON, YAML, or text files'}
        </div>
      </div>

      {/* Paste option */}
      <div className="text-center">
        <div className="text-gray-400 text-sm mb-2">Or paste content directly:</div>
        <textarea
          placeholder="Paste your collection, cURL command, or API spec here..."
          className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-sm font-mono resize-none focus:border-blue-500 focus:outline-none"
          onPaste={(e) => {
            const content = e.clipboardData.getData('text');
            if (content) {
              handlePaste(content);
            }
          }}
        />
      </div>

      {/* Back button */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('select-source')}
          className="px-4 py-2 text-gray-400 hover:text-white"
        >
          ← Back
        </button>
      </div>
    </div>
  );

  // Render preview step
  const renderPreviewStep = () => {
    if (!importResult) return null;

    const collections = Array.isArray(importResult.data)
      ? importResult.data
      : [importResult.data];

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-medium text-center">Preview Import</h3>

        {/* File info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">{fileName}</div>
              <div className="text-sm text-gray-400">
                Format: {supportedFormats.find((f) => f.id === selectedFormat)?.name || 'Auto-detected'}
              </div>
            </div>
            <div className="text-green-400">✓ Parsed successfully</div>
          </div>
        </div>

        {/* Import summary */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Import Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Type:</span>
              <span className="text-white capitalize">{importResult.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Collections:</span>
              <span className="text-white">{collections.length}</span>
            </div>
            {importResult.environments && (
              <div className="flex justify-between">
                <span className="text-gray-400">Environments:</span>
                <span className="text-white">{importResult.environments.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Warnings */}
        {importResult.warnings && importResult.warnings.length > 0 && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
            <h4 className="font-medium text-yellow-400 mb-3">
              ⚠️ Warnings ({importResult.warnings.length})
            </h4>
            <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
              {importResult.warnings.map((warning, index) => (
                <div key={index} className="text-yellow-200">
                  • {warning.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import options */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Import Options</h4>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={importOptions.createNewCollection}
                onChange={(e) =>
                  setImportOptions((prev) => ({
                    ...prev,
                    createNewCollection: e.target.checked,
                  }))
                }
                className="rounded"
              />
              <span className="text-sm text-gray-300">Create new collection</span>
            </label>
            {importOptions.createNewCollection && (
              <input
                type="text"
                value={importOptions.collectionName}
                onChange={(e) =>
                  setImportOptions((prev) => ({
                    ...prev,
                    collectionName: e.target.value,
                  }))
                }
                placeholder="Collection name"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
              />
            )}
            {importResult.environments && importResult.environments.length > 0 && (
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={importOptions.importEnvironments}
                  onChange={(e) =>
                    setImportOptions((prev) => ({
                      ...prev,
                      importEnvironments: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <span className="text-sm text-gray-300">
                  Import environments ({importResult.environments.length})
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentStep('upload')}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    );
  };

  // Render complete step
  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="text-6xl">✅</div>
      <h3 className="text-xl font-medium text-white">Import Complete!</h3>
      <p className="text-gray-400">
        Your collection has been imported successfully.
      </p>
      {importResult?.warnings && importResult.warnings.length > 0 && (
        <p className="text-yellow-400 text-sm">
          {importResult.warnings.length} warning(s) - some features may need manual configuration.
        </p>
      )}
      <div className="flex justify-center gap-4">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
        >
          Import Another
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          Done
        </button>
      </div>
    </div>
  );

  // Render error
  const renderError = () =>
    error && (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-red-400">❌</span>
          <div>
            <div className="font-medium text-red-400">Import Error</div>
            <div className="text-sm text-red-200 mt-1">{error}</div>
          </div>
        </div>
        <button
          onClick={() => setError(null)}
          className="mt-3 text-sm text-red-400 hover:text-red-300"
        >
          Dismiss
        </button>
      </div>
    );

  // Render loading
  const renderLoading = () =>
    isLoading && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <div className="text-white">Processing...</div>
        </div>
      </div>
    );

  return (
    <div className="bg-gray-900 text-white rounded-lg p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Import Collection</h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white text-xl"
        >
          ×
        </button>
      </div>

      {/* Step indicator */}
      {renderStepIndicator()}

      {/* Error display */}
      {renderError()}

      {/* Step content */}
      {currentStep === 'select-source' && renderSourceSelection()}
      {currentStep === 'upload' && renderUploadStep()}
      {currentStep === 'preview' && renderPreviewStep()}
      {currentStep === 'complete' && renderCompleteStep()}

      {/* Loading overlay */}
      {renderLoading()}
    </div>
  );
};

export default ImportWizard;