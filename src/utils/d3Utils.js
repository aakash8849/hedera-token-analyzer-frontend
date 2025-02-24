import * as d3 from 'd3';

export function createColorScale() {
  return d3.scaleOrdinal()
    .domain(['high', 'medium', 'low'])
    .range(['#FF3B9A', '#7A73FF', '#42C7FF']);
}

export function getNodeCategory(value, maxBalance) {
  const ratio = value / maxBalance;
  if (ratio > 0.1) return 'high';
  if (ratio > 0.01) return 'medium';
  return 'low';
}

export function createForceSimulation(nodes, links) {
  return d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter())
    .force('collision', d3.forceCollide().radius(d => d.radius + 2));
}
