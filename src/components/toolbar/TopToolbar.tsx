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