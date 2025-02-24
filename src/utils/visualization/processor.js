export function processVisualizationData(data) {
  if (!data || !data.nodes || !data.links) {
    console.error('Invalid visualization data received:', data);
    return { nodes: [], links: [], totalSupply: 0 };
  }

  // Calculate total supply and find treasury
  const totalSupply = data.nodes.reduce((sum, h) => sum + h.balance, 0);
  const treasuryNode = data.nodes.find(h => h.isTreasury);
  const treasuryId = treasuryNode?.id;

  // Calculate balance ranges for visualization
  const balances = data.nodes.map(h => h.balance).filter(b => b > 0);
  const maxBalance = Math.max(...balances);
  const minBalance = Math.min(...balances);

  // Create scale function for node sizes
  const scaleValue = (value, minValue, maxValue, targetMin, targetMax) => {
    return targetMin + (value - minValue) * (targetMax - targetMin) / (maxValue - minValue);
  };

  // Create color based on balance percentage
  const getColorByPercentage = (percentage) => {
    if (percentage > 0.1) return '#FF3B9A';
    if (percentage > 0.05) return '#7A73FF';
    return '#42C7FF';
  };

  // Process nodes
  const nodes = data.nodes
    .filter(h => h.balance > 0)
    .map(h => {
      const balancePercentage = h.balance / totalSupply;
      const radius = scaleValue(
        Math.sqrt(h.balance), 
        Math.sqrt(minBalance), 
        Math.sqrt(maxBalance), 
        15, 
        60
      );

      return {
        id: h.id,
        value: h.balance,
        percentage: balancePercentage * 100,
        radius,
        color: h.isTreasury ? '#FFD700' : getColorByPercentage(balancePercentage),
        isTreasury: h.isTreasury
      };
    });

  // Create node lookup for quick access
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Process links
  const links = data.links
    .filter(tx => {
      return nodeMap.has(tx.source) && nodeMap.has(tx.target);
    })
    .map(tx => ({
      source: tx.source,
      target: tx.target,
      value: tx.amount,
      timestamp: new Date(tx.timestamp),
      color: (tx.source === treasuryId || tx.target === treasuryId) ? 
        '#FFD700' : '#42C7FF'
    }));

  console.log(`Processed ${nodes.length} nodes and ${links.length} links`);

  return { 
    nodes, 
    links,
    totalSupply,
    treasuryId,
    maxBalance
  };
}
