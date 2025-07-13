import { Vector3, Mesh } from 'babylonjs';
import type { SceneObject } from '../types/types';
import { roomAnalysisService, type RoomAnalysisResult } from './roomAnalysisService';
import { placementConstraintsService, type PlacementConstraint, type PlacementValidationResult } from './placementConstraintsService';
import { furnitureAssociationService } from './furnitureAssociationService';
import { furnitureDatabase } from '../data/furnitureDatabase';
import { spaceOptimizer } from '../algorithms/spaceOptimization';

export interface ReorganizationSuggestion {
  id: string;
  type: 'move' | 'rotate' | 'group' | 'remove' | 'add';
  objectId: string;
  currentPosition: Vector3;
  suggestedPosition: Vector3;
  currentRotation?: Vector3;
  suggestedRotation?: Vector3;
  reason: string;
  improvementScore: number; // 0-100, how much this improves the layout
  priority: 'critical' | 'high' | 'medium' | 'low';
  regulation?: {
    standard: string;
    reference: string;
  };
}

export interface ReorganizationPlan {
  id: string;
  name: string;
  description: string;
  suggestions: ReorganizationSuggestion[];
  overallImprovement: number; // 0-100
  violationsResolved: number;
  newViolationsIntroduced: number;
  estimatedTime: number; // minutes to implement
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ReorganizationAnalysis {
  currentScore: number; // Current layout quality 0-100
  potentialScore: number; // Best possible score with reorganization
  majorIssues: PlacementConstraint[];
  minorIssues: PlacementConstraint[];
  reorganizationPlans: ReorganizationPlan[];
  quickFixes: ReorganizationSuggestion[];
  spaceUtilizationImprovement: number;
  accessibilityImprovement: number;
  safetyImprovement: number;
}

/**
 * Layout Reorganization Service - analyzes existing layouts and suggests improvements
 */
export class LayoutReorganizationService {

  /**
   * Analyze existing layout and suggest reorganization
   */
  public async analyzeAndSuggestReorganization(
    roomMesh: Mesh,
    sceneObjects: SceneObject[],
    roomId: string,
    goals: ('accessibility' | 'efficiency' | 'safety' | 'aesthetic')[] = ['accessibility', 'safety']
  ): Promise<ReorganizationAnalysis> {
    console.log(`🔄 Analyzing layout for reorganization in room ${roomId}`);

    // Analyze current room state
    const roomAnalysis = roomAnalysisService.analyzeRoom(roomMesh, sceneObjects, roomId);
    const currentValidation = placementConstraintsService.validatePlacement(roomMesh, sceneObjects, roomId);
    
    // Get furniture objects in the room
    const furnitureObjects = this.getFurnitureObjectsInRoom(sceneObjects, roomAnalysis);
    
    if (furnitureObjects.length === 0) {
      return this.createEmptyAnalysis();
    }

    // Identify current issues
    const majorIssues = currentValidation.violations;
    const minorIssues = currentValidation.warnings;

    // Generate reorganization suggestions
    const allSuggestions = await this.generateReorganizationSuggestions(
      furnitureObjects,
      roomAnalysis,
      currentValidation,
      goals
    );

    // Create reorganization plans
    const reorganizationPlans = this.createReorganizationPlans(allSuggestions, goals);

    // Identify quick fixes
    const quickFixes = allSuggestions.filter(s => 
      s.priority === 'high' && 
      s.improvementScore >= 20 &&
      s.type !== 'remove'
    ).slice(0, 5);

    // Calculate potential improvements
    const bestPlan = reorganizationPlans.length > 0 ? reorganizationPlans[0] : null;
    const potentialScore = bestPlan ? 
      Math.min(100, currentValidation.score + bestPlan.overallImprovement) : 
      currentValidation.score;

    return {
      currentScore: currentValidation.score,
      potentialScore,
      majorIssues,
      minorIssues,
      reorganizationPlans,
      quickFixes,
      spaceUtilizationImprovement: this.calculateSpaceUtilizationImprovement(reorganizationPlans),
      accessibilityImprovement: this.calculateAccessibilityImprovement(reorganizationPlans),
      safetyImprovement: this.calculateSafetyImprovement(reorganizationPlans)
    };
  }

  /**
   * Apply a reorganization plan to the scene
   */
  public applyReorganizationPlan(
    plan: ReorganizationPlan,
    updateObjectCallback: (objectId: string, newPosition: Vector3, newRotation?: Vector3) => void,
    removeObjectCallback: (objectId: string) => void,
    addObjectCallback: (type: string, position: Vector3, rotation?: Vector3) => void
  ): void {
    console.log(`🔄 Applying reorganization plan: ${plan.name}`);

    for (const suggestion of plan.suggestions) {
      try {
        switch (suggestion.type) {
          case 'move':
          case 'rotate':
            updateObjectCallback(
              suggestion.objectId,
              suggestion.suggestedPosition,
              suggestion.suggestedRotation
            );
            break;
          case 'remove':
            removeObjectCallback(suggestion.objectId);
            break;
          case 'add':
            // Extract object type from suggestion ID or reason
            const objectType = this.extractObjectTypeFromSuggestion(suggestion);
            addObjectCallback(
              objectType,
              suggestion.suggestedPosition,
              suggestion.suggestedRotation
            );
            break;
          case 'group':
            // Handle grouping by moving objects to suggested positions
            updateObjectCallback(
              suggestion.objectId,
              suggestion.suggestedPosition,
              suggestion.suggestedRotation
            );
            break;
        }
      } catch (error) {
        console.warn(`Failed to apply suggestion ${suggestion.id}:`, error);
      }
    }

    console.log(`✅ Applied ${plan.suggestions.length} reorganization suggestions`);
  }

  /**
   * Generate reorganization suggestions
   */
  private async generateReorganizationSuggestions(
    furnitureObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult,
    currentValidation: PlacementValidationResult,
    goals: string[]
  ): Promise<ReorganizationSuggestion[]> {
    const suggestions: ReorganizationSuggestion[] = [];

    // 1. Fix accessibility violations
    if (goals.includes('accessibility')) {
      suggestions.push(...this.generateAccessibilitySuggestions(furnitureObjects, roomAnalysis, currentValidation));
    }

    // 2. Fix safety violations
    if (goals.includes('safety')) {
      suggestions.push(...this.generateSafetySuggestions(furnitureObjects, roomAnalysis, currentValidation));
    }

    // 3. Improve space efficiency
    if (goals.includes('efficiency')) {
      suggestions.push(...this.generateEfficiencySuggestions(furnitureObjects, roomAnalysis));
    }

    // 4. Enhance aesthetic arrangement
    if (goals.includes('aesthetic')) {
      suggestions.push(...this.generateAestheticSuggestions(furnitureObjects, roomAnalysis));
    }

    // 5. Apply furniture associations
    suggestions.push(...this.generateAssociationSuggestions(furnitureObjects, roomAnalysis));

    // Sort by priority and improvement score
    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] - priorityOrder[a.priority]) || 
             (b.improvementScore - a.improvementScore);
    });
  }

  /**
   * Generate accessibility improvement suggestions
   */
  private generateAccessibilitySuggestions(
    furnitureObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult,
    currentValidation: PlacementValidationResult
  ): ReorganizationSuggestion[] {
    const suggestions: ReorganizationSuggestion[] = [];

    // Check pathway obstructions
    for (const path of roomAnalysis.accessibilityPaths) {
      if (path.width < 0.91) { // ADA minimum
        // Find objects blocking this path
        for (const obj of furnitureObjects) {
          if (this.isObjectBlockingPath(obj, path)) {
            const betterPosition = this.findBetterPositionForAccessibility(obj, roomAnalysis);
            if (betterPosition) {
              suggestions.push({
                id: `accessibility-move-${obj.id}`,
                type: 'move',
                objectId: obj.id,
                currentPosition: obj.position.clone(),
                suggestedPosition: betterPosition,
                reason: `Move to improve pathway width from ${path.width.toFixed(1)}m to ADA minimum 0.91m`,
                improvementScore: Math.min(50, (0.91 - path.width) * 100),
                priority: 'critical',
                regulation: {
                  standard: 'ADA 2010',
                  reference: 'Section 403.5.1'
                }
              });
            }
          }
        }
      }
    }

    // Check maneuvering space
    const restrictedZones = roomAnalysis.placementZones.filter(z => z.type === 'restricted');
    if (restrictedZones.length > 0) {
      for (const obj of furnitureObjects) {
        const nearRestrictedZone = restrictedZones.find(zone => 
          Vector3.Distance(obj.position, zone.center) < 1.5
        );
        
        if (nearRestrictedZone) {
          const betterPosition = this.findPositionAwayFromRestrictedZones(obj, roomAnalysis);
          if (betterPosition) {
            suggestions.push({
              id: `accessibility-clear-${obj.id}`,
              type: 'move',
              objectId: obj.id,
              currentPosition: obj.position.clone(),
              suggestedPosition: betterPosition,
              reason: 'Move away from restricted zone to improve wheelchair maneuvering space',
              improvementScore: 35,
              priority: 'high'
            });
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate safety improvement suggestions
   */
  private generateSafetySuggestions(
    furnitureObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult,
    currentValidation: PlacementValidationResult
  ): ReorganizationSuggestion[] {
    const suggestions: ReorganizationSuggestion[] = [];

    // Check fire egress paths
    const doors = roomAnalysis.constraints.filter(c => c.type === 'door');
    for (const door of doors) {
      for (const obj of furnitureObjects) {
        const distanceToDoor = Vector3.Distance(obj.position, door.position);
        if (distanceToDoor < 1.5) { // Too close to exit
          const saferPosition = this.findPositionAwayFromEgress(obj, door, roomAnalysis);
          if (saferPosition) {
            suggestions.push({
              id: `safety-egress-${obj.id}`,
              type: 'move',
              objectId: obj.id,
              currentPosition: obj.position.clone(),
              suggestedPosition: saferPosition,
              reason: 'Move away from egress door to maintain fire safety clearance',
              improvementScore: 40,
              priority: 'critical',
              regulation: {
                standard: 'IBC',
                reference: 'Section 1006.2'
              }
            });
          }
        }
      }
    }

    // Check clearance violations
    for (const violation of currentValidation.violations) {
      if (violation.type === 'clearance' && violation.affectedObjects.length > 0) {
        for (const objId of violation.affectedObjects) {
          const obj = furnitureObjects.find(o => o.id === objId);
          if (obj) {
            const betterPosition = this.findPositionWithAdequateClearance(obj, furnitureObjects, roomAnalysis);
            if (betterPosition) {
              suggestions.push({
                id: `safety-clearance-${obj.id}`,
                type: 'move',
                objectId: obj.id,
                currentPosition: obj.position.clone(),
                suggestedPosition: betterPosition,
                reason: violation.description,
                improvementScore: 30,
                priority: violation.severity === 'error' ? 'critical' : 'high'
              });
            }
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate space efficiency suggestions
   */
  private generateEfficiencySuggestions(
    furnitureObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult
  ): ReorganizationSuggestion[] {
    const suggestions: ReorganizationSuggestion[] = [];

    // Look for furniture in poor placement zones that could be moved to better zones
    const optimalZones = roomAnalysis.placementZones.filter(z => z.type === 'optimal');
    const poorZones = roomAnalysis.placementZones.filter(z => z.type === 'poor' || z.type === 'restricted');

    for (const obj of furnitureObjects) {
      const currentZone = this.findZoneForPosition(obj.position, roomAnalysis.placementZones);
      
      if (currentZone && (currentZone.type === 'poor' || currentZone.type === 'acceptable')) {
        const suitableOptimalZone = optimalZones.find(zone => 
          zone.recommendedFor.includes(obj.type) && 
          !this.isZoneOccupied(zone, furnitureObjects, obj.id)
        );
        
        if (suitableOptimalZone) {
          suggestions.push({
            id: `efficiency-optimal-${obj.id}`,
            type: 'move',
            objectId: obj.id,
            currentPosition: obj.position.clone(),
            suggestedPosition: suitableOptimalZone.center.clone(),
            reason: `Move from ${currentZone.type} zone to optimal zone for better space utilization`,
            improvementScore: 25,
            priority: 'medium'
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate aesthetic arrangement suggestions
   */
  private generateAestheticSuggestions(
    furnitureObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult
  ): ReorganizationSuggestion[] {
    const suggestions: ReorganizationSuggestion[] = [];

    // Suggest better alignment with walls
    const walls = roomAnalysis.constraints.filter(c => c.type === 'wall');
    
    for (const obj of furnitureObjects) {
      const nearestWall = this.findNearestWall(obj.position, walls);
      if (nearestWall) {
        const alignedRotation = this.calculateWallAlignedRotation(obj.position, nearestWall);
        const currentRotationDiff = Math.abs(obj.rotation.y - alignedRotation.y);
        
        if (currentRotationDiff > 0.1) { // More than ~6 degrees off
          suggestions.push({
            id: `aesthetic-align-${obj.id}`,
            type: 'rotate',
            objectId: obj.id,
            currentPosition: obj.position.clone(),
            suggestedPosition: obj.position.clone(),
            currentRotation: obj.rotation.clone(),
            suggestedRotation: alignedRotation,
            reason: 'Rotate to align with nearest wall for better visual harmony',
            improvementScore: 15,
            priority: 'low'
          });
        }
      }
    }

    // Suggest symmetrical arrangements
    const roomCenter = roomAnalysis.roomGeometry.boundingBox.min.add(roomAnalysis.roomGeometry.boundingBox.max).scale(0.5);
    const furnitureByType = this.groupFurnitureByType(furnitureObjects);
    
    for (const [type, objects] of furnitureByType) {
      if (objects.length === 2) {
        const [obj1, obj2] = objects;
        const symmetricalPositions = this.calculateSymmetricalPositions(obj1, obj2, roomCenter);
        
        if (symmetricalPositions) {
          suggestions.push({
            id: `aesthetic-symmetry-${obj1.id}`,
            type: 'move',
            objectId: obj1.id,
            currentPosition: obj1.position.clone(),
            suggestedPosition: symmetricalPositions.obj1Position,
            reason: `Arrange ${type} symmetrically for better visual balance`,
            improvementScore: symmetricalPositions.improvementScore,
            priority: 'low'
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate furniture association suggestions
   */
  private generateAssociationSuggestions(
    furnitureObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult
  ): ReorganizationSuggestion[] {
    const suggestions: ReorganizationSuggestion[] = [];

    // Check if furniture has proper associations
    for (const obj of furnitureObjects) {
      const association = furnitureAssociationService.getAssociation(obj.type);
      
      if (association) {
        for (const assocType of association.associatedTypes) {
          const associatedObjects = furnitureObjects.filter(o => o.type === assocType.type);
          
          if (associatedObjects.length > 0) {
            // Find the nearest associated object
            const nearestAssociated = associatedObjects.reduce((nearest, current) => {
              const distCurrent = Vector3.Distance(obj.position, current.position);
              const distNearest = nearest ? Vector3.Distance(obj.position, nearest.position) : Infinity;
              return distCurrent < distNearest ? current : nearest;
            }, null as SceneObject | null);

            if (nearestAssociated) {
              const currentDistance = Vector3.Distance(obj.position, nearestAssociated.position);
              const idealDistance = assocType.distance;
              
              if (Math.abs(currentDistance - idealDistance) > 0.3) { // More than 30cm off
                const idealPosition = this.calculateIdealAssociatedPosition(
                  obj, nearestAssociated, assocType, roomAnalysis
                );
                
                if (idealPosition) {
                  suggestions.push({
                    id: `association-${obj.id}-${nearestAssociated.id}`,
                    type: 'move',
                    objectId: nearestAssociated.id,
                    currentPosition: nearestAssociated.position.clone(),
                    suggestedPosition: idealPosition.position,
                    currentRotation: nearestAssociated.rotation.clone(),
                    suggestedRotation: idealPosition.rotation,
                    reason: `Position ${assocType.type} at ideal distance from ${obj.type} (${idealDistance}m)`,
                    improvementScore: 25,
                    priority: 'medium'
                  });
                }
              }
            }
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Create reorganization plans from suggestions
   */
  private createReorganizationPlans(
    suggestions: ReorganizationSuggestion[],
    goals: string[]
  ): ReorganizationPlan[] {
    const plans: ReorganizationPlan[] = [];

    // Plan 1: Critical fixes only
    const criticalSuggestions = suggestions.filter(s => s.priority === 'critical');
    if (criticalSuggestions.length > 0) {
      plans.push({
        id: 'critical-fixes',
        name: 'Critical Safety & Accessibility Fixes',
        description: 'Address only the most critical safety and accessibility violations',
        suggestions: criticalSuggestions,
        overallImprovement: criticalSuggestions.reduce((sum, s) => sum + s.improvementScore, 0) / criticalSuggestions.length,
        violationsResolved: criticalSuggestions.length,
        newViolationsIntroduced: 0,
        estimatedTime: criticalSuggestions.length * 5,
        difficulty: 'easy'
      });
    }

    // Plan 2: Comprehensive reorganization
    const comprehensiveSuggestions = suggestions.filter(s => 
      s.priority === 'critical' || s.priority === 'high'
    ).slice(0, 10); // Limit to top 10
    
    if (comprehensiveSuggestions.length > 0) {
      plans.push({
        id: 'comprehensive',
        name: 'Comprehensive Layout Improvement',
        description: 'Address all major issues and significantly improve the layout',
        suggestions: comprehensiveSuggestions,
        overallImprovement: comprehensiveSuggestions.reduce((sum, s) => sum + s.improvementScore, 0) / comprehensiveSuggestions.length,
        violationsResolved: comprehensiveSuggestions.filter(s => s.priority === 'critical' || s.priority === 'high').length,
        newViolationsIntroduced: Math.floor(comprehensiveSuggestions.length * 0.1),
        estimatedTime: comprehensiveSuggestions.length * 8,
        difficulty: 'medium'
      });
    }

    // Plan 3: Complete optimization
    const allSuggestions = suggestions.slice(0, 15); // Limit to top 15
    if (allSuggestions.length > comprehensiveSuggestions.length) {
      plans.push({
        id: 'complete-optimization',
        name: 'Complete Space Optimization',
        description: 'Full reorganization for optimal space utilization, aesthetics, and compliance',
        suggestions: allSuggestions,
        overallImprovement: allSuggestions.reduce((sum, s) => sum + s.improvementScore, 0) / allSuggestions.length,
        violationsResolved: allSuggestions.filter(s => s.priority === 'critical' || s.priority === 'high').length,
        newViolationsIntroduced: Math.floor(allSuggestions.length * 0.15),
        estimatedTime: allSuggestions.length * 10,
        difficulty: 'hard'
      });
    }

    return plans.sort((a, b) => b.overallImprovement - a.overallImprovement);
  }

  // Helper methods (simplified implementations)
  private getFurnitureObjectsInRoom(sceneObjects: SceneObject[], roomAnalysis: RoomAnalysisResult): SceneObject[] {
    return sceneObjects.filter(obj => 
      obj.type !== 'custom-room' && 
      obj.type !== 'ground' &&
      !obj.type.startsWith('house-') &&
      this.isPointInRoom(obj.position, roomAnalysis.roomGeometry.floorPolygon)
    );
  }

  private isPointInRoom(point: Vector3, polygon: { x: number; z: number }[]): boolean {
    const x = point.x, z = point.z;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, zi = polygon[i].z;
      const xj = polygon[j].x, zj = polygon[j].z;
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  private createEmptyAnalysis(): ReorganizationAnalysis {
    return {
      currentScore: 100,
      potentialScore: 100,
      majorIssues: [],
      minorIssues: [],
      reorganizationPlans: [],
      quickFixes: [],
      spaceUtilizationImprovement: 0,
      accessibilityImprovement: 0,
      safetyImprovement: 0
    };
  }

  // Placeholder implementations for helper methods
  private isObjectBlockingPath(obj: SceneObject, path: any): boolean { return false; }
  private findBetterPositionForAccessibility(obj: SceneObject, roomAnalysis: RoomAnalysisResult): Vector3 | null {
    // Find the best placement zone for accessibility
    const accessibleZones = roomAnalysis.placementZones.filter(zone => 
      zone.type === 'optimal' || zone.type === 'good'
    ).sort((a, b) => b.accessibilityScore - a.accessibilityScore);
    
    if (accessibleZones.length === 0) return null;
    
    // Find the best zone that's not too close to the current position
    const currentPos = obj.position;
    const bestZone = accessibleZones.find(zone => 
      zone.center.subtract(currentPos).length() > 1.0 // At least 1 meter away
    );
    
    if (!bestZone) return null;
    
    // Return the zone center as the suggested position
    return bestZone.center.clone();
  }
  private findPositionAwayFromRestrictedZones(obj: SceneObject, roomAnalysis: RoomAnalysisResult): Vector3 | null {
    // Find zones that are not restricted
    const safeZones = roomAnalysis.placementZones.filter(zone => 
      zone.type !== 'restricted' && zone.type !== 'poor'
    );
    
    if (safeZones.length === 0) return null;
    
    // Find the zone with the highest clearance score
    const bestZone = safeZones.reduce((best, zone) => 
      zone.clearanceScore > best.clearanceScore ? zone : best
    );
    
    // Make sure it's not too close to the current position
    const currentPos = obj.position;
    if (bestZone.center.subtract(currentPos).length() < 0.5) return null;
    
    return bestZone.center.clone();
  }
  private findPositionAwayFromEgress(obj: SceneObject, door: any, roomAnalysis: RoomAnalysisResult): Vector3 | null { return null; }
  private findPositionWithAdequateClearance(obj: SceneObject, furniture: SceneObject[], roomAnalysis: RoomAnalysisResult): Vector3 | null { return null; }
  private findZoneForPosition(position: Vector3, zones: any[]): any { return null; }
  private isZoneOccupied(zone: any, furniture: SceneObject[], excludeId: string): boolean { return false; }
  private findNearestWall(position: Vector3, walls: any[]): any { return null; }
  private calculateWallAlignedRotation(position: Vector3, wall: any): Vector3 { return new Vector3(0, 0, 0); }
  private groupFurnitureByType(objects: SceneObject[]): Map<string, SceneObject[]> {
    const groups = new Map<string, SceneObject[]>();
    
    objects.forEach(obj => {
      const type = obj.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(obj);
    });
    
    return groups;
  }
  private calculateSymmetricalPositions(obj1: SceneObject, obj2: SceneObject, center: Vector3): {
    obj1Position: Vector3;
    obj2Position: Vector3;
    improvementScore: number;
  } {
    // Calculate the midpoint between the two objects
    const currentMidpoint = obj1.position.add(obj2.position).scale(0.5);
    
    // Calculate the offset from center to midpoint
    const offsetFromCenter = currentMidpoint.subtract(center);
    
    // Calculate symmetrical positions around the room center
    const obj1Position = center.subtract(offsetFromCenter);
    const obj2Position = center.add(offsetFromCenter);
    
    // Calculate improvement score based on distance from center and symmetry
    const currentDistance = currentMidpoint.subtract(center).length();
    const improvementScore = Math.max(0, 100 - currentDistance * 10);
    
    return {
      obj1Position,
      obj2Position,
      improvementScore: Math.min(improvementScore, 100)
    };
  }
  private calculateIdealAssociatedPosition(primary: SceneObject, secondary: SceneObject, assocType: any, roomAnalysis: RoomAnalysisResult): any { return null; }
  private extractObjectTypeFromSuggestion(suggestion: ReorganizationSuggestion): string { return 'Chair'; }
  private calculateSpaceUtilizationImprovement(plans: ReorganizationPlan[]): number {
    if (plans.length === 0) return 0;
    
    // Calculate average improvement across all plans
    const totalImprovement = plans.reduce((sum, plan) => {
      // Consider plans that move objects to better zones as improving utilization
      const movesSuggestions = plan.suggestions.filter(s => s.type === 'move');
      const utilizationGain = movesSuggestions.length * 5; // 5 points per move
      
      return sum + Math.min(utilizationGain, 30); // Cap at 30 points per plan
    }, 0);
    
    return Math.min(totalImprovement / plans.length, 100);
  }
  private calculateAccessibilityImprovement(plans: ReorganizationPlan[]): number {
    if (plans.length === 0) return 0;
    
    // Calculate accessibility improvements based on plan suggestions
    const totalImprovement = plans.reduce((sum, plan) => {
      const accessibilityScore = plan.suggestions.reduce((score, suggestion) => {
        if (suggestion.reason.toLowerCase().includes('accessibility') || 
            suggestion.reason.toLowerCase().includes('clearance') ||
            suggestion.reason.toLowerCase().includes('path')) {
          return score + suggestion.improvementScore;
        }
        return score;
      }, 0);
      
      return sum + Math.min(accessibilityScore, 40); // Cap at 40 points per plan
    }, 0);
    
    return Math.min(totalImprovement / plans.length, 100);
  }
  private calculateSafetyImprovement(plans: ReorganizationPlan[]): number {
    if (plans.length === 0) return 0;
    
    // Calculate safety improvements based on plan suggestions
    const totalImprovement = plans.reduce((sum, plan) => {
      const safetyScore = plan.suggestions.reduce((score, suggestion) => {
        if (suggestion.reason.toLowerCase().includes('safety') || 
            suggestion.reason.toLowerCase().includes('fire') ||
            suggestion.reason.toLowerCase().includes('egress') ||
            suggestion.reason.toLowerCase().includes('emergency')) {
          return score + suggestion.improvementScore;
        }
        return score;
      }, 0);
      
      // Add bonus for violations resolved
      const violationBonus = plan.violationsResolved * 10;
      
      return sum + Math.min(safetyScore + violationBonus, 50); // Cap at 50 points per plan
    }, 0);
    
    return Math.min(totalImprovement / plans.length, 100);
  }
}

// Export singleton instance
export const layoutReorganizationService = new LayoutReorganizationService(); 