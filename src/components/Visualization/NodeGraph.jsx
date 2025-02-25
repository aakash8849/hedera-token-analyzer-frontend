import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as PIXI from 'pixi.js';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const containerRef = useRef(null);
  const pixiApp = useRef(null);
  const simulation = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [hoveredNode, setHoveredNode] = useState(null);
  const nodesContainer = useRef(null);
  const linksContainer = useRef(null);
  const nodeSprites = useRef(new Map());
  const linkSprites = useRef(new Map());

  useEffect(() => {
    if (!data || !data.nodes || !data.links) return;

    // Initialize PIXI Application
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    pixiApp.current = new PIXI.Application({
      width,
      height,
      backgroundColor: 0x13111C,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    });

    containerRef.current.appendChild(pixiApp.current.view);

    // Create containers for nodes and links
    nodesContainer.current = new PIXI.Container();
    linksContainer.current = new PIXI.Container();
    pixiApp.current.stage.addChild(linksContainer.current);
    pixiApp.current.stage.addChild(nodesContainer.current);

    // Center the view
    nodesContainer.current.position.set(width / 2, height / 2);
    linksContainer.current.position.set(width / 2, height / 2);

    // Create force simulation
    simulation.current = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody()
        .strength(-300))
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide()
        .radius(d => d.radius * 1.2))
      .on('tick', tick);

    // Create nodes and links
    createSprites();

    // Setup interaction
    setupInteraction();

    // Setup zoom and pan
    setupZoom();

    return () => {
      simulation.current.stop();
      pixiApp.current.destroy(true);
      nodeSprites.current.clear();
      linkSprites.current.clear();
    };
  }, [data]);

  function createSprites() {
    // Create links
    data.links.forEach((link, i) => {
      const graphics = new PIXI.Graphics();
      graphics.lineStyle(1, 0x42C7FF, 0.6);
      linkSprites.current.set(i, graphics);
      linksContainer.current.addChild(graphics);
    });

    // Create nodes
    data.nodes.forEach(node => {
      // Create circle
      const graphics = new PIXI.Graphics();
      graphics.beginFill(parseInt(node.color.replace('#', '0x')));
      graphics.lineStyle(node.isTreasury ? 3 : 1, 0xFFFFFF);
      graphics.drawCircle(0, 0, node.radius);
      graphics.endFill();

      // Add interactivity
      graphics.interactive = true;
      graphics.buttonMode = true;
      graphics.node = node;

      // Setup drag behavior
      graphics
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove)
        .on('pointerover', () => onNodeHover(node))
        .on('pointerout', onNodeUnhover);

      nodeSprites.current.set(node.id, graphics);
      nodesContainer.current.addChild(graphics);

      // Add label for significant nodes
      if (node.value > data.totalSupply * 0.01) {
        const label = new PIXI.Text(node.id, {
          fontSize: 10,
          fill: 0xFFFFFF,
          align: 'center'
        });
        label.anchor.set(0.5);
        label.position.y = -node.radius - 10;
        graphics.addChild(label);
      }
    });
  }

  function tick() {
    // Update link positions
    data.links.forEach((link, i) => {
      const graphics = linkSprites.current.get(i);
      graphics.clear();
      graphics.lineStyle(1, 0x42C7FF, 0.6);
      graphics.moveTo(link.source.x, link.source.y);
      graphics.lineTo(link.target.x, link.target.y);
    });

    // Update node positions
    data.nodes.forEach(node => {
      const sprite = nodeSprites.current.get(node.id);
      if (sprite) {
        sprite.position.set(node.x, node.y);
      }
    });
  }

  let dragTarget = null;
  let dragStartPosition = null;

  function onDragStart(event) {
    dragTarget = this;
    dragStartPosition = event.data.getLocalPosition(this.parent);
    dragTarget.node.fx = dragTarget.node.x;
    dragTarget.node.fy = dragTarget.node.y;
    simulation.current.alphaTarget(0.3).restart();
  }

  function onDragMove(event) {
    if (dragTarget) {
      const newPosition = event.data.getLocalPosition(dragTarget.parent);
      dragTarget.node.fx = newPosition.x;
      dragTarget.node.fy = newPosition.y;
    }
  }

  function onDragEnd() {
    if (dragTarget) {
      dragTarget.node.fx = null;
      dragTarget.node.fy = null;
      dragTarget = null;
      simulation.current.alphaTarget(0);
    }
  }

  function onNodeHover(node) {
    setHoveredNode(node);
    const sprite = nodeSprites.current.get(node.id);
    sprite.alpha = 1;

    // Highlight connected links
    data.links.forEach((link, i) => {
      const graphics = linkSprites.current.get(i);
      if (link.source.id === node.id || link.target.id === node.id) {
        graphics.alpha = 1;
      } else {
        graphics.alpha = 0.1;
      }
    });
  }

  function onNodeUnhover() {
    setHoveredNode(null);
    // Reset all opacities
    nodeSprites.current.forEach(sprite => sprite.alpha = 0.8);
    linkSprites.current.forEach(graphics => graphics.alpha = 0.6);
  }

  function setupZoom() {
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        nodesContainer.current.scale.set(event.transform.k);
        linksContainer.current.scale.set(event.transform.k);
        nodesContainer.current.position.set(
          event.transform.x + window.innerWidth / 2,
          event.transform.y + window.innerHeight / 2
        );
        linksContainer.current.position.set(
          event.transform.x + window.innerWidth / 2,
          event.transform.y + window.innerHeight / 2
        );
      });

    d3.select(pixiApp.current.view).call(zoom);
  }

  function setupInteraction() {
    pixiApp.current.stage.interactive = true;
    pixiApp.current.stage.hitArea = new PIXI.Rectangle(0, 0, window.innerWidth, window.innerHeight);
  }

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      
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
    </div>
  );
}

export default NodeGraph;
