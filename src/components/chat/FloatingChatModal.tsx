import React, { useState, useRef, useEffect } from 'react';
import { X, MessageCircle, Send, Mic, MicOff, Bot, User, Plus, Move, Palette, Trash2, PenTool } from 'lucide-react';
import { Vector3 } from 'babylonjs';
import { Button } from '@/components/ui/button';
import { ChatInput } from '@/components/ui/chat/chat-input';
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage } from '@/components/ui/chat/chat-bubble';
import { ChatMessageList } from '@/components/ui/chat/chat-message-list';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { BorderBeam } from '@/components/magicui/border-beam';
import { Marquee } from '@/components/magicui/marquee';
import { cn } from '@/lib/utils';
import type { RecordingState } from '@/services/audioRecordingService';
import type { TranscriptionProgress } from '@/services/speechToTextService';
import { createAudioRecordingService } from '@/services/audioRecordingService';
import { createSpeechToTextService } from '@/services/speechToTextService';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useSceneStore } from '@/state/sceneStore';
import { createAIService, type SceneCommand } from '@/ai/ai.service';
import type { SceneObject } from '@/types/types';
import { spaceAnalysisService } from '@/services/spaceAnalysisService';
import type { SpaceAnalysisResult } from '@/services/spaceAnalysisService';
import { placementConstraintsService, type FireSafetyValidationResult } from '@/services/placementConstraintsService';
import { ObjectCountDisplay } from '@/components/ui/ObjectCountDisplay';
import { SpaceMetricsDisplay } from '@/components/ui/SpaceMetricsDisplay';
import { ClearanceFeedbackPanel } from '@/components/ui/ClearanceFeedbackPanel';

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
  // Add the same props as AISidebar
  apiKey: string;
  sceneAPI?: {
    getSceneManager: () => any;
  };
  onOpenCustomRoomModal?: () => void;
  // Voice input props (keeping for backwards compatibility)
  voiceInputEnabled?: boolean;
  recordingState?: RecordingState;
  transcriptionProgress?: TranscriptionProgress;
  onStartVoiceRecording?: () => void;
  onStopVoiceRecording?: () => void;
  onToggleVoiceRecording?: () => void;
  onToggleVoiceInput?: () => void;
  audioRecordingService?: any;
}

// Scene Description Panel Component
const SceneDescriptionPanel = ({ description, onClose }: { description: string, onClose: () => void }) => {
  if (!description) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Scene Description</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/90 leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

export default function FloatingChatModal({
  isOpen,
  onClose,
  onToggle,
  onSubmit,
  isLoading,
  sceneInitialized,
  apiKey,
  sceneAPI,
  onOpenCustomRoomModal,
  voiceInputEnabled = false,
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
  
  // Add all the state from AISidebar
  const [showDescriptionPanel, setShowDescriptionPanel] = useState(false);
  const [sceneDescription, setSceneDescription] = useState('');
  const [spaceAnalysisResult, setSpaceAnalysisResult] = useState<SpaceAnalysisResult | null>(null);
  const [fireSafetyResult, setFireSafetyResult] = useState<FireSafetyValidationResult | null>(null);
  const [showSpaceReport, setShowSpaceReport] = useState(false);
  const [currentIsLoading, setCurrentIsLoading] = useState(false);
  
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

  // Get all the scene store functions
  const {
    sceneObjects,
    addToResponseLog,
    updateObject,
    addObject,
    removeObject,
    renameObject,
    undo,
    redo,
    selectedObjectId,
    selectedObjectIds,
  } = useSceneStore();
  
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

  // Add all the command processing functions from AISidebar
  /**
   * Synchronize object positions from the actual 3D meshes to the store
   * This ensures we have the most current positions before AI analysis
   */
  const syncPositionsFromMeshes = () => {
    if (!sceneAPI || !sceneInitialized) return;

    const sceneManager = sceneAPI.getSceneManager();
    if (!sceneManager) return;

    console.log('🔄 Syncing positions from 3D meshes to store...');
    
    sceneObjects.forEach(obj => {
      if (obj.type === 'ground') return; // Skip ground
      
      const mesh = sceneManager.getMeshById(obj.id);
      if (mesh) {
        const meshPosition = mesh.position;
        const meshRotation = mesh.rotation;
        const meshScale = mesh.scaling;
        
        // Check if the mesh position differs from store position
        const positionDiff = !obj.position.equals(meshPosition);
        const rotationDiff = !obj.rotation.equals(meshRotation);
        const scaleDiff = !obj.scale.equals(meshScale);
        
        if (positionDiff || rotationDiff || scaleDiff) {
          console.log(`  - Updating ${obj.id}: mesh pos (${meshPosition.x.toFixed(2)}, ${meshPosition.y.toFixed(2)}, ${meshPosition.z.toFixed(2)}) vs store pos (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`);
          
          updateObject(obj.id, {
            position: meshPosition.clone(),
            rotation: meshRotation.clone(),
            scale: meshScale.clone()
          });
        }
      }
    });
  };

  const performAlignment = (command: SceneCommand, sceneManager: any) => {
    if (!command.objectId || !command.relativeToObject || !command.edge) return;

    // Use the sceneManager's alignMesh method which handles all edge types including 'nearest-wall'
    sceneManager.alignMesh(command.objectId, command.relativeToObject, command.edge, command.offset);
    
    console.log(`✅ Aligned ${command.objectId} to ${command.edge} edge of ${command.relativeToObject}`);
  };

  // Helper function to place objects in the scene from optimization layouts
  const placeObjectsInScene = (layouts: any[], objectType: string) => {
    try {
      console.log(`🏗️ Placing ${layouts.length} optimized ${objectType} objects in scene`);
      
      // Clear existing optimized objects of this type
      const existingOptimizedObjects = sceneObjects.filter(obj => 
        obj.id.startsWith(`optimized-${objectType.toLowerCase()}`)
      );
      
      existingOptimizedObjects.forEach(obj => {
        removeObject(obj.id);
      });

      // Place new objects at optimal positions
      layouts.forEach((layout, index) => {
        const objectId = `optimized-${objectType.toLowerCase()}-${index + 1}`;
        
        addObject({
          id: objectId,
          type: objectType,
          position: layout.position,
          scale: new Vector3(1, 1, 1),
          rotation: layout.rotation || new Vector3(0, 0, 0),
          color: '#4CAF50', // Green color for optimized objects
          isNurbs: false
        });
      });
      
      addToResponseLog(`✅ Placed ${layouts.length} optimized ${objectType} objects in scene`);
    } catch (error) {
      console.error('Error placing objects in scene:', error);
      addToResponseLog(`Error: Could not place objects in scene`);
    }
  };

  // Helper function to clear all optimized objects
  const clearOptimizedObjects = () => {
    const optimizedObjects = sceneObjects.filter(obj => obj.id.startsWith('optimized-'));
    optimizedObjects.forEach(obj => {
      removeObject(obj.id);
    });
    addToResponseLog(`🗑️ Cleared ${optimizedObjects.length} optimized objects`);
  };

  // Helper function to get count of optimized objects
  const getOptimizedObjectCount = () => {
    return sceneObjects.filter(obj => obj.id.startsWith('optimized-')).length;
  };

  // Handler for space analysis commands
  const handleSpaceAnalysisCommand = async (command: SceneCommand) => {
    if (!sceneAPI) return;
    
    try {
      console.log('🔍 Executing space analysis command:', command);
      
      let result: SpaceAnalysisResult;
      
      // If the command already has analysis results, use them
      if (command.analysisResult) {
        result = command.analysisResult;
      } else {
        // Run analysis if not already done
        const getMeshById = (id: string) => {
          const sceneManager = sceneAPI.getSceneManager();
          return sceneManager?.getMeshById(id) || null;
        };

        // Get selected objects from the store
        const selectedObjects = command.useSelectedObjects ? 
          sceneObjects.filter(obj => selectedObjectIds.includes(obj.id)) : 
          undefined;
        
        const roomId = command.roomId || sceneObjects.find(obj => obj.type === 'custom-room')?.id;
        
        if (!roomId) {
          addToResponseLog('Error: No room found for space analysis');
          return;
        }

        const request = {
          roomId,
          targetObjectType: command.targetObjectType,
          selectedObjects,
          strategy: command.optimizationStrategy ? {
            name: command.optimizationStrategy,
            priority: command.optimizationStrategy,
            description: `${command.optimizationStrategy} optimization strategy`
          } : undefined
        };

        result = await spaceAnalysisService.analyzeSpace(request, sceneObjects, getMeshById);
      }
      
      // Store the analysis result for report display
      setSpaceAnalysisResult(result);
      
      // Run fire safety validation
      const roomMesh = sceneAPI.getSceneManager()?.getMeshById(result.request.roomId);
      if (roomMesh) {
        const fireSafety = placementConstraintsService.validateFireSafety(roomMesh, sceneObjects, result.request.roomId);
        setFireSafetyResult(fireSafety);
      }
      
      // Show the comprehensive report
      setShowSpaceReport(true);
      
      // Display basic results in log
      addToResponseLog(`Space Analysis: ${result.optimization.maxObjects} ${result.furnitureSpec.type}(s) can fit`);
      addToResponseLog(`Space Efficiency: ${(result.optimization.efficiency * 100).toFixed(1)}%`);
      
      if (result.recommendations.length > 0) {
        addToResponseLog(`Recommendations: ${result.recommendations.join(', ')}`);
      }

      // Place objects in the scene at optimal positions
      if (result.optimization.maxObjects > 0 && result.optimization.layouts.length > 0) {
        placeObjectsInScene(result.optimization.layouts, result.furnitureSpec.type);
      }
    } catch (error) {
      console.error('Space analysis command failed:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Space analysis failed'}`);
    }
  };

  // Handler for space optimization commands
  const handleSpaceOptimizationCommand = async (command: SceneCommand) => {
    if (!sceneAPI) return;
    
    try {
      console.log('🎯 Executing space optimization command:', command);
      
      const getMeshById = (id: string) => {
        const sceneManager = sceneAPI.getSceneManager();
        return sceneManager?.getMeshById(id) || null;
      };

      // Get selected objects from the store
      const selectedObjects = command.useSelectedObjects ? 
        sceneObjects.filter(obj => selectedObjectIds.includes(obj.id)) : 
        undefined;
      
      const roomId = command.roomId || sceneObjects.find(obj => obj.type === 'custom-room')?.id;
      
      if (!roomId) {
        addToResponseLog('Error: No room found for space optimization');
        return;
      }

      const request = {
        roomId,
        targetObjectType: command.targetObjectType,
        selectedObjects,
        strategy: command.optimizationStrategy ? {
          name: command.optimizationStrategy,
          priority: command.optimizationStrategy,
          description: `${command.optimizationStrategy} optimization strategy`
        } : { name: 'maximize' as const, priority: 'maximize' as const, description: 'Maximize capacity' }
      };

      const result = await spaceAnalysisService.analyzeSpace(request, sceneObjects, getMeshById);
      
      // Store the analysis result for report display
      setSpaceAnalysisResult(result);
      
      // Run fire safety validation
      const roomMesh = getMeshById(result.request.roomId);
      if (roomMesh) {
        const fireSafety = placementConstraintsService.validateFireSafety(roomMesh, sceneObjects, result.request.roomId);
        setFireSafetyResult(fireSafety);
      }
      
      // Show the comprehensive report
      setShowSpaceReport(true);
      
      // Display basic results in log
      addToResponseLog(`Space Optimization: ${result.optimization.maxObjects} ${result.furnitureSpec.type}(s) optimally placed`);
      addToResponseLog(`Space Efficiency: ${(result.optimization.efficiency * 100).toFixed(1)}%`);
      
      if (result.recommendations.length > 0) {
        addToResponseLog(`Recommendations: ${result.recommendations.join(', ')}`);
      }

      // Place objects in the scene at optimal positions
      if (result.optimization.maxObjects > 0 && result.optimization.layouts.length > 0) {
        placeObjectsInScene(result.optimization.layouts, result.furnitureSpec.type);
      }
    } catch (error) {
      console.error('Space optimization command failed:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Space optimization failed'}`);
    }
  };

  // Handler for furniture info commands
  const handleFurnitureInfoCommand = (command: SceneCommand) => {
    try {
      console.log('📋 Executing furniture info command:', command);
      
      // Get selected objects from the store
      const selectedObjects = command.useSelectedObjects ? 
        sceneObjects.filter(obj => selectedObjectIds.includes(obj.id)) : 
        [];
      
      if (selectedObjects.length === 0) {
        addToResponseLog('Error: No objects selected for furniture information');
        return;
      }

      // Get furniture information from the AI service
      const aiService = createAIService('dummy-key', []); // API key not needed for this function
      const furnitureInfo = aiService.getFurnitureInfo(selectedObjects);
      
      if (furnitureInfo.specs.length > 0) {
        addToResponseLog(`Furniture Information:`);
        addToResponseLog(furnitureInfo.summary);
      } else {
        addToResponseLog('No furniture specifications found for selected objects');
      }
    } catch (error) {
      console.error('Furniture info command failed:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Furniture info failed'}`);
    }
  };

  const executeSceneCommand = (command: SceneCommand) => {
    if (!sceneInitialized) return;
    
    try {
      switch (command.action) {
        case 'move':
          if (command.objectId) {
            updateObject(command.objectId, { 
              position: new Vector3(command.x || 0, command.y || 0, command.z || 0) 
            });
          }
          break;

        case 'color':
          if (command.objectId) {
            updateObject(command.objectId, { color: command.color || '#3498db' });
          }
          break;

        case 'scale':
          if (command.objectId) {
            // Handle both old format (x, y, z) and new format (scaleX, scaleY, scaleZ)
            const scaleX = command.scaleX || command.x || 1;
            const scaleY = command.scaleY || command.y || 1;
            const scaleZ = command.scaleZ || command.z || 1;
            
            updateObject(command.objectId, { 
              scale: new Vector3(scaleX, scaleY, scaleZ) 
            });
          }
          break;

        case 'rotate':
          if (command.objectId) {
            // Rotation values are in radians
            const rotationX = command.rotationX || 0;
            const rotationY = command.rotationY || 0;
            const rotationZ = command.rotationZ || 0;
            
            updateObject(command.objectId, { 
              rotation: new Vector3(rotationX, rotationY, rotationZ) 
            });
            
            console.log(`🔄 Rotated object ${command.objectId} to (${rotationX.toFixed(3)}, ${rotationY.toFixed(3)}, ${rotationZ.toFixed(3)}) radians`);
          }
          break;

        case 'create':
          if (command.type) {
            // Use provided name or generate a robust unique ID
            let newId = command.name;
            if (newId) {
                // Check for uniqueness
                if (sceneObjects.some(obj => obj.id === newId)) {
                    // Append a suffix to make it unique
                    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
                    const oldId = newId;
                    newId = `${newId}-${uniqueSuffix}`;
                    addToResponseLog(`Warning: Object name "${oldId}" already exists. Renaming to "${newId}".`);
                }
            } else {
                newId = `${command.type}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
            }
            
            // Determine default Y position based on object type
            // GLB objects should start at y=0 (floor level) since they have proper pivot adjustment
            // Primitive objects can start at y=1 for backward compatibility
            const isGLBObject = !command.type.startsWith('house-') && 
                               !['cube', 'sphere', 'cylinder', 'plane', 'torus', 'cone', 'nurbs', 'imported-glb', 'imported-stl', 'imported-obj'].includes(command.type);
            const defaultY = isGLBObject ? 0 : 1;
            
            const newObj: SceneObject = {
              id: newId,
              type: command.type,
              position: new Vector3(command.x || 0, command.y || defaultY, command.z || 0),
              scale: new Vector3(1, 1, 1),
              rotation: new Vector3(0, 0, 0),
              color: command.color || (command.type.startsWith('house-') ? '#8B4513' : '#3498db'),
              isNurbs: false
            };
            
            addObject(newObj);
            
            // If the command includes scaling information, apply it immediately
            if (command.scaleX || command.scaleY || command.scaleZ) {
              const scaleX = command.scaleX || 1;
              const scaleY = command.scaleY || 1;
              const scaleZ = command.scaleZ || 1;
              
              // Update with scale - use a small timeout to ensure object is created first
              setTimeout(() => {
                updateObject(newId, { 
                  scale: new Vector3(scaleX, scaleY, scaleZ) 
                });
              }, 10);
            }
            
            // Log creation with enhanced details
            console.log(`✅ Created object: ${newId} at (${command.x}, ${command.y}, ${command.z})`, {
              matchDimensions: command.matchDimensions,
              contactType: command.contactType,
              relativeToObject: command.relativeToObject,
              spatialRelation: command.spatialRelation
            });
          }
          break;

        case 'delete':
          if (command.objectId) {
            console.log('Deleting object with ID:', command.objectId);
            removeObject(command.objectId);
          }
          break;

        case 'rename':
          if (command.objectId && command.name) {
            if (sceneObjects.some(obj => obj.id === command.name)) {
              addToResponseLog(`Error: An object with the name "${command.name}" already exists.`);
            } else {
              renameObject(command.objectId, command.name);
            }
          }
          break;

        case 'align':
          if (command.objectId && command.relativeToObject && command.edge && sceneAPI) {
            const sceneManager = sceneAPI.getSceneManager();
            if (sceneManager) {
              performAlignment(command, sceneManager);
            }
          }
          break;

        case 'describe':
          if (command.description) {
            setSceneDescription(command.description);
            setShowDescriptionPanel(true);
          }
          break;

        case 'undo':
          // Call the undo function from the store
          undo();
          console.log('🔄 AI Command: Undo action executed');
          break;

        case 'redo':
          // Call the redo function from the store
          redo();
          console.log('🔄 AI Command: Redo action executed');
          break;

        case 'texture':
          if (command.objectId && command.textureId) {
            // Get the function from the store
            const { applyTextureToObject } = useSceneStore.getState();
            
            // Apply texture to the object
            applyTextureToObject(
              command.objectId, 
              command.textureId, 
              command.textureType || 'diffuse'
            );
            
            console.log(`🎨 Applied texture ${command.textureId} to object ${command.objectId} as ${command.textureType || 'diffuse'}`);
          } else if (!command.objectId) {
            console.warn('❌ Texture command missing objectId');
          } else if (!command.textureId) {
            console.warn('❌ Texture command missing textureId');
          }
          break;

        case 'analyze-space':
          handleSpaceAnalysisCommand(command);
          break;

        case 'optimize-space':
          handleSpaceOptimizationCommand(command);
          break;

        case 'furniture-info':
          handleFurnitureInfoCommand(command);
          break;
      }
    } catch (error) {
      console.error('Error executing scene command:', error);
    }
  };

  // Process AI commands with full functionality
  const processAICommand = async (inputText: string) => {
    if (!apiKey || !inputText.trim()) return;

    // Check for special keywords
    const lowerInput = inputText.trim().toLowerCase();
    if (lowerInput.includes('draw room panel')) {
      console.log('🎨 Detected "draw room panel" command');
      
      // Open the custom room modal
      if (onOpenCustomRoomModal) {
        onOpenCustomRoomModal();
        addToResponseLog('User: draw room panel');
        addToResponseLog('AI: Opening custom room drawing panel...');
      } else {
        console.warn('⚠️ onOpenCustomRoomModal callback not provided');
        addToResponseLog('Error: Custom room panel feature not available');
      }
      return;
    }

    setCurrentIsLoading(true);
    
    try {
      // Ensure we have the most current positions from the 3D meshes
      syncPositionsFromMeshes();
      
      // Give a brief moment for the store to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get the updated scene objects
      const currentSceneObjects = useSceneStore.getState().sceneObjects;
      
      // Enrich scene objects with mesh metadata for custom rooms
      const enrichedSceneObjects = currentSceneObjects.map(obj => {
        if (sceneAPI) {
          const sceneManager = sceneAPI.getSceneManager();
          const mesh = sceneManager?.getMeshById(obj.id);
          if (mesh) {
            // Ensure world matrix is up to date
            mesh.computeWorldMatrix(true);
            
            // Force refresh of bounding info to ensure accuracy
            mesh.refreshBoundingInfo(true);
            
            // Get actual bounding box dimensions
            const boundingInfo = mesh.getBoundingInfo();
            const worldMin = boundingInfo.boundingBox.minimumWorld;
            const worldMax = boundingInfo.boundingBox.maximumWorld;
            
            // Calculate actual dimensions from world bounding box
            const actualWidth = worldMax.x - worldMin.x;
            const actualHeight = worldMax.y - worldMin.y;
            const actualDepth = worldMax.z - worldMin.z;
            
            const enrichedObj = {
              ...obj,
              actualDimensions: {
                width: actualWidth,
                height: actualHeight,
                depth: actualDepth
              },
              // Store the world bounding box for debugging
              worldBounds: {
                min: { x: worldMin.x, y: worldMin.y, z: worldMin.z },
                max: { x: worldMax.x, y: worldMax.y, z: worldMax.z }
              },
              // Add room-specific metadata
              ...(obj.type === 'custom-room' && mesh.metadata && { metadata: mesh.metadata })
            } as any;
            
            return enrichedObj;
          }
        }
        return obj;
      });
      
      // Get current selection
      const { selectedObjectId: currentSelectedId, selectedObjectIds: currentSelectedIds } = useSceneStore.getState();
      
      // Debug: Log current scene objects before AI call
      console.log('🔍 Current scene objects at AI call time:');
      enrichedSceneObjects.forEach(obj => {
        console.log(`  - ${obj.id} (${obj.type}): position (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`);
        if (obj.type === 'custom-room' && (obj as any).metadata?.floorPolygon) {
          console.log(`    Floor polygon: ${(obj as any).metadata.floorPolygon.length} vertices`);
        }
      });
      
      // Debug: Log current selection
      if (currentSelectedId) {
        console.log(`🎯 Currently selected object: ${currentSelectedId}`);
      } else if (currentSelectedIds.length > 0) {
        console.log(`🎯 Currently selected objects: ${currentSelectedIds.join(', ')}`);
      }

      // In a real application, this list would ideally be fetched dynamically
      // or generated at build time to avoid maintaining a static list here.
      const glbObjectNames = [
        'Adjustable Desk', 'Bathtub', 'Bed Double', 'Bed Single', 'Bookcase', 
        'Chair', 'Clothes dryer', 'Couch Small', 'Desk', 'Fan', 'Kitchen Fridge', 
        'Light Desk', 'Light Stand', 'Oven', 'Simple computer', 'Simple table', 
        'Sofa', 'Standing Desk', 'Table', 'Toilet', 'TV', 'wooden bookshelf'
      ];

      const aiService = createAIService(apiKey, glbObjectNames);
      const result = await aiService.getSceneCommands(inputText, enrichedSceneObjects, currentSelectedId, currentSelectedIds);
      
      if (result.success && result.commands) {
        // Log the user prompt and AI response
        if (result.userPrompt) {
          addToResponseLog(`User: ${result.userPrompt}`);
        }
        if (result.aiResponse) {
          addToResponseLog(`AI: ${result.aiResponse}`);
        }
        
        // Execute all commands
        console.log('Executing commands:', result.commands);
        result.commands.forEach(command => executeSceneCommand(command));
        
        // Add AI response to chat
        const aiMessage: Message = {
          id: Date.now().toString(),
          content: result.aiResponse || 'Command executed successfully.',
          sender: 'ai',
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev.slice(0, -1), aiMessage]);
      } else {
        // Log error
        const errorMessage = result.error || 'Unknown error occurred';
        console.error('AI service error:', errorMessage);
        addToResponseLog(`Error: ${errorMessage}`);
        
        if (result.userPrompt) {
          addToResponseLog(`User: ${result.userPrompt}`);
        }
        if (result.aiResponse) {
          addToResponseLog(`AI: ${result.aiResponse}`);
        }
        
        // Add error response to chat
        const errorAiMessage: Message = {
          id: Date.now().toString(),
          content: result.aiResponse || `Error: ${errorMessage}`,
          sender: 'ai',
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev.slice(0, -1), errorAiMessage]);
      }
    } catch (error) {
      console.error('Error in AI service:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Add error response to chat
      const errorAiMessage: Message = {
        id: Date.now().toString(),
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'ai',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev.slice(0, -1), errorAiMessage]);
    } finally {
      setCurrentIsLoading(false);
    }
  };

  // Voice input processing function
  const processVoiceInput = async (audioResult: any) => {
    console.log('🎙️ Processing voice input...', audioResult);
    
    if (!apiKey || !audioResult) {
      console.error('❌ Missing API key or audio result');
      addToResponseLog('Error: Cannot process voice input - missing API key or audio');
      return;
    }

    setCurrentIsLoading(true);
    
    try {
      // Ensure we have the most current positions from the 3D meshes
      syncPositionsFromMeshes();
      
      // Give a brief moment for the store to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get the updated scene objects
      const currentSceneObjects = useSceneStore.getState().sceneObjects;
      
      // Enrich scene objects with mesh metadata for custom rooms
      const enrichedSceneObjects = currentSceneObjects.map(obj => {
        if (sceneAPI) {
          const sceneManager = sceneAPI.getSceneManager();
          const mesh = sceneManager?.getMeshById(obj.id);
          if (mesh) {
            // Ensure world matrix is up to date
            mesh.computeWorldMatrix(true);
            
            // Force refresh of bounding info to ensure accuracy
            mesh.refreshBoundingInfo(true);
            
            // Get actual bounding box dimensions
            const boundingInfo = mesh.getBoundingInfo();
            const worldMin = boundingInfo.boundingBox.minimumWorld;
            const worldMax = boundingInfo.boundingBox.maximumWorld;
            
            // Calculate actual dimensions from world bounding box
            const actualWidth = worldMax.x - worldMin.x;
            const actualHeight = worldMax.y - worldMin.y;
            const actualDepth = worldMax.z - worldMin.z;
            
            const enrichedObj = {
              ...obj,
              actualDimensions: {
                width: actualWidth,
                height: actualHeight,
                depth: actualDepth
              },
              // Store the world bounding box for debugging
              worldBounds: {
                min: { x: worldMin.x, y: worldMin.y, z: worldMin.z },
                max: { x: worldMax.x, y: worldMax.y, z: worldMax.z }
              },
              // Add room-specific metadata
              ...(obj.type === 'custom-room' && mesh.metadata && { metadata: mesh.metadata })
            } as any;
            
            return enrichedObj;
          }
        }
        return obj;
      });
      
      // Get current selection
      const { selectedObjectId: currentSelectedId, selectedObjectIds: currentSelectedIds } = useSceneStore.getState();
      
      // Debug: Log current scene objects before AI call
      console.log('🔍 Current scene objects at voice AI call time:');
      enrichedSceneObjects.forEach(obj => {
        console.log(`  - ${obj.id} (${obj.type}): position (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`);
        if (obj.type === 'custom-room' && (obj as any).metadata?.floorPolygon) {
          console.log(`    Floor polygon: ${(obj as any).metadata.floorPolygon.length} vertices`);
        }
      });

      // In a real application, this list would ideally be fetched dynamically
      // or generated at build time to avoid maintaining a static list here.
      const glbObjectNames = [
        'Adjustable Desk', 'Bathtub', 'Bed Double', 'Bed Single', 'Bookcase', 
        'Chair', 'Clothes dryer', 'Couch Small', 'Desk', 'Fan', 'Kitchen Fridge', 
        'Light Desk', 'Light Stand', 'Oven', 'Simple computer', 'Simple table', 
        'Sofa', 'Standing Desk', 'Table', 'Toilet', 'TV', 'wooden bookshelf'
      ];

      const aiService = createAIService(apiKey, glbObjectNames);
      
      // Set up transcription progress callback
      const unsubscribeProgress = aiService.onTranscriptionProgress((progress) => {
        console.log('📊 Transcription progress:', progress);
      });

      const result = await aiService.processVoiceInput(
        audioResult,
        enrichedSceneObjects,
        currentSelectedId,
        currentSelectedIds
      );
      
      // Clean up progress callback
      unsubscribeProgress();

      console.log('🎙️ Voice input processing result:', result);

      if (result.commandResult.success && result.commandResult.commands) {
        // Log the transcribed text and AI response
        addToResponseLog(`Voice: "${result.transcriptionResult.text}"`);
        
        if (result.commandResult.aiResponse) {
          addToResponseLog(`AI: ${result.commandResult.aiResponse}`);
        }
        
        // Execute all commands
        console.log('Executing voice commands:', result.commandResult.commands);
        result.commandResult.commands.forEach(command => executeSceneCommand(command));
        
        // Also put the transcribed text in the message input for user to see/edit
        setMessage(result.transcriptionResult.text);
        
        // Add to chat messages
        const userMessage: Message = {
          id: Date.now().toString(),
          content: result.transcriptionResult.text,
          sender: 'user',
          timestamp: new Date(),
        };
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: result.commandResult.aiResponse || 'Voice command executed successfully.',
          sender: 'ai',
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, userMessage, aiMessage]);
      } else {
        // Log error
        const errorMessage = result.commandResult.error || 'Unknown error occurred';
        console.error('Voice AI service error:', errorMessage);
        addToResponseLog(`Error: ${errorMessage}`);
        
        if (result.transcriptionResult.text) {
          addToResponseLog(`Transcribed: "${result.transcriptionResult.text}"`);
          // Put the transcribed text in the text input even if command failed
          setMessage(result.transcriptionResult.text);
        }
        
        if (result.commandResult.aiResponse) {
          addToResponseLog(`AI: ${result.commandResult.aiResponse}`);
        }
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Unknown voice processing error'}`);
    } finally {
      setCurrentIsLoading(false);
    }
  };

  // Dock animation values - same as dock.tsx
  const mouseX = useMotionValue(Infinity);
  const DEFAULT_SIZE = 40;
  const DEFAULT_MAGNIFICATION = 60;
  const DEFAULT_DISTANCE = 140;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !currentIsLoading && sceneInitialized) {
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
      
      // Process AI command instead of just calling onSubmit
      processAICommand(message.trim());
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
              
              if (finalMessage.trim() && !currentIsLoading && sceneInitialized) {
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
                
                // Process AI command
                processAICommand(finalMessage.trim());
                
                // Clear the input
                setMessage('');
                
                console.log('✅ Auto-submit completed');
              } else {
                console.warn('⚠️ Cannot auto-submit:', { 
                  hasMessage: !!finalMessage.trim(), 
                  isLoading: currentIsLoading, 
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
    if (!currentIsLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.isLoading) {
        // This will be handled by the processAICommand function
      }
    }
  }, [currentIsLoading, messages.length]);

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
              <div className="flex items-center justify-between pl-4 py-4 border-b border-white/10 bg-white/5 rounded-t-2xl" style={{ paddingRight: '8px' }}>
                <div className="flex items-center gap-3">
                  <div 
                    className={cn(
                      "w-2 h-2 rounded-full",
                      sceneInitialized ? "bg-green-400" : "bg-red-400"
                    )} 
                    style={{ marginLeft: '16px' }}
                  />
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
                  className="text-white/80 hover:text-white hover:bg-white/10 !px-4 !py-2"
                  style={{ transform: 'translateX(-8px)' }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 min-h-0 overflow-hidden">
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

              {/* AI-Triggered Space Analysis Report */}
              {showSpaceReport && spaceAnalysisResult && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">📊 Space Analysis Report</h3>
                      <button 
                        onClick={() => setShowSpaceReport(false)}
                        className="text-white/80 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Object Count Display */}
                    <div className="mb-4">
                      <ObjectCountDisplay
                        objectsPlaced={getOptimizedObjectCount()}
                        maxObjectsPossible={spaceAnalysisResult.optimization.maxObjects}
                        objectType={spaceAnalysisResult.furnitureSpec.type}
                        roomArea={spaceAnalysisResult.roomAnalysis.area}
                        efficiency={spaceAnalysisResult.optimization.efficiency}
                        onClearObjects={clearOptimizedObjects}
                        optimizedObjectCount={getOptimizedObjectCount()}
                        className="text-white"
                      />
                    </div>

                    {/* Detailed Metrics and Compliance */}
                    <div className="mb-4">
                      <SpaceMetricsDisplay
                        analysisResult={spaceAnalysisResult}
                        fireSafetyResult={fireSafetyResult || undefined}
                        className="text-white"
                      />
                    </div>

                    {/* Clearance Feedback Panel */}
                    <div className="mb-4">
                      <ClearanceFeedbackPanel
                        onFeedbackSubmitted={(result) => {
                          addToResponseLog(`Clearance adjusted: ${result.adjustmentReason}`);
                          addToResponseLog(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
                          if (result.affectedObjects.length > 0) {
                            addToResponseLog(`${result.affectedObjects.length} nearby objects affected`);
                          }
                        }}
                        className="text-white"
                      />
                    </div>

                    {/* Alternative Options */}
                    {spaceAnalysisResult.alternativeOptions.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-white font-medium mb-2">💡 Alternative Options:</h5>
                        <div className="space-y-2">
                          {spaceAnalysisResult.alternativeOptions.slice(0, 3).map((alt, index) => (
                            <div key={index} className="flex justify-between items-center bg-white/5 rounded-lg p-2">
                              <span className="text-white/90">{alt.objectType}:</span>
                              <div className="flex items-center gap-2">
                                <span className="text-white">{alt.maxCount} objects</span>
                                <span className="text-white/70">({(alt.efficiency * 100).toFixed(0)}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {spaceAnalysisResult.optimization.warnings.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-white font-medium mb-2">⚠️ Warnings:</h5>
                        <ul className="list-disc list-inside text-white/90 space-y-1">
                          {spaceAnalysisResult.optimization.warnings.map((warning, index) => (
                            <li key={index} className="text-sm">{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {spaceAnalysisResult.recommendations.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-white font-medium mb-2">💡 Recommendations:</h5>
                        <ul className="list-disc list-inside text-white/90 space-y-1">
                          {spaceAnalysisResult.recommendations.map((rec, index) => (
                            <li key={index} className="text-sm">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="px-4 py-2 border-t border-black/10">
                <Marquee className="[--duration:20s]" pauseOnHover={true}>
                  {[
                    { label: 'Create', icon: Plus },
                    { label: 'Move', icon: Move },
                    { label: 'Color', icon: Palette },
                    { label: 'Delete', icon: Trash2 },
                    { label: 'Draw Room Panel', icon: PenTool }
                  ].map((action) => (
                    <motion.button
                      key={action.label}
                      onClick={() => handleQuickAction(action.label)}
                      className="flex items-center gap-1 px-2 py-1 mx-0.5 rounded-full !bg-black/10 hover:!bg-white/20 transition-colors duration-200 text-xs text-white/80 hover:text-white"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <action.icon size={12} />
                      <span>{action.label}</span>
                    </motion.button>
                  ))}
                </Marquee>
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
                    disabled={currentIsLoading || !sceneInitialized}
                    sendButtonDisabled={!message.trim() || currentIsLoading || !sceneInitialized}
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

        {/* Scene Description Panel */}
        {showDescriptionPanel && (
          <SceneDescriptionPanel 
            description={sceneDescription} 
            onClose={() => setShowDescriptionPanel(false)} 
          />
        )}
      </div>
    </>
  );
} 