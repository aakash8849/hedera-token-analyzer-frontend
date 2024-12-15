import React from 'react';

function AnalyzerDescription({ isVisualizeMode }) {
  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-md">
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {isVisualizeMode ? 'Visualization Mode' : 'Fetch Mode'}
      </h3>
      <p className="text-gray-600">
        {isVisualizeMode
          ? 'This mode will visualize previously fetched token data using an interactive network graph. Holders will be shown as nodes with sizes proportional to their balances, connected by transaction relationships.'
          : 'This mode will fetch and store token holder data and transaction history. The data will be saved as CSV files for later visualization.'}
      </p>
    </div>
  );
}

export default AnalyzerDescription;