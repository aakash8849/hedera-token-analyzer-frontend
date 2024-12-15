import React, { useState } from 'react';
import TokenInput from './TokenAnalyzer/TokenInput';
import ModeToggle from './TokenAnalyzer/ModeToggle';
import AnalyzerDescription from './TokenAnalyzer/AnalyzerDescription';
import NodeGraph from './Visualization/NodeGraph';
import { analyzeToken, visualizeToken } from '../services/api';

function TokenAnalyzer() {
  const [tokenId, setTokenId] = useState('');
  const [isVisualizeMode, setIsVisualizeMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [visualizationData, setVisualizationData] = useState(null);

  const handleSubmit = async () => {
    if (!tokenId.match(/^\d+\.\d+\.\d+$/)) {
      setError('Invalid token ID format');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      if (isVisualizeMode) {
        const data = await visualizeToken(tokenId);
        setVisualizationData(data);
      } else {
        const result = await analyzeToken(tokenId);
        console.log('Analysis complete:', result);
      }
    } catch (err) {
      setError(err.message);
      setVisualizationData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <TokenInput 
            value={tokenId} 
            onChange={setTokenId} 
            error={error}
          />
          <ModeToggle 
            isVisualizeMode={isVisualizeMode} 
            onChange={setIsVisualizeMode} 
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          {isLoading ? 'Processing...' : isVisualizeMode ? 'Visualize Data' : 'Fetch Data'}
        </button>

        <AnalyzerDescription isVisualizeMode={isVisualizeMode} />
      </div>

      {visualizationData && (
        <div className="bg-white rounded-lg shadow p-6">
          <NodeGraph data={visualizationData} />
        </div>
      )}
    </div>
  );
}

export default TokenAnalyzer;
