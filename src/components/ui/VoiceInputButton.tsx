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
    if (disabled) return 'disabled';
    if (hasError) return 'error';
    if (isProcessing) return 'processing';
    if (isRecording) return 'recording';
    if (isActive) return 'active';
    return 'idle';
  };

  // Get button icon based on state
  const getButtonIcon = () => {
    const state = getButtonState();
    
    switch (state) {
      case 'recording':
        return '🛑'; // Stop icon when recording
      case 'processing':
        return '⏳'; // Processing icon
      case 'error':
        return '❌'; // Error icon
      case 'disabled':
        return '🎤'; // Disabled microphone
      default:
        return '🎤'; // Default microphone
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

  // CSS classes for different states and sizes
  const getButtonClasses = () => {
    const baseClasses = 'voice-input-button';
    const stateClass = `voice-input-button--${getButtonState()}`;
    const sizeClass = `voice-input-button--${size}`;
    const variantClass = `voice-input-button--${variant}`;
    const pressedClass = isPressed ? 'voice-input-button--pressed' : '';
    
    return `${baseClasses} ${stateClass} ${sizeClass} ${variantClass} ${pressedClass} ${className}`.trim();
  };

  // Audio level visualization
  const AudioLevelIndicator = () => {
    if (!showAudioLevel || !isRecording) return null;
    
    const level = Math.min(audioLevel, 1);
    const bars = 5;
    const activeBars = Math.round(level * bars);
    
    return (
      <div className="voice-input-button__audio-level">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className={`voice-input-button__audio-bar ${
              i < activeBars ? 'voice-input-button__audio-bar--active' : ''
            }`}
            style={{
              animationDelay: `${i * 100}ms`,
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
      <div className="voice-input-button__duration">
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </div>
    );
  };

  // Transcription progress indicator
  const TranscriptionProgress = () => {
    const info = getTranscriptionInfo();
    if (!info) return null;
    
    return (
      <div className="voice-input-button__transcription">
        <div className="voice-input-button__progress-bar">
          <div 
            className="voice-input-button__progress-fill"
            style={{ width: `${info.progress}%` }}
          />
        </div>
        <div className="voice-input-button__progress-text">
          {info.message}
        </div>
      </div>
    );
  };

  return (
    <div className="voice-input-button-container">
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
        <span className="voice-input-button__icon" aria-hidden="true">
          {getButtonIcon()}
        </span>

        {/* Button text (screen reader only) */}
        <span className="voice-input-button__text sr-only">
          {getButtonText()}
        </span>

        {/* Audio level indicator */}
        <AudioLevelIndicator />

        {/* Recording pulse animation */}
        {isRecording && (
          <div className="voice-input-button__pulse" aria-hidden="true" />
        )}

        {/* Processing spinner */}
        {isProcessing && (
          <div className="voice-input-button__spinner" aria-hidden="true" />
        )}
      </button>

      {/* Recording duration */}
      <RecordingDuration />

      {/* Transcription progress */}
      <TranscriptionProgress />

      {/* Tooltip */}
      {showTooltip && (
        <div
          id="voice-input-tooltip"
          className="voice-input-button__tooltip"
          role="tooltip"
          aria-hidden="true"
        >
          {getTooltipContent()}
        </div>
      )}
    </div>
  );
};

export default VoiceInputButton; 