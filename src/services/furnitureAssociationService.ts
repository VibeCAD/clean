import { Vector3 } from 'babylonjs';

export interface FurnitureAssociation {
  primaryType: string;
  associatedTypes: {
    type: string;
    quantity: number;
    positioning: 'around' | 'facing' | 'adjacent' | 'opposite';
    distance: number; // meters
    priority: 'required' | 'preferred' | 'optional';
  }[];
  description: string;
  category: 'office' | 'dining' | 'meeting' | 'living' | 'bedroom' | 'classroom';
}

export interface AssociationPlacement {
  primaryPosition: Vector3;
  primaryRotation: Vector3;
  associatedObjects: {
    type: string;
    position: Vector3;
    rotation: Vector3;
    groupId: string;
  }[];
}

/**
 * Furniture Association Service - manages automatic furniture groupings and relationships
 */
export class FurnitureAssociationService {
  
  // Define furniture associations
  private associations: FurnitureAssociation[] = [
    {
      primaryType: 'Desk',
      associatedTypes: [
        { type: 'Chair', quantity: 1, positioning: 'facing', distance: 0.6, priority: 'required' }
      ],
      description: 'Office desk with chair',
      category: 'office'
    },
    {
      primaryType: 'Adjustable Desk',
      associatedTypes: [
        { type: 'Chair', quantity: 1, positioning: 'facing', distance: 0.6, priority: 'required' }
      ],
      description: 'Adjustable office desk with chair',
      category: 'office'
    },
    {
      primaryType: 'Standing Desk',
      associatedTypes: [
        { type: 'Chair', quantity: 1, positioning: 'facing', distance: 0.8, priority: 'preferred' }
      ],
      description: 'Standing desk with optional chair',
      category: 'office'
    },
    {
      primaryType: 'Table',
      associatedTypes: [
        { type: 'Chair', quantity: 4, positioning: 'around', distance: 0.5, priority: 'required' }
      ],
      description: 'Dining/meeting table with 4 chairs',
      category: 'dining'
    },
    {
      primaryType: 'Simple table',
      associatedTypes: [
        { type: 'Chair', quantity: 4, positioning: 'around', distance: 0.5, priority: 'preferred' }
      ],
      description: 'Simple table with 4 chairs',
      category: 'dining'
    },
    {
      primaryType: 'Conference Table',
      associatedTypes: [
        { type: 'Chair', quantity: 8, positioning: 'around', distance: 0.6, priority: 'required' }
      ],
      description: 'Conference table with 8 chairs',
      category: 'meeting'
    },
    {
      primaryType: 'TV',
      associatedTypes: [
        { type: 'Sofa', quantity: 1, positioning: 'facing', distance: 2.5, priority: 'preferred' },
        { type: 'Chair', quantity: 2, positioning: 'facing', distance: 2.0, priority: 'optional' }
      ],
      description: 'TV with seating arrangement',
      category: 'living'
    },
    {
      primaryType: 'Sofa',
      associatedTypes: [
        { type: 'Simple table', quantity: 1, positioning: 'facing', distance: 0.8, priority: 'preferred' }
      ],
      description: 'Sofa with coffee table',
      category: 'living'
    },
    {
      primaryType: 'Bed Double',
      associatedTypes: [
        { type: 'Simple table', quantity: 2, positioning: 'adjacent', distance: 0.3, priority: 'preferred' }
      ],
      description: 'Double bed with nightstands',
      category: 'bedroom'
    },
    {
      primaryType: 'Bed Single',
      associatedTypes: [
        { type: 'Simple table', quantity: 1, positioning: 'adjacent', distance: 0.3, priority: 'preferred' }
      ],
      description: 'Single bed with nightstand',
      category: 'bedroom'
    },
    {
      primaryType: 'Bookcase',
      associatedTypes: [
        { type: 'Chair', quantity: 1, positioning: 'facing', distance: 1.2, priority: 'optional' }
      ],
      description: 'Bookcase with reading chair',
      category: 'office'
    }
  ];

  /**
   * Get association for a furniture type
   */
  public getAssociation(furnitureType: string): FurnitureAssociation | undefined {
    return this.associations.find(assoc => assoc.primaryType === furnitureType);
  }

  /**
   * Get all associations for a category
   */
  public getAssociationsByCategory(category: string): FurnitureAssociation[] {
    return this.associations.filter(assoc => assoc.category === category);
  }

  /**
   * Check if furniture type has associations
   */
  public hasAssociations(furnitureType: string): boolean {
    return this.associations.some(assoc => assoc.primaryType === furnitureType);
  }

  /**
   * Get expanded furniture list including associations
   */
  public expandFurnitureRequest(
    furnitureType: string, 
    quantity: number = 1,
    includePriority: 'required' | 'preferred' | 'optional' = 'preferred'
  ): { type: string; quantity: number; priority: 'primary' | 'secondary' }[] {
    const association = this.getAssociation(furnitureType);
    const result: { type: string; quantity: number; priority: 'primary' | 'secondary' }[] = [];

    // Add primary furniture
    result.push({ type: furnitureType, quantity, priority: 'primary' });

    if (association) {
      // Add associated furniture based on priority filter
      for (const assocType of association.associatedTypes) {
        if (this.shouldIncludeByPriority(assocType.priority, includePriority)) {
          result.push({
            type: assocType.type,
            quantity: assocType.quantity * quantity, // Multiply by primary quantity
            priority: 'secondary'
          });
        }
      }
    }

    return result;
  }

  /**
   * Calculate associated object placements
   */
  public calculateAssociatedPlacements(
    primaryType: string,
    primaryPosition: Vector3,
    primaryRotation: Vector3,
    roomBounds?: { min: Vector3; max: Vector3 }
  ): AssociationPlacement {
    const association = this.getAssociation(primaryType);
    
    if (!association) {
      return {
        primaryPosition: primaryPosition.clone(),
        primaryRotation: primaryRotation.clone(),
        associatedObjects: []
      };
    }

    const associatedObjects: AssociationPlacement['associatedObjects'] = [];
    let objectIndex = 0;

    for (const assocType of association.associatedTypes) {
      const positions = this.calculatePositionsForType(
        assocType,
        primaryPosition,
        primaryRotation,
        roomBounds
      );

      for (const pos of positions) {
        associatedObjects.push({
          type: assocType.type,
          position: pos.position,
          rotation: pos.rotation,
          groupId: `${primaryType.toLowerCase()}-group-${objectIndex++}`
        });
      }
    }

    return {
      primaryPosition: primaryPosition.clone(),
      primaryRotation: primaryRotation.clone(),
      associatedObjects
    };
  }

  /**
   * Calculate positions for associated furniture type
   */
  private calculatePositionsForType(
    assocType: FurnitureAssociation['associatedTypes'][0],
    primaryPosition: Vector3,
    primaryRotation: Vector3,
    roomBounds?: { min: Vector3; max: Vector3 }
  ): { position: Vector3; rotation: Vector3 }[] {
    const positions: { position: Vector3; rotation: Vector3 }[] = [];

    switch (assocType.positioning) {
      case 'facing':
        positions.push(...this.calculateFacingPositions(assocType, primaryPosition, primaryRotation));
        break;
      case 'around':
        positions.push(...this.calculateAroundPositions(assocType, primaryPosition, primaryRotation));
        break;
      case 'adjacent':
        positions.push(...this.calculateAdjacentPositions(assocType, primaryPosition, primaryRotation));
        break;
      case 'opposite':
        positions.push(...this.calculateOppositePositions(assocType, primaryPosition, primaryRotation));
        break;
    }

    // Filter positions that are within room bounds if provided
    if (roomBounds) {
      return positions.filter(pos => 
        pos.position.x >= roomBounds.min.x && pos.position.x <= roomBounds.max.x &&
        pos.position.z >= roomBounds.min.z && pos.position.z <= roomBounds.max.z
      );
    }

    return positions;
  }

  /**
   * Calculate facing positions (for desks, TVs, etc.)
   */
  private calculateFacingPositions(
    assocType: FurnitureAssociation['associatedTypes'][0],
    primaryPosition: Vector3,
    primaryRotation: Vector3
  ): { position: Vector3; rotation: Vector3 }[] {
    // Get the front direction of the primary object
    const frontDirection = new Vector3(
      Math.sin(primaryRotation.y),
      0,
      Math.cos(primaryRotation.y)
    );

    const position = primaryPosition.add(frontDirection.scale(assocType.distance));
    
    // Face toward the primary object
    const rotation = new Vector3(
      primaryRotation.x,
      primaryRotation.y + Math.PI, // Face opposite direction
      primaryRotation.z
    );

    return [{ position, rotation }];
  }

  /**
   * Calculate around positions (for tables with multiple chairs)
   */
  private calculateAroundPositions(
    assocType: FurnitureAssociation['associatedTypes'][0],
    primaryPosition: Vector3,
    primaryRotation: Vector3
  ): { position: Vector3; rotation: Vector3 }[] {
    const positions: { position: Vector3; rotation: Vector3 }[] = [];
    const angleStep = (2 * Math.PI) / assocType.quantity;

    for (let i = 0; i < assocType.quantity; i++) {
      const angle = i * angleStep;
      const x = primaryPosition.x + Math.cos(angle) * assocType.distance;
      const z = primaryPosition.z + Math.sin(angle) * assocType.distance;
      
      const position = new Vector3(x, primaryPosition.y, z);
      
      // Face toward the center (primary object)
      const rotation = new Vector3(
        primaryRotation.x,
        angle + Math.PI, // Face inward
        primaryRotation.z
      );

      positions.push({ position, rotation });
    }

    return positions;
  }

  /**
   * Calculate adjacent positions (for nightstands, side tables)
   */
  private calculateAdjacentPositions(
    assocType: FurnitureAssociation['associatedTypes'][0],
    primaryPosition: Vector3,
    primaryRotation: Vector3
  ): { position: Vector3; rotation: Vector3 }[] {
    const positions: { position: Vector3; rotation: Vector3 }[] = [];
    
    // Calculate side directions
    const rightDirection = new Vector3(
      Math.cos(primaryRotation.y),
      0,
      -Math.sin(primaryRotation.y)
    );

    for (let i = 0; i < assocType.quantity; i++) {
      const side = i % 2 === 0 ? 1 : -1; // Alternate sides
      const position = primaryPosition.add(rightDirection.scale(side * assocType.distance));
      
      // Same orientation as primary object
      const rotation = primaryRotation.clone();

      positions.push({ position, rotation });
    }

    return positions;
  }

  /**
   * Calculate opposite positions
   */
  private calculateOppositePositions(
    assocType: FurnitureAssociation['associatedTypes'][0],
    primaryPosition: Vector3,
    primaryRotation: Vector3
  ): { position: Vector3; rotation: Vector3 }[] {
    // Get the back direction of the primary object
    const backDirection = new Vector3(
      -Math.sin(primaryRotation.y),
      0,
      -Math.cos(primaryRotation.y)
    );

    const position = primaryPosition.add(backDirection.scale(assocType.distance));
    
    // Same orientation as primary object
    const rotation = primaryRotation.clone();

    return [{ position, rotation }];
  }

  /**
   * Check if association should be included based on priority
   */
  private shouldIncludeByPriority(
    associationPriority: 'required' | 'preferred' | 'optional',
    includePriority: 'required' | 'preferred' | 'optional'
  ): boolean {
    const priorityLevels = { required: 3, preferred: 2, optional: 1 };
    return priorityLevels[associationPriority] >= priorityLevels[includePriority];
  }

  /**
   * Get all primary furniture types that have associations
   */
  public getPrimaryFurnitureTypes(): string[] {
    return this.associations.map(assoc => assoc.primaryType);
  }

  /**
   * Get description of furniture associations
   */
  public getAssociationDescription(furnitureType: string): string {
    const association = this.getAssociation(furnitureType);
    return association ? association.description : `${furnitureType} (no associations)`;
  }
}

// Export singleton instance
export const furnitureAssociationService = new FurnitureAssociationService(); 