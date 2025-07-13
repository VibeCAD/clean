Creating Your Rectangle Primitive
Step 1: Add the Type Definition
In src/types/types.ts, add 'rectangle' to the PrimitiveType union:
Apply to rectangle.md
types
export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 'rectangle' | 'nurbs' | 
    'house-basic' | // ... rest of types

Step 2: Create the Factory Function
In src/babylon/objectFactory.ts, add a new createRectangle function:
Apply to rectangle.md
/**
 * Creates a rectangle mesh with the specified options
 * Default dimensions: 2x2x2 (same as cube)
 */
export const createRectangle = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  // Create a box with 2x2x2 dimensions (same as cube)
  const mesh = MeshBuilder.CreateBox(options.name || 'rectangle', { 
    width: 2,  // Same as cube width
    height: 2, // Same as cube height
    depth: 2   // Same as cube depth
  }, scene);
  
  applyMeshOptions(mesh, options);
  attachConnectionPoints(mesh, 'rectangle');
  return mesh;
};
;
Step 3: Update the Factory Switch Statement
In the same file, add the rectangle case to createPrimitiveMesh:
Apply to rectangle.md
export const createPrimitiveMesh = (
  type: PrimitiveType, 
  scene: Scene, 
  options: MeshCreationOptions = {}
): Mesh => {
  // ... existing code
  
  switch (type) {
    case 'cube':
      return createCube(scene, options);
    case 'rectangle':
      return createRectangle(scene, options);
    // ... other cases
  }
};
;
Step 4: Add Connection Points
In the attachConnectionPoints function, add a case for rectangle:
Apply to rectangle.md
case 'rectangle': {
  const halfX = 1.0 * mesh.scaling.x;  // 2/2
  const halfY = 1.0 * mesh.scaling.y;  // 2/2
  const halfZ = 1.0 * mesh.scaling.z;  // 2/2

  connectionPoints = [
    { id: 'px', position: new Vector3(halfX, 0, 0), normal: new Vector3(1, 0, 0) },
    { id: 'nx', position: new Vector3(-halfX, 0, 0), normal: new Vector3(-1, 0, 0) },
    { id: 'py', position: new Vector3(0, halfY, 0), normal: new Vector3(0, 1, 0) },
    { id: 'ny', position: new Vector3(0, -halfY, 0), normal: new Vector3(0, -1, 0) },
    { id: 'pz', position: new Vector3(0, 0, halfZ), normal: new Vector3(0, 0, 1) },
    { id: 'nz', position: new Vector3(0, 0, -halfZ), normal: new Vector3(0, 0, -1) },
  ];
  break;
}
}
Step 5: Update Scene Manager
In src/babylon/sceneManager.ts, add the rectangle case:
Apply to rectangle.md
case 'rectangle':
  mesh = MeshBuilder.CreateBox(sceneObject.id, { 
    width: 2, 
    height: 2, 
    depth: 2 
  }, this.scene)
  break
break
Step 6: Update AI Service Dimensions
In src/ai/ai.service.ts, add rectangle dimensions in multiple places:
In defaultFrontFaces:
Apply to rectangle.md
'rectangle': new Vector3(0, 0, 1),
,
In getObjectDimensions and getBaseDimensionsForType:
Apply to rectangle.md
,
Step 7: Update Space Optimization
In src/algorithms/spaceOptimization.ts, add rectangle dimensions:
Apply to rectangle.md
,
Step 8: Update Furniture Database
In src/data/furnitureDatabase.ts, add rectangle to the defaults:
Apply to rectangle.md
,
Key Points About Dimensions
Cube dimensions: 2×2×2 units (as defined in the codebase)
Your rectangle: 2×2×2 units (same as cube)
Scaling: The scale property in SceneObject will be applied on top of these base dimensions
Coordinate system: X=width, Y=height, Z=depth
Usage
Once implemented, users can create rectangles through:
Programmatically: createPrimitive('rectangle')
AI Commands: "create a rectangle"
UI: Add a rectangle button to the toolbar dropdown
The rectangle will have the exact dimensions you specified (2×2×2, same as cube) and will integrate seamlessly with all existing features like textures, transformations, space optimization, and AI interactions.