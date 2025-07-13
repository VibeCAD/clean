import React from 'react';
import type { SpaceAnalysisResult } from '../../services/spaceAnalysisService';
import type { FireSafetyValidationResult } from '../../services/placementConstraintsService';

interface SpaceMetricsDisplayProps {
  analysisResult?: SpaceAnalysisResult;
  fireSafetyResult?: FireSafetyValidationResult;
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: number;
  maxValue: number;
  unit: string;
  status: 'excellent' | 'good' | 'warning' | 'error';
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, maxValue, unit, status, description }) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  
  const getStatusColor = () => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'excellent': return '✅';
      case 'good': return '👍';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '📊';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <span className="text-lg">{getStatusIcon()}</span>
      </div>
      
      <div className="mb-2">
        <div className="flex items-baseline">
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          <span className="ml-1 text-sm text-gray-500">{unit}</span>
          {maxValue > 0 && maxValue !== 100 && (
            <span className="ml-1 text-sm text-gray-400">/ {maxValue}</span>
          )}
        </div>
      </div>

      {maxValue > 0 && (
        <div className="mb-2">
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>{percentage.toFixed(1)}%</span>
            <span>{maxValue}</span>
          </div>
        </div>
      )}

      {description && (
        <p className="text-xs text-gray-600">{description}</p>
      )}
    </div>
  );
};

const ComplianceIndicator: React.FC<{ 
  compliant: boolean; 
  score: number; 
  title: string;
  violations?: number;
}> = ({ compliant, score, title, violations = 0 }) => {
  const getStatus = () => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'warning';
    return 'error';
  };

  return (
    <div className={`rounded-lg border-2 p-3 ${
      compliant ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-lg mr-2">
            {compliant ? '✅' : '❌'}
          </span>
          <div>
            <h4 className="font-medium text-gray-900">{title}</h4>
            <p className="text-sm text-gray-600">Score: {score}/100</p>
          </div>
        </div>
        {violations > 0 && (
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {violations} issues
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const SpaceMetricsDisplay: React.FC<SpaceMetricsDisplayProps> = ({
  analysisResult,
  fireSafetyResult,
  className = ''
}) => {
  if (!analysisResult && !fireSafetyResult) {
    return (
      <div className={`bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center ${className}`}>
        <div className="text-gray-400 text-lg mb-2">📊</div>
        <p className="text-gray-500">No analysis data available</p>
        <p className="text-sm text-gray-400 mt-1">Run space analysis to see metrics</p>
      </div>
    );
  }

  const getEfficiencyStatus = (efficiency: number) => {
    if (efficiency >= 0.8) return 'warning'; // Too dense
    if (efficiency >= 0.6) return 'excellent';
    if (efficiency >= 0.4) return 'good';
    return 'warning';
  };

  const getCapacityStatus = (count: number, roomArea: number) => {
    const density = count / roomArea;
    if (density >= 0.5) return 'excellent';
    if (density >= 0.3) return 'good';
    if (density >= 0.1) return 'warning';
    return 'error';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          📊 Space Optimization Metrics
        </h2>

        {analysisResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricCard
              title="Objects Fit"
              value={analysisResult.optimization.maxObjects}
              maxValue={0}
              unit="items"
              status={getCapacityStatus(analysisResult.optimization.maxObjects, analysisResult.roomAnalysis.area)}
              description={`${analysisResult.furnitureSpec.type} objects`}
            />
            
            <MetricCard
              title="Space Efficiency"
              value={Math.round(analysisResult.optimization.efficiency * 100)}
              maxValue={100}
              unit="%"
              status={getEfficiencyStatus(analysisResult.optimization.efficiency)}
              description="Room space utilization"
            />
            
            <MetricCard
              title="Room Area"
              value={analysisResult.roomAnalysis.area}
              maxValue={0}
              unit="m²"
              status="good"
              description={`${analysisResult.roomAnalysis.usableArea.toFixed(1)}m² usable`}
            />
            
            <MetricCard
              title="Density"
              value={+(analysisResult.optimization.maxObjects / analysisResult.roomAnalysis.area).toFixed(2)}
              maxValue={1}
              unit="items/m²"
              status="good"
              description="Objects per square meter"
            />
          </div>
        )}

        {/* Compliance Section */}
        <div className="space-y-3">
          <h3 className="text-md font-medium text-gray-900 mb-2">🛡️ Regulation Compliance</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {fireSafetyResult && (
              <ComplianceIndicator
                compliant={fireSafetyResult.compliant}
                score={fireSafetyResult.score}
                title="Fire Safety"
                violations={fireSafetyResult.violations.length}
              />
            )}
            
            {analysisResult && (
              <>
                <ComplianceIndicator
                  compliant={analysisResult.optimization.efficiency <= 0.85}
                  score={analysisResult.optimization.efficiency <= 0.85 ? 90 : 60}
                  title="Space Standards"
                  violations={analysisResult.optimization.efficiency > 0.85 ? 1 : 0}
                />
                
                <ComplianceIndicator
                  compliant={analysisResult.optimization.warnings.length === 0}
                  score={Math.max(0, 100 - (analysisResult.optimization.warnings.length * 20))}
                  title="General Safety"
                  violations={analysisResult.optimization.warnings.length}
                />
              </>
            )}
          </div>
        </div>

        {/* Recommendations */}
        {analysisResult && analysisResult.recommendations.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">💡 Recommendations</h4>
            <ul className="space-y-1">
              {analysisResult.recommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="text-sm text-blue-800 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fire Safety Details */}
        {fireSafetyResult && fireSafetyResult.violations.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <h4 className="font-medium text-red-900 mb-2">🔥 Fire Safety Issues</h4>
            <ul className="space-y-1">
              {fireSafetyResult.violations.slice(0, 3).map((violation, index) => (
                <li key={index} className="text-sm text-red-800 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{violation.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}; 