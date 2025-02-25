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
  const isDragging = useRef(false);
  const dragTarget = useRef(null);
  const viewOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!data || !data.nodes || !data.links) return;

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
        .strength(-200))
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide().radius(d => d.radius * 1.2))
      .on('tick', tick);

    createSprites();
    setupInteraction();

    // Handle window resize
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      pixiApp.current.renderer.resize(newWidth, newHeight);
      nodesContainer.current.position.set(newWidth / 2 + viewOffset.current.x, newHeight / 2 + viewOffset.current.y);
      linksContainer.current.position.set(newWidth / 2 + viewOffset.current.x, newHeight / 2 + viewOffset.current.y);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      simulation.current.stop();
      pixiApp.current.destroy(true);
      nodeSprites.current.clear();
      linkSprites.current.clear();
    };
  }, [data]);

  useEffect(() => {
    if (!data) return;

    const filteredLinks = filterTransactionsByMonths(data.links, selectedMonths);
    const activeNodes = new Set();
    
    filteredLinks.forEach(link => {
      activeNodes.add(typeof link.source === 'object' ? link.source.id : link.source);
      activeNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
    });

    nodeSprites.current.forEach((sprite, id) => {
      sprite.alpha = selectedWallets.size === 0 || selectedWallets.has(id) ? 1 : 0.2;
    });

    linkSprites.current.forEach((sprite, i) => {
      const link = data.links[i];
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      const isVisible = (selectedWallets.size === 0 || 
        selectedWallets.has(sourceId) || 
        selectedWallets.has(targetId)) &&
        filteredLinks.includes(link);
      
      sprite.alpha = isVisible ? 0.6 : 0.1;
    });
  }, [selectedMonths, selectedWallets, data]);

  function createSprites() {
    data.links.forEach((link, i) => {
      const graphics = new PIXI.Graphics();
      graphics.lineStyle(1, 0x42C7FF, 0.6);
      linkSprites.current.set(i, graphics);
      linksContainer.current.addChild(graphics);
    });

    data.nodes.forEach(node => {
      const graphics = new PIXI.Graphics();
      graphics.beginFill(parseInt(node.color.replace('#', '0x')));
      graphics.lineStyle(node.isTreasury ? 3 : 1, 0xFFFFFF);
      graphics.drawCircle(0, 0, node.radius);
      graphics.endFill();

      graphics.interactive = true;
      graphics.buttonMode = true;
      graphics.node = node;

      graphics
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove)
        .on('pointerover', () => onNodeHover(node))
        .on('pointerout', onNodeUnhover);

      nodeSprites.current.set(node.id, graphics);
      nodesContainer.current.addChild(graphics);

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
    data.links.forEach((link, i) => {
      const graphics = linkSprites.current.get(i);
      graphics.clear();
      graphics.lineStyle(1, 0x42C7FF, 0.6);
      graphics.moveTo(link.source.x, link.source.y);
      graphics.lineTo(link.target.x, link.target.y);
    });

    data.nodes.forEach(node => {
      const sprite = nodeSprites.current.get(node.id);
      if (sprite) {
        sprite.position.set(node.x, node.y);
      }
    });
  }

  function onDragStart(event) {
    isDragging.current = true;
    dragTarget.current = this;
    this.dragData = event.data;
    this.dragging = true;
    
    if (this.node) {
      // Node dragging
      this.node.fx = this.node.x;
      this.node.fy = this.node.y;
      simulation.current.alphaTarget(0.3).restart();
    } else {
      // Background dragging
      this.dragStartPosition = event.data.getLocalPosition(this.parent);
    }
  }

  function onDragMove(event) {
    if (!isDragging.current) return;

    if (dragTarget.current?.node) {
      // Node dragging
      const newPosition = event.data.getLocalPosition(dragTarget.current.parent);
      dragTarget.current.node.fx = newPosition.x;
      dragTarget.current.node.fy = newPosition.y;
    } else if (dragTarget.current) {
      // Background dragging
      const newPosition = event.data.getLocalPosition(dragTarget.current.parent);
      const dx = newPosition.x - dragTarget.current.dragStartPosition.x;
      const dy = newPosition.y - dragTarget.current.dragStartPosition.y;
      
      viewOffset.current.x += dx;
      viewOffset.current.y += dy;
      
      nodesContainer.current.position.x += dx;
      nodesContainer.current.position.y += dy;
      linksContainer.current.position.x += dx;
      linksContainer.current.position.y += dy;
      
      dragTarget.current.dragStartPosition = newPosition;
    }
  }

  function onDragEnd() {
    isDragging.current = false;
    if (dragTarget.current?.node) {
      dragTarget.current.node.fx = null;
      dragTarget.current.node.fy = null;
      simulation.current.alphaTarget(0);
    }
    dragTarget.current = null;
  }

  function onNodeHover(node) {
    setHoveredNode(node);
    const sprite = nodeSprites.current.get(node.id);
    sprite.alpha = 1;

    data.links.forEach((link, i) => {
      const graphics = linkSprites.current.get(i);
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === node.id || targetId === node.id) {
        graphics.alpha = 1;
      } else {
        graphics.alpha = 0.1;
      }
    });
  }

  function onNodeUnhover() {
    setHoveredNode(null);
    nodeSprites.current.forEach((sprite, id) => {
      sprite.alpha = selectedWallets.size === 0 || selectedWallets.has(id) ? 1 : 0.2;
    });
    linkSprites.current.forEach(graphics => {
      graphics.alpha = 0.6;
    });
  }

  function setupInteraction() {
    const background = new PIXI.Graphics();
    background.beginFill(0x000000, 0);
    background.drawRect(0, 0, window.innerWidth, window.innerHeight);
    background.endFill();
    background.interactive = true;
    
    background
      .on('pointerdown', onDragStart)
      .on('pointerup', onDragEnd)
      .on('pointerupoutside', onDragEnd)
      .on('pointermove', onDragMove);
    
    pixiApp.current.stage.addChildAt(background, 0);
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
