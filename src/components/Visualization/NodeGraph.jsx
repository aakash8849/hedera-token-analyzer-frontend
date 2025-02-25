import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { filterTransactionsByMonths } from '../../utils/dateUtils';
import { optimizeVisualizationData } from '../../utils/visualization/optimizer';

function NodeGraph({ data, onClose }) {
  const svgRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [viewportNodes, setViewportNodes] = useState([]);

  // Optimize data once when component mounts
  const optimizedData = useMemo(() => {
    return optimizeVisualizationData(data, {
      maxNodes: 1000, // Limit initial nodes for better performance
      minBalance: data.totalSupply * 0.0001 // Filter out tiny holders (< 0.01%)
    });
  }, [data]);

  useEffect(() => {
    if (!optimizedData || !optimizedData.nodes || !optimizedData.links) return;

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    svg.attr('viewBox', [-width / 2, -height / 2, width, height]);
    svg.selectAll('*').remove();

    // Create container for zoom
    const g = svg.append('g');

    // Optimize force simulation
    const simulation = d3.forceSimulation(optimizedData.nodes)
      .alphaDecay(0.1) // Faster stabilization
      .velocityDecay(0.3) // Reduce node movement
      .force('link', d3.forceLink(optimizedData.links)
        .id(d => d.id)
        .distance(100)
        .strength(0.1)) // Reduce link force
      .force('charge', d3.forceManyBody()
        .strength(-300)
        .distanceMax(300)) // Limit charge effect range
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide()
        .radius(d => d.radius * 1.2)
        .strength(0.5)) // Reduce collision strength
      .force('x', d3.forceX().strength(0.07))
      .force('y', d3.forceY().strength(0.07))
      .stop(); // Don't start automatically

    // Run simulation steps in batches
    for (let i = 0; i < 100; i++) simulation.tick();

    // Create links first so they appear behind nodes
    const links = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(optimizedData.links)
      .join('line')
      .attr('stroke', d => d.color || '#42C7FF')
      .attr('stroke-width', 1)
      .attr('opacity', 0.6)
      .attr('marker-end', 'url(#arrow)');

    // Add arrow marker for links
    svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .join('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#42C7FF')
      .attr('d', 'M0,-5L10,0L0,5');

    // Create nodes with canvas for better performance
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    // Create nodes
    const nodes = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(optimizedData.nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes
    nodes.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', d => d.isTreasury ? '#FFD700' : '#fff')
      .attr('stroke-width', d => d.isTreasury ? 3 : 1)
      .attr('opacity', 0.8);

    // Add labels only to significant nodes
    nodes.filter(d => d.value > optimizedData.totalSupply * 0.01)
      .append('text')
      .text(d => d.id)
      .attr('dy', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .style('pointer-events', 'none');

    // Implement efficient zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setTransform(event.transform);
      });

    svg.call(zoom);

    // Add hover effects with optimization
    nodes.on('mouseover', function(event, d) {
      setHoveredNode(d);
      d3.select(this).select('circle')
        .attr('opacity', 1)
        .attr('stroke-width', d.isTreasury ? 4 : 2);

      // Only update visible links
      links.attr('opacity', l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return (sourceId === d.id || targetId === d.id) ? 1 : 0.1;
      });
    })
    .on('mouseout', function() {
      setHoveredNode(null);
      d3.select(this).select('circle')
        .attr('opacity', 0.8)
        .attr('stroke-width', d => d.isTreasury ? 3 : 1);

      links.attr('opacity', 0.6);
    });

    // Update positions efficiently
    function updatePositions() {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    }

    // Initial position update
    updatePositions();

    // Drag functions with optimized simulation
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
  }, [optimizedData, selectedWallets, selectedMonths]);

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
      <WalletList 
        wallets={optimizedData?.nodes || []}
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
