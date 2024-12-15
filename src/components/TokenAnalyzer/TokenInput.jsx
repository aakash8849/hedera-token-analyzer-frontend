import React from 'react';

function TokenInput({ value, onChange, error }) {
  return (
    <div className="flex-1 mr-4">
      <label htmlFor="tokenId" className="block text-sm font-medium text-gray-700">
        Token ID
      </label>
      <input
        type="text"
        id="tokenId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.0.xxxxx"
        className={`mt-1 block w-full rounded-md shadow-sm ${
          error ? 'border-red-300' : 'border-gray-300'
        } focus:border-blue-500 focus:ring-blue-500`}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

export default TokenInput;