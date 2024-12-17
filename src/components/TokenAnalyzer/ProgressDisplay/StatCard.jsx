import React from 'react';

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="text-sm font-medium text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtitle && (
        <div className="mt-1 text-sm text-gray-500">{subtitle}</div>
      )}
    </div>
  );
}

export default StatCard;
