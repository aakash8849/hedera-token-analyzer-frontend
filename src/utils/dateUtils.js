export function filterTransactionsByMonths(transactions, months) {
  const now = new Date();
  const cutoffDate = new Date(now.setMonth(now.getMonth() - months));

  return transactions.filter(transaction => {
    const txDate = new Date(transaction.timestamp);
    return txDate >= cutoffDate;
  });
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}