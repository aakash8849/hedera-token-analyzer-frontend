import React, { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { FA2Layout } from 'graphology-layout-forceatlas2';
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

  useEffect(() => {
    if (!data || !data.nodes || !data.links || !containerRef.current) return;

    // Create and setup graph
    const graph = new Graph();
    graphRef.current = graph;

    // Filter nodes and links
    const filteredNodes = data.nodes.filter(node => !selectedWallets.has(node.id));
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    
    const filteredLinks = data.links.filter(link => {
      return nodeIds.has(link.source) && 
             nodeIds.has(link.target) &&
             !selectedWallets.has(link.source) &&
             !selectedWallets.has(link.target) &&
             filterTransactionsByMonths([{ timestamp: link.timestamp }], selectedMonths).length > 0;
    });

    // Add nodes to graph
    filteredNodes.forEach(node => {
      graph.addNode(node.id, {
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: node.radius,
        color: node.color,
        label: node.id,
        isTreasury: node.isTreasury,
        value: node.value
      });
    });

    // Add edges to graph
    filteredLinks.forEach((link, i) => {
      graph.addEdge(link.source, link.target, {
        size: 1,
        color: link.color || '#42C7FF',
        type: 'arrow'
      });
    });

    // Initialize Sigma
    const sigma = new Sigma(graph, containerRef.current, {
      minCameraRatio: 0.1,
      maxCameraRatio: 4,
      renderEdgeLabels: false,
      defaultEdgeType: 'arrow',
      labelRenderedSizeThreshold: 1,
      labelDensity: 0.07,
      labelGridCellSize: 60,
      nodeHoverColor: 'default',
      defaultNodeColor: '#999',
      defaultEdgeColor: '#42C7FF',
      edgeColor: 'default'
    });
    sigmaRef.current = sigma;

    // Initialize ForceAtlas2 layout
    const layout = new FA2Layout(graph, {
      settings: {
        gravity: 1,
        adjustSizes: true,
        linLogMode: true,
        outboundAttractionDistribution: true,
        strongGravityMode: true,
        slowDown: 10
      }
    });
    layoutRef.current = layout;
    layout.start();

    // Setup event handlers
    sigma.on('enterNode', ({ node }) => {
      const nodeAttributes = graph.getNodeAttributes(node);
      setHoveredNode({
        id: node,
        value: nodeAttributes.value,
        isTreasury: nodeAttributes.isTreasury
      });

      // Highlight connected edges
      graph.forEachEdge((edge, attributes, source, target) => {
        if (source === node || target === node) {
          graph.setEdgeAttribute(edge, 'color', '#FFD700');
          graph.setEdgeAttribute(edge, 'size', 2);
        } else {
          graph.setEdgeAttribute(edge, 'color', '#42C7FF');
          graph.setEdgeAttribute(edge, 'size', 0.5);
        }
      });
    });

    sigma.on('leaveNode', () => {
      setHoveredNode(null);
      // Reset edge styles
      graph.forEachEdge((edge) => {
        graph.setEdgeAttribute(edge, 'color', '#42C7FF');
        graph.setEdgeAttribute(edge, 'size', 1);
      });
    });

    // Enable drag'n'drop
    let draggedNode = null;
    let isDragging = false;

    sigma.on('downNode', (e) => {
      isDragging = true;
      draggedNode = e.node;
      graph.setNodeAttribute(draggedNode, 'highlighted', true);
    });

    sigma.getMouseCaptor().on('mousemovebody', (e) => {
      if (!isDragging || !draggedNode) return;

      // Get new position of node
      const pos = sigma.viewportToGraph(e);
      graph.setNodeAttribute(draggedNode, 'x', pos.x);
      graph.setNodeAttribute(draggedNode, 'y', pos.y);

      // Disable layout when dragging
      if (layoutRef.current?.isRunning()) {
        layoutRef.current.stop();
      }
    });

    sigma.getMouseCaptor().on('mouseup', () => {
      if (draggedNode) {
        graph.setNodeAttribute(draggedNode, 'highlighted', false);
        draggedNode = null;
      }
      isDragging = false;
    });

    return () => {
      if (layoutRef.current?.isRunning()) {
        layoutRef.current.stop();
      }
      sigma.kill();
      graph.clear();
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
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg">
          <p>Account: {hoveredNode.id}</p>
          <p>Balance: {hoveredNode.value.toLocaleString()}</p>
          {hoveredNode.isTreasury && <p>Treasury Wallet</p>}
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default NodeGraph;
