/**
 * KeyValueEditor Component
 * 
 * A reusable component for editing key-value pairs.
 * Used for request params, headers, form data, etc.
 */

import React, { useCallback } from 'react';
import { nanoid } from 'nanoid';
import type { KeyValuePair } from '../../stores';

interface KeyValueEditorProps {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  showDescription?: boolean;
  readOnly?: boolean;
  bulkEditMode?: boolean;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  items,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  showDescription = false,
  readOnly = false,
  bulkEditMode = false,
}) => {
  // Add a new empty row
  const addRow = useCallback(() => {
    const newItem: KeyValuePair = {
      id: nanoid(),
      key: '',
      value: '',
      description: '',
      enabled: true,
    };
    onChange([...items, newItem]);
  }, [items, onChange]);

  // Update a specific row
  const updateRow = useCallback((id: string, field: keyof KeyValuePair, value: string | boolean) => {
    onChange(
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }, [items, onChange]);

  // Delete a row
  const deleteRow = useCallback((id: string) => {
    onChange(items.filter(item => item.id !== id));
  }, [items, onChange]);

  // Toggle row enabled state
  const toggleRow = useCallback((id: string) => {
    onChange(
      items.map(item =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
  }, [items, onChange]);

  // Handle bulk edit mode
  const handleBulkEdit = useCallback((text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const newItems: KeyValuePair[] = lines.map(line => {
      const [key, ...valueParts] = line.split(':');
      return {
        id: nanoid(),
        key: key?.trim() || '',
        value: valueParts.join(':').trim(),
        description: '',
        enabled: true,
      };
    });
    onChange(newItems);
  }, [onChange]);

  // Convert items to bulk edit text
  const toBulkText = useCallback(() => {
    return items
      .filter(item => item.key || item.value)
      .map(item => `${item.key}: ${item.value}`)
      .join('\n');
  }, [items]);

  if (bulkEditMode) {
    return (
      <div className="h-full">
        <textarea
          value={toBulkText()}
          onChange={(e) => handleBulkEdit(e.target.value)}
          placeholder="key: value&#10;another-key: another-value"
          className="w-full h-full p-3 bg-background border border-border rounded-lg text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-primary"
          readOnly={readOnly}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-text-muted uppercase">
        <div className="w-6" /> {/* Checkbox space */}
        <div className="flex-1">{keyPlaceholder}</div>
        <div className="flex-1">{valuePlaceholder}</div>
        {showDescription && <div className="flex-1">Description</div>}
        <div className="w-8" /> {/* Delete button space */}
      </div>

      {/* Data rows */}
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-surface/50 group ${
            !item.enabled ? 'opacity-50' : ''
          }`}
        >
          {/* Enable/disable checkbox */}
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={() => toggleRow(item.id)}
            disabled={readOnly}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 bg-background"
          />

          {/* Key input */}
          <input
            type="text"
            value={item.key}
            onChange={(e) => updateRow(item.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            disabled={readOnly || !item.enabled}
            className="flex-1 px-2 py-1 bg-transparent border border-transparent hover:border-border focus:border-primary rounded text-sm text-text-primary placeholder-text-muted focus:outline-none disabled:cursor-not-allowed"
          />

          {/* Value input */}
          <input
            type="text"
            value={item.value}
            onChange={(e) => updateRow(item.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            disabled={readOnly || !item.enabled}
            className="flex-1 px-2 py-1 bg-transparent border border-transparent hover:border-border focus:border-primary rounded text-sm text-text-primary placeholder-text-muted focus:outline-none disabled:cursor-not-allowed"
          />

          {/* Description input (optional) */}
          {showDescription && (
            <input
              type="text"
              value={item.description || ''}
              onChange={(e) => updateRow(item.id, 'description', e.target.value)}
              placeholder="Description"
              disabled={readOnly || !item.enabled}
              className="flex-1 px-2 py-1 bg-transparent border border-transparent hover:border-border focus:border-primary rounded text-sm text-text-muted placeholder-text-muted focus:outline-none disabled:cursor-not-allowed"
            />
          )}

          {/* Delete button */}
          <button
            onClick={() => deleteRow(item.id)}
            disabled={readOnly}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-error rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
            title="Delete row"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add row button */}
      {!readOnly && (
        <button
          onClick={addRow}
          className="flex items-center gap-2 px-2 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-surface/50 rounded transition-colors w-full"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add {keyPlaceholder.toLowerCase()}
        </button>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-8 text-text-muted text-sm">
          No {keyPlaceholder.toLowerCase()}s added yet.
          {!readOnly && (
            <button
              onClick={addRow}
              className="block mx-auto mt-2 text-primary hover:underline"
            >
              Add your first {keyPlaceholder.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default KeyValueEditor;