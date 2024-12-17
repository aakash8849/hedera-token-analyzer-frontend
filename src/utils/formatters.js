export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatNumber(num) {
  return new Intl.NumberFormat().format(num);
}

export function formatPercentage(value) {
  return `${parseFloat(value).toFixed(2)}%`;
}
