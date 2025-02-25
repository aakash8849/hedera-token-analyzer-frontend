import * as d3 from 'd3';

export function optimizeVisualizationData(data, options = {}) {
  const {
    maxNodes = 1000,
    minBalance = 0,
    groupThreshold = 0.001 // 0.1% of total supply
  } = options;

  if (!data || !data.nodes || !data.links) {
    console.error('Invalid data structure');
    return { nodes: [], links: [], totalSupply: 0 };
  }

  // Calculate total supply
  const totalSupply = data.nodes.reduce((sum, node) => sum + node.value, 0);

  // Filter and sort nodes by value
  let nodes = data.nodes
    .filter(node => node.value > minBalance)
    .sort((a, b) => b.value - a.value);

  // If we have too many nodes, group smaller ones
  if (nodes.length > maxNodes) {
    const significantNodes = nodes.filter(node => 
      node.value / totalSupply > groupThreshold || node.isTreasury
    );

    const smallNodes = nodes.filter(node => 
      node.value / totalSupply <= groupThreshold && !node.isTreasury
    );

    // Group small nodes by value ranges
    const groups = {};
    smallNodes.forEach(node => {
      const valueRange = Math.floor(node.value / totalSupply * 100);
      const groupKey = `Group ${valueRange}%`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          value: 0,
          count: 0,
          radius: 0,
          color: '#808080',
          isGroup: true
        };
      }
      groups[groupKey].value += node.value;
      groups[groupKey].count++;
    });

    // Convert groups to nodes
    const groupNodes = Object.values(groups).map(group => ({
      ...group,
      radius: Math.sqrt(group.value) * 0.5
    }));

    // Combine significant nodes with group nodes
    nodes = [...significantNodes, ...groupNodes];
  }

  // Create node lookup for quick access
  const nodeIds = new Set(nodes.map(n => n.id));

  // Filter and optimize links
  const links = data.links.filter(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  // Batch links between the same nodes
  const batchedLinks = new Map();
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const key = `${sourceId}-${targetId}`;
    
    if (!batchedLinks.has(key)) {
      batchedLinks.set(key, {
        source: sourceId,
        target: targetId,
        value: 0,
        count: 0,
        color: link.color
      });
    }
    
    const batch = batchedLinks.get(key);
    batch.value += link.value;
    batch.count++;
  });

  return {
    nodes,
    links: Array.from(batchedLinks.values()),
    totalSupply,
    treasuryId: data.treasuryId
  };
}

export function calculateViewportBounds(width, height, transform) {
  return {
    x1: (-transform.x) / transform.k,
    y1: (-transform.y) / transform.k,
    x2: (width - transform.x) / transform.k,
    y2: (height - transform.y) / transform.k
  };
}

export function isNodeInViewport(node, bounds) {
  return node.x >= bounds.x1 && 
         node.x <= bounds.x2 && 
         node.y >= bounds.y1 && 
         node.y <= bounds.y2;
}
