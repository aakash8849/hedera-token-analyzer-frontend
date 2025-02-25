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
  const zoomLevel = useRef(1);

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
      autoDensity: true,
    });

    containerRef.current.appendChild(pixiApp.current.view);

    // Create containers for links and nodes
    linksContainer.current = new PIXI.Container();
    nodesContainer.current = new PIXI.Container();
    
    // Add containers to stage in correct order
    pixiApp.current.stage.addChild(linksContainer.current);
    pixiApp.current.stage.addChild(nodesContainer.current);

    // Center the view
    nodesContainer.current.position.set(width / 2, height / 2);
    linksContainer.current.position.set(width / 2, height / 2);

    // Create force simulation with improved forces from second implementation
    simulation.current = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody()
        .strength(-300))
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide().radius(d => d.radius * 1.2))
      .force('x', d3.forceX().strength(0.07))
      .force('y', d3.forceY().strength(0.07))
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
    
    // Add wheel listener for zoom
    containerRef.current.addEventListener('wheel', handleWheel);

    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current.removeEventListener('wheel', handleWheel);
      simulation.current.stop();
      pixiApp.current.destroy(true);
      nodeSprites.current.clear();
      linkSprites.current.clear();
    };
  }, [data]);

  // Apply filtering based on selected wallets and months
  useEffect(() => {
    if (!data) return;

    const filteredLinks = filterTransactionsByMonths(data.links, selectedMonths);
    const activeNodes = new Set();
    
    // Collect all active node IDs from filtered links
    filteredLinks.forEach(link => {
      activeNodes.add(typeof link.source === 'object' ? link.source.id : link.source);
      activeNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
    });

    // Update node visibility based on selection
    nodeSprites.current.forEach((sprite, id) => {
      const isVisible = (selectedWallets.size === 0 || !selectedWallets.has(id)) && 
                        activeNodes.has(id);
      sprite.alpha = isVisible ? 1 : 0.2;
    });

    // Update link visibility based on selection and time filter
    linkSprites.current.forEach((sprite, i) => {
      const link = data.links[i];
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      const isVisible = (selectedWallets.size === 0 || 
                        (!selectedWallets.has(sourceId) && !selectedWallets.has(targetId))) &&
                        filteredLinks.includes(link);
      
      sprite.alpha = isVisible ? 0.6 : 0.1;
    });
  }, [selectedMonths, selectedWallets, data]);

  function createSprites() {
    // Create link sprites with arrow markers
    data.links.forEach((link, i) => {
      const graphics = new PIXI.Graphics();
      graphics.lineStyle(1, 0x42C7FF, 0.6);
      
      // Add arrow marker (will be positioned in tick function)
      const arrowSize = 6;
      graphics.beginFill(0x42C7FF);
      graphics.moveTo(-arrowSize, -arrowSize/2);
      graphics.lineTo(0, 0);
      graphics.lineTo(-arrowSize, arrowSize/2);
      graphics.endFill();
      
      linkSprites.current.set(i, graphics);
      linksContainer.current.addChild(graphics);
    });

    // Create node sprites with improved visuals
    data.nodes.forEach(node => {
      const graphics = new PIXI.Graphics();
      
      // Draw circle with glow effect for treasury
      const color = parseInt(node.color.replace('#', '0x'));
      graphics.beginFill(color, 0.8);
      graphics.lineStyle(node.isTreasury ? 3 : 1, node.isTreasury ? 0xFFD700 : 0xFFFFFF);
      graphics.drawCircle(0, 0, node.radius);
      graphics.endFill();

      // Make node interactive
      graphics.interactive = true;
      graphics.buttonMode = true;
      graphics.node = node;

      // Set up event handlers
      graphics
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove)
        .on('pointerover', () => onNodeHover(node))
        .on('pointerout', onNodeUnhover);

      nodeSprites.current.set(node.id, graphics);
      nodesContainer.current.addChild(graphics);

      // Add label for large wallets
      if (node.value > (data.totalSupply * 0.01 || 0)) {
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
    // Update link positions and arrow markers
    data.links.forEach((link, i) => {
      const graphics = linkSprites.current.get(i);
      if (!graphics) return;
      
      graphics.clear();
      
      if (!link.source.x || !link.target.x) return;
      
      // Draw line
      graphics.lineStyle(1, 0x42C7FF, 0.6);
      graphics.moveTo(link.source.x, link.source.y);
      graphics.lineTo(link.target.x, link.target.y);
      
      // Calculate and position arrow
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const angle = Math.atan2(dy, dx);
      const targetRadius = link.target.radius || 5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > targetRadius) {
        const arrowX = link.target.x - Math.cos(angle) * targetRadius;
        const arrowY = link.target.y - Math.sin(angle) * targetRadius;
        
        graphics.beginFill(0x42C7FF);
        graphics.moveTo(arrowX, arrowY);
        graphics.lineTo(
          arrowX - 10 * Math.cos(angle) + 6 * Math.sin(angle),
          arrowY - 10 * Math.sin(angle) - 6 * Math.cos(angle)
        );
        graphics.lineTo(
          arrowX - 10 * Math.cos(angle) - 6 * Math.sin(angle),
          arrowY - 10 * Math.sin(angle) + 6 * Math.cos(angle)
        );
        graphics.closePath();
        graphics.endFill();
      }
    });

    // Update node positions
    data.nodes.forEach(node => {
      const sprite = nodeSprites.current.get(node.id);
      if (sprite && node.x !== undefined && node.y !== undefined) {
        sprite.position.set(node.x, node.y);
      }
    });
  }

  function handleWheel(event) {
    event.preventDefault();
    
    // Calculate new zoom level
    const delta = event.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoomLevel.current * delta, 0.1), 4);
    const zoomFactor = newZoom / zoomLevel.current;
    zoomLevel.current = newZoom;
    
    // Get mouse position relative to container
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate container center offset
    const containerCenterX = nodesContainer.current.position.x;
    const containerCenterY = nodesContainer.current.position.y;
    
    // Calculate mouse position relative to container center
    const relativeX = mouseX - containerCenterX;
    const relativeY = mouseY - containerCenterY;
    
    // Apply zoom
    nodesContainer.current.scale.set(newZoom);
    linksContainer.current.scale.set(newZoom);
    
    // Adjust position to zoom toward mouse pointer
    const newX = containerCenterX - relativeX * (zoomFactor - 1);
    const newY = containerCenterY - relativeY * (zoomFactor - 1);
    
    nodesContainer.current.position.set(newX, newY);
    linksContainer.current.position.set(newX, newY);
    
    viewOffset.current = {
      x: newX - window.innerWidth / 2,
      y: newY - window.innerHeight / 2
    };
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
    if (sprite) {
      sprite.alpha = 1;
      // Increase stroke width on hover
      sprite.clear();
      sprite.beginFill(parseInt(node.color.replace('#', '0x')), 0.8);
      sprite.lineStyle(node.isTreasury ? 4 : 2, node.isTreasury ? 0xFFD700 : 0xFFFFFF);
      sprite.drawCircle(0, 0, node.radius);
      sprite.endFill();
    }

    // Highlight connected links
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
    if (!hoveredNode) return;
    
    const node = hoveredNode;
    setHoveredNode(null);
    
    // Reset node appearance
    const sprite = nodeSprites.current.get(node.id);
    if (sprite) {
      sprite.clear();
      sprite.beginFill(parseInt(node.color.replace('#', '0x')), 0.8);
      sprite.lineStyle(node.isTreasury ? 3 : 1, node.isTreasury ? 0xFFD700 : 0xFFFFFF);
      sprite.drawCircle(0, 0, node.radius);
      sprite.endFill();
      
      sprite.alpha = selectedWallets.size === 0 || !selectedWallets.has(node.id) ? 1 : 0.2;
    }
    
    // Reset link appearance
    linkSprites.current.forEach((graphics, i) => {
      const link = data.links[i];
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      const isVisible = (selectedWallets.size === 0 || 
        (!selectedWallets.has(sourceId) && !selectedWallets.has(targetId))) &&
        filterTransactionsByMonths([link], selectedMonths).length > 0;
      
      graphics.alpha = isVisible ? 0.6 : 0.1;
    });
  }

  function setupInteraction() {
    // Create transparent background for panning
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
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg z-10">
          <p className="font-bold">Account: {hoveredNode.id}</p>
          <p>Balance: {hoveredNode.value.toLocaleString()}</p>
          {hoveredNode.isTreasury && (
            <p className="text-yellow-300 font-bold">Treasury Wallet</p>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-70 text-white p-2 rounded-lg text-sm">
        <p>Scroll to zoom • Drag to pan • Click nodes to inspect</p>
      </div>
    </div>
  );
}

export default NodeGraph;
