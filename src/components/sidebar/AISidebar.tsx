import React from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import { createAIService, type SceneCommand } from '../../ai/ai.service';
import type { SceneObject } from '../../types/types';
import { SceneGraph } from './SceneGraph';
import { PropertiesPanel } from './PropertiesPanel';
import { ImportButton } from './ImportButton';
import { ExportButton } from './ExportButton';
import { SpaceOptimizationPanel } from './SpaceOptimizationPanel';
import { createGLBImporter } from '../../babylon/glbImporter';
import { createSTLExporter } from '../../babylon/stlExporter';
import { spaceAnalysisService } from '../../services/spaceAnalysisService';
import type { SpaceAnalysisResult } from '../../services/spaceAnalysisService';
import { placementConstraintsService, type FireSafetyValidationResult } from '../../services/placementConstraintsService';
// Add voice input imports
import { VoiceInputButton } from '../ui/VoiceInputButton';
import { createAudioRecordingService } from '../../services/audioRecordingService';
import type { AudioRecordingService, AudioRecordingResult } from '../../services/audioRecordingService';
// Import report UI components
import { ObjectCountDisplay } from '../ui/ObjectCountDisplay';
import { SpaceMetricsDisplay } from '../ui/SpaceMetricsDisplay';
import { ClearanceFeedbackPanel } from '../ui/ClearanceFeedbackPanel';
import '../ui/VoiceInputButton.css';

interface AISidebarProps {
  apiKey: string;
  sceneInitialized: boolean;
  sceneAPI?: {
    getSceneManager: () => any;
  };
  onOpenCustomRoomModal?: () => void;
}

const SceneDescriptionPanel = ({ description, onClose }: { description: string, onClose: () => void }) => {
  if (!description) return null;

  return (
    <div className="scene-description-panel">
      <div className="scene-description-header">
        <h3>Scene Description</h3>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      <p className="scene-description-text">{description}</p>
    </div>
  );
};

export const AISidebar: React.FC<AISidebarProps> = ({ 
  apiKey, 
  sceneInitialized,
  sceneAPI,
  onOpenCustomRoomModal
}) => {
  const {
    sidebarCollapsed,
    isLoading,
    textInput,
    responseLog,
    sceneObjects,
    importError,
    // Voice recording state
    isRecording,
    recordingState,
    transcriptionProgress,
    voiceInputEnabled,
    setSidebarCollapsed,
    setTextInput,
    setIsLoading,
    addToResponseLog,
    updateObject,
    addObject,
    removeObject,
    renameObject,
    startImport,
    importSuccess,
    setImportError,
    clearImportError,
    undo,
    redo,
    // Voice recording actions
    setRecordingState,
    setTranscriptionProgress,
    setVoiceInputEnabled,
  } = useSceneStore();

  const [showDescriptionPanel, setShowDescriptionPanel] = React.useState(false);
  const [sceneDescription, setSceneDescription] = React.useState('');
  
  // Space analysis report state
  const [spaceAnalysisResult, setSpaceAnalysisResult] = React.useState<SpaceAnalysisResult | null>(null);
  const [fireSafetyResult, setFireSafetyResult] = React.useState<FireSafetyValidationResult | null>(null);
  const [showSpaceReport, setShowSpaceReport] = React.useState(false);
  
  // Voice input state
  const [audioRecordingService, setAudioRecordingService] = React.useState<AudioRecordingService | null>(null);

  // Initialize audio recording service
  React.useEffect(() => {
    if (voiceInputEnabled && !audioRecordingService) {
      console.log('🎤 Initializing audio recording service...');
      
      try {
        const service = createAudioRecordingService();
        
        // Subscribe to recording state changes
        const unsubscribe = service.onStateChange((state) => {
          console.log('🎤 Recording state changed:', state);
          setRecordingState(state);
        });
        
        setAudioRecordingService(service);
        console.log('✅ Audio recording service initialized');
        
        // Cleanup function
        return () => {
          console.log('🧹 Cleaning up audio recording service...');
          unsubscribe();
          service.cleanup();
        };
      } catch (error) {
        console.error('❌ Failed to initialize audio recording service:', error);
        addToResponseLog(`Error: Failed to initialize voice input - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [voiceInputEnabled, audioRecordingService, setRecordingState, addToResponseLog]);

  // Listen for Ctrl+V keyboard shortcut to toggle voice recording
  React.useEffect(() => {
    const handleKeyboardToggleVoiceRecording = (event: CustomEvent) => {
      console.log('⚡ Received voice recording toggle event from keyboard shortcut');
      
      if (voiceInputEnabled && audioRecordingService && sceneInitialized && !isLoading) {
        console.log('✅ Conditions met, toggling voice recording via Ctrl+V');
        // Use the audio recording service directly
        if (audioRecordingService) {
          audioRecordingService.toggleRecording()
            .then((audioResult) => {
              if (audioResult) {
                // Recording was stopped, process the voice input
                console.log('✅ Voice recording completed via keyboard, processing...');
                addToResponseLog('🔄 Processing voice input...');
                processVoiceInput(audioResult).catch((error) => {
                  console.error('❌ Error processing voice input from keyboard:', error);
                });
              } else {
                // Recording was started
                addToResponseLog('🎤 Voice recording started via Ctrl+V - speak your command...');
              }
            })
            .catch((error) => {
              console.error('❌ Error toggling voice recording via keyboard:', error);
              addToResponseLog(`Error: Voice recording failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
            });
        }
      } else {
        console.log('❌ Cannot toggle voice recording - conditions not met:', {
          voiceInputEnabled,
          hasAudioService: !!audioRecordingService,
          sceneInitialized,
          isLoading
        });
        
        if (!voiceInputEnabled) {
          addToResponseLog('Voice input is disabled. Enable it using the microphone button.');
        } else if (!sceneInitialized) {
          addToResponseLog('Scene not initialized yet. Please wait.');
        } else if (isLoading) {
          addToResponseLog('Please wait for current operation to complete.');
        } else {
          addToResponseLog('Voice input not ready. Please try again.');
        }
      }
    };

    // Listen for the custom event
    window.addEventListener('toggleVoiceRecording', handleKeyboardToggleVoiceRecording as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('toggleVoiceRecording', handleKeyboardToggleVoiceRecording as EventListener);
    };
  }, [voiceInputEnabled, audioRecordingService, sceneInitialized, isLoading, addToResponseLog]);

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
        const { selectedObjectIds } = useSceneStore.getState();
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
      const { selectedObjectIds } = useSceneStore.getState();
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
      const { selectedObjectIds } = useSceneStore.getState();
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

  const handleImportGLB = async (file: File) => {
    if (!sceneInitialized || !sceneAPI) {
      console.error('Scene not initialized');
      return;
    }

    const sceneManager = sceneAPI.getSceneManager();
    if (!sceneManager || !sceneManager.scene) {
      console.error('Scene manager not available');
      return;
    }

    // Clear any previous import error
    clearImportError();
    
    // Start the import process
    startImport();

    try {
      // Create model importer with scene and sceneManager
      const importer = createGLBImporter(sceneManager.scene, sceneManager);
      
      // Import the file
      const sceneObject = await importer.importModel(file);
      
      // Add the imported object to the scene
      addObject(sceneObject);
      
      // Success!
      importSuccess();
      addToResponseLog(`Success: Imported 3D model "${file.name}"`);
      
    } catch (error: any) {
      console.error('Import failed:', error);
      
      // Set the import error based on the error message
      let errorType: 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'LOADING_FAILED' = 'LOADING_FAILED';
      
      if (error instanceof Error) {
        if (error.message === 'FILE_TOO_LARGE') {
          errorType = 'FILE_TOO_LARGE';
        } else if (error.message === 'INVALID_FORMAT') {
          errorType = 'INVALID_FORMAT';
        }
      }
      
      setImportError({
        type: errorType,
        message: 'IMPORT FAILED'
      });
      
      addToResponseLog('Error: IMPORT FAILED');
    }
  };

  const handleExportSTL = async () => {
    if (!sceneInitialized || !sceneAPI) {
      console.error('Scene not initialized');
      return;
    }

    const sceneManager = sceneAPI.getSceneManager();
    if (!sceneManager || !sceneManager.scene) {
      console.error('Scene manager not available');
      return;
    }

    try {
      // Create STL exporter
      const exporter = createSTLExporter(sceneManager.scene);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `vibecad-export-${timestamp}.stl`;
      
      // Export the scene
      await exporter.exportSceneToSTL(sceneObjects, filename);
      
      // Success!
      addToResponseLog(`Success: Exported scene to "${filename}"`);
      
    } catch (error: any) {
      console.error('Export failed:', error);
      addToResponseLog(`Error: Export failed - ${error.message || 'Unknown error'}`);
    }
  };

  // Voice input handlers
  const handleStartVoiceRecording = async () => {
    console.log('🎤 Starting voice recording...');
    
    if (!audioRecordingService) {
      console.error('❌ Audio recording service not initialized');
      addToResponseLog('Error: Voice input not initialized');
      return;
    }

    try {
      await audioRecordingService.startRecording();
      addToResponseLog('🎤 Voice recording started - speak your command...');
    } catch (error) {
      console.error('❌ Failed to start voice recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addToResponseLog(`Error: Failed to start voice recording - ${errorMessage}`);
    }
  };

  const handleStopVoiceRecording = async () => {
    console.log('🛑 Stopping voice recording...');
    
    if (!audioRecordingService) {
      console.error('❌ Audio recording service not initialized');
      return;
    }

    try {
      const audioResult = await audioRecordingService.stopRecording();
      
      if (audioResult) {
        console.log('✅ Voice recording completed, processing...');
        addToResponseLog('🔄 Processing voice input...');
        await processVoiceInput(audioResult);
      } else {
        console.warn('⚠️ No audio recorded');
        addToResponseLog('Warning: No audio was recorded');
      }
    } catch (error) {
      console.error('❌ Failed to stop voice recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addToResponseLog(`Error: Failed to stop voice recording - ${errorMessage}`);
    }
  };

  const handleToggleVoiceRecording = async () => {
    console.log('🔄 Toggling voice recording...');
    
    if (!audioRecordingService) {
      console.error('❌ Audio recording service not initialized');
      return;
    }

    try {
      if (isRecording) {
        await handleStopVoiceRecording();
      } else {
        await handleStartVoiceRecording();
      }
    } catch (error) {
      console.error('❌ Error toggling voice recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addToResponseLog(`Error: Voice recording failed - ${errorMessage}`);
    }
  };

  const processVoiceInput = async (audioResult: AudioRecordingResult) => {
    console.log('🎙️ Processing voice input...', audioResult);
    
    if (!apiKey || !audioResult) {
      console.error('❌ Missing API key or audio result');
      addToResponseLog('Error: Cannot process voice input - missing API key or audio');
      return;
    }

    setIsLoading(true);
    
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
            
            const enrichedObj: any = {
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
              }
            };
            
            // Add room-specific metadata
            if (obj.type === 'custom-room' && mesh.metadata) {
              enrichedObj.metadata = mesh.metadata;
            }
            
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
        setTranscriptionProgress(progress);
      });

      const result = await aiService.processVoiceInput(
        audioResult,
        enrichedSceneObjects,
        currentSelectedId,
        currentSelectedIds
      );
      
      // Clean up progress callback
      unsubscribeProgress();
      setTranscriptionProgress(null);

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
        
        // Also put the transcribed text in the text input for user to see/edit
        setTextInput(result.transcriptionResult.text);
      } else {
        // Log error
        const errorMessage = result.commandResult.error || 'Unknown error occurred';
        console.error('Voice AI service error:', errorMessage);
        addToResponseLog(`Error: ${errorMessage}`);
        
        if (result.transcriptionResult.text) {
          addToResponseLog(`Transcribed: "${result.transcriptionResult.text}"`);
          // Put the transcribed text in the text input even if command failed
          setTextInput(result.transcriptionResult.text);
        }
        
        if (result.commandResult.aiResponse) {
          addToResponseLog(`AI: ${result.commandResult.aiResponse}`);
        }
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Unknown voice processing error'}`);
    } finally {
      setIsLoading(false);
      setTranscriptionProgress(null);
    }
  };

  const handleSubmitPrompt = async () => {
    if (!apiKey || !textInput.trim()) return;

    // Check for special keywords
    const lowerInput = textInput.trim().toLowerCase();
    if (lowerInput.includes('draw room panel')) {
      console.log('🎨 Detected "draw room panel" command');
      
      // Open the custom room modal
      if (onOpenCustomRoomModal) {
        onOpenCustomRoomModal();
        setTextInput(''); // Clear the input
        addToResponseLog('User: draw room panel');
        addToResponseLog('AI: Opening custom room drawing panel...');
      } else {
        console.warn('⚠️ onOpenCustomRoomModal callback not provided');
        addToResponseLog('Error: Custom room panel feature not available');
      }
      return;
    }

    setIsLoading(true);
    
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
            
            const enrichedObj: any = {
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
              }
            };
            
            // Add room-specific metadata
            if (obj.type === 'custom-room' && mesh.metadata) {
              enrichedObj.metadata = mesh.metadata;
            }
            
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
      const result = await aiService.getSceneCommands(textInput, enrichedSceneObjects, currentSelectedId, currentSelectedIds);
      
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
      }
    } catch (error) {
      console.error('Error in AI service:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setTextInput('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for Cmd+Enter on macOS or Ctrl+Enter on other systems
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      // Prevent the default action of adding a new line
      event.preventDefault();
      
      // Check if the submit button would be active, and if so, submit the prompt
      if (!isLoading && textInput.trim() && sceneInitialized) {
        handleSubmitPrompt();
      }
    }
  };

  return (
    <div className={`ai-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="ai-sidebar-header">
        <h3>AI Assistant</h3>
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '◀' : '▶'}
        </button>
      </div>
      
      {!sidebarCollapsed && (
        <div className="ai-sidebar-content">
          {showDescriptionPanel && <SceneDescriptionPanel description={sceneDescription} onClose={() => setShowDescriptionPanel(false)} />}
          
          {!sceneInitialized && (
            <div className="loading-indicator">
              <p>Initializing 3D scene...</p>
            </div>
          )}
          
          {/* AI Control Group */}
          <div className="ai-control-group">
            <label htmlFor="ai-prompt">Natural Language Commands:</label>
            <div className="ai-input-container">
              <textarea
                id="ai-prompt"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Try: 'move the cube to the right', 'make the cube blue', 'create a red sphere above the cube', 'apply wood texture', 'make it brick'"
                className="ai-text-input"
                disabled={isLoading || !sceneInitialized}
              />
              {voiceInputEnabled && (
                <div className="voice-input-controls">
                  <VoiceInputButton
                    disabled={isLoading || !sceneInitialized || !audioRecordingService}
                    recordingState={recordingState || undefined}
                    transcriptionProgress={transcriptionProgress || undefined}
                    onStartRecording={handleStartVoiceRecording}
                    onStopRecording={handleStopVoiceRecording}
                    onToggle={handleToggleVoiceRecording}
                    size="medium"
                    variant="primary"
                    showAudioLevel={true}
                  />
                </div>
              )}
            </div>
            <div className="ai-button-group">
              <button 
                onClick={handleSubmitPrompt}
                disabled={isLoading || !textInput.trim() || !sceneInitialized}
                className="ai-submit-button"
              >
                {isLoading ? 'Processing...' : 'Execute AI Command'}
              </button>
              <button 
                onClick={() => setVoiceInputEnabled(!voiceInputEnabled)}
                className={`voice-toggle-button ${voiceInputEnabled ? 'enabled' : 'disabled'}`}
                title={voiceInputEnabled ? 'Disable voice input' : 'Enable voice input'}
              >
                {voiceInputEnabled ? '🎤' : '🎤'}
              </button>
            </div>
          </div>

          {/* Import GLB Control */}
          <div className="ai-control-group">
            <label>Import 3D Model:</label>
            <ImportButton 
              onImport={handleImportGLB}
              disabled={!sceneInitialized}
            />
            {importError && (
              <div className="import-error-message">
                {importError.message}
              </div>
            )}
          </div>

          {/* Export STL Control */}
          <div className="ai-control-group">
            <label>Export Scene:</label>
            <ExportButton
              onExport={handleExportSTL}
              disabled={!sceneInitialized}
              objectCount={sceneObjects.filter(obj => obj.type !== 'ground').length}
            />
          </div>

          {/* Space Optimization Panel */}
          <SpaceOptimizationPanel sceneAPI={sceneAPI} />

          {/* AI-Triggered Space Analysis Report */}
          {showSpaceReport && spaceAnalysisResult && (
            <div className="ai-control-group space-analysis-report">
              <div className="report-header">
                <label>📊 AI Space Analysis Report:</label>
                <button 
                  className="close-button"
                  onClick={() => setShowSpaceReport(false)}
                  title="Close report"
                >
                  ×
                </button>
              </div>
              
              {/* Object Count Display */}
              <ObjectCountDisplay
                objectsPlaced={getOptimizedObjectCount()}
                maxObjectsPossible={spaceAnalysisResult.optimization.maxObjects}
                objectType={spaceAnalysisResult.furnitureSpec.type}
                roomArea={spaceAnalysisResult.roomAnalysis.area}
                efficiency={spaceAnalysisResult.optimization.efficiency}
                onClearObjects={clearOptimizedObjects}
                optimizedObjectCount={getOptimizedObjectCount()}
                className="mb-4"
              />

              {/* Detailed Metrics and Compliance */}
              <SpaceMetricsDisplay
                analysisResult={spaceAnalysisResult}
                fireSafetyResult={fireSafetyResult || undefined}
                className="mb-4"
              />

              {/* Clearance Feedback Panel */}
              <ClearanceFeedbackPanel
                onFeedbackSubmitted={(result) => {
                  addToResponseLog(`Clearance adjusted: ${result.adjustmentReason}`);
                  addToResponseLog(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
                  if (result.affectedObjects.length > 0) {
                    addToResponseLog(`${result.affectedObjects.length} nearby objects affected`);
                  }
                }}
                className="mb-4"
              />

              {/* Alternative Options */}
              {spaceAnalysisResult.alternativeOptions.length > 0 && (
                <div className="alternative-options">
                  <h5>💡 Alternative Options:</h5>
                  <div className="alternatives-list">
                    {spaceAnalysisResult.alternativeOptions.slice(0, 3).map((alt, index) => (
                      <div key={index} className="alternative-item">
                        <span className="alt-type">{alt.objectType}:</span>
                        <span className="alt-count">{alt.maxCount} objects</span>
                        <span className="alt-efficiency">({(alt.efficiency * 100).toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {spaceAnalysisResult.optimization.warnings.length > 0 && (
                <div className="warnings">
                  <h5>⚠️ Warnings:</h5>
                  <ul>
                    {spaceAnalysisResult.optimization.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {spaceAnalysisResult.recommendations.length > 0 && (
                <div className="recommendations">
                  <h5>💡 Recommendations:</h5>
                  <ul>
                    {spaceAnalysisResult.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Scene Graph Component */}
          <SceneGraph />

          {/* Properties Panel Component */}
          <PropertiesPanel />

          {/* Keyboard Shortcuts */}
          <div className="ai-control-group">
            <label>Keyboard Shortcuts:</label>
            <div className="keyboard-shortcuts">
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+A</span>
                <span className="shortcut-desc">Select All</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+I</span>
                <span className="shortcut-desc">Invert Selection</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+D</span>
                <span className="shortcut-desc">Duplicate</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+T</span>
                <span className="shortcut-desc">Reset Transform</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+G</span>
                <span className="shortcut-desc">Toggle Snap to Grid</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">M</span>
                <span className="shortcut-desc">Move Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">R</span>
                <span className="shortcut-desc">Rotate Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">S</span>
                <span className="shortcut-desc">Scale Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Delete</span>
                <span className="shortcut-desc">Delete Selected</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Esc</span>
                <span className="shortcut-desc">Deselect All</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+V</span>
                <span className="shortcut-desc">Toggle Voice Input</span>
              </div>
            </div>
          </div>

          {/* AI Response Log */}
          <div className="ai-control-group">
            <label>AI Response Log:</label>
            <div className="ai-response-log">
              {responseLog.slice(-8).map((log, index) => (
                <div key={index} className={`ai-log-entry ${log.startsWith('User:') ? 'user' : log.startsWith('AI:') ? 'ai' : 'error'}`}>
                  {log}
                </div>
              ))}
              {responseLog.length === 0 && (
                <div className="ai-log-entry ai-log-empty">
                  No AI responses yet. Try entering a command above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};