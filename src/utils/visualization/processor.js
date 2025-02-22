import * as d3 from 'd3';

export function processVisualizationData(data) {
  const { holders, transactions } = data;

  // Find treasury account using isTreasury flag
  const treasuryAccount = holders.find(holder => holder.isTreasury);
  const treasuryId = treasuryAccount?.account;
  const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0);

  // Calculate balance ranges for visualization
  const balances = holders.map(h => h.balance).filter(b => b > 0);
  const maxBalance = Math.max(...balances);

  // Create scale for node sizes
  const balanceScale = d3.scaleSqrt()
    .domain([0, maxBalance])
    .range([15, 60]);

  // Create color scale based on balance percentages
  const colorScale = d3.scaleThreshold()
    .domain([0.01, 0.05, 0.1])
    .range(['#42C7FF', '#7A73FF', '#FF3B9A']);

  // Create nodes
  const nodes = holders
    .filter(h => h.balance > 0)
    .map(h => {
      const balancePercentage = h.balance / totalSupply;
      return {
        id: h.account,
        value: h.balance,
        percentage: balancePercentage * 100,
        radius: balanceScale(h.balance),
        color: h.isTreasury ? '#FFD700' : colorScale(balancePercentage),
        isTreasury: h.isTreasury
      };
    });

  // Create links from transactions
  const links = transactions.map(tx => ({
    source: tx.sender,
    target: tx.receiver,
    value: tx.amount,
    timestamp: new Date(tx.timestamp),
    color: (treasuryId && (tx.sender === treasuryId || tx.receiver === treasuryId)) 
      ? '#FFD700' 
      : '#42C7FF'
  }));

  return { 
    nodes, 
    links, 
    transactions,
    treasuryId,
    totalSupply,
    maxBalance 
  };
}
