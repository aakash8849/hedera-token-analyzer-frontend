import React, { useState } from 'react';

function WalletList({ wallets, selectedWallets, onWalletToggle }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const sortedWallets = [...wallets].sort((a, b) => b.value - a.value);
  const filteredWallets = sortedWallets.filter(wallet => 
    wallet.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="absolute left-4 top-4 bottom-4 w-72 bg-gray-900 rounded-lg p-4 overflow-hidden flex flex-col">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search Wallets"
          className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredWallets.map((wallet, index) => (
          <div
            key={wallet.id}
            className={`flex items-center justify-between p-2 hover:bg-gray-800 rounded cursor-pointer ${
              selectedWallets.has(wallet.id) ? 'bg-gray-800' : ''
            }`}
            onClick={() => onWalletToggle(wallet)}
          >
            <div className="flex items-center space-x-2">
              <div className="w-4 text-gray-500">#{index + 1}</div>
              <div className="text-white">{wallet.id}</div>
            </div>
            <div className="text-gray-400">{wallet.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WalletList;
