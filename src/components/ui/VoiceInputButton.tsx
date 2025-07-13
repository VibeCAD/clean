/**
 * Voice Input Button Component
 * 
 * This component provides a microphone button for voice input with:
 * - Recording state indicators with animations
 * - Audio visualization during recording
 * - Accessibility features and keyboard support
 * - Error handling and user feedback
 * - Integration with audio recording service
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecordingState } from '../../services/audioRecordingService';
import type { TranscriptionProgress } from '../../services/speechToTextService';

export interface VoiceInputButtonProps {
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether voice input is currently active */
  isActive?: boolean;
  /** Current recording state */
  recordingState?: RecordingState;
  /** Current transcription progress */
  transcriptionProgress?: TranscriptionProgress;
  /** Callback when voice input is toggled */
  onToggle?: () => void;
  /** Callback when recording starts */
  onStartRecording?: () => void;
  /** Callback when recording stops */
  onStopRecording?: () => void;
  /** Custom class name */
  className?: string;
  /** Show audio level visualization */
  showAudioLevel?: boolean;
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'minimal';
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  disabled = false,
  isActive = false,
  recordingState,
  transcriptionProgress,
  onToggle,
  onStartRecording,
  onStopRecording,
  className = '',
  showAudioLevel = true,
  size = 'medium',
  variant = 'primary'
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Determine current state for UI
  const isRecording = recordingState?.isRecording ?? false;
  const isProcessing = recordingState?.isProcessing ?? false;
  const hasError = recordingState?.error !== null;
  const audioLevel = recordingState?.audioLevel ?? 0;
  const permissionStatus = recordingState?.permissionStatus ?? 'unknown';

  // Handle button click
  const handleClick = () => {
    console.log('🎤 Voice input button clicked');
    
    if (disabled) return;

    if (isRecording) {
      console.log('🛑 Stopping recording via button click');
      onStopRecording?.();
    } else {
      console.log('🎙️ Starting recording via button click');
      onStartRecording?.();
    }

    onToggle?.();
  };

  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsPressed(true);
      handleClick();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsPressed(false);
    }
  };

  // Get button state for styling
  const getButtonState = () => {
    const state = disabled ? 'disabled' 
      : hasError ? 'error'
      : isProcessing ? 'processing'
      : isRecording ? 'recording'
      : isActive ? 'active'
      : 'idle';
    
    return state;
  };

  // Get button icon based on state
  const getButtonIcon = () => {
    const state = getButtonState();
    const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;
    
    switch (state) {
      case 'recording':
        return <Square size={iconSize} />;
      case 'processing':
        return <Loader2 size={iconSize} className="animate-spin" />;
      case 'error':
        return <AlertCircle size={iconSize} />;
      case 'disabled':
        return <MicOff size={iconSize} />;
      default:
        // Use MicOff if permission denied, otherwise use Mic if ready
        if (permissionStatus === 'denied') {
          return <MicOff size={iconSize} />;
        }
        return <Mic size={iconSize} />;
    }
  };

  // Get button text for accessibility
  const getButtonText = () => {
    const state = getButtonState();
    
    switch (state) {
      case 'recording':
        return 'Stop recording';
      case 'processing':
        return 'Processing...';
      case 'error':
        return 'Error - Click to retry';
      case 'disabled':
        return 'Voice input disabled';
      default:
        return 'Start voice input';
    }
  };

  // Get tooltip content
  const getTooltipContent = () => {
    if (hasError) {
      return `Error: ${recordingState?.error}`;
    }
    
    if (isProcessing) {
      return 'Processing audio...';
    }
    
    if (isRecording) {
      const duration = recordingState?.duration || 0;
      return `Recording... ${duration.toFixed(1)}s (Ctrl+V to stop)`;
    }
    
    if (permissionStatus === 'denied') {
      return 'Microphone permission denied';
    }
    
    if (permissionStatus === 'prompt') {
      return 'Click to request microphone permission';
    }
    
    return 'Click or press Ctrl+V to start voice input';
  };

  // Get transcription progress info
  const getTranscriptionInfo = () => {
    if (!transcriptionProgress) return null;
    
    const { stage, progress, message } = transcriptionProgress;
    
    return {
      stage,
      progress: Math.round(progress * 100),
      message
    };
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-8 h-8';
      case 'large':
        return 'w-16 h-16';
      default:
        return 'w-12 h-12';
    }
  };

  // Get base button classes
  const getButtonClasses = () => {
    const state = getButtonState();
    const baseClasses = 'relative inline-flex items-center justify-center rounded-full border transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    // Size classes
    const sizeClasses = getSizeClasses();
    
    // State and variant specific classes
    let stateClasses = '';
    
    if (state === 'disabled') {
      stateClasses = 'cursor-not-allowed opacity-50';
      if (variant === 'minimal') {
        stateClasses += ' bg-transparent border-gray-400 text-gray-400';
      } else {
        stateClasses += ' bg-gray-300 border-gray-300 text-gray-500';
      }
    } else if (state === 'recording') {
      if (variant === 'minimal') {
        stateClasses = 'bg-red-500/20 border-red-500 text-red-500 animate-pulse';
      } else {
        stateClasses = 'bg-red-500 border-red-500 text-white animate-pulse shadow-lg shadow-red-500/25';
      }
    } else if (state === 'processing') {
      if (variant === 'minimal') {
        stateClasses = 'bg-orange-500/20 border-orange-500 text-orange-500';
      } else {
        stateClasses = 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/25';
      }
    } else if (state === 'error') {
      if (variant === 'minimal') {
        stateClasses = 'bg-red-500/20 border-red-500 text-red-500';
      } else {
        stateClasses = 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/25';
      }
    } else {
      // idle/active state
      if (variant === 'minimal') {
        stateClasses = 'bg-transparent border-white/30 text-white hover:bg-white/10';
      } else if (variant === 'secondary') {
        stateClasses = 'bg-gray-500 border-gray-500 text-white hover:bg-gray-600 shadow-lg shadow-gray-500/25';
      } else {
        stateClasses = 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25';
      }
    }
    
    // Focus ring color
    const focusClasses = state === 'recording' ? 'focus:ring-red-500' 
      : state === 'error' ? 'focus:ring-red-500'
      : state === 'processing' ? 'focus:ring-orange-500'
      : 'focus:ring-white/50';
    
    return cn(baseClasses, sizeClasses, stateClasses, focusClasses, className);
  };

  // Audio level visualization (if needed)
  const AudioLevelIndicator = () => {
    if (!showAudioLevel || !isRecording) return null;
    
    const level = Math.min(audioLevel, 1);
    const bars = 5;
    const activeBars = Math.round(level * bars);
    
    return (
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex items-end gap-0.5 h-5 px-2 bg-black/80 rounded-lg">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-0.5 bg-gray-400 rounded-sm transition-all duration-100",
              i < activeBars && "bg-green-400"
            )}
            style={{
              height: `${Math.max(20, level * 100)}%`
            }}
          />
        ))}
      </div>
    );
  };

  // Recording duration indicator
  const RecordingDuration = () => {
    if (!isRecording || !recordingState?.duration) return null;
    
    const minutes = Math.floor(recordingState.duration / 60);
    const seconds = Math.floor(recordingState.duration % 60);
    
    return (
      <div className="mt-2 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg text-xs font-mono text-red-500">
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </div>
    );
  };

  // Transcription progress indicator
  const TranscriptionProgress = () => {
    const info = getTranscriptionInfo();
    if (!info) return null;
    
    return (
      <div className="mt-2 flex flex-col items-center gap-1 min-w-48">
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${info.progress}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 text-center max-w-48 truncate">
          {info.message}
        </div>
      </div>
    );
  };

  return (
    <div className="relative inline-flex flex-col items-center gap-2">
      <button
        ref={buttonRef}
        className={getButtonClasses()}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        disabled={disabled}
        aria-label={getButtonText()}
        aria-pressed={isRecording}
        aria-describedby={showTooltip ? 'voice-input-tooltip' : undefined}
        title={getTooltipContent()}
      >
        {/* Button icon */}
        <span className="inline-flex items-center justify-center" aria-hidden="true">
          {getButtonIcon()}
        </span>

        {/* Button text (screen reader only) */}
        <span className="sr-only">
          {getButtonText()}
        </span>

        {/* Audio level indicator */}
        <AudioLevelIndicator />
      </button>

      {/* Recording duration */}
      <RecordingDuration />

      {/* Transcription progress */}
      <TranscriptionProgress />

      {/* Tooltip */}
      {showTooltip && (
        <div
          id="voice-input-tooltip"
          className="absolute bottom-full mb-2 px-3 py-2 bg-black/90 text-white text-xs rounded-md whitespace-nowrap z-50 pointer-events-none"
          role="tooltip"
          aria-hidden="true"
        >
          {getTooltipContent()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/90" />
        </div>
      )}
    </div>
  );
};

export default VoiceInputButton; 