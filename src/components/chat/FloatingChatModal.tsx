import React, { useState, useRef, useEffect } from 'react';
import { X, MessageCircle, Send, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { BorderBeam } from '@/components/magicui/border-beam';
import { cn } from '@/lib/utils';
import type { RecordingState } from '@/services/audioRecordingService';
import type { TranscriptionProgress } from '@/services/speechToTextService';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface FloatingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  onSubmit: (message: string) => void;
  isLoading: boolean;
  sceneInitialized: boolean;
  // Voice input props
  voiceInputEnabled?: boolean;
  recordingState?: RecordingState;
  transcriptionProgress?: TranscriptionProgress;
  onStartVoiceRecording?: () => void;
  onStopVoiceRecording?: () => void;
  onToggleVoiceRecording?: () => void;
  onToggleVoiceInput?: () => void;
  audioRecordingService?: any;
}

export default function FloatingChatModal({
  isOpen,
  onClose,
  onToggle,
  onSubmit,
  isLoading,
  sceneInitialized,
  voiceInputEnabled = false,
  recordingState,
  transcriptionProgress,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onToggleVoiceRecording,
  onToggleVoiceInput,
  audioRecordingService,
}: FloatingChatModalProps) {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dock animation values - same as dock.tsx
  const mouseX = useMotionValue(Infinity);
  const DEFAULT_SIZE = 40;
  const DEFAULT_MAGNIFICATION = 60;
  const DEFAULT_DISTANCE = 140;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && sceneInitialized) {
      onSubmit(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
    }
  };

  const handleChatIconClick = () => {
    setIsExpanded(!isExpanded);
  };

  // Chat Dock Icon Component - exact same logic as dock.tsx DockIcon
  const ChatDockIcon = ({ 
    children, 
    onClick, 
    disabled = false,
    className,
    mouseX: providedMouseX
  }: { 
    children: React.ReactNode; 
    onClick: () => void; 
    disabled?: boolean;
    className?: string;
    mouseX?: any; // MotionValue<number>
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    const padding = Math.max(6, DEFAULT_SIZE * 0.2);
    const defaultMouseX = useMotionValue(Infinity);

    const distanceCalc = useTransform(providedMouseX ?? defaultMouseX, (val: number) => {
      const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
      return val - bounds.x - bounds.width / 2;
    });

    const sizeTransform = useTransform(
      distanceCalc,
      [-DEFAULT_DISTANCE, 0, DEFAULT_DISTANCE],
      [DEFAULT_SIZE, DEFAULT_MAGNIFICATION, DEFAULT_SIZE],
    );

    const scaleSize = useSpring(sizeTransform, {
      mass: 0.1,
      stiffness: 150,
      damping: 12,
    });

    return (
      <motion.div
        ref={ref}
        style={{ width: scaleSize, height: scaleSize, padding }}
        onClick={disabled ? undefined : onClick}
        className={cn(
          "flex aspect-square cursor-pointer items-center justify-center rounded-full",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {children}
      </motion.div>
    );
  };

  return (
    <>
      {/* Floating Chat Dock */}
      <div className="fixed bottom-4 right-24">
        {/* Main Dock Container - with mouse tracking like dock.tsx */}
        <motion.div 
          onMouseMove={(e) => mouseX.set(e.pageX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          className="supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 mx-auto flex h-[58px] w-max items-center justify-center gap-2 rounded-2xl border border-white/20 p-2 backdrop-blur-md relative overflow-hidden"
        >
          
          {/* Chat Icon */}
          <ChatDockIcon onClick={handleChatIconClick} mouseX={mouseX}>
            <MessageCircle className="w-6 h-6 text-white" />
          </ChatDockIcon>

          {/* Voice Icon */}
          {onToggleVoiceInput && (
            <ChatDockIcon onClick={onToggleVoiceInput} mouseX={mouseX}>
              {voiceInputEnabled ? (
                <Mic className="w-6 h-6 text-blue-300" />
              ) : (
                <MicOff className="w-6 h-6 text-white/60" />
              )}
            </ChatDockIcon>
          )}

          {/* Send/Submit Icon */}
          <ChatDockIcon 
            onClick={() => message.trim() && sceneInitialized && !isLoading && handleSubmit({ preventDefault: () => {} } as any)}
            disabled={!message.trim() || isLoading || !sceneInitialized}
            mouseX={mouseX}
          >
            <Send className="w-6 h-6 text-white" />
          </ChatDockIcon>

          {/* Close/Settings Icon */}
          <ChatDockIcon onClick={() => setIsExpanded(false)} mouseX={mouseX}>
            <X className="w-6 h-6 text-white" />
          </ChatDockIcon>

          {/* Border Beam as child - exactly like main dock */}
          <BorderBeam 
            duration={8} 
            size={100} 
            colorFrom="#ffaa40" 
            colorTo="#9c40ff" 
          />
        </motion.div>
      </div>

      {/* Expanded Chat Interface */}
      {isExpanded && (
        <div className="fixed bottom-20 right-24 z-40 w-80">
          <motion.div 
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 0.8,
            }}
            className="relative supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 backdrop-blur-md border border-white/20 rounded-2xl flex flex-col gap-2 p-2"
          >
            
            {/* Status Row */}
            <div className="flex items-center justify-center gap-3 py-3 px-4 bg-white/5 rounded-xl">
              <div className={cn(
                "w-2 h-2 rounded-full",
                sceneInitialized ? "bg-green-400" : "bg-red-400"
              )} />
              <span className="text-xs text-white font-medium">
                {sceneInitialized ? 'AI Ready' : 'Initializing...'}
              </span>
              {isLoading && (
                <span className="text-xs text-blue-300 animate-pulse">
                  Processing...
                </span>
              )}
            </div>

            {/* Chat Input Container - Explicit Spacing */}
            <div>
              {/* Input Form Section */}
              <div className="mt-6 mb-6 mx-8 bg-white/5 rounded-xl">
                <form onSubmit={handleSubmit} className="p-6">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Try: 'create cube', 'make it blue', 'move left'..."
                    className="w-full px-4 py-4 text-sm border border-white/20 rounded-xl bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:ring-1 focus:ring-blue-400/50 focus:border-blue-400/50 resize-none min-h-[60px] max-h-32 transition-all duration-200"
                    disabled={isLoading || !sceneInitialized}
                    rows={1}
                  />
                </form>
              </div>

              {/* Quick Actions - Dock-style Icons */}
              <div className="mx-8 flex items-center justify-center gap-3 px-4 py-4 bg-white/5 rounded-xl">
                {[
                  { label: 'Create', icon: '🔨' },
                  { label: 'Move', icon: '↔️' },
                  { label: 'Color', icon: '🎨' },
                  { label: 'More', icon: '⚡' }
                ].map((action, index) => (
                  <motion.div
                    key={action.label}
                    className="flex aspect-square cursor-pointer items-center justify-center rounded-full w-[40px] h-[40px] hover:bg-white/10 transition-colors duration-200"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    onClick={() => setMessage(`${action.label.toLowerCase()} `)}
                  >
                    <span className="text-sm text-white" title={action.label}>
                      {action.icon}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Voice Input Controls */}
              {voiceInputEnabled && onStartVoiceRecording && onStopVoiceRecording && onToggleVoiceRecording && (
                <div className="mx-8 flex items-center justify-center py-4 px-4 border-t border-white/10 bg-white/5 rounded-xl">
                  <VoiceInputButton
                    disabled={isLoading || !sceneInitialized || !audioRecordingService}
                    recordingState={recordingState}
                    transcriptionProgress={transcriptionProgress}
                    onStartRecording={onStartVoiceRecording}
                    onStopRecording={onStopVoiceRecording}
                    onToggle={onToggleVoiceRecording}
                    size="small"
                    variant="secondary"
                    showAudioLevel={true}
                  />
                </div>
              )}
            </div>

            {/* Border Beam - Dock-Card Style */}
            <BorderBeam
              duration={6}
              size={60}
              className="from-transparent via-white/30 to-transparent"
              borderWidth={1}
            />
          </motion.div>
        </div>
      )}


    </>
  );
} 