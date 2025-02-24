export function optimizeVisualizationData(data, options = {}) {
  const {
    maxNodes = 1000,
    minBalance = 0
  } = options;

  // Filter out nodes with very small balances
  let nodes = data.nodes.filter(node => node.value > minBalance);

  // If still too many nodes, group smaller ones
  if (nodes.length > maxNodes) {
    // Sort by value descending
    nodes.sort((a, b) => b.value - a.value);

    // Take top nodes directly
    const topNodes = nodes.slice(0, maxNodes - 1);
    const remainingNodes = nodes.slice(maxNodes - 1);

    // Create an aggregated node for the rest
    if (remainingNodes.length > 0) {
      const aggregatedValue = remainingNodes.reduce((sum, node) => sum + node.value, 0);
      const aggregatedNode = {
        id: 'Others',
        value: aggregatedValue,
        radius: Math.sqrt(aggregatedValue) * 0.5,
        color: '#808080',
        isAggregated: true
      };
      nodes = [...topNodes, aggregatedNode];
    }
  }

  // Optimize links
  const nodeIds = new Set(nodes.map(n => n.id));
  const links = data.links.filter(link => 
    nodeIds.has(link.source.id || link.source) && 
    nodeIds.has(link.target.id || link.target)
  );

  return {
    nodes,
    links,
    totalSupply: data.totalSupply,
    treasuryId: data.treasuryId
  };
}

export function calculateViewportBounds(width, height, transform) {
  const bounds = {
    x1: (-transform.x) / transform.k,
    y1: (-transform.y) / transform.k,
    x2: (width - transform.x) / transform.k,
    y2: (height - transform.y) / transform.k
  };
  return bounds;
}

export function isNodeInViewport(node, bounds) {
  return node.x >= bounds.x1 && 
         node.x <= bounds.x2 && 
         node.y >= bounds.y1 && 
         node.y <= bounds.y2;
}
