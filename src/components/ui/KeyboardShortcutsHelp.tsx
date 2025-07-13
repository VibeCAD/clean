import React, { useState } from 'react';

interface KeyboardShortcutsHelpProps {
  position?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  position = { top: '80px', right: '20px' }
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const shortcuts = [
    { key: 'Ctrl+A', desc: 'Select All' },
    { key: 'Ctrl+I', desc: 'Invert Selection' },
    { key: 'Ctrl+D', desc: 'Duplicate' },
    { key: 'Ctrl+T', desc: 'Reset Transform' },
    { key: 'Ctrl+G', desc: 'Toggle Snap to Grid' },
    { key: 'M', desc: 'Move Mode' },
    { key: 'R', desc: 'Rotate Mode' },
    { key: 'S', desc: 'Scale Mode' },
    { key: 'Delete', desc: 'Delete Selected' },
    { key: 'Esc', desc: 'Deselect All' }
  ];

  return (
    <div 
      style={{
        position: 'fixed',
        zIndex: 10000,
        ...position
      }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {/* Help Icon */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#3b82f6',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'help',
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          transition: 'all 0.2s ease'
        }}
      >
        ?
      </div>

      {/* Shortcuts Tooltip */}
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '0',
            width: '280px',
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            padding: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            zIndex: 10001
          }}
        >
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '12px',
            textAlign: 'center'
          }}>
            ⌨️ Keyboard Shortcuts
          </div>
          <div style={{
            display: 'grid',
            gap: '8px'
          }}>
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0'
                }}
              >
                <span style={{
                  fontFamily: 'monospace',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  {shortcut.key}
                </span>
                <span style={{
                  color: '#6b7280',
                  fontSize: '12px'
                }}>
                  {shortcut.desc}
                </span>
              </div>
            ))}
          </div>
          {/* Arrow pointing to the icon */}
          <div style={{
            position: 'absolute',
            top: '-6px',
            right: '10px',
            width: '12px',
            height: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderBottom: 'none',
            borderRight: 'none',
            transform: 'rotate(45deg)'
          }}></div>
        </div>
      )}
    </div>
  );
};

export default KeyboardShortcutsHelp; 