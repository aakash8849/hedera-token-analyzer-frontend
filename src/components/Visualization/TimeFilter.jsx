import React from 'react';

function TimeFilter({ value, onChange }) {
  const options = [
    { value: 1, label: '1M' },
    { value: 2, label: '2M' },
    { value: 3, label: '3M' },
    { value: 4, label: '4M' },
    { value: 6, label: '6M' },
  ];

  return (
    <div className="flex items-center bg-gray-900 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          className={`px-3 py-1 rounded ${
            value === option.value
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default TimeFilter;
