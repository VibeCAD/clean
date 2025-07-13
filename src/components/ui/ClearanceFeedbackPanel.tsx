import React, { useState, useEffect } from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import { 
  dynamicClearanceService, 
  type ClearanceFeedback, 
  type ClearanceAdjustmentRequest,
  type ClearanceAdjustmentResult
} from '../../services/dynamicClearanceService';

interface ClearanceFeedbackPanelProps {
  selectedObjectId?: string;
  onFeedbackSubmitted?: (result: ClearanceAdjustmentResult) => void;
  className?: string;
}

export const ClearanceFeedbackPanel: React.FC<ClearanceFeedbackPanelProps> = ({
  selectedObjectId,
  onFeedbackSubmitted,
  className = ''
}) => {
  const { sceneObjects, selectedObjectIds, getSelectedObjects } = useSceneStore();
  const [selectedFeedback, setSelectedFeedback] = useState<ClearanceFeedback | null>(null);
  const [activity, setActivity] = useState<string>('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<ClearanceAdjustmentResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get target object
  const targetObjectId = selectedObjectId || selectedObjectIds[0];
  const targetObject = sceneObjects.find(obj => obj.id === targetObjectId);

  // Get current clearance settings
  const currentSettings = targetObject 
    ? dynamicClearanceService.getClearanceSettings(targetObject.type)
    : null;

  // Get feedback statistics
  const stats = dynamicClearanceService.getFeedbackStatistics();

  const handleSubmitFeedback = async () => {
    if (!targetObject || !selectedFeedback) return;

    setIsSubmitting(true);
    try {
      const request: ClearanceAdjustmentRequest = {
        objectId: targetObject.id,
        feedback: selectedFeedback,
        location: targetObject.position.clone(),
        userContext: {
          activity: activity || 'general',
          severity
        }
      };

      const result = await dynamicClearanceService.processClearanceFeedback(request, sceneObjects);
      setLastResult(result);
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }

      // Reset form
      setSelectedFeedback(null);
      setActivity('');
      setSeverity('moderate');
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFeedback = async (feedback: ClearanceFeedback) => {
    if (!targetObject) return;

    setSelectedFeedback(feedback);
    setActivity('general');
    setSeverity('moderate');
    
    // Auto-submit for quick feedback
    setTimeout(() => {
      handleSubmitFeedback();
    }, 100);
  };

  const predictCrowdingIssues = () => {
    if (!targetObject) return null;
    
    return dynamicClearanceService.predictCrowdingIssues(
      sceneObjects,
      targetObject.type,
      targetObject.position
    );
  };

  const crowdingPrediction = predictCrowdingIssues();

  const getFeedbackIcon = (feedback: ClearanceFeedback) => {
    switch (feedback) {
      case 'too_crowded': return '🔴';
      case 'uncomfortable': return '⚠️';
      case 'just_right': return '✅';
      case 'too_sparse': return '📏';
      default: return '❓';
    }
  };

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (!targetObject) {
    return (
      <div className={`bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center ${className}`}>
        <div className="text-gray-400 text-lg mb-2">📍</div>
        <p className="text-gray-500 mb-2">No object selected</p>
        <p className="text-sm text-gray-400">Select an object to provide clearance feedback</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🎯</span>
            <div>
              <h3 className="text-lg font-bold">Space Feedback</h3>
              <p className="text-blue-100 text-sm">How does this {targetObject.type} feel?</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-100">Current clearance:</div>
            <div className="text-lg font-semibold">
              {currentSettings ? (currentSettings.baseClearance * currentSettings.adaptiveMultiplier).toFixed(1) : 'N/A'}m
            </div>
          </div>
        </div>
      </div>

      {/* Quick Feedback Buttons */}
      <div className="p-4 border-b">
        <h4 className="font-semibold text-gray-800 mb-3">Quick Feedback</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleQuickFeedback('too_crowded')}
            disabled={isSubmitting}
            className="flex items-center justify-center p-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <span className="text-xl mr-2">🔴</span>
            <span className="text-sm font-medium text-red-800">Too Crowded</span>
          </button>
          
          <button
            onClick={() => handleQuickFeedback('just_right')}
            disabled={isSubmitting}
            className="flex items-center justify-center p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <span className="text-xl mr-2">✅</span>
            <span className="text-sm font-medium text-green-800">Just Right</span>
          </button>
          
          <button
            onClick={() => handleQuickFeedback('uncomfortable')}
            disabled={isSubmitting}
            className="flex items-center justify-center p-3 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <span className="text-xl mr-2">⚠️</span>
            <span className="text-sm font-medium text-yellow-800">Uncomfortable</span>
          </button>
          
          <button
            onClick={() => handleQuickFeedback('too_sparse')}
            disabled={isSubmitting}
            className="flex items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <span className="text-xl mr-2">📏</span>
            <span className="text-sm font-medium text-blue-800">Too Sparse</span>
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="p-4 border-b">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="font-semibold text-gray-800">Advanced Options</span>
          <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* Activity Context */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Context
              </label>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select activity</option>
                <option value="working">Working</option>
                <option value="meeting">Meeting</option>
                <option value="relaxing">Relaxing</option>
                <option value="dining">Dining</option>
                <option value="sleeping">Sleeping</option>
                <option value="exercising">Exercising</option>
                <option value="general">General use</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Severity
              </label>
              <div className="flex space-x-2">
                {(['mild', 'moderate', 'severe'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSeverity(level)}
                    className={`flex-1 p-2 rounded-lg text-sm font-medium transition-colors ${
                      severity === level
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Feedback Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['too_crowded', 'uncomfortable', 'just_right', 'too_sparse'] as const).map((feedback) => (
                  <button
                    key={feedback}
                    onClick={() => setSelectedFeedback(feedback)}
                    className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedFeedback === feedback
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {getFeedbackIcon(feedback)} {feedback.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitFeedback}
              disabled={!selectedFeedback || isSubmitting}
              className="w-full p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Detailed Feedback'}
            </button>
          </div>
        )}
      </div>

      {/* Crowding Prediction */}
      {crowdingPrediction && crowdingPrediction.potentialIssues.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
            <span className="mr-2">🔮</span>
            Crowding Analysis
          </h4>
          <div className="mb-2">
            <span className="text-sm text-gray-600">Risk Level: </span>
            <span className={`font-semibold ${getRiskColor(crowdingPrediction.riskLevel)}`}>
              {crowdingPrediction.riskLevel.toUpperCase()}
            </span>
          </div>
          {crowdingPrediction.potentialIssues.slice(0, 3).map((issue, index) => (
            <div key={index} className="text-sm text-gray-600 mb-1">
              • {issue}
            </div>
          ))}
          {crowdingPrediction.potentialIssues.length > 3 && (
            <div className="text-sm text-gray-500">
              +{crowdingPrediction.potentialIssues.length - 3} more issues
            </div>
          )}
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <div className="p-4 border-b bg-green-50">
          <h4 className="font-semibold text-green-800 mb-2 flex items-center">
            <span className="mr-2">✅</span>
            Feedback Applied
          </h4>
          <div className="text-sm text-green-700 mb-1">
            {lastResult.adjustmentReason}
          </div>
          <div className="text-xs text-green-600">
            Confidence: {(lastResult.confidence * 100).toFixed(0)}%
          </div>
          {lastResult.affectedObjects.length > 0 && (
            <div className="mt-2 text-sm text-green-700">
              {lastResult.affectedObjects.length} nearby objects affected
            </div>
          )}
        </div>
      )}

      {/* Statistics */}
      <div className="p-4">
        <h4 className="font-semibold text-gray-800 mb-3">Feedback Statistics</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Total Feedback</div>
            <div className="text-lg font-semibold">{stats.totalFeedback}</div>
          </div>
          <div>
            <div className="text-gray-600">Avg. Adjustment</div>
            <div className="text-lg font-semibold">{(stats.averageAdjustment * 100).toFixed(0)}%</div>
          </div>
        </div>
        
        <div className="mt-3 space-y-1">
          {Object.entries(stats.feedbackByType).map(([type, count]) => (
            <div key={type} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {getFeedbackIcon(type as ClearanceFeedback)} {type.replace('_', ' ')}
              </span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Compact version for smaller displays
interface CompactClearanceFeedbackProps {
  selectedObjectId?: string;
  onFeedbackSubmitted?: (result: ClearanceAdjustmentResult) => void;
  className?: string;
}

export const CompactClearanceFeedback: React.FC<CompactClearanceFeedbackProps> = ({
  selectedObjectId,
  onFeedbackSubmitted,
  className = ''
}) => {
  const { sceneObjects, selectedObjectIds } = useSceneStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetObjectId = selectedObjectId || selectedObjectIds[0];
  const targetObject = sceneObjects.find(obj => obj.id === targetObjectId);

  const handleQuickFeedback = async (feedback: ClearanceFeedback) => {
    if (!targetObject) return;

    setIsSubmitting(true);
    try {
      const request: ClearanceAdjustmentRequest = {
        objectId: targetObject.id,
        feedback,
        location: targetObject.position.clone(),
        userContext: {
          activity: 'general',
          severity: 'moderate'
        }
      };

      const result = await dynamicClearanceService.processClearanceFeedback(request, sceneObjects);
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!targetObject) {
    return (
      <div className={`bg-gray-100 rounded p-3 text-center ${className}`}>
        <p className="text-sm text-gray-500">Select object for feedback</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Space Feedback</span>
        <span className="text-xs text-gray-500">{targetObject.type}</span>
      </div>
      
      <div className="flex space-x-1">
        <button
          onClick={() => handleQuickFeedback('too_crowded')}
          disabled={isSubmitting}
          className="flex-1 p-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded text-xs font-medium text-red-800 transition-colors disabled:opacity-50"
        >
          🔴
        </button>
        
        <button
          onClick={() => handleQuickFeedback('just_right')}
          disabled={isSubmitting}
          className="flex-1 p-2 bg-green-50 hover:bg-green-100 border border-green-200 rounded text-xs font-medium text-green-800 transition-colors disabled:opacity-50"
        >
          ✅
        </button>
        
        <button
          onClick={() => handleQuickFeedback('uncomfortable')}
          disabled={isSubmitting}
          className="flex-1 p-2 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded text-xs font-medium text-yellow-800 transition-colors disabled:opacity-50"
        >
          ⚠️
        </button>
        
        <button
          onClick={() => handleQuickFeedback('too_sparse')}
          disabled={isSubmitting}
          className="flex-1 p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-xs font-medium text-blue-800 transition-colors disabled:opacity-50"
        >
          📏
        </button>
      </div>
    </div>
  );
}; 