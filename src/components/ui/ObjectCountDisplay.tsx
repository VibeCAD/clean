import React from 'react';

interface ObjectCountDisplayProps {
  objectsPlaced: number;
  maxObjectsPossible: number;
  objectType: string;
  roomArea: number;
  efficiency: number;
  className?: string;
  onClearObjects?: () => void;
  optimizedObjectCount?: number;
}

export const ObjectCountDisplay: React.FC<ObjectCountDisplayProps> = ({
  objectsPlaced,
  maxObjectsPossible,
  objectType,
  roomArea,
  efficiency,
  className = '',
  onClearObjects,
  optimizedObjectCount = 0
}) => {
  const utilizationPercentage = maxObjectsPossible > 0 ? (objectsPlaced / maxObjectsPossible) * 100 : 0;
  const densityRating = objectsPlaced / roomArea;

  const getEfficiencyColor = () => {
    if (efficiency >= 0.8) return 'text-yellow-600'; // Warning - too dense
    if (efficiency >= 0.6) return 'text-green-600';  // Excellent
    if (efficiency >= 0.4) return 'text-blue-600';   // Good
    return 'text-gray-600'; // Poor
  };

  const getEfficiencyLabel = () => {
    if (efficiency >= 0.8) return 'Dense';
    if (efficiency >= 0.6) return 'Excellent';
    if (efficiency >= 0.4) return 'Good';
    return 'Sparse';
  };

  const getCapacityIcon = () => {
    if (objectsPlaced === 0) return '🏢';
    if (utilizationPercentage >= 90) return '🎯';
    if (utilizationPercentage >= 70) return '✅';
    if (utilizationPercentage >= 40) return '📊';
    return '📉';
  };

  return (
    <div className={`bg-white rounded-lg border-2 border-gray-200 shadow-lg ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-3">{getCapacityIcon()}</span>
            <div>
              <h3 className="text-lg font-bold">Furniture Placement</h3>
              <p className="text-indigo-100 text-sm">{objectType} optimization results</p>
            </div>
          </div>
          {onClearObjects && optimizedObjectCount > 0 && (
            <button
              onClick={onClearObjects}
              className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1 text-sm font-medium transition-colors"
            >
              Clear ({optimizedObjectCount})
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Primary Count Display */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-2">
            <div className="text-center">
              <div className="text-6xl font-bold text-gray-900 mb-1">
                {objectsPlaced}
              </div>
              <div className="text-sm text-gray-500 uppercase tracking-wide">
                {objectType}{objectsPlaced !== 1 ? 's' : ''} Placed
              </div>
            </div>
            
            {maxObjectsPossible > 0 && (
              <>
                <div className="mx-4 text-gray-300 text-2xl">/</div>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-gray-600 mb-1">
                    {maxObjectsPossible}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    Maximum Possible
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {maxObjectsPossible > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
              />
            </div>
          )}
          
          <div className="text-sm text-gray-600">
            {maxObjectsPossible > 0 ? (
              <>
                <span className="font-medium">{utilizationPercentage.toFixed(1)}%</span> of maximum capacity
              </>
            ) : (
              'No placement analysis available'
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{roomArea.toFixed(1)}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Room Area (m²)</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${getEfficiencyColor()}`}>
              {(efficiency * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Efficiency ({getEfficiencyLabel()})
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{densityRating.toFixed(2)}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Items/m²</div>
          </div>
        </div>

        {/* Status Messages */}
        <div className="mt-4 space-y-2">
          {objectsPlaced === 0 && maxObjectsPossible > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <span className="text-yellow-600 text-sm">
                💡 Room can fit {maxObjectsPossible} {objectType.toLowerCase()}{maxObjectsPossible !== 1 ? 's' : ''}. 
                Run optimization to place them!
              </span>
            </div>
          )}

          {objectsPlaced > 0 && utilizationPercentage < 50 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <span className="text-blue-600 text-sm">
                📈 Room has space for {maxObjectsPossible - objectsPlaced} more items
              </span>
            </div>
          )}

          {utilizationPercentage >= 90 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <span className="text-orange-600 text-sm">
                ⚠️ Room is near maximum capacity. Consider spacing adjustments for comfort.
              </span>
            </div>
          )}

          {objectsPlaced === 0 && maxObjectsPossible === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <span className="text-red-600 text-sm">
                ❌ Room is too small for {objectType.toLowerCase()}s or has no valid placement zones
              </span>
            </div>
          )}
        </div>

        {/* Action Hint */}
        {objectsPlaced > 0 && (
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">
              Objects with "optimized-" prefix were placed by the optimization algorithm
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Simplified version for smaller displays
interface CompactCountDisplayProps {
  objectsPlaced: number;
  maxObjectsPossible: number;
  objectType: string;
  efficiency: number;
  className?: string;
}

export const CompactCountDisplay: React.FC<CompactCountDisplayProps> = ({
  objectsPlaced,
  maxObjectsPossible,
  objectType,
  efficiency,
  className = ''
}) => {
  const utilizationPercentage = maxObjectsPossible > 0 ? (objectsPlaced / maxObjectsPossible) * 100 : 0;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="text-2xl font-bold text-gray-900 mr-2">{objectsPlaced}</div>
          <div>
            <div className="text-sm font-medium text-gray-700">{objectType}s Placed</div>
            <div className="text-xs text-gray-500">
              {maxObjectsPossible > 0 ? `${utilizationPercentage.toFixed(0)}% of ${maxObjectsPossible}` : 'No analysis'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-700">{(efficiency * 100).toFixed(0)}%</div>
          <div className="text-xs text-gray-500">Efficiency</div>
        </div>
      </div>
      
      {maxObjectsPossible > 0 && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}; 