import React, { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { circular } from 'graphology-layout';
import FA2Layout from 'graphology-layout-forceatlas2';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const containerRef = useRef(null);
  const sigmaRef = useRef(null);
  const graphRef = useRef(null);
  const layoutRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);

  useEffect(() => {
    if (!data || !data.nodes || !data.links || !containerRef.current) return;

    // Create graph instance
    const graph = new Graph();
    graphRef.current = graph;

    // Add nodes
    data.nodes.forEach(node => {
      if (!selectedWallets.has(node.id)) {
        graph.addNode(node.id, {
          x: Math.random() * 1000 - 500,
          y: Math.random() * 1000 - 500,
          size: node.radius / 2,
          color: node.color,
          label: node.id,
          balance: node.value,
          isTreasury: node.isTreasury
        });
      }
    });

    // Add edges (links)
    data.links.forEach((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (!selectedWallets.has(sourceId) && 
          !selectedWallets.has(targetId) &&
          graph.hasNode(sourceId) && 
          graph.hasNode(targetId) &&
          filterTransactionsByMonths([{ timestamp: link.timestamp }], selectedMonths).length > 0) {
        try {
          graph.addEdge(sourceId, targetId, {
            color: link.color || '#42C7FF',
            size: 1,
            type: 'arrow'
          });
        } catch (e) {
          // Skip duplicate edges
          console.debug('Skipping duplicate edge:', e.message);
        }
      }
    });

    // Initialize Sigma
    const sigma = new Sigma(graph, containerRef.current, {
      minCameraRatio: 0.1,
      maxCameraRatio: 10,
      renderEdgeLabels: false,
      defaultEdgeColor: '#42C7FF',
      defaultEdgeType: 'arrow',
      labelColor: {
        color: '#ffffff'
      },
      labelSize: 12,
      labelWeight: 'bold',
      nodeReducer: (node, data) => ({
        ...data,
        highlighted: hoveredNode === node,
        label: data.isTreasury ? `${node} (Treasury)` : node,
        size: data.size * (hoveredNode === node ? 1.5 : 1)
      }),
      edgeReducer: (edge, data) => ({
        ...data,
        hidden: hoveredNode && 
               !graph.hasExtremity(edge, hoveredNode) &&
               !graph.hasExtremity(edge, hoveredNode)
      })
    });

    sigmaRef.current = sigma;

    // Enable drag'n'drop
    let draggedNode = null;
    let isDragging = false;

    sigma.on('downNode', (e) => {
      isDragging = true;
      draggedNode = e.node;
      graph.setNodeAttribute(draggedNode, 'highlighted', true);
    });

    sigma.on('mouseup', () => {
      if (draggedNode) {
        graph.setNodeAttribute(draggedNode, 'highlighted', false);
      }
      isDragging = false;
      draggedNode = null;
    });

    sigma.on('mousedown', () => {
      // Disable camera drag while dragging a node
      if (!draggedNode) sigma.getCamera().disable();
    });

    sigma.on('mousemove', (e) => {
      if (!isDragging || !draggedNode) return;

      // Get new position of node
      const pos = sigma.viewportToGraph(e);
      graph.setNodeAttribute(draggedNode, 'x', pos.x);
      graph.setNodeAttribute(draggedNode, 'y', pos.y);

      // Prevent sigma from moving the camera
      e.preventSigmaDefault();
      e.original.preventDefault();
      e.original.stopPropagation();
    });

    // Setup hover events
    sigma.on('enterNode', ({ node }) => {
      const nodeAttributes = graph.getNodeAttributes(node);
      setHoveredNode({
        id: node,
        value: nodeAttributes.balance,
        isTreasury: nodeAttributes.isTreasury
      });
      graph.setNodeAttribute(node, 'highlighted', true);
    });

    sigma.on('leaveNode', ({ node }) => {
      setHoveredNode(null);
      graph.setNodeAttribute(node, 'highlighted', false);
    });

    // Start ForceAtlas2 layout
    const sensibleSettings = {
      settings: {
        gravity: 1,
        scalingRatio: 4,
        strongGravityMode: true,
        slowDown: 2,
        barnesHutOptimize: true,
        barnesHutTheta: 0.5,
        adjustSizes: true
      }
    };

    setIsLayoutRunning(true);
    layoutRef.current = new FA2Layout(graph, sensibleSettings);
    layoutRef.current.start();

    setTimeout(() => {
      layoutRef.current.stop();
      setIsLayoutRunning(false);
    }, 3000);

    return () => {
      if (layoutRef.current) {
        layoutRef.current.stop();
      }
      if (sigmaRef.current) {
        sigmaRef.current.kill();
      }
    };
  }, [data, selectedWallets, selectedMonths]);

  const handleWalletToggle = (wallet) => {
    const newSelected = new Set(selectedWallets);
    if (newSelected.has(wallet.id)) {
      newSelected.delete(wallet.id);
    } else {
      newSelected.add(wallet.id);
    }
    setSelectedWallets(newSelected);
  };

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
      <WalletList 
        wallets={data?.nodes || []}
        selectedWallets={selectedWallets}
        onWalletToggle={handleWalletToggle}
      />

      <div className="absolute top-4 right-4 flex items-center space-x-4">
        <TimeFilter value={selectedMonths} onChange={setSelectedMonths} />
        <button
          onClick={() => {
            if (layoutRef.current) {
              if (isLayoutRunning) {
                layoutRef.current.stop();
                setIsLayoutRunning(false);
              } else {
                setIsLayoutRunning(true);
                layoutRef.current.start();
              }
            }
          }}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
        >
          {isLayoutRunning ? 'Stop Layout' : 'Start Layout'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
        >
          Back
        </button>
      </div>

      {hoveredNode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg z-50">
          <p>Account: {hoveredNode.id}</p>
          <p>Balance: {hoveredNode.value.toLocaleString()}</p>
          {hoveredNode.isTreasury && <p>Treasury Wallet</p>}
        </div>
      )}

      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isLayoutRunning ? 0.5 : 1,
          transition: 'opacity 0.3s'
        }}
      />
    </div>
  );
}

export default NodeGraph;
