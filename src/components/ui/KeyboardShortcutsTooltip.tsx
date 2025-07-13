import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';

interface ShortcutItem {
  key: string;
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { key: 'Ctrl+A', description: 'Select All' },
  { key: 'Ctrl+I', description: 'Invert Selection' },
  { key: 'Ctrl+D', description: 'Duplicate' },
  { key: 'Ctrl+T', description: 'Reset Transform' },
  { key: 'Ctrl+G', description: 'Toggle Snap to Grid' },
  { key: 'M', description: 'Move Mode' },
  { key: 'R', description: 'Rotate Mode' },
  { key: 'S', description: 'Scale Mode' },
  { key: 'Delete', description: 'Delete Selected' },
  { key: 'Esc', description: 'Deselect All' },
  { key: 'Ctrl+V', description: 'Toggle Voice Input' },
];

export const KeyboardShortcutsTooltip: React.FC = () => {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button 
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 border border-gray-300 hover:border-gray-400 cursor-help"
            aria-label="View keyboard shortcuts"
          >
            <HelpCircle className="w-4 h-4 text-gray-600" />
          </button>
        </Tooltip.Trigger>
        
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-[9999] max-w-xs p-3 bg-white border border-gray-300 rounded-lg shadow-xl"
            sideOffset={5}
            side="left"
            style={{
              zIndex: 9999,
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              maxWidth: '300px'
            }}
          >
            <div style={{ color: '#1f2937', lineHeight: '1.4' }}>
              <h4 style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#111827', 
                marginBottom: '8px',
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: '6px'
              }}>
                Keyboard Shortcuts
              </h4>
              <div style={{ display: 'grid', gap: '6px' }}>
                {shortcuts.map((shortcut, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '12px',
                    fontSize: '12px'
                  }}>
                    <span style={{
                      fontFamily: 'monospace',
                      backgroundColor: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: '#374151',
                      whiteSpace: 'nowrap',
                      fontWeight: '500'
                    }}>
                      {shortcut.key}
                    </span>
                    <span style={{
                      color: '#6b7280',
                      textAlign: 'left',
                      flex: '1'
                    }}>
                      {shortcut.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Tooltip.Arrow style={{ fill: 'white', zIndex: 9999 }} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}; 