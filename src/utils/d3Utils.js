// Replace d3Utils.js with native JavaScript functions
export function getNodeCategory(value, maxBalance) {
  const ratio = value / maxBalance;
  if (ratio > 0.1) return 'high';
  if (ratio > 0.01) return 'medium';
  return 'low';
}

export function createColorScale() {
  return (category) => {
    switch (category) {
      case 'high': return '#FF3B9A';
      case 'medium': return '#7A73FF';
      case 'low': return '#42C7FF';
      default: return '#42C7FF';
    }
  };
}
