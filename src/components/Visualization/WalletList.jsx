import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

function WalletList({ wallets, selectedWallets, onWalletToggle }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const sortedWallets = [...wallets].sort((a, b) => b.value - a.value);
  const totalValue = sortedWallets[0]?.value || 0;
  
  const filteredWallets = sortedWallets.filter(wallet => 
    wallet.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="absolute left-4 top-4 bottom-4 w-72 bg-[#1F1D2B] rounded-lg p-4 overflow-hidden flex flex-col">
      <h2 className="text-xl font-semibold text-white mb-4">Wallets List</h2>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search Wallets"
          className="w-full px-3 py-2 bg-[#13111C] text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredWallets.map((wallet, index) => (
          <div
            key={wallet.id}
            className="flex items-center justify-between p-2 hover:bg-[#13111C] rounded-lg mb-1"
          >
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 w-8">#{index + 1}</span>
              <div className="flex flex-col">
                <span className="text-white">{wallet.id}</span>
                <span className="text-gray-500 text-sm">
                  {(wallet.value * 100 / totalValue).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">{wallet.value.toLocaleString()}</span>
              <button
                onClick={() => onWalletToggle(wallet)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                {!selectedWallets.has(wallet.id) ? (
                  <EyeSlashIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <EyeIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WalletList;
