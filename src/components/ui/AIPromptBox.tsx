import React from 'react';

interface AIPromptBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isDisabled: boolean;
  placeholder?: string;
}

export const AIPromptBox: React.FC<AIPromptBoxProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading,
  isDisabled,
  placeholder = "Try: 'move the cube to the right', 'make the cube blue', 'create a red sphere above the cube', 'apply wood texture', 'make it brick'"
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for Cmd+Enter on macOS or Ctrl+Enter on other systems
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      // Prevent the default action of adding a new line
      event.preventDefault();
      
      // Check if the submit button would be active, and if so, submit the prompt
      if (!isLoading && value.trim() && !isDisabled) {
        onSubmit();
      }
    }
  };

  // Debug logging
  React.useEffect(() => {
    console.log('🎯 AIPromptBox rendered:', { value, isLoading, isDisabled });
  }, [value, isLoading, isDisabled]);

  // Component mount logging
  React.useEffect(() => {
    console.log('🚀 AIPromptBox component mounted in lower left corner!');
  }, []);

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 10000,
        width: '400px',
        backgroundColor: '#ffffff',
        border: '2px solid #3b82f6',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          fontSize: '14px', 
          fontWeight: '600',
          color: '#374151'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}></div>
          AI Assistant
        </div>
      </div>
      
      <div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading || isDisabled}
          rows={3}
          style={{
            width: '100%',
            minHeight: '80px',
            resize: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            backgroundColor: isDisabled ? '#f9fafb' : '#ffffff'
          }}
        />
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '8px'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#6b7280'
          }}>
            {isLoading ? 'Processing...' : 'Ctrl+Enter to submit'}
          </div>
          <button 
            onClick={onSubmit}
            disabled={isLoading || !value.trim() || isDisabled}
            style={{
              backgroundColor: isLoading || !value.trim() || isDisabled ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isLoading || !value.trim() || isDisabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isLoading ? '⏳' : '🚀'}
            {isLoading ? 'Processing' : 'Execute'}
          </button>
        </div>
      </div>
      
      {/* Add pulsing animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default AIPromptBox; 