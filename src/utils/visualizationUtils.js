import * as d3 from 'd3';

export function processVisualizationData(data) {
  // Parse CSV data
  const holders = data.holders.split('\n')
    .slice(1)
    .filter(line => line.trim())
    .map(line => {
      const [account, balance] = line.split(',');
      return { 
        account, 
        balance: parseFloat(balance) || 0
      };
    });

  // Find treasury account (account with highest balance)
  const treasuryAccount = holders.reduce((max, holder) => 
    holder.balance > max.balance ? holder : max
  , holders[0]);

  const treasuryId = treasuryAccount.account;
  const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0);

  // Calculate balance ranges for visualization
  const balances = holders.map(h => h.balance).filter(b => b > 0);
  const maxBalance = Math.max(...balances);

  // Create scale for node sizes (larger range for more prominent bubbles)
  const balanceScale = d3.scaleSqrt()
    .domain([0, maxBalance])
    .range([15, 60]); // Increased size range

  // Create color scale based on balance percentages
  const colorScale = d3.scaleThreshold()
    .domain([0.01, 0.05, 0.1])
    .range(['#42C7FF', '#7A73FF', '#FF3B9A']);

  // Create nodes with proper sizing and colors
  const nodes = holders
    .filter(h => h.balance > 0)
    .map(h => {
      const balancePercentage = h.balance / totalSupply;
      return {
        id: h.account,
        value: h.balance,
        percentage: balancePercentage * 100,
        radius: balanceScale(h.balance),
        color: h.account === treasuryId ? '#FFD700' : colorScale(balancePercentage),
        isTreasury: h.account === treasuryId
      };
    })
    .sort((a, b) => b.value - a.value);

  // Parse and filter transactions
  const transactions = data.transactions.split('\n')
    .slice(1)
    .filter(line => line.trim())
    .map(line => {
      const [timestamp, , sender, amount, receiver] = line.split(',');
      return {
        timestamp: new Date(timestamp),
        sender,
        amount: parseFloat(amount) || 0,
        receiver,
        isTreasuryTransaction: sender === treasuryId || receiver === treasuryId
      };
    });

  // Create links with proper styling
  const links = transactions
    .filter(tx => {
      const sourceExists = nodes.some(n => n.id === tx.sender);
      const targetExists = nodes.some(n => n.id === tx.receiver);
      return sourceExists && targetExists;
    })
    .map(tx => ({
      source: tx.sender,
      target: tx.receiver,
      value: tx.amount,
      timestamp: tx.timestamp,
      color: tx.isTreasuryTransaction ? '#FFD700' : '#42C7FF',
      isTreasuryTransaction: tx.isTreasuryTransaction
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

export function getNodeColor(node, treasuryId) {
  return node.id === treasuryId ? '#FFD700' : node.color;
}

export function getLinkColor(link, treasuryId) {
  return (link.source.id === treasuryId || link.target.id === treasuryId) ? '#FFD700' : '#42C7FF';
}

export function getNodeRadius(value, maxValue) {
  return d3.scaleSqrt()
    .domain([0, maxValue])
    .range([15, 60])(value);
}
