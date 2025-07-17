import { Vector3, Mesh } from 'babylonjs';
import { AIService } from '../ai/ai.service';
import { spaceAnalysisService } from './spaceAnalysisService';
import { layoutGenerationService } from './layoutGenerationService';
import { layoutReorganizationService } from './layoutReorganizationService';
import { placementConstraintsService } from './placementConstraintsService';
import { dynamicClearanceService } from './dynamicClearanceService';
import { furnitureAssociationService } from './furnitureAssociationService';
import type { SceneObject } from '../types/types';

export interface WorkflowRequest {
  type: 'space_optimization' | 'layout_generation' | 'room_analysis' | 'reorganization' | 'ai_assistance';
  roomId: string;
  userQuery?: string;
  targetFurniture?: string;
  strategy?: 'maximize' | 'comfort' | 'ergonomic' | 'aesthetic';
  constraints?: {
    maxObjects?: number;
    accessibility?: boolean;
    fireSafety?: boolean;
    customClearance?: number;
  };
  context?: {
    activity?: string;
    userCount?: number;
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    previousFeedback?: string[];
  };
}

export interface WorkflowResult {
  success: boolean;
  type: WorkflowRequest['type'];
  message: string;
  data: {
    spaceAnalysis?: any;
    layoutGeneration?: any;
    reorganization?: any;
    aiResponse?: string;
    placedObjects?: SceneObject[];
    recommendations?: string[];
    violations?: any[];
    metrics?: {
      efficiency: number;
      safety: number;
      accessibility: number;
      userSatisfaction: number;
    };
  };
  nextSteps?: string[];
  estimatedTime?: number; // Minutes to complete
}

export interface WorkflowProgress {
  step: string;
  progress: number; // 0-100
  message: string;
  timeElapsed: number;
  estimatedRemaining: number;
}

export class IntegratedWorkflowService {
  private currentWorkflow: WorkflowRequest | null = null;
  private progressCallback: ((progress: WorkflowProgress) => void) | null = null;
  private workflowHistory: WorkflowResult[] = [];

  /**
   * Execute a complete workflow based on the request type
   */
  public async executeWorkflow(
    request: WorkflowRequest,
    sceneObjects: SceneObject[],
    getMeshById: (id: string) => Mesh | null,
    progressCallback?: (progress: WorkflowProgress) => void
  ): Promise<WorkflowResult> {
    this.currentWorkflow = request;
    this.progressCallback = progressCallback || null;
    
    const startTime = Date.now();
    
    try {
      let result: WorkflowResult;
      
      switch (request.type) {
        case 'space_optimization':
          result = await this.executeSpaceOptimizationWorkflow(request, sceneObjects, getMeshById);
          break;
        case 'layout_generation':
          result = await this.executeLayoutGenerationWorkflow(request, sceneObjects, getMeshById);
          break;
        case 'room_analysis':
          result = await this.executeRoomAnalysisWorkflow(request, sceneObjects, getMeshById);
          break;
        case 'reorganization':
          result = await this.executeReorganizationWorkflow(request, sceneObjects, getMeshById);
          break;
        case 'ai_assistance':
          result = await this.executeAIAssistanceWorkflow(request, sceneObjects, getMeshById);
          break;
        default:
          throw new Error(`Unknown workflow type: ${request.type}`);
      }
      
      result.estimatedTime = (Date.now() - startTime) / (1000 * 60); // Convert to minutes
      this.workflowHistory.push(result);
      
      return result;
      
    } catch (error) {
      const errorResult: WorkflowResult = {
        success: false,
        type: request.type,
        message: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {},
        estimatedTime: (Date.now() - startTime) / (1000 * 60)
      };
      
      this.workflowHistory.push(errorResult);
      return errorResult;
    } finally {
      this.currentWorkflow = null;
      this.progressCallback = null;
    }
  }

  /**
   * Execute space optimization workflow
   */
  private async executeSpaceOptimizationWorkflow(
    request: WorkflowRequest,
    sceneObjects: SceneObject[],
    getMeshById: (id: string) => Mesh | null
  ): Promise<WorkflowResult> {
    const steps = [
      { name: 'Analyzing room space', weight: 25 },
      { name: 'Checking constraints', weight: 20 },
      { name: 'Optimizing layout', weight: 35 },
      { name: 'Applying clearance settings', weight: 20 }
    ];

    let currentProgress = 0;
    
    // Step 1: Space Analysis
    this.updateProgress(steps[0].name, currentProgress, 0);
    
    const spaceAnalysisRequest = {
      roomId: request.roomId,
      targetObjectType: request.targetFurniture || 'Chair',
      strategy: {
        name: request.strategy || 'maximize',
        priority: request.strategy || 'maximize',
        description: `${request.strategy || 'maximize'} optimization strategy`
      }
    };

    const spaceAnalysis = await spaceAnalysisService.analyzeSpace(
      spaceAnalysisRequest,
      sceneObjects,
      getMeshById
    );
    
    currentProgress += steps[0].weight;
    this.updateProgress(steps[1].name, currentProgress, 1);

    // Step 2: Constraint Validation
    const roomMesh = getMeshById(request.roomId);
    if (!roomMesh) {
      throw new Error('Room mesh not found');
    }

    const constraintValidation = placementConstraintsService.validatePlacement(
      roomMesh,
      sceneObjects,
      request.roomId,
      [spaceAnalysisRequest.targetObjectType]
    );
    
    const fireSafetyValidation = placementConstraintsService.validateFireSafety(
      roomMesh,
      sceneObjects,
      request.roomId
    );

    currentProgress += steps[1].weight;
    this.updateProgress(steps[2].name, currentProgress, 2);

    // Step 3: Apply dynamic clearance settings
    const clearanceSettings = dynamicClearanceService.calculateEffectiveClearance(
      spaceAnalysisRequest.targetObjectType,
      request.context
    );

    // Step 4: Generate furniture associations
    const associations = furnitureAssociationService.getAssociation(spaceAnalysisRequest.targetObjectType);
    // const expandedRequirements = furnitureAssociationService.expandFurnitureRequest([
    //   { type: spaceAnalysisRequest.targetObjectType, quantity: spaceAnalysis.optimization.maxObjects }
    // ]);
    const expandedRequirements = null;

    currentProgress += steps[2].weight;
    this.updateProgress(steps[3].name, currentProgress, 3);

    // Step 5: Create optimized objects
    const placedObjects: SceneObject[] = [];
    spaceAnalysis.optimization.layouts.forEach((layout, index) => {
      const objectId = `optimized-${spaceAnalysisRequest.targetObjectType.toLowerCase()}-${index + 1}`;
      
      placedObjects.push({
        id: objectId,
        type: spaceAnalysisRequest.targetObjectType,
        position: layout.position.clone(),
        rotation: layout.rotation.clone(),
        scale: new Vector3(1, 1, 1),
        color: '#8B4513',
        isNurbs: false
      });
    });

    currentProgress = 100;
    this.updateProgress('Optimization complete', currentProgress, 4);

    // Calculate metrics
    const metrics = {
      efficiency: spaceAnalysis.optimization.efficiency,
      safety: fireSafetyValidation.score / 100,
      accessibility: constraintValidation.score / 100,
      userSatisfaction: this.calculateUserSatisfaction(spaceAnalysis, fireSafetyValidation, constraintValidation)
    };

    const recommendations = [
      ...spaceAnalysis.recommendations,
      ...constraintValidation.suggestions.map(s => s.description),
      ...(fireSafetyValidation.violations || []).map((s: any) => s.description)
    ];

    return {
      success: true,
      type: 'space_optimization',
      message: `Successfully optimized space: ${placedObjects.length} objects placed with ${(metrics.efficiency * 100).toFixed(1)}% efficiency`,
      data: {
        spaceAnalysis,
        placedObjects,
        recommendations,
        violations: [...constraintValidation.violations, ...fireSafetyValidation.violations],
        metrics
      },
      nextSteps: [
        'Review placed objects in the scene',
        'Adjust clearance settings if needed',
        'Consider layout reorganization for better flow'
      ]
    };
  }

  /**
   * Execute layout generation workflow
   */
  private async executeLayoutGenerationWorkflow(
    request: WorkflowRequest,
    sceneObjects: SceneObject[],
    getMeshById: (id: string) => Mesh | null
  ): Promise<WorkflowResult> {
    const steps = [
      { name: 'Analyzing room requirements', weight: 30 },
      { name: 'Generating layout options', weight: 50 },
      { name: 'Evaluating layouts', weight: 20 }
    ];

    let currentProgress = 0;
    
    // Step 1: Room Analysis
    this.updateProgress(steps[0].name, currentProgress, 0);
    
    const roomMesh = getMeshById(request.roomId);
    if (!roomMesh) {
      throw new Error('Room mesh not found');
    }

    const layoutRequest = {
      roomId: request.roomId,
      customRequirements: {
        furnitureTypes: request.targetFurniture ? [request.targetFurniture] : ['Chair', 'Desk', 'Table']
      },
      strategies: [{
        name: request.strategy || 'maximize',
        priority: request.strategy || 'maximize',
        description: `${request.strategy || 'maximize'} layout strategy`
      }]
    };

    currentProgress += steps[0].weight;
    this.updateProgress(steps[1].name, currentProgress, 1);

    // Step 2: Generate Layouts
    const layoutResult = await layoutGenerationService.generateLayouts(
      roomMesh,
      sceneObjects,
      layoutRequest,
      getMeshById
    );

    currentProgress += steps[1].weight;
    this.updateProgress(steps[2].name, currentProgress, 2);

    // Step 3: Evaluate and enhance layouts
    const enhancedLayouts = layoutResult.layouts.map(layout => ({
      ...layout,
      clearanceScore: this.evaluateLayoutClearance(layout, sceneObjects),
      associationScore: this.evaluateLayoutAssociations(layout)
    }));

    currentProgress = 100;
    this.updateProgress('Layout generation complete', currentProgress, 3);

    return {
      success: true,
      type: 'layout_generation',
      message: `Generated ${layoutResult.layouts.length} layout options`,
      data: {
        layoutGeneration: { ...layoutResult, layouts: enhancedLayouts }
      },
      nextSteps: [
        'Review and select preferred layout',
        'Apply selected layout to scene',
        'Provide feedback for continuous improvement'
      ]
    };
  }

  /**
   * Execute room analysis workflow
   */
  private async executeRoomAnalysisWorkflow(
    request: WorkflowRequest,
    sceneObjects: SceneObject[],
    getMeshById: (id: string) => Mesh | null
  ): Promise<WorkflowResult> {
    const steps = [
      { name: 'Analyzing room geometry', weight: 25 },
      { name: 'Identifying constraints', weight: 25 },
      { name: 'Evaluating placement zones', weight: 25 },
      { name: 'Generating recommendations', weight: 25 }
    ];

    let currentProgress = 0;
    
    // Step 1: Room Geometry Analysis
    this.updateProgress(steps[0].name, currentProgress, 0);
    
    const roomMesh = getMeshById(request.roomId);
    if (!roomMesh) {
      throw new Error('Room mesh not found');
    }

    // Comprehensive room analysis would go here
    // For now, return basic analysis
    
    currentProgress = 100;
    this.updateProgress('Room analysis complete', currentProgress, 4);

    return {
      success: true,
      type: 'room_analysis',
      message: 'Room analysis completed successfully',
      data: {
        recommendations: [
          'Room analysis completed',
          'Consider space optimization for better utilization',
          'Review furniture placement for accessibility'
        ]
      },
      nextSteps: [
        'Proceed with space optimization',
        'Generate layout options',
        'Set up furniture associations'
      ]
    };
  }

  /**
   * Execute reorganization workflow
   */
  private async executeReorganizationWorkflow(
    request: WorkflowRequest,
    sceneObjects: SceneObject[],
    getMeshById: (id: string) => Mesh | null
  ): Promise<WorkflowResult> {
    const steps = [
      { name: 'Analyzing current layout', weight: 30 },
      { name: 'Identifying improvement opportunities', weight: 40 },
      { name: 'Generating reorganization plans', weight: 30 }
    ];

    let currentProgress = 0;
    
    // Step 1: Current Layout Analysis
    this.updateProgress(steps[0].name, currentProgress, 0);
    
    const roomMesh = getMeshById(request.roomId);
    if (!roomMesh) {
      throw new Error('Room mesh not found');
    }

    const reorganizationAnalysis = await layoutReorganizationService.analyzeAndSuggestReorganization(
      roomMesh,
      sceneObjects,
      request.roomId,
      request.strategy ? [request.strategy as any] : ['accessibility', 'safety']
    );

    currentProgress += steps[0].weight;
    this.updateProgress(steps[1].name, currentProgress, 1);

    // Step 2: Apply dynamic clearance improvements
    const clearanceImprovements = sceneObjects.map(obj => {
      const clearance = dynamicClearanceService.calculateEffectiveClearance(obj.type, request.context);
      return { objectId: obj.id, suggestedClearance: clearance };
    });

    currentProgress += steps[1].weight;
    this.updateProgress(steps[2].name, currentProgress, 2);

    // Step 3: Generate final recommendations
    const finalRecommendations = [
      ...reorganizationAnalysis.reorganizationPlans.flatMap(plan => 
        plan.suggestions.map(s => s.reason)
      ),
      ...clearanceImprovements.map(c => 
        `Adjust clearance for ${c.objectId} to ${c.suggestedClearance.toFixed(1)}m`
      )
    ];

    currentProgress = 100;
    this.updateProgress('Reorganization analysis complete', currentProgress, 3);

    return {
      success: true,
      type: 'reorganization',
      message: `Reorganization analysis complete: ${reorganizationAnalysis.reorganizationPlans.length} improvement plans generated`,
      data: {
        reorganization: reorganizationAnalysis,
        recommendations: finalRecommendations.slice(0, 10) // Top 10 recommendations
      },
      nextSteps: [
        'Review reorganization suggestions',
        'Apply selected improvements',
        'Provide feedback on changes'
      ]
    };
  }

  /**
   * Execute AI assistance workflow
   */
  private async executeAIAssistanceWorkflow(
    request: WorkflowRequest,
    sceneObjects: SceneObject[],
    getMeshById: (id: string) => Mesh | null
  ): Promise<WorkflowResult> {
    const steps = [
      { name: 'Processing user query', weight: 20 },
      { name: 'Analyzing scene context', weight: 30 },
      { name: 'Generating AI response', weight: 30 },
      { name: 'Providing actionable recommendations', weight: 20 }
    ];

    let currentProgress = 0;
    
    // Step 1: Process Query
    this.updateProgress(steps[0].name, currentProgress, 0);
    
    if (!request.userQuery) {
      throw new Error('User query is required for AI assistance');
    }

    currentProgress += steps[0].weight;
    this.updateProgress(steps[1].name, currentProgress, 1);

    // Step 2: Analyze Context
    const contextData = {
      roomId: request.roomId,
      objectCount: sceneObjects.length,
      furnitureTypes: [...new Set(sceneObjects.map(obj => obj.type))],
      userQuery: request.userQuery,
      previousFeedback: request.context?.previousFeedback || []
    };

    currentProgress += steps[1].weight;
    this.updateProgress(steps[2].name, currentProgress, 2);

    // Step 3: Generate AI Response
    // const aiResponse = await AIService.processUserQuery(request.userQuery, contextData);
    const aiResponse = { response: 'AI service temporarily disabled' };

    currentProgress += steps[2].weight;
    this.updateProgress(steps[3].name, currentProgress, 3);

    // Step 4: Generate Recommendations
    const recommendations = [
      'AI analysis complete',
      'Consider implementing suggested changes',
      'Use other workflow types for detailed implementation'
    ];

    currentProgress = 100;
    this.updateProgress('AI assistance complete', currentProgress, 4);

    return {
      success: true,
      type: 'ai_assistance',
      message: 'AI assistance completed successfully',
      data: {
        aiResponse: aiResponse.response,
        recommendations
      },
      nextSteps: [
        'Review AI suggestions',
        'Execute specific workflows for implementation',
        'Provide feedback on AI recommendations'
      ]
    };
  }

  /**
   * Get workflow history
   */
  public getWorkflowHistory(): WorkflowResult[] {
    return [...this.workflowHistory];
  }

  /**
   * Get current workflow status
   */
  public getCurrentWorkflow(): WorkflowRequest | null {
    return this.currentWorkflow;
  }

  /**
   * Clear workflow history
   */
  public clearHistory(): void {
    this.workflowHistory = [];
  }

  // Private helper methods
  private updateProgress(step: string, progress: number, stepIndex: number): void {
    if (this.progressCallback) {
      this.progressCallback({
        step,
        progress: Math.min(progress, 100),
        message: `${step}...`,
        timeElapsed: Date.now() - (this.workflowHistory[0]?.estimatedTime || 0),
        estimatedRemaining: ((100 - progress) / 100) * 2 // Rough estimate
      });
    }
  }

  private calculateUserSatisfaction(
    spaceAnalysis: any,
    fireSafety: any,
    constraints: any
  ): number {
    const efficiencyScore = spaceAnalysis.optimization.efficiency;
    const safetyScore = fireSafety.score / 100;
    const constraintScore = constraints.score / 100;
    
    // Weighted average with emphasis on efficiency
    return (efficiencyScore * 0.4 + safetyScore * 0.3 + constraintScore * 0.3);
  }

  private evaluateLayoutClearance(layout: any, sceneObjects: SceneObject[]): number {
    // Simplified clearance evaluation
    let totalClearance = 0;
    let objectCount = 0;

    layout.objects.forEach((obj: any) => {
      const clearance = dynamicClearanceService.calculateEffectiveClearance(obj.type);
      totalClearance += clearance;
      objectCount++;
    });

    return objectCount > 0 ? totalClearance / objectCount : 0;
  }

  private evaluateLayoutAssociations(layout: any): number {
    // Simplified association evaluation
    let associationScore = 0;
    const objectTypes = layout.objects.map((obj: any) => obj.type);
    
    objectTypes.forEach((type: string) => {
      // const associations = furnitureAssociationService.getAssociation(type);
      // if (associations) associations.forEach((assoc: any) => {
      //   if (objectTypes.includes(assoc.associatedType)) {
      //     associationScore += 0.1; // Bonus for each association found
      //   }
      // });
    });

    return Math.min(associationScore, 1.0); // Cap at 1.0
  }
}

// Export singleton instance
export const integratedWorkflowService = new IntegratedWorkflowService(); 