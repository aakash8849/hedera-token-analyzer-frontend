import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { optimizeVisualizationData } from '../../utils/visualizationOptimizer';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const svgRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Optimize data based on zoom level and viewport
  const processedData = useMemo(() => {
    return optimizeVisualizationData(data, {
      maxNodes: 1000, // Limit visible nodes
      minBalance: data.totalSupply * 0.0001 // Filter out tiny holders
    });
  }, [data]);

  useEffect(() => {
    if (!processedData) return;

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    svg.attr('viewBox', [-width / 2, -height / 2, width, height]);
    svg.selectAll('*').remove();

    // Create WebGL renderer for better performance with large datasets
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.width = width;
    canvas.height = height;
    svg.node().parentNode.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Filter data based on current view
    const filteredTransactions = filterTransactionsByMonths(processedData.transactions, selectedMonths);
    const filteredNodes = processedData.nodes.filter(node => !selectedWallets.has(node.id));
    const filteredLinks = processedData.links.filter(link => {
      const sourceVisible = !selectedWallets.has(link.source.id);
      const targetVisible = !selectedWallets.has(link.target.id);
      const inTimeRange = filterTransactionsByMonths([{ timestamp: link.timestamp }], selectedMonths).length > 0;
      return sourceVisible && targetVisible && inTimeRange;
    });

    // Use quadtree for efficient collision detection
    const quadtree = d3.quadtree()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(filteredNodes);

    // Optimize force simulation
    const simulation = d3.forceSimulation(filteredNodes)
      .alphaDecay(0.05) // Faster stabilization
      .velocityDecay(0.3)
      .force('link', d3.forceLink(filteredLinks)
        .id(d => d.id)
        .distance(d => d.source.isTreasury || d.target.isTreasury ? 200 : 100)
        .strength(0.3))
      .force('charge', d3.forceManyBody()
        .strength(d => d.isTreasury ? -2000 : -500)
        .theta(0.9)) // Optimize Barnes-Hut approximation
      .force('collide', d3.forceCollide()
        .radius(d => d.radius * 1.2)
        .strength(0.5)
        .iterations(1)) // Reduce collision iterations
      .force('center', d3.forceCenter(0, 0))
      .force('radial', d3.forceRadial(d => d.isTreasury ? 0 : 400, 0, 0)
        .strength(d => d.isTreasury ? 1 : 0.3));

    // Batch rendering for better performance
    let renderRequested = false;
    const render = () => {
      if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(() => {
          renderRequested = false;
          ctx.clearRect(0, 0, width, height);
          ctx.save();
          ctx.translate(width / 2, height / 2);
          ctx.scale(zoomLevel, zoomLevel);

          // Draw links
          ctx.globalAlpha = 0.2;
          filteredLinks.forEach(link => {
            ctx.beginPath();
            ctx.moveTo(link.source.x, link.source.y);
            ctx.lineTo(link.target.x, link.target.y);
            ctx.strokeStyle = link.color;
            ctx.stroke();
          });

          // Draw nodes
          ctx.globalAlpha = 0.7;
          filteredNodes.forEach(node => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
            ctx.fillStyle = node.color;
            ctx.fill();
          });

          ctx.restore();
        });
      }
    };

    // Optimize simulation ticks
    simulation.on('tick', () => {
      render();
    });

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        setZoomLevel(event.transform.k);
        ctx.setTransform(
          event.transform.k, 0, 0,
          event.transform.k,
          event.transform.x + width / 2,
          event.transform.y + height / 2
        );
        render();
      });

    svg.call(zoom);

    // Cleanup
    return () => {
      simulation.stop();
      canvas.remove();
    };
  }, [processedData, selectedWallets, selectedMonths, zoomLevel]);

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
      <WalletList 
        wallets={processedData?.nodes || []}
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
