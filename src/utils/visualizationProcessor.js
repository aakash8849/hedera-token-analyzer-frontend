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

  // Create nodes
  const nodes = holders
    .filter(h => h.balance > 0)
    .map(h => ({
      id: h.account,
      value: h.balance,
      radius: balanceScale(h.balance)
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
      value: tx.amount
    }));

  return { nodes, links };
}
