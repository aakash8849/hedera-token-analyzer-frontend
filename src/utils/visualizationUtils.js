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

  // Calculate balance ranges for visualization
  const balances = holders.map(h => h.balance).filter(b => b > 0);
  const maxBalance = Math.max(...balances);
  const minBalance = Math.min(...balances);

  // Create scale for node sizes
  const balanceScale = d3.scaleSqrt()
    .domain([minBalance, maxBalance])
    .range([10, 50]);

  // Create nodes
  const nodes = holders
    .filter(h => h.balance > 0)
    .map(h => ({
      id: h.account,
      value: h.balance,
      radius: balanceScale(h.balance),
      isTreasury: h.account === treasuryId
    }));

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
        receiver
      };
    });

  // Create links
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

  return { nodes, links, transactions, treasuryId };
}
