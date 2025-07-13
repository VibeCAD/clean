import { Vector3 } from 'babylonjs';
import type { SceneObject } from '../types/types';

export type ClearanceFeedback = 'too_crowded' | 'just_right' | 'too_sparse' | 'uncomfortable';

export interface ClearanceAdjustmentRequest {
  objectId: string;
  feedback: ClearanceFeedback;
  location: Vector3;
  affectedObjects?: string[]; // Other objects that feel too close
  userContext?: {
    activity: string; // What user was trying to do
    severity: 'mild' | 'moderate' | 'severe';
  };
}

export interface ClearanceSettings {
  objectType: string;
  baseClearance: number; // Base clearance in meters
  personalSpace: number; // Personal space multiplier
  activityClearance: number; // Activity-specific clearance
  comfortBuffer: number; // Extra comfort buffer
  emergencyAccess: number; // Emergency access clearance
  adaptiveMultiplier: number; // Adjustment based on feedback (0.5 - 2.0)
}

export interface ClearanceAdjustmentResult {
  objectId: string;
  previousClearance: number;
  newClearance: number;
  adjustmentReason: string;
  confidence: number; // 0-1, how confident we are about this adjustment
  suggestedPositions?: Vector3[]; // Alternative positions if relocation is needed
  affectedObjects: {
    objectId: string;
    clearanceChange: number;
    repositionRequired: boolean;
  }[];
}

export class DynamicClearanceService {
  private clearanceSettings: Map<string, ClearanceSettings> = new Map();
  private feedbackHistory: Map<string, ClearanceAdjustmentRequest[]> = new Map();
  private globalLearning: {
    crowdingTolerance: number; // Overall user tolerance for crowding
    preferredSpacing: number; // Preferred spacing multiplier
    activityPreferences: Map<string, number>; // Activity-specific preferences
  } = {
    crowdingTolerance: 0.5,
    preferredSpacing: 1.0,
    activityPreferences: new Map()
  };

  constructor() {
    this.initializeDefaultSettings();
  }

  /**
   * Process user feedback about crowding and adjust clearance settings
   */
  public async processClearanceFeedback(
    request: ClearanceAdjustmentRequest,
    sceneObjects: SceneObject[]
  ): Promise<ClearanceAdjustmentResult> {
    // Record feedback for learning
    this.recordFeedback(request);

    // Find the object and its current settings
    const targetObject = sceneObjects.find(obj => obj.id === request.objectId);
    if (!targetObject) {
      throw new Error(`Object ${request.objectId} not found`);
    }

    const currentSettings = this.getClearanceSettings(targetObject.type);
    const previousClearance = this.calculateCurrentClearance(currentSettings);

    // Calculate adjustment based on feedback
    const adjustment = this.calculateClearanceAdjustment(request, currentSettings);
    
    // Apply adjustment to settings
    const newSettings = this.applyClearanceAdjustment(currentSettings, adjustment);
    this.clearanceSettings.set(targetObject.type, newSettings);

    const newClearance = this.calculateCurrentClearance(newSettings);

    // Find affected objects and calculate impacts
    const affectedObjects = this.findAffectedObjects(
      targetObject,
      sceneObjects,
      previousClearance,
      newClearance
    );

    // Generate alternative positions if significant adjustment is needed
    const suggestedPositions = this.generateAlternativePositions(
      targetObject,
      sceneObjects,
      newClearance
    );

    // Update global learning
    this.updateGlobalLearning(request);

    return {
      objectId: request.objectId,
      previousClearance,
      newClearance,
      adjustmentReason: this.generateAdjustmentReason(request, adjustment),
      confidence: this.calculateConfidence(request, targetObject.type),
      suggestedPositions,
      affectedObjects
    };
  }

  /**
   * Get current clearance settings for an object type
   */
  public getClearanceSettings(objectType: string): ClearanceSettings {
    return this.clearanceSettings.get(objectType) || this.createDefaultSettings(objectType);
  }

  /**
   * Calculate effective clearance for an object based on context
   */
  public calculateEffectiveClearance(
    objectType: string,
    context?: {
      activity?: string;
      userCount?: number;
      timeOfDay?: 'morning' | 'afternoon' | 'evening';
    }
  ): number {
    const settings = this.getClearanceSettings(objectType);
    let effectiveClearance = settings.baseClearance;

    // Apply adaptive multiplier from feedback
    effectiveClearance *= settings.adaptiveMultiplier;

    // Apply activity-specific adjustments
    if (context?.activity) {
      const activityMultiplier = this.globalLearning.activityPreferences.get(context.activity) || 1.0;
      effectiveClearance *= activityMultiplier;
    }

    // Apply user count adjustments
    if (context?.userCount && context.userCount > 1) {
      effectiveClearance *= (1 + (context.userCount - 1) * 0.2); // 20% more per additional person
    }

    // Apply global preferences
    effectiveClearance *= this.globalLearning.preferredSpacing;

    return Math.max(effectiveClearance, 0.3); // Minimum 0.3m clearance
  }

  /**
   * Predict potential crowding issues before they occur
   */
  public predictCrowdingIssues(
    sceneObjects: SceneObject[],
    newObjectType: string,
    newObjectPosition: Vector3
  ): {
    riskLevel: 'low' | 'medium' | 'high';
    potentialIssues: string[];
    suggestedAdjustments: {
      objectId: string;
      suggestionType: 'move' | 'adjust_clearance' | 'remove';
      details: string;
    }[];
  } {
    const issues: string[] = [];
    const suggestions: {
      objectId: string;
      suggestionType: 'move' | 'adjust_clearance' | 'remove';
      details: string;
    }[] = [];

    // Check clearance against nearby objects
    const newObjectClearance = this.calculateEffectiveClearance(newObjectType);
    
    for (const obj of sceneObjects) {
      const distance = obj.position.subtract(newObjectPosition).length();
      const requiredClearance = this.calculateEffectiveClearance(obj.type);
      const totalRequired = (newObjectClearance + requiredClearance) / 2;

      if (distance < totalRequired) {
        issues.push(`${newObjectType} too close to ${obj.type} (${distance.toFixed(1)}m < ${totalRequired.toFixed(1)}m required)`);
        
        // Suggest adjustments
        if (distance < totalRequired * 0.5) {
          suggestions.push({
            objectId: obj.id,
            suggestionType: 'move',
            details: `Move ${obj.type} to maintain ${totalRequired.toFixed(1)}m clearance`
          });
        } else {
          suggestions.push({
            objectId: obj.id,
            suggestionType: 'adjust_clearance',
            details: `Reduce clearance requirement by ${(totalRequired - distance).toFixed(1)}m`
          });
        }
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (issues.length > 3) riskLevel = 'high';
    else if (issues.length > 1) riskLevel = 'medium';

    return {
      riskLevel,
      potentialIssues: issues,
      suggestedAdjustments: suggestions
    };
  }

  /**
   * Apply learned preferences to new layouts
   */
  public applyLearnedPreferences(
    layoutObjects: { type: string; position: Vector3 }[]
  ): { type: string; position: Vector3; adjustedClearance: number }[] {
    return layoutObjects.map(obj => ({
      ...obj,
      adjustedClearance: this.calculateEffectiveClearance(obj.type)
    }));
  }

  /**
   * Reset clearance settings to defaults (for testing/reset functionality)
   */
  public resetClearanceSettings(): void {
    this.clearanceSettings.clear();
    this.feedbackHistory.clear();
    this.globalLearning = {
      crowdingTolerance: 0.5,
      preferredSpacing: 1.0,
      activityPreferences: new Map()
    };
    this.initializeDefaultSettings();
  }

  /**
   * Get feedback statistics for analytics
   */
  public getFeedbackStatistics(): {
    totalFeedback: number;
    feedbackByType: Record<ClearanceFeedback, number>;
    mostAdjustedObjects: string[];
    averageAdjustment: number;
  } {
    const stats = {
      totalFeedback: 0,
      feedbackByType: {
        too_crowded: 0,
        just_right: 0,
        too_sparse: 0,
        uncomfortable: 0
      } as Record<ClearanceFeedback, number>,
      mostAdjustedObjects: [] as string[],
      averageAdjustment: 0
    };

    let totalAdjustment = 0;
    const objectFeedbackCount = new Map<string, number>();

    for (const [objectId, feedback] of this.feedbackHistory) {
      stats.totalFeedback += feedback.length;
      objectFeedbackCount.set(objectId, feedback.length);

      feedback.forEach(f => {
        stats.feedbackByType[f.feedback]++;
      });
    }

    // Find most adjusted objects
    const sortedObjects = Array.from(objectFeedbackCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    stats.mostAdjustedObjects = sortedObjects.map(([objectId]) => objectId);

    // Calculate average adjustment
    const adjustments = Array.from(this.clearanceSettings.values())
      .map(settings => settings.adaptiveMultiplier);
    
    stats.averageAdjustment = adjustments.length > 0 
      ? adjustments.reduce((sum, adj) => sum + adj, 0) / adjustments.length 
      : 1.0;

    return stats;
  }

  // Private helper methods
  private initializeDefaultSettings(): void {
    const defaultTypes = [
      'Desk', 'Chair', 'Table', 'Sofa', 'Bed Single', 'Bed Double',
      'Bookcase', 'TV', 'Standing Desk', 'Adjustable Desk'
    ];

    defaultTypes.forEach(type => {
      this.clearanceSettings.set(type, this.createDefaultSettings(type));
    });
  }

  private createDefaultSettings(objectType: string): ClearanceSettings {
    const baseSettings = {
      objectType,
      baseClearance: 0.8,
      personalSpace: 0.6,
      activityClearance: 0.4,
      comfortBuffer: 0.2,
      emergencyAccess: 0.9,
      adaptiveMultiplier: 1.0
    };

    // Type-specific adjustments
    switch (objectType.toLowerCase()) {
      case 'desk':
      case 'standing desk':
      case 'adjustable desk':
        return { ...baseSettings, baseClearance: 1.2, activityClearance: 0.6 };
      case 'chair':
        return { ...baseSettings, baseClearance: 0.6, personalSpace: 0.4 };
      case 'table':
        return { ...baseSettings, baseClearance: 1.0, activityClearance: 0.8 };
      case 'sofa':
        return { ...baseSettings, baseClearance: 1.0, personalSpace: 0.8 };
      case 'bed single':
      case 'bed double':
        return { ...baseSettings, baseClearance: 0.8, personalSpace: 1.0 };
      case 'tv':
        return { ...baseSettings, baseClearance: 2.0, activityClearance: 1.5 };
      default:
        return baseSettings;
    }
  }

  private recordFeedback(request: ClearanceAdjustmentRequest): void {
    const history = this.feedbackHistory.get(request.objectId) || [];
    history.push(request);
    this.feedbackHistory.set(request.objectId, history);
  }

  private calculateCurrentClearance(settings: ClearanceSettings): number {
    return (settings.baseClearance + settings.personalSpace + settings.activityClearance + settings.comfortBuffer) 
           * settings.adaptiveMultiplier;
  }

  private calculateClearanceAdjustment(
    request: ClearanceAdjustmentRequest,
    settings: ClearanceSettings
  ): number {
    const severity = request.userContext?.severity || 'moderate';
    const baseAdjustment = {
      mild: 0.1,
      moderate: 0.2,
      severe: 0.4
    }[severity];

    switch (request.feedback) {
      case 'too_crowded':
        return baseAdjustment; // Increase clearance
      case 'uncomfortable':
        return baseAdjustment * 0.8; // Moderate increase
      case 'too_sparse':
        return -baseAdjustment; // Decrease clearance
      case 'just_right':
        return 0; // No adjustment needed
      default:
        return 0;
    }
  }

  private applyClearanceAdjustment(
    settings: ClearanceSettings,
    adjustment: number
  ): ClearanceSettings {
    const newMultiplier = Math.max(0.5, Math.min(2.0, settings.adaptiveMultiplier + adjustment));
    
    return {
      ...settings,
      adaptiveMultiplier: newMultiplier
    };
  }

  private findAffectedObjects(
    targetObject: SceneObject,
    sceneObjects: SceneObject[],
    previousClearance: number,
    newClearance: number
  ): {
    objectId: string;
    clearanceChange: number;
    repositionRequired: boolean;
  }[] {
    const clearanceChange = newClearance - previousClearance;
    const searchRadius = Math.max(previousClearance, newClearance) * 2;

    return sceneObjects
      .filter(obj => 
        obj.id !== targetObject.id &&
        obj.position.subtract(targetObject.position).length() <= searchRadius
      )
      .map(obj => {
        const distance = obj.position.subtract(targetObject.position).length();
        const repositionRequired = distance < newClearance;
        
        return {
          objectId: obj.id,
          clearanceChange,
          repositionRequired
        };
      });
  }

  private generateAlternativePositions(
    targetObject: SceneObject,
    sceneObjects: SceneObject[],
    newClearance: number
  ): Vector3[] {
    const alternatives: Vector3[] = [];
    const currentPos = targetObject.position;
    
    // Generate positions in a circle around the current position
    for (let angle = 0; angle < 360; angle += 45) {
      const radian = (angle * Math.PI) / 180;
      const newPos = new Vector3(
        currentPos.x + newClearance * Math.cos(radian),
        currentPos.y,
        currentPos.z + newClearance * Math.sin(radian)
      );
      
      // Check if position is valid (not too close to other objects)
      const tooClose = sceneObjects.some(obj => 
        obj.id !== targetObject.id &&
        obj.position.subtract(newPos).length() < newClearance
      );
      
      if (!tooClose) {
        alternatives.push(newPos);
      }
    }
    
    return alternatives.slice(0, 3); // Return up to 3 alternatives
  }

  private generateAdjustmentReason(request: ClearanceAdjustmentRequest, adjustment: number): string {
    const direction = adjustment > 0 ? 'increased' : 'decreased';
    const magnitude = Math.abs(adjustment);
    
    let reason = `Clearance ${direction} by ${(magnitude * 100).toFixed(0)}% based on user feedback: "${request.feedback}"`;
    
    if (request.userContext?.activity) {
      reason += ` during ${request.userContext.activity}`;
    }
    
    return reason;
  }

  private calculateConfidence(request: ClearanceAdjustmentRequest, objectType: string): number {
    const history = this.feedbackHistory.get(request.objectId) || [];
    const typeHistory = Array.from(this.feedbackHistory.values())
      .flat()
      .filter(f => f.objectId.includes(objectType));

    // More feedback = higher confidence
    const feedbackConfidence = Math.min(1.0, (history.length + typeHistory.length) / 10);
    
    // Severity affects confidence
    const severityConfidence = {
      mild: 0.6,
      moderate: 0.8,
      severe: 1.0
    }[request.userContext?.severity || 'moderate'];

    return (feedbackConfidence + severityConfidence) / 2;
  }

  private updateGlobalLearning(request: ClearanceAdjustmentRequest): void {
    // Update overall crowding tolerance
    if (request.feedback === 'too_crowded') {
      this.globalLearning.crowdingTolerance = Math.max(0.1, this.globalLearning.crowdingTolerance - 0.05);
    } else if (request.feedback === 'too_sparse') {
      this.globalLearning.crowdingTolerance = Math.min(1.0, this.globalLearning.crowdingTolerance + 0.05);
    }

    // Update activity preferences
    if (request.userContext?.activity) {
      const currentPref = this.globalLearning.activityPreferences.get(request.userContext.activity) || 1.0;
      const adjustment = request.feedback === 'too_crowded' ? 0.1 : -0.1;
      this.globalLearning.activityPreferences.set(
        request.userContext.activity,
        Math.max(0.5, Math.min(2.0, currentPref + adjustment))
      );
    }
  }
}

// Export singleton instance
export const dynamicClearanceService = new DynamicClearanceService(); 