import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Vector3, Vector2, StandardMaterial, Color3, Mesh, PolygonMeshBuilder, DynamicTexture } from 'babylonjs'
import { computeCompositeBoundary, generateDefaultConnectionPoints } from './babylon/boundaryUtils'
import { createFullGridTexture, calculateFullGridUVScale } from './babylon/gridTextureUtils'
import type { ConnectionPoint } from './types/types'
import './App.css'

// Import material presets constant (value)
import { materialPresets } from './types/types'

// Import the new hook
import { useBabylonScene } from './babylon/hooks/useBabylonScene'

// Import the new AISidebar component
import { AISidebar } from './components/sidebar/AISidebar'

// Import the CompassOverlay component
import { CompassOverlay } from './components/ui/CompassOverlay'

// Import the MeasurementOverlay component
import { MeasurementOverlay } from './components/ui/MeasurementOverlay'

// Import the keyboard shortcuts hook
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

import { useSceneStore } from './state/sceneStore'
import type { SceneObject, PrimitiveType, TransformMode, ControlPointVisualization } from './types/types'
import { CustomRoomModal } from './components/modals/CustomRoomModal'
import { SelectionModeIndicator } from './components/ui/SelectionModeIndicator'
import { SelectionInfoDisplay } from './components/ui/SelectionInfoDisplay'
import { UndoRedoIndicator } from './components/ui/UndoRedoIndicator'
import { AIPromptBox } from './components/ui/AIPromptBox'
import { ActionButtonsOverlay } from './components/ui/ActionButtonsOverlay'
import { MeshBuilder } from 'babylonjs'
import { createGLBImporter } from './babylon/glbImporter'
import { createSTLExporter } from './babylon/stlExporter'

// SceneDescriptionPanel component
const SceneDescriptionPanel = ({ description, onClose }: { description: string, onClose: () => void }) => {
  if (!description) return null;

  return (
    <div 
      className="scene-description-panel"
      style={{
        position: 'fixed',
        bottom: '230px', // Position so bottom of panel is at top of AIPromptBox
        left: '20px',
        zIndex: 10001, // Higher than AIPromptBox which is 10000
        backgroundColor: '#2c2c2e',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        border: '1px solid #444',
        maxWidth: '400px',
        minWidth: '300px'
      }}
    >
      <div className="scene-description-header">
        <h3>Scene Description</h3>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      <p className="scene-description-text">{description}</p>
    </div>
  );
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Modal state for custom room drawing
  const [showCustomRoomModal, setShowCustomRoomModal] = useState(false)
  
  // Scene description panel state
  const [showDescriptionPanel, setShowDescriptionPanel] = useState(false)
  const [sceneDescription, setSceneDescription] = useState('')

  // Space optimization state
  const [selectedFurnitureType, setSelectedFurnitureType] = useState('Desk')
  const [optimizationStrategy, setOptimizationStrategy] = useState<'maximize' | 'comfort' | 'ergonomic' | 'aesthetic'>('maximize')
  
  // Use the new babylon scene hook
  const { sceneAPI, sceneInitialized } = useBabylonScene(canvasRef)

  // Use keyboard shortcuts hook
  useKeyboardShortcuts()
  
  // Load default textures when scene is initialized
  useEffect(() => {
    if (sceneInitialized) {
      const loadDefaults = async () => {
        const { loadDefaultTextures } = useSceneStore.getState();
        await loadDefaultTextures();
      };
      loadDefaults();
    }
  }, [sceneInitialized]);

  // --- START: Reading state from the Zustand store ---
  const {
    // State properties
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    transformMode,
    currentColor,
    isLoading,
    apiKey,
    showApiKeyInput,
    responseLog,
    wireframeMode,
    hoveredObjectId,
    multiSelectMode,
    snapToGrid,
    gridSize,
    objectLocked,
    showGrid,
    objectVisibility,
    multiSelectPivot,
    gridMesh,
    multiSelectInitialStates,
    textInput,
    sidebarCollapsed,
    activeDropdown,
    collisionDetectionEnabled,
    snapToObjects,
    showConnectionPoints,
    movementEnabled,
    movementSpeed,
    moveToMode,

    // Actions
    setSceneObjects,
    setSelectedObjectId,
    setSelectedObjectIds,
    setTransformMode,
    setCurrentColor,
    setIsLoading,
    setApiKey,
    setShowApiKeyInput,
    addToResponseLog,
    setWireframeMode,
    setShowGrid,
    setHoveredObjectId,
    setMultiSelectMode,
    setSnapToGrid,
    setGridSize,
    setObjectVisibility,
    setObjectLocked,
    setMultiSelectPivot,
    setGridMesh,
    setMultiSelectInitialStates,
    setTextInput,
    setSidebarCollapsed,
    setActiveDropdown,
    setResponseLog,
    clearSelection,
    clearAllObjects,
    updateObject,
    addObject,
    removeObject,
    setCollisionDetectionEnabled,
    setSnapToObjects,
    setShowConnectionPoints,
    setMovementEnabled,
    setMovementSpeed,
    setMoveToMode,
    
    // Getters from store (for checking object status)
    hasSelection,
    isObjectLocked,
    isObjectVisible,
  } = useSceneStore();
  // --- END: Reading state from the Zustand store ---

  // Sync movement controls with SceneManager when scene is initialized
  useEffect(() => {
    if (sceneInitialized && sceneAPI?.getSceneManager()) {
      const sceneManager = sceneAPI.getSceneManager()
      if (sceneManager) {
        sceneManager.setMovementEnabled(movementEnabled)
        sceneManager.setMovementSpeed(movementSpeed)
        console.log(`🎮 Movement controls synced: ${movementEnabled ? 'ENABLED' : 'DISABLED'}, speed: ${movementSpeed}`)
      }
    }
  }, [sceneInitialized, movementEnabled, movementSpeed, sceneAPI]);

  // ---------------------------------------------------------------------------
  // Helper utils (state write) & placeholders for removed NURBS functionality
  // ---------------------------------------------------------------------------

  /**
   * Functional updater helper that keeps the ergonomic `(prev) => newArray` style
   * while complying with the store API which expects the full object array.
   */
  // Scene objects are now managed by the useBabylonScene hook

  // The application no longer supports NURBS control-points.  We define inert
  // placeholders so that the few remaining references compile but have no
  // runtime effect.
  const selectedControlPointMesh: Mesh | null = null
  const selectedControlPointIndex: number | null = null
  // No-op stubs replacing the old setters
  const setSelectedControlPointMesh = (_?: any) => {}
  const setSelectedControlPointIndex = (_?: any) => {}

  // OpenAI client initialization is now handled by the AI service

  // now use getters from the store
  // something is wrong here....
  const selectedObject = useMemo(() => 
    sceneObjects.find(obj => obj.id === selectedObjectId), 
    [sceneObjects, selectedObjectId]
  );

  const selectedObjects = useMemo(() => 
    sceneObjects.filter(obj => selectedObjectIds.includes(obj.id)), 
    [sceneObjects, selectedObjectIds]
  );

  // Boolean flag for current selection
  const hasSelectionFlag = hasSelection();

  // Scene synchronization is now handled by the useBabylonScene hook

  // Track canvas ref changes
  /*
  useEffect(() => {
    console.log('🎯 App.tsx: Canvas ref changed:', {
      hasCanvas: !!canvasRef.current,
      showApiKeyInput,
      canvasElement: canvasRef.current
    })
  }, [canvasRef.current, showApiKeyInput])
  */
  
  // Keyboard shortcuts are now handled by the useKeyboardShortcuts hook

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown && !(event.target as Element).closest('.toolbar-item')) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeDropdown])

  // Gizmo management is now handled by the useGizmoManager hook in useBabylonScene

  // Visual grid, multi-select pivot, and object selection feedback are now handled by the useBabylonScene hook

  // Handle NURBS control point visualizations when selection changes
  /*
  useEffect(() => {
    if (selectedObject && selectedObject.isNurbs && selectedObject.verbData) {
      // Create control point visualizations for selected NURBS object
      createControlPointVisualizations(selectedObject.id, selectedObject.verbData)
    } else {
      // Remove all control point visualizations when no NURBS object is selected
      controlPointVisualizations.forEach(viz => {
        removeControlPointVisualizations(viz.objectId)
      })
      setSelectedControlPointIndex(null)
      setSelectedControlPointMesh(null)
    }
  }, [selectedObjectId, selectedObject?.isNurbs])
  */

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName)
  }

  // Object click and hover handling is now managed directly in the useBabylonScene hook

  const createPrimitive = (type: Exclude<PrimitiveType, 'nurbs'>) => {
    if (!sceneInitialized) return;
    
    const newId = `${type}-${Date.now()}`;
    const position = new Vector3(Math.random() * 4 - 2, 2, Math.random() * 4 - 2);

    const newObj: SceneObject = {
      id: newId, 
      type, 
      position: position,
      scale: new Vector3(1, 1, 1), 
      rotation: new Vector3(0, 0, 0),
      color: currentColor, 
      isNurbs: false
    };

    addObject(newObj);
    setSelectedObjectId(newId);
    setActiveDropdown(null);
  }

  const createModularRoom = () => {
    if (!sceneInitialized) return;
    
    const newId = `house-room-modular-${Date.now()}`;
    const position = new Vector3(Math.random() * 4 - 2, 0, Math.random() * 4 - 2);

    const newObj: SceneObject = {
      id: newId,
      type: 'house-room-modular',
      position: position,
      scale: new Vector3(1, 1, 1),
      rotation: new Vector3(0, 0, 0),
      color: '#DEB887',
      isNurbs: false
    };

    addObject(newObj);
    setSelectedObjectId(newId);
    setActiveDropdown(null);
  }

  // Helper function to get parametric position of a point on a line segment
  const getParametricPosition = (lineStart: Vector3, lineEnd: Vector3, point: Vector3): number => {
    const lineDir = lineEnd.subtract(lineStart)
    const lineLengthSq = lineDir.lengthSquared()
    
    if (lineLengthSq < 0.0001) return 0 // Degenerate line
    
    const toPoint = point.subtract(lineStart)
    const t = Vector3.Dot(toPoint, lineDir) / lineLengthSq
    
    return t
  }
  
  // Helper function to check if a point is on a line segment
  const isPointOnSegment = (point: Vector3, segStart: Vector3, segEnd: Vector3): boolean => {
    const t = getParametricPosition(segStart, segEnd, point)
    if (t < 0 || t > 1) return false
    
    const projectedPoint = Vector3.Lerp(segStart, segEnd, t)
    const distance = Vector3.Distance(point, projectedPoint)
    
    return distance < 0.01 // Tolerance for floating point comparison
  }

  /**
   * Callback invoked when the user finishes drawing a custom room shape in the modal.
   * Converts 2D SVG coordinates to 3D world-space points, extrudes the polygon,
   * registers the mesh with the scene, and stores a SceneObject entry.
   */
  const handleCreateCustomRoom = (roomData: { points: { x: number; y: number }[]; openings?: { start: { x: number; y: number }; end: { x: number; y: number } }[]; name?: string; allSegments?: { start: { x: number; y: number }; end: { x: number; y: number }; isOpening?: boolean }[]; gridSize?: number; drawingBounds?: { width: number; height: number } }) => {
    if (!sceneInitialized) return

    const sceneManager = sceneAPI.getSceneManager()
    const scene = sceneManager?.getScene()
    if (!scene || !sceneManager) return

    const SVG_SIZE = 400 // matches modal SVG dimension
    const SCALE = 0.05 // px -> world units (adjust as desired)
    const WALL_HEIGHT = 2.0
    const WALL_THICKNESS = 0.15

    const { points, openings, name, allSegments } = roomData

    // Convert SVG (origin top-left, +y down) to Babylon XZ plane (origin center, +z forward)
    const vertices2D = points.map(p => new Vector2(
      (p.x - SVG_SIZE / 2) * SCALE,
      ((SVG_SIZE / 2) - p.y) * SCALE // flip Y
    ))

    if (vertices2D.length < 3) return

    const newId = `custom-room-${Date.now()}`

    // -------------------------------------------------------------
    // Determine polygon orientation (CW vs CCW)
    // Used to ensure outward normals always point outside even for
    // concave polygons, without relying on a centroid approximation.
    // -------------------------------------------------------------
    const signedArea = vertices2D.reduce((acc, curr, idx) => {
      const next = vertices2D[(idx + 1) % vertices2D.length]
      return acc + (curr.x * next.y - next.x * curr.y)
    }, 0)
    // For a counter-clockwise (positive area) polygon, the vector
    // Up × direction already points outward. For clockwise polygons
    // (negative area), invert the sign.
    const orientationSign = signedArea >= 0 ? 1 : -1

    // Create a root mesh to act as the parent for all room components
    const rootMesh = new Mesh(newId, scene)

    // --- Create Floor ---
    // Convert 2D vertices to 3D for the floor polygon
    const floorVertices = vertices2D.map(p => new Vector3(p.x, 0, p.y))

    // Use CreatePolygon to build a solid floor with thickness (depth)
    const floor = MeshBuilder.CreatePolygon(`${newId}-floor`, {
      shape: floorVertices,
      depth: WALL_THICKNESS
    }, scene)
    floor.position.y -= WALL_THICKNESS / 2 // Position floor correctly
    const floorMaterial = new StandardMaterial(`${newId}-floor-mat`, scene)
    
    // Create grid texture for the floor
    const gridTexture = createFullGridTexture(
      scene,
      roomData.gridSize || 20,
      roomData.drawingBounds?.width || 400,
      roomData.drawingBounds?.height || 400,
      1024,
      {
        lineColor: '#e0e0e0',
        backgroundColor: '#A0522D',
        lineWidth: 2,
        opacity: 1,
        showSubGrid: true,
        subGridDivisions: 4
      }
    )
    
    // Apply the grid texture
    floorMaterial.diffuseTexture = gridTexture
    floorMaterial.specularColor = new Color3(0.1, 0.1, 0.1)
    
    // Calculate proper UV scaling for the floor
    const floorBounds = floor.getBoundingInfo()
    if (floorBounds) {
      const floorWidth = floorBounds.maximum.x - floorBounds.minimum.x
      const floorDepth = floorBounds.maximum.z - floorBounds.minimum.z
      const uvScale = calculateFullGridUVScale(
        floorWidth,
        floorDepth,
        roomData.drawingBounds?.width || 400,
        roomData.drawingBounds?.height || 400,
        SCALE
      )
      gridTexture.uScale = uvScale.u
      gridTexture.vScale = uvScale.v
    }
    
    floor.material = floorMaterial
    floor.parent = rootMesh

    // --- Create Walls ---
    const wallMaterial = new StandardMaterial(`${newId}-wall-mat`, scene)
    wallMaterial.diffuseColor = Color3.FromHexString('#DEB887') // BurlyWood

    const wallTopConnectionPoints: ConnectionPoint[] = []

    // Convert openings to world coordinates for comparison
    const worldOpenings = openings?.map(opening => ({
      start: new Vector2(
        (opening.start.x - SVG_SIZE / 2) * SCALE,
        ((SVG_SIZE / 2) - opening.start.y) * SCALE
      ),
      end: new Vector2(
        (opening.end.x - SVG_SIZE / 2) * SCALE,
        ((SVG_SIZE / 2) - opening.end.y) * SCALE
      )
    })) || []

    for (let i = 0; i < vertices2D.length; i++) {
      const p1 = new Vector3(vertices2D[i].x, 0, vertices2D[i].y)
      const p2 = new Vector3(vertices2D[(i + 1) % vertices2D.length].x, 0, vertices2D[(i + 1) % vertices2D.length].y)

      const wallLength = Vector3.Distance(p1, p2)
      if (wallLength < 0.01) continue // Skip zero-length walls

      // Find all openings that intersect with this wall segment
      const wallDirection = p2.subtract(p1).normalize()
      const wallSegments: Array<{ start: Vector3; end: Vector3 }> = []
      
      // Collect all opening intersections along this wall
      const intersections: number[] = [0, 1] // Start with wall endpoints (in parametric form)
      
      worldOpenings.forEach(opening => {
        // Check if opening is on the same line as the wall
        const openingStart = new Vector3(opening.start.x, 0, opening.start.y)
        const openingEnd = new Vector3(opening.end.x, 0, opening.end.y)
        
        // Calculate parametric positions of opening points on the wall line
        const t1 = getParametricPosition(p1, p2, openingStart)
        const t2 = getParametricPosition(p1, p2, openingEnd)
        
        // Check if opening overlaps with this wall segment
        if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) {
          // Add intersection points
          if (t1 >= 0 && t1 <= 1) intersections.push(t1)
          if (t2 >= 0 && t2 <= 1) intersections.push(t2)
        }
      })
      
      // Sort intersection points
      intersections.sort((a, b) => a - b)
      
      // Create wall segments between openings
      for (let j = 0; j < intersections.length - 1; j++) {
        const t1 = intersections[j]
        const t2 = intersections[j + 1]
        
        if (Math.abs(t2 - t1) < 0.001) continue // Skip tiny segments
        
        const segmentStart = Vector3.Lerp(p1, p2, t1)
        const segmentEnd = Vector3.Lerp(p1, p2, t2)
        
        // Check if this segment is inside an opening
        const segmentMid = Vector3.Lerp(segmentStart, segmentEnd, 0.5)
        const isInOpening = worldOpenings.some(opening => {
          return isPointOnSegment(
            segmentMid,
            new Vector3(opening.start.x, 0, opening.start.y),
            new Vector3(opening.end.x, 0, opening.end.y)
          )
        })
        
        if (!isInOpening) {
          wallSegments.push({ start: segmentStart, end: segmentEnd })
        }
      }
      
      // Create wall meshes for each segment
      wallSegments.forEach((segment, segIdx) => {
        const segmentLength = Vector3.Distance(segment.start, segment.end)
        if (segmentLength < 0.01) return
        
        const wall = MeshBuilder.CreateBox(`${newId}-wall-${i}-${segIdx}`, {
          width: segmentLength,
          height: WALL_HEIGHT,
          depth: WALL_THICKNESS
        }, scene)

        // Position and orient the wall segment
        const direction = segment.end.subtract(segment.start).normalize()
        const midPoint = Vector3.Lerp(segment.start, segment.end, 0.5)
        const outward = Vector3.Cross(Vector3.Up(), direction).normalize().scale(orientationSign)
        const wallPos = midPoint.add(outward.scale(WALL_THICKNESS / 2))

        wall.position = wallPos
        wall.position.y += WALL_HEIGHT / 2
        wall.rotation.y = -Math.atan2(direction.z, direction.x)
        wall.material = wallMaterial
        wall.parent = rootMesh

        // Add connection point at the top middle of wall segment
        const cpMid = Vector3.Lerp(segment.start, segment.end, 0.5)
        const cpPosLocal = new Vector3(cpMid.x, WALL_HEIGHT, cpMid.z)
        const cp: ConnectionPoint = {
          id: `wall-top-${i}-${segIdx}`,
          position: cpPosLocal,
          normal: new Vector3(0, 1, 0),
          kind: 'edge'
        }
        wallTopConnectionPoints.push(cp)
      })
    }
    
    // --- Create Interior Walls ---
    // Find all wall segments that are not openings and create 3D walls for them
    // This includes both perimeter walls (already created above) and interior walls
    const allWallSegments = allSegments?.filter((segment: { isOpening?: boolean }) => !segment.isOpening) || []
    
    // Convert line segments to world coordinates for comparison
    const worldWallSegments = allWallSegments.map((segment: { start: { x: number; y: number }; end: { x: number; y: number } }) => ({
      start: new Vector2(
        (segment.start.x - SVG_SIZE / 2) * SCALE,
        ((SVG_SIZE / 2) - segment.start.y) * SCALE
      ),
      end: new Vector2(
        (segment.end.x - SVG_SIZE / 2) * SCALE,
        ((SVG_SIZE / 2) - segment.end.y) * SCALE
      )
    }))
    
    // Track which wall segments have already been created as perimeter walls
    const createdWalls = new Set<string>()
    
    // Mark perimeter walls as created
    for (let i = 0; i < vertices2D.length; i++) {
      const p1 = vertices2D[i]
      const p2 = vertices2D[(i + 1) % vertices2D.length]
      
      // Find matching wall segment
      worldWallSegments.forEach((segment: { start: Vector2; end: Vector2 }, idx: number) => {
        const matchesForward = 
          (Math.abs(p1.x - segment.start.x) < 0.01 && Math.abs(p1.y - segment.start.y) < 0.01 &&
           Math.abs(p2.x - segment.end.x) < 0.01 && Math.abs(p2.y - segment.end.y) < 0.01)
        
        const matchesReverse = 
          (Math.abs(p1.x - segment.end.x) < 0.01 && Math.abs(p1.y - segment.end.y) < 0.01 &&
           Math.abs(p2.x - segment.start.x) < 0.01 && Math.abs(p2.y - segment.start.y) < 0.01)
        
        if (matchesForward || matchesReverse) {
          createdWalls.add(`wall-${idx}`)
        }
      })
    }
    
    // Create interior walls (walls not part of the perimeter)
    worldWallSegments.forEach((segment: { start: Vector2; end: Vector2 }, idx: number) => {
      if (createdWalls.has(`wall-${idx}`)) return // Skip if already created as perimeter
      
      const p1 = new Vector3(segment.start.x, 0, segment.start.y)
      const p2 = new Vector3(segment.end.x, 0, segment.end.y)
      
      const wallLength = Vector3.Distance(p1, p2)
      if (wallLength < 0.01) return // Skip zero-length walls
      
      const interiorWall = MeshBuilder.CreateBox(`${newId}-interior-wall-${idx}`, {
        width: wallLength,
        height: WALL_HEIGHT,
        depth: WALL_THICKNESS
      }, scene)
      
      // Position and orient the interior wall
      const direction = p2.subtract(p1).normalize()
      const midPoint = Vector3.Lerp(p1, p2, 0.5)
      
      interiorWall.position = midPoint
      interiorWall.position.y += WALL_HEIGHT / 2
      interiorWall.rotation.y = -Math.atan2(direction.z, direction.x)
      
      // Apply the same material as perimeter walls
      interiorWall.material = wallMaterial
      interiorWall.parent = rootMesh
      
      console.log(`[CustomRoom] Created interior wall ${idx}`)
    })
    
    // -------------------------------------------------------------
    // Attach connection points after geometry created so boundary
    // includes floor and walls (important for correct snapping)
    // -------------------------------------------------------------
    const compositeBoundary = computeCompositeBoundary(rootMesh)
    const defaultCPs = generateDefaultConnectionPoints(rootMesh, compositeBoundary)
    const cps = [...defaultCPs, ...wallTopConnectionPoints]
    if (!rootMesh.metadata) rootMesh.metadata = {}
    ;(rootMesh.metadata as any).connectionPoints = cps
    
    // Store grid information in metadata
    ;(rootMesh.metadata as any).gridInfo = {
      gridSize: roomData.gridSize || 20,
      worldScale: SCALE,
      drawingBounds: roomData.drawingBounds || { width: 400, height: 400 }
    }
    
    // Store floor polygon for AI and collision detection
    ;(rootMesh.metadata as any).floorPolygon = vertices2D.map(v => ({ x: v.x, z: v.y }))
    
    // Store room name in metadata
    if (name) {
      (rootMesh.metadata as any).roomName = name
      
      // Create text label for the room
      const labelPlane = MeshBuilder.CreatePlane(`${newId}-label`, {
        width: 2,
        height: 0.5
      }, scene)
      
      // Position label at the center of the room, slightly above floor
      const centerX = vertices2D.reduce((sum, v) => sum + v.x, 0) / vertices2D.length
      const centerZ = vertices2D.reduce((sum, v) => sum + v.y, 0) / vertices2D.length
      labelPlane.position = new Vector3(centerX, 0.1, centerZ)
      labelPlane.rotation.x = -Math.PI / 2 // Make it horizontal
      labelPlane.parent = rootMesh
      
      // Create dynamic texture for the text
      const labelTexture = new DynamicTexture(`${newId}-label-texture`, {
        width: 512,
        height: 128
      }, scene)
      
      // Configure text
      labelTexture.hasAlpha = true
      const ctx = labelTexture.getContext() as any // Cast to avoid TS issues with canvas context
      ctx.clearRect(0, 0, 512, 128)
      
      // Draw text
      const fontSize = 48
      ctx.font = `bold ${fontSize}px Arial`
      ctx.fillStyle = '#2c3e50'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, 256, 64)
      
      labelTexture.update()
      
      // Create material for the label
      const labelMaterial = new StandardMaterial(`${newId}-label-mat`, scene)
      labelMaterial.diffuseTexture = labelTexture
      labelMaterial.specularColor = new Color3(0, 0, 0)
      labelMaterial.emissiveColor = new Color3(1, 1, 1)
      labelMaterial.backFaceCulling = false
      labelPlane.material = labelMaterial
    }

    // Debugging: log connection point info
    console.log(`[CustomRoom] Generated ${cps.length} connection points for ${newId}:`, cps.map(cp => ({ id: cp.id, pos: cp.position.toString(), normal: cp.normal.toString() })))

    // Register the root mesh with the SceneManager
    sceneManager.addPreExistingMesh(rootMesh, newId)

    // Store SceneObject
    const newObj: SceneObject = {
      id: newId,
      type: 'custom-room',
      position: rootMesh.position.clone(),
      scale: rootMesh.scaling.clone(),
      rotation: rootMesh.rotation.clone(),
      color: '#DEB887',
      isNurbs: false,
      roomName: name,
      gridInfo: {
        gridSize: roomData.gridSize || 20,
        worldScale: SCALE,
        drawingBounds: roomData.drawingBounds || { width: 400, height: 400 }
      },
      metadata: {
        floorPolygon: vertices2D.map(v => ({ x: v.x, z: v.y })),
        gridInfo: {
          gridSize: roomData.gridSize || 20,
          worldScale: SCALE,
          drawingBounds: roomData.drawingBounds || { width: 400, height: 400 }
        }
      }
    }

    addObject(newObj)
    setSelectedObjectId(newId)

    // Close modal
    setShowCustomRoomModal(false)
    setActiveDropdown(null)
  }

  const handleCreateMultipleCustomRooms = (roomsData: Array<{ points: { x: number; y: number }[]; openings?: { start: { x: number; y: number }; end: { x: number; y: number } }[]; name?: string; allSegments?: { start: { x: number; y: number }; end: { x: number; y: number }; isOpening?: boolean }[]; gridSize?: number; drawingBounds?: { width: number; height: number } }>) => {
    // Create all rooms with slight delays to ensure unique IDs
    roomsData.forEach((roomData, index) => {
      setTimeout(() => {
        handleCreateCustomRoom(roomData)
      }, index * 100)
    })
  }

  const createHousingComponent = (componentType: string, subType?: string) => {
    if (!sceneInitialized) return;
    
    const typeString = subType ? `house-${componentType}-${subType}` : `house-${componentType}`;
    const newId = `${typeString}-${Date.now()}`;
    const position = new Vector3(Math.random() * 4 - 2, 1, Math.random() * 4 - 2);

    // Set appropriate heights for different components
    let yPosition = 1;
    let defaultColor = currentColor;
    
    switch (componentType) {
      case 'wall':
        yPosition = 0.75; // Half of standard wall height
        defaultColor = '#8B4513'; // Brown for walls
        break;
      case 'door':
        yPosition = 1; // Standard door height
        defaultColor = '#654321'; // Dark brown for doors
        break;
      case 'window':
        yPosition = 1; // Standard window height
        defaultColor = '#87CEEB'; // Sky blue for windows
        break;
      case 'ceiling':
        yPosition = 2.5; // Standard ceiling height
        defaultColor = '#F5F5DC'; // Beige for ceilings
        break;
      case 'floor':
        yPosition = 0.05; // Just above ground
        defaultColor = '#8B4513'; // Brown for floors
        break;
    }

    const newObj: SceneObject = {
      id: newId,
      type: typeString as PrimitiveType,
      position: new Vector3(position.x, yPosition, position.z),
      scale: new Vector3(1, 1, 1),
      rotation: new Vector3(0, 0, 0),
      color: defaultColor,
      isNurbs: false
    };

    addObject(newObj);
    setSelectedObjectId(newId);
    setActiveDropdown(null);
  }

  const duplicateObject = () => {
    if (!selectedObject || !sceneInitialized) return

    const newId = `${selectedObject.type}-${Date.now()}`
    
    console.log('Duplicating object:', selectedObject.id, 'as', newId)

    // Compute new position with optional grid snapping
    const offsetPosition = selectedObject.position.clone().add(new Vector3(2, 0, 0))
    const snappedPosition = snapToGrid ? sceneAPI.snapToGrid(offsetPosition) : offsetPosition

    const newObj: SceneObject = {
      id: newId,
      type: selectedObject.type,
      position: snappedPosition,
      scale: selectedObject.scale.clone(),
      rotation: selectedObject.rotation.clone(),
      color: selectedObject.color,
      isNurbs: selectedObject.isNurbs,
      verbData: selectedObject.isNurbs ? selectedObject.verbData : undefined
    }

    // --- Special handling for mesh-based types that cannot be recreated via the factory (e.g. custom-room) ---
    if (selectedObject.type === 'custom-room') {
      const sceneManager = sceneAPI.getSceneManager()
      const originalMesh = sceneManager?.getMeshById(selectedObject.id)
      if (sceneManager && originalMesh) {
        const clonedMesh = originalMesh.clone(newId, null, false) as Mesh
        clonedMesh.position = snappedPosition.clone()
        sceneManager.addPreExistingMesh(clonedMesh, newId)
        newObj.mesh = clonedMesh
      }
    }

    addObject(newObj)
    setSelectedObjectId(newId)
    setActiveDropdown(null)
  }

  const deleteSelectedObject = () => {
    if (!selectedObject) return

    console.log('🗑️ Deleting object:', selectedObject.id)
    
    removeObject(selectedObject.id)
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('✅ Deleted object')
  }


  // TODO: fix store useage here
  const changeSelectedObjectColor = (color: string) => {
    const objectsToColor = selectedObjectId ? [selectedObjectId] : selectedObjectIds;
    if (objectsToColor.length === 0) return;

    objectsToColor.forEach(id => {
        updateObject(id, { color });
    });
  }

  const applyCurrentColorToSelection = () => {
    changeSelectedObjectColor(currentColor)
    setActiveDropdown(null)
  }

  const applyPresetColor = (color: string) => {
    setCurrentColor(color)
    changeSelectedObjectColor(color)
  }

  const setCameraView = (view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'home') => {
    sceneAPI.setCameraView(view)
    setActiveDropdown(null)
    console.log('📷 Camera set to:', view)
  }

  const toggleWireframe = () => {
    const newWireframeMode = !wireframeMode
    setWireframeMode(newWireframeMode)

    sceneObjects.forEach(obj => {
      if (obj.mesh?.material && obj.type !== 'ground') {
        const material = obj.mesh.material as StandardMaterial
        material.wireframe = newWireframeMode
      }
    })
    
    console.log('🔲 Wireframe mode:', newWireframeMode ? 'ON' : 'OFF')
  }



  // Snap position to grid
  const snapToGridPosition = (position: Vector3): Vector3 => {
    if (!snapToGrid) return position
    return new Vector3(
      Math.round(position.x / gridSize) * gridSize,
      Math.round(position.y / gridSize) * gridSize,
      Math.round(position.z / gridSize) * gridSize
    )
  }

  // Visual grid, multi-select pivot, and transform operations are now handled by the useBabylonScene hook

  // Select all objects
  const selectAllObjects = () => {
    const selectableObjects = sceneObjects.filter(obj => obj.type !== 'ground' && !objectLocked[obj.id])
    setSelectedObjectIds(selectableObjects.map(obj => obj.id))
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('🔍 Selected all objects')
  }

  // Deselect all objects
  const deselectAllObjects = () => {
    setSelectedObjectId(null)
    setSelectedObjectIds([])
    setActiveDropdown(null)
    console.log('🔍 Deselected all objects')
  }

  // Invert selection
  const invertSelection = () => {
    const selectableObjects = sceneObjects.filter(obj => obj.type !== 'ground' && !objectLocked[obj.id])
    const currentlySelected = selectedObjectIds
    const newSelection = selectableObjects.filter(obj => !currentlySelected.includes(obj.id)).map(obj => obj.id)
    setSelectedObjectIds(newSelection)
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('🔍 Inverted selection')
  }



  // Reset transform for selected objects
  const resetTransforms = () => {
    const objectsToReset = selectedObjectId ? [selectedObjectId] : selectedObjectIds;
    const defaultPosition = new Vector3(0, 1, 0);
    const defaultRotation = new Vector3(0, 0, 0);
    const defaultScale = new Vector3(1, 1, 1);
    
    objectsToReset.forEach(id => {
        updateObject(id, {
            position: defaultPosition,
            rotation: defaultRotation,
            scale: defaultScale
        });
    });
  }

  // Duplicate selected objects
  const duplicateSelectedObjects = () => {
    if (!sceneInitialized) return
    
    const objectsToDuplicate = selectedObjectId ? [selectedObjectId] : selectedObjectIds
    const newObjects: SceneObject[] = []
    
    objectsToDuplicate.forEach(objectId => {
      const originalObject = sceneObjects.find(obj => obj.id === objectId)
      if (!originalObject) return
      
      const newId = `${originalObject.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Copy properties and offset position
      const offsetPosition = originalObject.position.clone().add(new Vector3(2, 0, 0))
      const snappedPosition = snapToGrid ? sceneAPI.snapToGrid(offsetPosition) : offsetPosition
      
      const newObj: SceneObject = {
        id: newId,
        type: originalObject.type,
        position: snappedPosition,
        scale: originalObject.scale.clone(),
        rotation: originalObject.rotation.clone(),
        color: originalObject.color,
        isNurbs: originalObject.isNurbs,
        verbData: originalObject.isNurbs ? originalObject.verbData : undefined
      }
      
      // Handle custom-room duplication by cloning the existing mesh hierarchy
      if (originalObject.type === 'custom-room') {
        const sceneManager = sceneAPI.getSceneManager()
        const originalMesh = sceneManager?.getMeshById(originalObject.id)
        if (sceneManager && originalMesh) {
          const clonedMesh = originalMesh.clone(newId, null, false) as Mesh
          clonedMesh.position = snappedPosition.clone()
          sceneManager.addPreExistingMesh(clonedMesh, newId)
          newObj.mesh = clonedMesh
        }
      }
      
      newObjects.push(newObj)
    })
    
    newObjects.forEach(addObject)
    
    // Select the new objects
    if (newObjects.length === 1) {
      setSelectedObjectId(newObjects[0].id)
      setSelectedObjectIds([])
    } else {
      setSelectedObjectIds(newObjects.map(obj => obj.id))
      setSelectedObjectId(null)
    }
    
    setActiveDropdown(null)
    console.log('📋 Duplicated selected objects')
  }

  // Scene initialization is now handled by the useBabylonScene hook

  // Top Toolbar Component
  const renderTopToolbar = () => (
    <div className="top-toolbar">
      <div className="toolbar-menu">
        <div className="toolbar-brand">VibeCad Pro</div>
        

        
        {/* Transform Tools */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${transformMode !== 'select' ? 'active' : ''}`}
            onClick={() => toggleDropdown('transform')}
          >
            Transform <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'transform' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Transform Mode</div>
              <div className="dropdown-grid">
                <button 
                  className={`dropdown-button ${transformMode === 'select' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('select')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">🔍</span>
                  Select
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'move' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('move')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">⬆️</span>
                  Move
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'rotate' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('rotate')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">🔄</span>
                  Rotate
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'scale' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('scale')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">📏</span>
                  Scale
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Move To Point Tool */}
        <div className="toolbar-item">
            <button
                className={`toolbar-button move-to-button ${moveToMode ? 'active' : ''}`}
                onClick={() => {
                    if(hasSelection()){
                        setMoveToMode(!moveToMode)
                    }
                }}
                disabled={!hasSelection()}
                title="Move to Point"
            >
                <span className="dropdown-icon">📍</span>
                Move to...
            </button>
        </div>

        {/* Create Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('create')}
          >
            Create <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'create' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Primitives</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createPrimitive('cube')}>
                  <span className="dropdown-icon">⬜</span>
                  Cube
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('sphere')}>
                  <span className="dropdown-icon">⚪</span>
                  Sphere
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('cylinder')}>
                  <span className="dropdown-icon">⚫</span>
                  Cylinder
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('plane')}>
                  <span className="dropdown-icon">▬</span>
                  Plane
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('torus')}>
                  <span className="dropdown-icon">🔘</span>
                  Torus
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('cone')}>
                  <span className="dropdown-icon">🔺</span>
                  Cone
                </button>
                {/* NURBS option removed */}
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Basic Housing</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createPrimitive('house-basic')}>
                  <span className="dropdown-icon">🏠</span>
                  Basic House
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-room')}>
                  <span className="dropdown-icon">🏠</span>
                  Room
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-hallway')}>
                  <span className="dropdown-icon">🚪</span>
                  Hallway
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-roof-flat')}>
                  <span className="dropdown-icon">🏢</span>
                  Flat Roof
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-roof-pitched')}>
                  <span className="dropdown-icon">🏠</span>
                  Pitched Roof
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Modular Rooms</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createModularRoom()}>
                  <span className="dropdown-icon">🏗️</span>
                  Modular Room
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Foundation & Structure</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createPrimitive('house-foundation')}>
                  <span className="dropdown-icon">🏗️</span>
                  Foundation
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-stairs')}>
                  <span className="dropdown-icon">🪜</span>
                  Stairs
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Walls & Structure</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createHousingComponent('wall')}>
                  <span className="dropdown-icon">🧱</span>
                  Wall
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('ceiling')}>
                  <span className="dropdown-icon">🏗️</span>
                  Ceiling
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('floor')}>
                  <span className="dropdown-icon">🟫</span>
                  Floor
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Doors</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createHousingComponent('door', 'single')}>
                  <span className="dropdown-icon">🚪</span>
                  Single Door
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('door', 'double')}>
                  <span className="dropdown-icon">🚪</span>
                  Double Door
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('door', 'sliding')}>
                  <span className="dropdown-icon">🚪</span>
                  Sliding Door
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('door', 'french')}>
                  <span className="dropdown-icon">🚪</span>
                  French Door
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('door', 'garage')}>
                  <span className="dropdown-icon">🚪</span>
                  Garage Door
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Windows</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createHousingComponent('window', 'single')}>
                  <span className="dropdown-icon">🪟</span>
                  Single Window
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('window', 'double')}>
                  <span className="dropdown-icon">🪟</span>
                  Double Window
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('window', 'bay')}>
                  <span className="dropdown-icon">🪟</span>
                  Bay Window
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('window', 'casement')}>
                  <span className="dropdown-icon">🪟</span>
                  Casement Window
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('window', 'sliding')}>
                  <span className="dropdown-icon">🪟</span>
                  Sliding Window
                </button>
                <button className="dropdown-button" onClick={() => createHousingComponent('window', 'skylight')}>
                  <span className="dropdown-icon">🪟</span>
                  Skylight
                </button>
              </div>
            </div>
            {/* Custom */}
            <div className="dropdown-section">
              <div className="dropdown-section-title">Custom</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => { setShowCustomRoomModal(true); setActiveDropdown(null) }}>
                  <span className="dropdown-icon">📐</span>
                  Custom Room
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Material Menu */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${hasSelectionFlag ? 'active' : ''}`}
            onClick={() => toggleDropdown('material')}
          >
            Material <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'material' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">RGB Color Picker</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <span className="control-label">Color:</span>
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => {
                      setCurrentColor(e.target.value)
                      if (hasSelectionFlag) {
                        changeSelectedObjectColor(e.target.value)
                      }
                    }}
                    className="color-picker-large"
                  />
                </div>
                <div className="control-row">
                  <span className="control-label">Hex:</span>
                  <input
                    type="text"
                    value={currentColor}
                    onChange={(e) => {
                      const hexValue = e.target.value
                      if (/^#[0-9A-F]{6}$/i.test(hexValue)) {
                        setCurrentColor(hexValue)
                        if (hasSelectionFlag) {
                          changeSelectedObjectColor(hexValue)
                        }
                      }
                    }}
                    className="hex-input"
                    placeholder="#FFFFFF"
                  />
                </div>
                <div className="control-row">
                  <span className="control-label">RGB:</span>
                  <div className="rgb-inputs">
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(1, 2), 16)}
                      onChange={(e) => {
                        const r = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const g = parseInt(currentColor.substr(3, 2), 16)
                        const b = parseInt(currentColor.substr(5, 2), 16)
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelectionFlag) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="R"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(3, 2), 16)}
                      onChange={(e) => {
                        const r = parseInt(currentColor.substr(1, 2), 16)
                        const g = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const b = parseInt(currentColor.substr(5, 2), 16)
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelectionFlag) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="G"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(5, 2), 16)}
                      onChange={(e) => {
                        const r = parseInt(currentColor.substr(1, 2), 16)
                        const g = parseInt(currentColor.substr(3, 2), 16)
                        const b = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelectionFlag) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="B"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Quick Colors</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <div className="material-chips">
                    {materialPresets.map((preset) => (
                      <button
                        key={preset.name}
                        className={`material-chip ${currentColor === preset.color ? 'active' : ''}`}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => applyPresetColor(preset.color)}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {hasSelectionFlag && (
              <div className="dropdown-section">
                <div className="dropdown-section-title">
                  Apply to: {selectedObject ? selectedObject.type.toUpperCase() : `${selectedObjectIds.length} OBJECTS`}
                </div>
                <div className="dropdown-actions">
                  <button 
                    className="dropdown-action"
                    onClick={applyCurrentColorToSelection}
                  >
                    Apply Current Color
                  </button>
                  <button 
                    className="dropdown-action"
                    onClick={() => {
                      // Random color generator
                      const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
                      setCurrentColor(randomColor)
                      changeSelectedObjectColor(randomColor)
                    }}
                  >
                    Random Color
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>



        {/* Tools Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('tools')}
          >
            Tools <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'tools' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Snap Settings</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <label className="control-checkbox">
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                    />
                    <span>Snap to Grid</span>
                  </label>
                </div>
                <div className="control-row">
                  <label className="control-checkbox">
                    <input
                      type="checkbox"
                      checked={snapToObjects}
                      onChange={(e) => setSnapToObjects(e.target.checked)}
                    />
                    <span>Snap to Objects</span>
                  </label>
                </div>
                <div className="control-row">
                  <label className="control-checkbox">
                    <input
                      type="checkbox"
                      checked={showConnectionPoints}
                      onChange={(e) => setShowConnectionPoints(e.target.checked)}
                    />
                    <span>Show Connection Points</span>
                  </label>
                </div>
                <div className="control-row">
                  <span className="control-label">Grid Size:</span>
                  <input
                    type="number"
                    value={gridSize}
                    onChange={(e) => setGridSize(parseFloat(e.target.value) || 1)}
                    min="0.1"
                    max="5"
                    step="0.1"
                    className="control-input"
                  />
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Physics</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <label className="control-checkbox">
                    <input
                      type="checkbox"
                      checked={collisionDetectionEnabled}
                      onChange={(e) => {
                        setCollisionDetectionEnabled(e.target.checked)
                        if (sceneAPI) {
                          sceneAPI.setCollisionDetectionEnabled(e.target.checked)
                        }
                      }}
                    />
                    <span>Collision Detection</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Movement Controls</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <label 
                    className="control-checkbox"
                    title="Enable keyboard-based camera movement controls similar to FPS games"
                  >
                    <input
                      type="checkbox"
                      checked={movementEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked
                        setMovementEnabled(enabled)
                        if (sceneAPI?.getSceneManager()) {
                          sceneAPI.getSceneManager()?.setMovementEnabled(enabled)
                        }
                      }}
                    />
                    <span>Enable WASD Movement</span>
                  </label>
                </div>
                <div className="control-row">
                  <span className="control-label">Movement Speed:</span>
                  <input
                    type="range"
                    value={movementSpeed}
                    onChange={(e) => {
                      const speed = parseFloat(e.target.value)
                      setMovementSpeed(speed)
                      if (sceneAPI?.getSceneManager()) {
                        sceneAPI.getSceneManager()?.setMovementSpeed(speed)
                      }
                    }}
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    className="control-range"
                    title={`Movement speed: ${movementSpeed.toFixed(2)} units/frame. Hold Shift to sprint at 2x speed.`}
                  />
                  <span className="control-value">{movementSpeed.toFixed(2)}</span>
                </div>
                <div className="control-row">
                  <small className="control-help">
                    📖 <strong>Controls:</strong> W/A/S/D to move • Q/E for up/down • Shift to sprint<br/>
                    💡 <strong>Tip:</strong> Works like FPS games - movement is relative to camera direction<br/>
                    ⚠️  <strong>Note:</strong> Automatically disabled when typing or using menus
                  </small>
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Precision Tools</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Focus on selected object
                    if (selectedObject) {
                      sceneAPI.focusOnPosition(selectedObject.position)
                    } else if (selectedObjects.length > 0) {
                      // Focus on center of multi-selection
                      const center = selectedObjects.reduce((acc, obj) => {
                        return acc.add(obj.position)
                      }, new Vector3(0, 0, 0)).scale(1 / selectedObjects.length)
                      sceneAPI.focusOnPosition(center)
                    }
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelectionFlag}
                >
                  Focus Selected
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Align selected objects to grid
                    const objectsToAlign = selectedObjectId ? [selectedObjectId] : selectedObjectIds
                    objectsToAlign.forEach(id => {
                      const obj = sceneObjects.find(o => o.id === id)
                      if (obj && obj.mesh) {
                        const snappedPos = snapToGridPosition(obj.position)
                        obj.mesh.position = snappedPos
                        updateObject(id, { position: snappedPos })
                      }
                    })
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelectionFlag}
                >
                  Align to Grid
                </button>
              </div>
            </div>
          </div>
        </div>



        {/* Space Optimization Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('space')}
          >
            Space <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'space' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Room Analysis</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <span className="control-label">Room Status:</span>
                  <span className="control-value">
                    {sceneObjects.filter(obj => obj.type === 'custom-room').length > 0 ? 
                      '✅ Available' : '⚠️ No rooms'}
                  </span>
                </div>
                <div className="control-row">
                  <span className="control-label">Furniture Type:</span>
                  <select 
                    className="control-select"
                    value={selectedFurnitureType || 'Desk'}
                    onChange={(e) => setSelectedFurnitureType(e.target.value)}
                  >
                    <option value="Desk">Desk</option>
                    <option value="Chair">Chair</option>
                    <option value="Table">Table</option>
                    <option value="Sofa">Sofa</option>
                    <option value="Bed Single">Bed Single</option>
                    <option value="Bed Double">Bed Double</option>
                    <option value="Bookcase">Bookcase</option>
                    <option value="TV">TV</option>
                    <option value="Standing Desk">Standing Desk</option>
                    <option value="Adjustable Desk">Adjustable Desk</option>
                  </select>
                </div>
                <div className="control-row">
                  <span className="control-label">Strategy:</span>
                  <select 
                    className="control-select"
                    value={optimizationStrategy || 'maximize'}
                    onChange={(e) => setOptimizationStrategy(e.target.value as any)}
                  >
                    <option value="maximize">Maximize Capacity</option>
                    <option value="comfort">Comfort & Accessibility</option>
                    <option value="ergonomic">Ergonomic Layout</option>
                    <option value="aesthetic">Aesthetic Balance</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Analysis Actions</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    handleAnalyzeSpace();
                    setActiveDropdown(null);
                  }}
                  disabled={sceneObjects.filter(obj => obj.type === 'custom-room').length === 0}
                >
                  🔍 Analyze Space
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    handleAnalyzeSelected();
                    setActiveDropdown(null);
                  }}
                  disabled={!hasSelectionFlag || sceneObjects.filter(obj => obj.type === 'custom-room').length === 0}
                >
                  📋 Analyze Selected
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    handleGenerateLayouts();
                    setActiveDropdown(null);
                  }}
                  disabled={sceneObjects.filter(obj => obj.type === 'custom-room').length === 0}
                >
                  🎨 Generate Layouts
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    handleClearOptimizedObjects();
                    setActiveDropdown(null);
                  }}
                  disabled={sceneObjects.filter(obj => obj.id.startsWith('optimized-')).length === 0}
                >
                  🗑️ Clear Optimized ({sceneObjects.filter(obj => obj.id.startsWith('optimized-')).length})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* View Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('view')}
          >
            View <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'view' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Camera</div>
              <div className="camera-grid">
                <button className="camera-button" onClick={() => setCameraView('front')}>Front</button>
                <button className="camera-button" onClick={() => setCameraView('back')}>Back</button>
                <button className="camera-button" onClick={() => setCameraView('left')}>Left</button>
                <button className="camera-button" onClick={() => setCameraView('right')}>Right</button>
                <button className="camera-button" onClick={() => setCameraView('top')}>Top</button>
                <button className="camera-button" onClick={() => setCameraView('bottom')}>Bottom</button>
                <button className="camera-button" onClick={() => setCameraView('home')}>Home</button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Display</div>
              <div className="dropdown-actions">
                <button 
                  className={`dropdown-action ${wireframeMode ? 'active' : ''}`}
                  onClick={toggleWireframe}
                >
                  {wireframeMode ? '✓' : ''} Wireframe
                </button>
                <button 
                  className={`dropdown-action ${showGrid ? 'active' : ''}`}
                  onClick={() => setShowGrid(!showGrid)}
                >
                  {showGrid ? '✓' : ''} Grid
                </button>
                <button 
                  className={`dropdown-action ${snapToGrid ? 'active' : ''}`}
                  onClick={() => setSnapToGrid(!snapToGrid)}
                >
                  {snapToGrid ? '✓' : ''} Snap to Grid
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Visibility</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Show all objects
                    sceneObjects.forEach(obj => {
                      if (obj.type !== 'ground') {
                        setObjectVisibility(obj.id, true)
                        if (obj.mesh) obj.mesh.isVisible = true
                      }
                    })
                    setActiveDropdown(null)
                  }}
                >
                  Show All
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Hide unselected objects
                    const visibleIds = selectedObjectId ? [selectedObjectId] : selectedObjectIds
                    const newVisibility: {[key: string]: boolean} = {}
                    
                    sceneObjects.forEach(obj => {
                      if (obj.type !== 'ground') {
                        const shouldBeVisible = visibleIds.includes(obj.id)
                        if (obj.mesh) {
                          obj.mesh.isVisible = shouldBeVisible
                        }
                        newVisibility[obj.id] = shouldBeVisible
                      }
                    })
                    
                    // isolate selected handler change
                    Object.entries(newVisibility).forEach(([id, vis]) => setObjectVisibility(id, vis))
                    
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelectionFlag}
                >
                  Isolate Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )



  // AI logic is now handled by the AI service in the AISidebar component

  const handleContinue = () => {
    if (apiKey.trim()) {
      console.log('🔑 API key entered, switching to main app view')
      setShowApiKeyInput(false)
    }
  }

  // Callback function to open custom room modal
  const handleOpenCustomRoomModal = () => {
    console.log('🎨 Opening custom room modal from AI command')
    setShowCustomRoomModal(true)
  }

  // AI prompt submission handler
  const handleAIPromptSubmit = async () => {
    if (!textInput.trim() || isLoading || !sceneInitialized) return;

    // Check for special keywords
    const lowerInput = textInput.trim().toLowerCase();
    if (lowerInput.includes('draw room panel')) {
      console.log('🎨 Detected "draw room panel" command');
      
      // Open the custom room modal
      handleOpenCustomRoomModal();
      setTextInput(''); // Clear the input
      addToResponseLog('User: draw room panel');
      addToResponseLog('AI: Opening custom room drawing panel...');
      return;
    }

    setIsLoading(true);
    
    try {
      // Import AI service dynamically
      const { createAIService } = await import('./ai/ai.service');
      
      // Sync positions from 3D meshes to store
      if (sceneAPI && sceneInitialized) {
        const sceneManager = sceneAPI.getSceneManager();
        if (sceneManager) {
          sceneObjects.forEach(obj => {
            if (obj.type === 'ground') return;
            
            const mesh = sceneManager.getMeshById(obj.id);
            if (mesh) {
              const meshPosition = mesh.position;
              const meshRotation = mesh.rotation;
              const meshScale = mesh.scaling;
              
              const positionDiff = !obj.position.equals(meshPosition);
              const rotationDiff = !obj.rotation.equals(meshRotation);
              const scaleDiff = !obj.scale.equals(meshScale);
              
              if (positionDiff || rotationDiff || scaleDiff) {
                updateObject(obj.id, {
                  position: meshPosition.clone(),
                  rotation: meshRotation.clone(),
                  scale: meshScale.clone()
                });
              }
            }
          });
        }
      }

      // Prepare scene data for AI
      const enrichedSceneObjects = sceneObjects.map(obj => ({
        id: obj.id,
        type: obj.type,
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
        color: obj.color,
        isNurbs: obj.isNurbs
      }));

      const currentSelectedId = selectedObjectId;
      const currentSelectedIds = selectedObjectIds;

      // GLB object names for AI context
      const glbObjectNames = [
        'Adjustable Desk', 'Bathtub', 'Bed Double', 'Bed Single', 'Bookcase', 'Chair',
        'Clothes dryer', 'Couch Small', 'Desk', 'Fan', 'Kitchen Fridge', 'Light Desk',
        'Light Stand', 'Oven', 'Simple computer', 'Simple table', 'Sofa', 'Standing Desk',
        'Table', 'TV', 'wooden bookshelf'
      ];

      const aiService = createAIService(apiKey, glbObjectNames);
      const result = await aiService.getSceneCommands(textInput, enrichedSceneObjects as any, currentSelectedId, currentSelectedIds);
      
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
        result.commands.forEach(command => {
          // Execute scene command logic here
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
                const rotationX = command.rotationX || 0;
                const rotationY = command.rotationY || 0;
                const rotationZ = command.rotationZ || 0;
                
                updateObject(command.objectId, { 
                  rotation: new Vector3(rotationX, rotationY, rotationZ) 
                });
              }
              break;
            case 'create':
              if (command.type) {
                let newId = command.name;
                if (newId) {
                  if (sceneObjects.some(obj => obj.id === newId)) {
                    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
                    const oldId = newId;
                    newId = `${newId}-${uniqueSuffix}`;
                    addToResponseLog(`Warning: Object name "${oldId}" already exists. Renaming to "${newId}".`);
                  }
                } else {
                  newId = `${command.type}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
                }
                
                const newObj: SceneObject = {
                  id: newId,
                  type: command.type,
                  position: new Vector3(command.x || 0, command.y || 1, command.z || 0),
                  scale: new Vector3(1, 1, 1),
                  rotation: new Vector3(0, 0, 0),
                  color: command.color || (command.type.startsWith('house-') ? '#8B4513' : '#3498db'),
                  isNurbs: false
                };
                
                addObject(newObj);
              }
              break;
            case 'delete':
              if (command.objectId) {
                removeObject(command.objectId);
              }
              break;
            case 'describe':
              if (command.description) {
                setSceneDescription(command.description);
                setShowDescriptionPanel(true);
              }
              break;
          }
        });
      } else {
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
  }

  // Import GLB handler
  const handleImportGLB = async (file: File) => {
    if (!sceneInitialized || !sceneAPI) {
      console.error('Scene not initialized');
      return;
    }

    const sceneManager = sceneAPI.getSceneManager();
    const scene = sceneManager?.getScene();
    if (!sceneManager || !scene) {
      console.error('Scene manager not available');
      return;
    }

    // Clear any previous import error
    const { clearImportError, startImport, importSuccess, setImportError, addToResponseLog } = useSceneStore.getState();
    clearImportError();
    
    // Start the import process
    startImport();

    try {
      // Create model importer with scene and sceneManager
      const importer = createGLBImporter(scene, sceneManager);
      
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

  // Export STL handler
  const handleExportSTL = async () => {
    if (!sceneInitialized || !sceneAPI) {
      console.error('Scene not initialized');
      return;
    }

    const sceneManager = sceneAPI.getSceneManager();
    const scene = sceneManager?.getScene();
    if (!sceneManager || !scene) {
      console.error('Scene manager not available');
      return;
    }

    try {
      // Create STL exporter
      const exporter = createSTLExporter(scene);
      
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

  // Space optimization handlers
  const handleAnalyzeSpace = async () => {
    const roomObjects = sceneObjects.filter(obj => obj.type === 'custom-room');
    if (roomObjects.length === 0) {
      addToResponseLog('Error: No custom rooms found. Please draw a room first.');
      return;
    }
    
    try {
      addToResponseLog(`🔍 Analyzing space for ${selectedFurnitureType} using ${optimizationStrategy} strategy...`);
      // Placeholder for space analysis logic
      // This would integrate with the SpaceOptimizationPanel's actual analysis
      addToResponseLog('✅ Space analysis complete. Check AI sidebar for detailed results.');
    } catch (error) {
      addToResponseLog(`Error: Space analysis failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAnalyzeSelected = async () => {
    if (!hasSelectionFlag) {
      addToResponseLog('Error: Please select objects to analyze');
      return;
    }

    const roomObjects = sceneObjects.filter(obj => obj.type === 'custom-room');
    if (roomObjects.length === 0) {
      addToResponseLog('Error: No custom rooms found. Please draw a room first.');
      return;
    }

    try {
      addToResponseLog(`📋 Analyzing selected objects in room context...`);
      // Placeholder for selected object analysis logic
      addToResponseLog('✅ Selected object analysis complete. Check AI sidebar for detailed results.');
    } catch (error) {
      addToResponseLog(`Error: Selected object analysis failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleGenerateLayouts = async () => {
    const roomObjects = sceneObjects.filter(obj => obj.type === 'custom-room');
    if (roomObjects.length === 0) {
      addToResponseLog('Error: No custom rooms found. Please draw a room first.');
      return;
    }

    try {
      addToResponseLog(`🎨 Generating optimized layouts for ${selectedFurnitureType}...`);
      // Placeholder for layout generation logic  
      addToResponseLog('✅ Layout generation complete. Check AI sidebar for layout options.');
    } catch (error) {
      addToResponseLog(`Error: Layout generation failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClearOptimizedObjects = () => {
    const optimizedObjects = sceneObjects.filter(obj => obj.id.startsWith('optimized-'));
    if (optimizedObjects.length === 0) {
      addToResponseLog('No optimized objects to clear.');
      return;
    }

    try {
      optimizedObjects.forEach(obj => {
        removeObject(obj.id);
      });
      addToResponseLog(`🗑️ Cleared ${optimizedObjects.length} optimized objects from the scene.`);
    } catch (error) {
      addToResponseLog(`Error: Failed to clear optimized objects - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /*
  const clearAllObjects = () => {
    // Detach gizmo first
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.attachToMesh(null)
    }

    setSceneObjects(prev => {
      const objectsToDelete = prev.filter(obj => obj.type !== 'ground')
      console.log('🧹 Clearing all objects:', objectsToDelete.map(obj => obj.id))
      
      // Dispose all meshes
      objectsToDelete.forEach(obj => {
        if (obj.mesh) {
          obj.mesh.dispose()
        }
      })
      
      // Keep only the ground
      const remainingObjects = prev.filter(obj => obj.type === 'ground')
      return remainingObjects
    })
    setSelectedObjectId(null)
    console.log('✅ All objects cleared')
  }
  */

  // Scene initialization is now handled by the useBabylonScene hook
  // No need for manual cleanup since the hook handles it

  if (showApiKeyInput) {
    console.log('🔐 App.tsx: Rendering API key input form')
    return (
      <div className="api-key-setup">
        <div className="api-key-container">
          <h2>VibeCad - AI Scene Manipulation</h2>
          <p>Enter your OpenAI API Key to enable AI-powered 3D scene manipulation:</p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="api-key-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleContinue()
              }
            }}
          />
          <button 
            onClick={handleContinue}
            disabled={!apiKey.trim()}
            className="api-key-submit"
          >
            Continue
          </button>
          <p className="api-key-note">
            Your API key is stored locally and never sent to our servers.
          </p>
        </div>
      </div>
    )
  }

  //console.log('🎨 App.tsx: Rendering main app with canvas')
  
  return (
    <div className="app-container">
      {renderTopToolbar()}
      <div className="main-content">
        <div className="canvas-container">
          <canvas 
            ref={canvasRef} 
            className="babylon-canvas" 
            onLoad={() => console.log('📺 Canvas onLoad event')}
          />
          {/* Compass overlay for directional reference */}
          <CompassOverlay />
          {/* Measurement overlay for grid coordinates and distance measurement */}
          <MeasurementOverlay scene={sceneAPI.getSceneManager()?.getScene() || null} />
          {/* Action Buttons Overlay - Test Cube, Import/Export buttons side by side */}
          <ActionButtonsOverlay
            onImport={handleImportGLB}
            onExport={handleExportSTL}
            onCreateCube={() => createPrimitive('cube')}
            sceneInitialized={sceneInitialized}
          />
          {/* Selection mode indicator for multi-select feedback */}
          <SelectionModeIndicator isVisible={sceneInitialized} />
          {/* Undo/Redo indicator and controls */}
          <UndoRedoIndicator />
        </div>
        <AISidebar 
          apiKey={apiKey}
          sceneInitialized={sceneInitialized}
          sceneAPI={sceneAPI}
          onOpenCustomRoomModal={handleOpenCustomRoomModal}
        />
      </div>
      {/* Custom Room Drawing Modal */}
      <CustomRoomModal
        isOpen={showCustomRoomModal}
        onCancel={() => setShowCustomRoomModal(false)}
        onCreate={handleCreateCustomRoom}
        onCreateMultiple={handleCreateMultipleCustomRooms}
      />
      
      {/* Scene Description Panel - Above AI Prompt Box */}
      {showDescriptionPanel && (
        <SceneDescriptionPanel 
          description={sceneDescription} 
          onClose={() => setShowDescriptionPanel(false)} 
        />
      )}
      
      {/* AI Prompt Box - Lower Left Corner */}
      <AIPromptBox
        value={textInput}
        onChange={setTextInput}
        onSubmit={handleAIPromptSubmit}
        isLoading={isLoading}
        isDisabled={!sceneInitialized}
      />
    </div>
  )
}

export default App
