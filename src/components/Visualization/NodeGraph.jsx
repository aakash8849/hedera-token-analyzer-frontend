import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { optimizeVisualizationData } from '../../utils/visualizationOptimizer';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [error, setError] = useState(null);

  // Optimize data for visualization
  const processedData = useMemo(() => {
    try {
      if (!data || !data.nodes || !data.links) {
        throw new Error('Invalid visualization data structure');
      }
      return optimizeVisualizationData(data, {
        maxNodes: 1000,
        minBalance: data.totalSupply * 0.0001
      });
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [data]);

  useEffect(() => {
    if (!processedData || !containerRef.current) return;

    try {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Set canvas size
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Filter data
      const filteredNodes = processedData.nodes.filter(node => !selectedWallets.has(node.id));
      const filteredLinks = processedData.links.filter(link => {
        const sourceVisible = !selectedWallets.has(link.source);
        const targetVisible = !selectedWallets.has(link.target);
        return sourceVisible && targetVisible;
      });

      // Create force simulation
      const simulation = d3.forceSimulation(filteredNodes)
        .force('link', d3.forceLink(filteredLinks)
          .id(d => d.id)
          .distance(100))
        .force('charge', d3.forceManyBody()
          .strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => d.radius + 2));

      // Transform for zooming and panning
      let transform = d3.zoomIdentity;

      // Draw function
      function draw() {
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        // Draw links
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 1;
        filteredLinks.forEach(link => {
          const source = link.source;
          const target = link.target;
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = link.color;
          ctx.stroke();
        });

        // Draw nodes
        ctx.globalAlpha = 0.8;
        filteredNodes.forEach(node => {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw labels for larger nodes
          if (node.radius > 20 || node.isTreasury) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(node.id, node.x, node.y + node.radius + 10);
          }
        });

        ctx.restore();
      }

      // Add zoom behavior
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          transform = event.transform;
          draw();
        });

      // Add zoom to canvas
      d3.select(canvas)
        .call(zoom)
        .on('mousemove', (event) => {
          const [x, y] = d3.pointer(event);
          const node = findNodeUnderMouse(x, y, transform);
          setHoveredNode(node);
        });

      // Update positions on simulation tick
      simulation.on('tick', draw);

      // Helper function to find node under mouse
      function findNodeUnderMouse(x, y, transform) {
        const invertedPoint = transform.invert([x, y]);
        const radius = 10 / transform.k; // Adjust hit area based on zoom

        return filteredNodes.find(node => {
          const dx = node.x - invertedPoint[0];
          const dy = node.y - invertedPoint[1];
          return dx * dx + dy * dy < radius * radius;
        });
      }

      return () => {
        simulation.stop();
      };
    } catch (err) {
      setError(err.message);
    }
  }, [processedData, selectedWallets, selectedMonths]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#13111C] flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-[#13111C] overflow-hidden">
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
        <div className="absolute p-4 bg-gray-800 text-white rounded-lg shadow-lg pointer-events-none"
             style={{
               left: `${hoveredNode.x}px`,
               top: `${hoveredNode.y + 30}px`
             }}>
          <p>Account: {hoveredNode.id}</p>
          <p>Balance: {hoveredNode.value.toLocaleString()}</p>
          {hoveredNode.isTreasury && <p>Treasury Wallet</p>}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}

export default NodeGraph;
