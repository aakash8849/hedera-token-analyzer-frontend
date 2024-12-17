import React from 'react';
import ProgressBar from './ProgressBar';
import StatCard from './StatCard';
import { formatTime } from '../../../utils/formatters';

function AnalysisProgress({ progress }) {
  if (!progress) return null;

  return (
    <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Progress</h3>
      
      <div className="space-y-4">
        <ProgressBar 
          value={parseFloat(progress.holders.progress)} 
          label="Holders Processed" 
        />
        <ProgressBar 
          value={parseFloat(progress.batches.progress)} 
          label="Batch Progress" 
        />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Holders"
          value={progress.holders.processed}
          subtitle={`of ${progress.holders.total} total`}
        />
        <StatCard
          title="Transactions Found"
          value={progress.transactions.unique}
          subtitle="Unique transactions"
        />
        <StatCard
          title="Time Elapsed"
          value={formatTime(progress.elapsedTime)}
        />
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <ul className="space-y-1">
          <li>• Holders with transactions: {progress.holders.withTransactions}</li>
          <li>• Current batch: {progress.batches.current} of {progress.batches.total}</li>
          <li>• Total transactions processed: {progress.transactions.total}</li>
        </ul>
      </div>
    </div>
  );
}

export default AnalysisProgress;
