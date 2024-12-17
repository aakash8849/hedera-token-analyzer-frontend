import React, { useState } from 'react';
import TokenInput from './TokenInput';
import ModeToggle from './ModeToggle';
import AnalyzerDescription from './AnalyzerDescription';
import AnalysisProgress from './ProgressDisplay/AnalysisProgress';
import NodeGraph from '../Visualization/NodeGraph';
import { analyzeToken, visualizeToken } from '../../services/api';
import { useAnalysisStatus } from '../../hooks/useAnalysisStatus';

function TokenAnalyzer() {
  const [tokenId, setTokenId] = useState('');
  const [isVisualizeMode, setIsVisualizeMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [visualizationData, setVisualizationData] = useState(null);
  const [showVisualization, setShowVisualization] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const { status, progress, error: statusError } = useAnalysisStatus(
    analysisStarted ? tokenId : null
  );

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
        setShowVisualization(true);
      } else {
        const response = await analyzeToken(tokenId);
        if (response.data.status === 'started' || response.data.status === 'in_progress') {
          setAnalysisStarted(true);
        }
      }
    } catch (err) {
      setError(err.message);
      setVisualizationData(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (showVisualization && visualizationData) {
    return (
      <NodeGraph 
        data={visualizationData} 
        onClose={() => setShowVisualization(false)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <TokenInput 
            value={tokenId} 
            onChange={setTokenId} 
            error={error || statusError}
          />
          <ModeToggle 
            isVisualizeMode={isVisualizeMode} 
            onChange={setIsVisualizeMode} 
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading || status === 'in_progress'}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          {status === 'in_progress' ? 'Analysis in Progress...' : 
           isLoading ? 'Processing...' : 
           isVisualizeMode ? 'Visualize Data' : 'Fetch Data'}
        </button>

        {status === 'in_progress' && <AnalysisProgress progress={progress} />}
        <AnalyzerDescription isVisualizeMode={isVisualizeMode} />
      </div>
    </div>
  );
}

export default TokenAnalyzer;
