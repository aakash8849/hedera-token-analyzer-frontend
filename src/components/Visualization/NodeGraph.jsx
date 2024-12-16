import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { processVisualizationData } from '../../utils/visualizationUtils';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const svgRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [processedData, setProcessedData] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  useEffect(() => {
    if (!data) return;
    const processed = processVisualizationData(data);
    setProcessedData(processed);
  }, [data]);

  useEffect(() => {
    if (!processedData) return;

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    svg.attr('viewBox', [-width / 2, -height / 2, width, height]);

    // Clear previous content
    svg.selectAll('*').remove();

    // Define arrow markers
    const defs = svg.append('defs');
    ['#FFD700', '#42C7FF'].forEach(color => {
      defs.append('marker')
        .attr('id', `arrow-${color.slice(1)}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', color)
        .attr('d', 'M0,-5L10,0L0,5');
    });

    // Filter nodes and links based on selected wallets and time period
    const filteredTransactions = filterTransactionsByMonths(processedData.transactions, selectedMonths);
    const filteredNodes = processedData.nodes.filter(node => 
      !selectedWallets.has(node.id)
    );
    const filteredLinks = processedData.links.filter(link => {
      const sourceVisible = !selectedWallets.has(link.source.id);
      const targetVisible = !selectedWallets.has(link.target.id);
      const inTimeRange = filterTransactionsByMonths([{ timestamp: link.timestamp }], selectedMonths).length > 0;
      return sourceVisible && targetVisible && inTimeRange;
    });

    // Create force simulation
const simulation = d3.forceSimulation(filteredNodes)
  .force("link", d3.forceLink(filteredLinks)
    .id(d => d.id)
    .distance(d => {
      // Shorter distance for treasury connections
      if (d.source.isTreasury || d.target.isTreasury) return 150;
      // Longer distance for other connections
      return 100;
    }))
  .force("charge", d3.forceManyBody()
    .strength(d => d.isTreasury ? -1000 : -300))
  .force("collide", d3.forceCollide()
    .radius(d => d.radius * 1.2))
  .force("center", d3.forceCenter(0, 0))
  .force("radial", d3.forceRadial(d => d.isTreasury ? 0 : 300, 0, 0)
    .strength(d => d.isTreasury ? 0.5 : 0.1));

    // Create container for zoom
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Create links
  const link = g.append("g")
  .selectAll("line")
  .data(filteredLinks)
  .join("line")
  .attr("stroke", d => getLinkColor(d, processedData.treasuryId))
  .attr("stroke-width", 1)
  .attr("opacity", 0.4)
  .attr("marker-end", d => `url(#arrow-${getLinkColor(d, processedData.treasuryId).slice(1)})`);

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(filteredNodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('opacity', 0.7)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2);

    // Add labels to nodes
    node.append('text')
      .text(d => d.id)
      .attr('dy', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .style('pointer-events', 'none');

    // Add hover effects
    node.on('mouseover', function(event, d) {
      setHoveredNode(d);
      d3.select(this).attr('opacity', 1);
      link
        .attr('opacity', l => 
          l.source.id === d.id || l.target.id === d.id ? 0.8 : 0.1
        )
        .attr('stroke-width', l =>
          l.source.id === d.id || l.target.id === d.id ? 2 : 1
        );
    })
    .on('mouseout', function() {
      setHoveredNode(null);
      d3.select(this).attr('opacity', 0.7);
      link
        .attr('opacity', 0.4)
        .attr('stroke-width', 1);
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [processedData, selectedWallets, selectedMonths]);

  if (!processedData) return null;

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
      <WalletList 
        wallets={processedData.nodes}
        selectedWallets={selectedWallets}
        onWalletToggle={(wallet) => {
          const newSelected = new Set(selectedWallets);
          if (newSelected.has(wallet.id)) {
            newSelected.delete(wallet.id);
          } else {
            newSelected.add(wallet.id);
          }
          setSelectedWallets(newSelected);
        }}
      />

      <div className="absolute top-4 right-4 flex items-center space-x-4">
        <TimeFilter value={selectedMonths} onChange={setSelectedMonths} />
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
        >
          Back
        </button>
      </div>

      {hoveredNode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg">
          <p>Account: {hoveredNode.id}</p>
          <p>Balance: {hoveredNode.value.toLocaleString()}</p>
          {hoveredNode.isTreasury && <p>Treasury Wallet</p>}
        </div>
      )}

      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}

export default NodeGraph;
