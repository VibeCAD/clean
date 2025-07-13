import React from 'react';
import { MousePointer2, Move, RotateCw, Scale } from 'lucide-react';
import type { TransformMode } from '../../types/types';

interface TransformToolbarProps {
  transformMode: TransformMode;
  activeDropdown: string | null;
  onTransformModeChange: (mode: TransformMode) => void;
  onToggleDropdown: (dropdown: string) => void;
  onSetActiveDropdown: (dropdown: string | null) => void;
}

const transformModes = [
  { 
    mode: 'select' as TransformMode, 
    icon: MousePointer2, 
    label: 'Select',
    description: 'Select objects'
  },
  { 
    mode: 'move' as TransformMode, 
    icon: Move, 
    label: 'Move',
    description: 'Move objects'
  },
  { 
    mode: 'rotate' as TransformMode, 
    icon: RotateCw, 
    label: 'Rotate',
    description: 'Rotate objects'
  },
  { 
    mode: 'scale' as TransformMode, 
    icon: Scale, 
    label: 'Scale',
    description: 'Scale objects'
  }
] as const;

export const TransformToolbar: React.FC<TransformToolbarProps> = ({
  transformMode,
  activeDropdown,
  onTransformModeChange,
  onToggleDropdown,
  onSetActiveDropdown
}) => {
  const handleModeSelect = (mode: TransformMode) => {
    onTransformModeChange(mode);
    onSetActiveDropdown(null);
  };

  return (
    <div className="toolbar-item">
      <button 
        className={`toolbar-button ${transformMode !== 'select' ? 'active' : ''}`}
        onClick={() => onToggleDropdown('transform')}
      >
        Transform <span className="dropdown-arrow">▼</span>
      </button>
      <div className={`dropdown-menu ${activeDropdown === 'transform' ? 'show' : ''}`}>
        <div className="dropdown-section">
          <div className="dropdown-section-title">Transform Mode</div>
          <div className="dropdown-grid">
            {transformModes.map(({ mode, icon: Icon, label, description }) => (
              <button 
                key={mode}
                className={`dropdown-button ${transformMode === mode ? 'active' : ''}`}
                onClick={() => handleModeSelect(mode)}
                title={description}
              >
                <Icon className="dropdown-icon w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};