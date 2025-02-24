import React, { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { circular } from 'graphology-layout';
import ForceAtlas2 from 'graphology-layout-forceatlas2';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const containerRef = useRef(null);
  const sigmaRef = useRef(null);
  const graphRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);

  useEffect(() => {
    if (!data?.nodes || !data?.links || !containerRef.current) return;

    // Create graph instance
    const graph = new Graph();
    graphRef.current = graph;

    // Add nodes
    data.nodes.forEach(node => {
      if (!selectedWallets.has(node.id)) {
        graph.addNode(node.id, {
          size: node.radius,
          color: node.color,
          label: node.id,
          x: Math.random() * 1000 - 500,
          y: Math.random() * 1000 - 500,
          balance: node.value,
          isTreasury: node.isTreasury
        });
      }
    });

    // Add edges
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (!selectedWallets.has(sourceId) && 
          !selectedWallets.has(targetId) &&
          graph.hasNode(sourceId) && 
          graph.hasNode(targetId) &&
          filterTransactionsByMonths([{ timestamp: link.timestamp }], selectedMonths).length > 0) {
        try {
          graph.addEdge(sourceId, targetId, {
            size: 2,
            color: link.color || '#42C7FF',
            type: 'arrow'
          });
        } catch (e) {
          // Skip duplicate edges
        }
      }
    });

    // Apply initial circular layout
    circular.assign(graph);

    // Initialize Sigma
    const renderer = new Sigma(graph, containerRef.current, {
      minCameraRatio: 0.1,
      maxCameraRatio: 10,
      renderEdgeLabels: true,
      defaultEdgeType: 'arrow',
      labelSize: 12,
      labelColor: {
        color: '#ffffff'
      },
      nodeColor: node => node.color || '#42C7FF',
      edgeColor: edge => edge.color || '#42C7FF',
      nodeProgramClasses: {},
      labelWeight: 'bold',
      labelThreshold: 5,
      renderLabels: true,
      renderEdges: true,
      enableEdgeHoverEvents: true,
      enableNodeDrag: true,
      hideEdgesOnMove: true
    });

    sigmaRef.current = renderer;

    // Setup force layout
    const layout = new ForceAtlas2({
      settings: {
        gravity: 1,
        strongGravityMode: true,
        scalingRatio: 2,
        slowDown: 2,
        barnesHutOptimize: true,
        barnesHutTheta: 0.5,
        linLogMode: true
      }
    });

    // Start layout
    setIsLayoutRunning(true);
    layout.assign(graph);
    layout.start();

    setTimeout(() => {
      layout.stop();
      setIsLayoutRunning(false);
    }, 3000);

    // Handle node hover
    renderer.on('enterNode', ({ node }) => {
      const attrs = graph.getNodeAttributes(node);
      setHoveredNode({
        id: node,
        value: attrs.balance,
        isTreasury: attrs.isTreasury
      });
    });

    renderer.on('leaveNode', () => {
      setHoveredNode(null);
    });

    // Enable drag'n'drop
    let draggedNode = null;
    let isDragging = false;

    renderer.on('downNode', (e) => {
      isDragging = true;
      draggedNode = e.node;
      graph.setNodeAttribute(draggedNode, 'highlighted', true);
    });

    renderer.on('mouseup', () => {
      if (draggedNode) {
        graph.setNodeAttribute(draggedNode, 'highlighted', false);
      }
      isDragging = false;
      draggedNode = null;
    });

    renderer.getMouseCaptor().on('mousemove', (e) => {
      if (!isDragging || !draggedNode) return;

      // Get new position of node
      const pos = renderer.viewportToGraph(e);
      graph.setNodeAttribute(draggedNode, 'x', pos.x);
      graph.setNodeAttribute(draggedNode, 'y', pos.y);
    });

    return () => {
      if (layout) layout.stop();
      renderer.kill();
    };
  }, [data, selectedWallets, selectedMonths]);

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
      <WalletList 
        wallets={data?.nodes || []}
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
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg z-50">
          <p>Account: {hoveredNode.id}</p>
          <p>Balance: {hoveredNode.value.toLocaleString()}</p>
          {hoveredNode.isTreasury && <p>Treasury Wallet</p>}
        </div>
      )}

      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ cursor: isLayoutRunning ? 'wait' : 'grab' }}
      />
    </div>
  );
}

export default NodeGraph;
