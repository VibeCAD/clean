import React from 'react';
import { TransformToolbar } from './transform';
import type { TransformMode, PrimitiveType } from '../../types/types';

interface TopToolbarProps {
  transformMode: TransformMode;
  activeDropdown: string | null;
  snapToGrid: boolean;
  gridSize: number;
  collisionDetectionEnabled: boolean;
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  movementEnabled: boolean;
  movementSpeed: number;
  sceneInitialized: boolean;
  onTransformModeChange: (mode: TransformMode) => void;
  onToggleDropdown: (dropdown: string) => void;
  onSetActiveDropdown: (dropdown: string | null) => void;
  onCreatePrimitive: (type: Exclude<PrimitiveType, 'nurbs'>) => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  transformMode,
  activeDropdown,
  snapToGrid,
  gridSize,
  collisionDetectionEnabled,
  selectedObjectId,
  selectedObjectIds,
  movementEnabled,
  movementSpeed,
  sceneInitialized,
  onTransformModeChange,
  onToggleDropdown,
  onSetActiveDropdown,
  onCreatePrimitive
}) => {
  return (
    <div className="top-toolbar">
      <div className="toolbar-menu">
        <div className="text-4xl font-bold text-pink-500">MOORPH</div>
        
        <div className="toolbar-status">
          <span className="status-item">
            <span className="status-label">Mode:</span>
            <span className={`status-value ${transformMode}`}>{transformMode.toUpperCase()}</span>
          </span>
          <span className="status-item">
            <span className="status-label">Grid:</span>
            <span className={`status-value ${snapToGrid ? 'on' : 'off'}`}>
              {snapToGrid ? `ON (${gridSize})` : 'OFF'}
            </span>
          </span>
          <span className="status-item">
            <span className="status-label">Collision:</span>
            <span className={`status-value ${collisionDetectionEnabled ? 'on' : 'off'}`}>
              {collisionDetectionEnabled ? 'ON' : 'OFF'}
            </span>
          </span>
          <span className="status-item">
            <span className="status-label">Selected:</span>
            <span className="status-value">
              {selectedObjectId ? '1' : selectedObjectIds.length}
            </span>
          </span>
          <span 
            className="status-item"
            title={movementEnabled 
              ? `WASD Movement is ENABLED. Speed: ${movementSpeed.toFixed(2)} units/frame. Use WASD keys to navigate, Q/E for vertical movement, Shift to sprint.`
              : 'WASD Movement is DISABLED. Enable in Tools menu to use keyboard navigation.'
            }
          >
            <span className="status-label">Movement:</span>
            <span className={`status-value ${movementEnabled ? 'on' : 'off'}`}>
              {movementEnabled ? `WASD (${movementSpeed.toFixed(2)})` : 'OFF'}
            </span>
          </span>
          {/* Quick test button */}
          <button 
            className="test-button"
            onClick={() => onCreatePrimitive('cube')}
            disabled={!sceneInitialized}
            style={{
              marginLeft: '10px',
              padding: '4px 8px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🧪 Add Test Cube
          </button>
        </div>
        
        {/* Transform Tools */}
        <TransformToolbar
          transformMode={transformMode}
          activeDropdown={activeDropdown}
          onTransformModeChange={onTransformModeChange}
          onToggleDropdown={onToggleDropdown}
          onSetActiveDropdown={onSetActiveDropdown}
        />
        
        {/* TODO: Other toolbar sections will go here */}
        
      </div>
    </div>
  );
};