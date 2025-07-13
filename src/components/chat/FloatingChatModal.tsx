import React, { useState, useRef, useEffect } from 'react';
import { X, MessageCircle, Send, Mic, MicOff, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInput } from '@/components/ui/chat/chat-input';
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage } from '@/components/ui/chat/chat-bubble';
import { ChatMessageList } from '@/components/ui/chat/chat-message-list';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { BorderBeam } from '@/components/magicui/border-beam';
import { cn } from '@/lib/utils';
import type { RecordingState } from '@/services/audioRecordingService';
import type { TranscriptionProgress } from '@/services/speechToTextService';
import { createAudioRecordingService } from '@/services/audioRecordingService';
import { createSpeechToTextService } from '@/services/speechToTextService';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isLoading?: boolean;
}

interface FloatingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  onSubmit: (message: string) => void;
  isLoading: boolean;
  sceneInitialized: boolean;
  // Voice input props (keeping for backwards compatibility)
  voiceInputEnabled?: boolean;
  apiKey?: string; // OpenAI API key for speech-to-text
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
  voiceInputEnabled = false, // Disable by default to prevent auto-initialization
  apiKey, // OpenAI API key for speech-to-text
  recordingState: externalRecordingState,
  transcriptionProgress: externalTranscriptionProgress,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onToggleVoiceRecording,
  onToggleVoiceInput,
  audioRecordingService: externalAudioService,
}: FloatingChatModalProps) {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I can help you create and modify 3D objects. Try saying "create a cube" or "make it blue".',
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  
  // Voice input state
  const [internalRecordingState, setInternalRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    hasPermission: false,
    permissionStatus: 'unknown',
    audioLevel: 0,
    error: null,
    isProcessing: false
  });

  
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const audioServiceRef = useRef<any>(null);
  const speechServiceRef = useRef<any>(null);

  // Initialize services
  useEffect(() => {
    if (voiceInputEnabled && !audioServiceRef.current) {
      console.log('🎙️ Initializing voice input services...');
      
      // Declare timeout variables at function scope for cleanup
      let timeoutId: NodeJS.Timeout;
      let progressTimeoutId: NodeJS.Timeout;
      
      try {
        // Use external service or create new one
        audioServiceRef.current = externalAudioService || createAudioRecordingService();
        
        // Set up state change listener with debouncing to prevent render loops
        const unsubscribe = audioServiceRef.current.onStateChange((state: RecordingState) => {
          // Debounce state changes to prevent rapid updates
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            console.log('🔄 Recording state changed:', state);
            setInternalRecordingState(state);
          }, 50); // 50ms debounce
        });

        // Initialize speech service if we have an API key
        const resolvedApiKey = apiKey || import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key');
        if (resolvedApiKey) {
                      speechServiceRef.current = createSpeechToTextService(resolvedApiKey);
          
          // Set up transcription progress listener (console only)
          speechServiceRef.current.onProgress((progress: TranscriptionProgress) => {
            clearTimeout(progressTimeoutId);
            progressTimeoutId = setTimeout(() => {
              console.log('📊 Transcription progress:', progress);
            }, 100); // 100ms debounce for progress updates
          });
        } else {
          console.warn('⚠️ No OpenAI API key found for speech-to-text');
        }

        return () => {
          clearTimeout(timeoutId);
          clearTimeout(progressTimeoutId);
          unsubscribe();
          if (audioServiceRef.current) {
            audioServiceRef.current.cleanup();
          }
        };
      } catch (error) {
        console.error('❌ Failed to initialize voice services:', error);
        // Set error state but don't continuously retry
        setInternalRecordingState(prev => ({ 
          ...prev, 
          error: 'Failed to initialize voice services',
          hasPermission: false,
          isProcessing: false
        }));
      }
    }
  }, [voiceInputEnabled, externalAudioService, apiKey]);

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleToggleVoiceRecording = (event: CustomEvent) => {
      console.log('⚡ Received voice recording toggle event:', event.detail);
      if (voiceInputEnabled && audioServiceRef.current) {
        handleVoiceToggle();
      }
    };

    window.addEventListener('toggleVoiceRecording', handleToggleVoiceRecording as EventListener);
    
    return () => {
      window.removeEventListener('toggleVoiceRecording', handleToggleVoiceRecording as EventListener);
    };
  }, [voiceInputEnabled]);

  // Use external state if provided, otherwise use internal state
  const currentRecordingState = externalRecordingState || internalRecordingState;

  // Dock animation values - same as dock.tsx
  const mouseX = useMotionValue(Infinity);
  const DEFAULT_SIZE = 40;
  const DEFAULT_MAGNIFICATION = 60;
  const DEFAULT_DISTANCE = 140;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && sceneInitialized) {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: message.trim(),
        sender: 'user',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Add loading AI message
      const loadingMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        sender: 'ai',
        timestamp: new Date(),
        isLoading: true,
      };
      
      setMessages(prev => [...prev, loadingMessage]);
      
      // Submit to parent
      onSubmit(message.trim());
      setMessage('');
    }
  };

  // Voice input handlers
  const handleVoiceToggle = async () => {
    console.log('🎤 Voice toggle requested');
    
    if (!audioServiceRef.current) {
      console.error('❌ Audio service not available');
      return;
    }

    // Safety check: don't allow auto-recording, only on explicit user action
    if (!sceneInitialized) {
      console.warn('⚠️ Scene not initialized, cannot start recording');
      return;
    }

    try {
      // Get real-time state directly from the service to avoid stale state
      const realTimeState = audioServiceRef.current.getState();
      console.log('🔍 Real-time recording state:', realTimeState.isRecording);
      
      if (realTimeState.isRecording) {
        console.log('🛑 Stopping recording...');
        const result = await audioServiceRef.current.stopRecording();
        
        if (result && speechServiceRef.current) {
          console.log('🎯 Processing transcription...');

          try {
            const transcriptionResult = await speechServiceRef.current.transcribeAudio(result);
            console.log('✅ Transcription completed:', transcriptionResult.text);
            
            // Add transcribed text to message input and auto-submit
            const finalMessage = (message ? message + ' ' : '') + transcriptionResult.text;
            console.log('📝 Previous message:', message);
            console.log('📝 Transcribed text:', transcriptionResult.text);
            console.log('📝 Final message for auto-submit:', finalMessage);
            
            // Set the message first
            setMessage(finalMessage);
            
            // Auto-submit the transcribed text after a short delay to ensure state updates
            setTimeout(() => {
              console.log('🚀 Auto-submitting transcribed message...');
              
              if (finalMessage.trim() && !isLoading && sceneInitialized) {
                // Add user message to chat
                const userMessage: Message = {
                  id: Date.now().toString(),
                  content: finalMessage.trim(),
                  sender: 'user',
                  timestamp: new Date(),
                };
                
                setMessages(prev => [...prev, userMessage]);
                
                // Add loading AI message
                const loadingMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  content: '',
                  sender: 'ai',
                  timestamp: new Date(),
                  isLoading: true,
                };
                
                setMessages(prev => [...prev, loadingMessage]);
                
                // Submit to parent for AI processing
                onSubmit(finalMessage.trim());
                
                // Clear the input
                setMessage('');
                
                console.log('✅ Auto-submit completed');
              } else {
                console.warn('⚠️ Cannot auto-submit:', { 
                  hasMessage: !!finalMessage.trim(), 
                  isLoading, 
                  sceneInitialized 
                });
              }
            }, 100);
            
          } catch (transcriptionError) {
            console.error('❌ Transcription failed:', transcriptionError);
          }
        }
      } else {
        console.log('🎙️ Starting recording...');
        // First request permission if not already granted
        if (!currentRecordingState.hasPermission) {
          console.log('🔐 Requesting microphone permission...');
          const permissionGranted = await audioServiceRef.current.requestPermission();
          if (!permissionGranted) {
            console.warn('⚠️ Microphone permission denied');
            return;
          }
        }
        await audioServiceRef.current.startRecording();
      }
    } catch (error) {
      console.error('❌ Voice input error:', error);
      setInternalRecordingState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Voice input failed',
        isProcessing: false,
        isRecording: false
      }));
    }
    
    // Call external handlers if provided
    // Note: Use inverse logic since we just toggled the state
    const finalState = audioServiceRef.current.getState();
    if (finalState.isRecording) {
      onStartVoiceRecording?.(); // Just started recording
    } else {
      onStopVoiceRecording?.(); // Just stopped recording
    }
    onToggleVoiceRecording?.();
  };

  // Handle AI response (simulate for now)
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.isLoading) {
        // Replace loading message with actual response
        setMessages(prev => prev.slice(0, -1).concat({
          ...lastMessage,
          content: 'I understand! I\'ll help you with that.',
          isLoading: false,
        }));
      }
    }
  }, [isLoading, messages.length]);

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

  const handleQuickAction = (action: string) => {
    setMessage(`${action.toLowerCase()} `);
    chatInputRef.current?.focus();
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

          {/* Voice Input Button */}
          {voiceInputEnabled && (
            <ChatDockIcon onClick={handleVoiceToggle} disabled={!sceneInitialized} mouseX={mouseX}>
              <div className="relative">
                <VoiceInputButton
                  disabled={!sceneInitialized}
                  recordingState={currentRecordingState}
                  onToggle={() => {}} // Handled by ChatDockIcon onClick
                  onStartRecording={() => {}} // Handled by ChatDockIcon onClick
                  onStopRecording={() => {}} // Handled by ChatDockIcon onClick
                  size="small"
                  variant="minimal"
                  showAudioLevel={false}
                  className="!w-6 !h-6 !bg-transparent !border-transparent hover:!border-transparent !shadow-none pointer-events-none"
                />
              </div>
            </ChatDockIcon>
          )}

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
        <div className="fixed bottom-20 right-24 z-40 w-96 h-[600px]">
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
            className="relative h-full supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 backdrop-blur-md border border-white/20 rounded-2xl flex flex-col overflow-hidden"
          >
            
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  sceneInitialized ? "bg-green-400" : "bg-red-400"
                )} />
                <span className="text-sm text-white font-medium">
                  {sceneInitialized ? 'AI Ready' : 'Initializing...'}
                </span>
                {currentRecordingState.isRecording && (
                  <span className="text-xs text-red-300 animate-pulse font-medium">
                    Recording... {currentRecordingState.duration.toFixed(1)}s
                  </span>
                )}

              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Chat Message List */}
            <div className="flex-1 min-h-0">
              <ChatMessageList 
                className="h-full !px-4 !py-3"
                smooth={true}
                style={{ padding: '12px 16px' }}
              >
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    variant={msg.sender === 'user' ? 'sent' : 'received'}
                    className=""
                    style={{ marginBottom: '12px' }}
                  >
                    <ChatBubbleAvatar
                      src={msg.sender === 'ai' ? undefined : undefined}
                      fallback={msg.sender === 'ai' ? '🤖' : '👤'}
                      className="w-8 h-8"
                    />
                    <ChatBubbleMessage
                      variant={msg.sender === 'user' ? 'sent' : 'received'}
                      isLoading={msg.isLoading}
                      className={cn(
                        // Glassmorphism styling for messages
                        msg.sender === 'user' 
                          ? "bg-blue-500/20 text-white border border-blue-400/30 backdrop-blur-sm" 
                          : "bg-white/10 text-white border border-white/20 backdrop-blur-sm",
                        "shadow-lg"
                      )}
                      style={{ padding: '12px' }}
                    >
                      {msg.content}
                    </ChatBubbleMessage>
                  </ChatBubble>
                ))}
              </ChatMessageList>
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-2 border-t border-white/10 bg-white/5" style={{ padding: '8px 16px' }}>
              <div className="flex items-center justify-center gap-2">
                {[
                  { label: 'Create', icon: '🔨' },
                  { label: 'Move', icon: '↔️' },
                  { label: 'Color', icon: '🎨' },
                  { label: 'Delete', icon: '🗑️' }
                ].map((action) => (
                  <motion.button
                    key={action.label}
                    onClick={() => handleQuickAction(action.label)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-200 text-xs text-white/80 hover:text-white"
                    style={{ padding: '4px 8px', margin: '0 2px' }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Chat Input Footer */}
            <div className="p-3 border-t border-white/10 bg-white/5 rounded-b-2xl" style={{ padding: '12px' }}>
              <div className="flex gap-2">
                <ChatInput
                  ref={chatInputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onSubmit={handleSubmit}
                  placeholder="Type your message..."
                  disabled={isLoading || !sceneInitialized}
                  sendButtonDisabled={!message.trim() || isLoading || !sceneInitialized}
                  className={cn(
                    "flex-1 border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/50",
                    "focus-visible:border-blue-400/50 focus-visible:ring-blue-400/50 focus-visible:ring-1",
                    "min-h-[40px] max-h-20 rounded-xl px-3 py-2 text-sm",
                    "transition-all duration-200 shadow-none resize-none",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  style={{ padding: '8px 12px', minHeight: '40px' }}
                />
              </div>
            </div>

            {/* Border Beam */}
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