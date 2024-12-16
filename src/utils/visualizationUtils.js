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

  const transactions = data.transactions.split('\n')
    .slice(1)
    .filter(line => line.trim())
    .map(line => {
      const [timestamp, txId, sender, amount, receiver] = line.split(',');
      return {
        timestamp: new Date(timestamp),
        sender,
        amount: parseFloat(amount) || 0,
        receiver
      };
    });

  // Calculate balance ranges for visualization
  const balances = holders.map(h => h.balance).filter(b => b > 0);
  const maxBalance = Math.max(...balances);
  const minBalance = Math.min(...balances);

  // Create scale for node sizes
  const balanceScale = d3.scaleSqrt()
    .domain([minBalance, maxBalance])
    .range([5, 50]);

  // Create nodes with color categories
  const nodes = holders
    .filter(h => h.balance > 0)
    .map(h => ({
      id: h.account,
      value: h.balance,
      radius: balanceScale(h.balance),
      category: getNodeCategory(h.balance, maxBalance)
    }));

  // Create links from transactions
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
      timestamp: tx.timestamp
    }));

  return { nodes, links, transactions };
}

function getNodeCategory(value, maxValue) {
  const ratio = value / maxValue;
  if (ratio > 0.1) return 'high';
  if (ratio > 0.01) return 'medium';
  return 'low';
}

export function createForceSimulation(nodes, links) {
  return d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-500))
    .force('center', d3.forceCenter())
    .force('collision', d3.forceCollide().radius(d => d.radius + 2));
}

export function createColorScale() {
  return d3.scaleOrdinal()
    .domain(['high', 'medium', 'low'])
    .range(['#FF3B9A', '#7A73FF', '#42C7FF']);
}
