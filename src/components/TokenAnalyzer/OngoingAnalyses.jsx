import React, { useState } from 'react';
import { formatTime } from '../../utils/formatters';

function OngoingAnalyses({ analyses, onSelect }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!analyses || analyses.length === 0) return null;

  return (
    <div className="mt-8">
      <div 
        className="bg-gray-100 p-4 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Ongoing Analyses ({analyses.length})
          </h3>
          <span className="text-gray-500">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {analyses.map((analysis) => (
            <div 
              key={analysis.tokenId}
              className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelect(analysis.tokenId)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Token ID: {analysis.tokenId}</span>
                <span className="text-sm text-gray-500">
                  Time elapsed: {formatTime(analysis.progress.elapsedTime)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${analysis.progress.holders.progress}%` 
                  }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {analysis.progress.holders.processed} of {analysis.progress.holders.total} holders processed
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OngoingAnalyses;
