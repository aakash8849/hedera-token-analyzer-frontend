import React, { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
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
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState(null);

  useEffect(() => {
    if (!data?.nodes || !data?.links || !containerRef.current) return;

    // Create and configure the graph
    const graph = new Graph();
    graphRef.current = graph;

    // Add nodes
    data.nodes.forEach(node => {
      if (!selectedWallets.has(node.id)) {
        graph.addNode(node.id, {
          x: Math.random(),
          y: Math.random(),
          size: node.radius,
          color: node.color,
          label: node.id,
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
            size: 1,
            color: link.color || '#42C7FF'
          });
        } catch (e) {
          // Skip duplicate edges
        }
      }
    });

    // Create and configure Sigma instance
    const renderer = new Sigma(graph, containerRef.current, {
      minCameraRatio: 0.1,
      maxCameraRatio: 10,
      labelColor: {
        color: '#fff'
      },
      labelSize: 12,
      labelWeight: 'bold',
      renderEdgeLabels: false,
      defaultEdgeColor: '#42C7FF',
      nodeReducer: (node, data) => ({
        ...data,
        highlighted: hoveredNode === node,
        label: data.isTreasury ? `${node} (Treasury)` : node,
        size: data.size * (hoveredNode === node ? 1.5 : 1)
      })
    });

    sigmaRef.current = renderer;

    // Mouse interactions
    renderer.on('downNode', (e) => {
      setIsDragging(true);
      setDraggedNode(e.node);
      graph.setNodeAttribute(e.node, 'highlighted', true);
    });

    renderer.on('mouseup', () => {
      if (draggedNode) {
        graph.setNodeAttribute(draggedNode, 'highlighted', false);
      }
      setIsDragging(false);
      setDraggedNode(null);
    });

    renderer.on('mousemove', (e) => {
      if (!isDragging || !draggedNode) return;

      // Get new position of node
      const pos = renderer.viewportToGraph(e);
      graph.setNodeAttribute(draggedNode, 'x', pos.x);
      graph.setNodeAttribute(draggedNode, 'y', pos.y);

      e.preventSigmaDefault();
      e.original.preventDefault();
      e.original.stopPropagation();
    });

    // Node hover
    renderer.on('enterNode', ({ node }) => {
      const nodeAttributes = graph.getNodeAttributes(node);
      setHoveredNode({
        id: node,
        value: nodeAttributes.balance,
        isTreasury: nodeAttributes.isTreasury
      });
    });

    renderer.on('leaveNode', () => {
      setHoveredNode(null);
    });

    // Start layout
    const layout = new ForceAtlas2({
      settings: {
        gravity: 1,
        scalingRatio: 4,
        strongGravityMode: true,
        slowDown: 2
      }
    });

    layout.assign(graph);
    layout.start();
    setIsLayoutRunning(true);

    setTimeout(() => {
      layout.stop();
      setIsLayoutRunning(false);
    }, 3000);

    return () => {
      layout.stop();
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
