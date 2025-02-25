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
  const zoomContainer = useRef(null);
  const currentZoom = useRef({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    if (!data || !data.nodes || !data.links) return;

    // Set up PIXI application
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

    // Create container structure for zoom
    zoomContainer = new PIXI.Container();
    pixiApp.current.stage.addChild(zoomContainer);
    
    linksContainer.current = new PIXI.Container();
    nodesContainer.current = new PIXI.Container();
    zoomContainer.addChild(linksContainer.current);
    zoomContainer.addChild(nodesContainer.current);

    // Initial position at center
    zoomContainer.position.set(width / 2, height / 2);

    // Create visual elements
    createSprites();
    
    // Set up D3 force simulation
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

    // Set up zoom and pan using PIXI interaction
    setupZoomAndPan();

    // Handle window resize
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      pixiApp.current.renderer.resize(newWidth, newHeight);
      
      // Adjust center position while maintaining zoom
      zoomContainer.position.set(
        newWidth / 2 + currentZoom.current.x,
        newHeight / 2 + currentZoom.current.y
      );
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

  // Effect for filtering based on selected wallets and time
  useEffect(() => {
    if (!data) return;

    // Filter links based on time
    const filteredLinks = filterTransactionsByMonths(data.links, selectedMonths);
    
    // Filter nodes and links exactly like in the second file
    const filteredNodes = data.nodes.filter(node => !selectedWallets.has(node.id));
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Update node visibility
    nodeSprites.current.forEach((sprite, id) => {
      sprite.visible = !selectedWallets.has(id);
      sprite.alpha = !selectedWallets.has(id) ? 1 : 0.2;
    });

    // Update link visibility
    linkSprites.current.forEach((sprite, i) => {
      const link = data.links[i];
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      const isVisible = !selectedWallets.has(sourceId) && 
                        !selectedWallets.has(targetId) && 
                        filteredLinks.includes(link);
      
      sprite.visible = isVisible;
      sprite.alpha = isVisible ? 0.6 : 0.1;
    });
    
    // Restart simulation with filtered nodes
    simulation.current.nodes(filteredNodes);
    simulation.current.force('link').links(
      filteredLinks.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return !selectedWallets.has(sourceId) && !selectedWallets.has(targetId);
      })
    );
    simulation.current.alpha(0.3).restart();
    
  }, [selectedMonths, selectedWallets, data]);

  function createSprites() {
    // Create links as lines with arrow markers
    data.links.forEach((link, i) => {
      const graphics = new PIXI.Graphics();
      graphics.lineStyle(1, 0x42C7FF, 0.6);
      graphics.link = link; // Store reference to the link data
      
      linkSprites.current.set(i, graphics);
      linksContainer.current.addChild(graphics);
    });

    // Create nodes as circles with labels
    data.nodes.forEach(node => {
      const container = new PIXI.Container();
      
      // Main circle
      const circle = new PIXI.Graphics();
      const color = parseInt(node.color.replace('#', '0x'));
      circle.beginFill(color, 0.8);
      circle.lineStyle(node.isTreasury ? 3 : 1, node.isTreasury ? 0xFFD700 : 0xFFFFFF);
      circle.drawCircle(0, 0, node.radius);
      circle.endFill();
      
      container.addChild(circle);
      
      // Add label for significant wallets
      if (node.value > (data.totalSupply * 0.01)) {
        const label = new PIXI.Text(node.id, {
          fontSize: 10,
          fill: 0xFFFFFF,
          align: 'center'
        });
        label.anchor.set(0.5);
        label.position.y = -node.radius - 10;
        container.addChild(label);
      }
      
      // Set up interactivity
      container.interactive = true;
      container.buttonMode = true;
      container.node = node;
      
      container
        .on('pointerdown', onNodeDragStart)
        .on('pointerup', onNodeDragEnd)
        .on('pointerupoutside', onNodeDragEnd)
        .on('pointermove', onNodeDragMove)
        .on('pointerover', () => onNodeHover(node))
        .on('pointerout', onNodeUnhover);
      
      nodeSprites.current.set(node.id, container);
      nodesContainer.current.addChild(container);
    });
  }

  function tick() {
    // Update link positions
    linkSprites.current.forEach((graphics, i) => {
      const link = data.links[i];
      
      if (!link.source.x || !link.target.x) return;
      
      graphics.clear();
      graphics.lineStyle(1, 0x42C7FF, 0.6);
      
      // Draw the line
      graphics.moveTo(link.source.x, link.source.y);
      graphics.lineTo(link.target.x, link.target.y);
      
      // Add arrow marker
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const targetRadius = link.target.radius || 10;
      
      if (distance > targetRadius) {
        // Position arrow at the edge of target node
        const arrowX = link.target.x - Math.cos(angle) * targetRadius;
        const arrowY = link.target.y - Math.sin(angle) * targetRadius;
        
        // Draw arrow
        graphics.beginFill(0x42C7FF);
        graphics.drawPolygon([
          arrowX, arrowY,
          arrowX - 10 * Math.cos(angle) + 6 * Math.sin(angle),
          arrowY - 10 * Math.sin(angle) - 6 * Math.cos(angle),
          arrowX - 10 * Math.cos(angle) - 6 * Math.sin(angle),
          arrowY - 10 * Math.sin(angle) + 6 * Math.cos(angle)
        ]);
        graphics.endFill();
      }
    });

    // Update node positions
    nodeSprites.current.forEach((container, id) => {
      const node = data.nodes.find(n => n.id === id);
      if (node && node.x !== undefined && node.y !== undefined) {
        container.position.set(node.x, node.y);
      }
    });
  }

  function setupZoomAndPan() {
    // Create a background for dragging the entire view
    const background = new PIXI.Graphics();
    background.beginFill(0x000000, 0);
    background.drawRect(-10000, -10000, 20000, 20000);
    background.endFill();
    background.interactive = true;
    pixiApp.current.stage.addChildAt(background, 0);
    
    // Background drag events
    let isDragging = false;
    let startPosition = null;
    
    background
      .on('pointerdown', (event) => {
        isDragging = true;
        startPosition = event.data.getLocalPosition(pixiApp.current.stage);
      })
      .on('pointermove', (event) => {
        if (!isDragging) return;
        
        const newPosition = event.data.getLocalPosition(pixiApp.current.stage);
        const dx = newPosition.x - startPosition.x;
        const dy = newPosition.y - startPosition.y;
        
        zoomContainer.position.x += dx;
        zoomContainer.position.y += dy;
        
        // Update the current transformation
        currentZoom.current.x += dx;
        currentZoom.current.y += dy;
        
        startPosition = newPosition;
      })
      .on('pointerup', () => {
        isDragging = false;
      })
      .on('pointerupoutside', () => {
        isDragging = false;
      });
    
    // Add wheel zoom behavior
    const onWheel = (event) => {
      event.preventDefault();
      
      // Get position before zoom
      const mouseLocalPos = {
        x: event.clientX - pixiApp.current.view.getBoundingClientRect().left,
        y: event.clientY - pixiApp.current.view.getBoundingClientRect().top
      };
      
      // Calculate the world position under the mouse
      const worldPos = {
        x: (mouseLocalPos.x - zoomContainer.position.x) / zoomContainer.scale.x,
        y: (mouseLocalPos.y - zoomContainer.position.y) / zoomContainer.scale.y
      };
      
      // Calculate new scale with limits
      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(Math.max(zoomContainer.scale.x * zoomFactor, 0.1), 4);
      
      // Update scale
      zoomContainer.scale.set(newScale);
      
      // Calculate position after zoom to keep the mouse position fixed
      zoomContainer.position.x = mouseLocalPos.x - worldPos.x * newScale;
      zoomContainer.position.y = mouseLocalPos.y - worldPos.y * newScale;
      
      // Update current transformation
      currentZoom.current.k = newScale;
      currentZoom.current.x = zoomContainer.position.x - window.innerWidth / 2;
      currentZoom.current.y = zoomContainer.position.y - window.innerHeight / 2;
    };
    
    pixiApp.current.view.addEventListener('wheel', onWheel);
  }

  function onNodeDragStart(event) {
    // Store initial data
    this.dragging = true;
    this.dragData = event.data;
    
    // Set initial fixed position for D3
    this.node.fx = this.node.x;
    this.node.fy = this.node.y;
    
    // Heat up the simulation
    simulation.current.alphaTarget(0.3).restart();
  }

  function onNodeDragMove(event) {
    if (!this.dragging) return;
    
    // Get new position
    const newPosition = this.dragData.getLocalPosition(this.parent);
    
    // Update node fixed position
    this.node.fx = newPosition.x;
    this.node.fy = newPosition.y;
  }

  function onNodeDragEnd() {
    this.dragging = false;
    this.dragData = null;
    
    // Release the node
    this.node.fx = null;
    this.node.fy = null;
    
    // Cool down the simulation
    simulation.current.alphaTarget(0);
  }

  function onNodeHover(node) {
    setHoveredNode(node);
    
    // Highlight the node
    const nodeSprite = nodeSprites.current.get(node.id);
    if (nodeSprite) {
      const circle = nodeSprite.children[0]; // Get the circle graphics
      circle.clear();
      circle.beginFill(parseInt(node.color.replace('#', '0x')), 1);
      circle.lineStyle(node.isTreasury ? 4 : 2, node.isTreasury ? 0xFFD700 : 0xFFFFFF);
      circle.drawCircle(0, 0, node.radius);
      circle.endFill();
    }
    
    // Highlight connected links
    linkSprites.current.forEach((sprite, i) => {
      const link = data.links[i];
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === node.id || targetId === node.id) {
        sprite.alpha = 1;
      } else {
        sprite.alpha = 0.1;
      }
    });
  }

  function onNodeUnhover() {
    if (!hoveredNode) return;
    
    // Reset node appearance
    const nodeSprite = nodeSprites.current.get(hoveredNode.id);
    if (nodeSprite) {
      const circle = nodeSprite.children[0]; // Get the circle graphics
      circle.clear();
      circle.beginFill(parseInt(hoveredNode.color.replace('#', '0x')), 0.8);
      circle.lineStyle(hoveredNode.isTreasury ? 3 : 1, hoveredNode.isTreasury ? 0xFFD700 : 0xFFFFFF);
      circle.drawCircle(0, 0, hoveredNode.radius);
      circle.endFill();
    }
    
    setHoveredNode(null);
    
    // Reset link appearance based on current filters
    linkSprites.current.forEach((sprite, i) => {
      const link = data.links[i];
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      const isVisible = !selectedWallets.has(sourceId) && 
                        !selectedWallets.has(targetId) && 
                        filterTransactionsByMonths([link], selectedMonths).length > 0;
      
      sprite.alpha = isVisible ? 0.6 : 0.1;
    });
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
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg z-10">
          <p>Account: {hoveredNode.id}</p>
          <p>Balance: {hoveredNode.value.toLocaleString()}</p>
          {hoveredNode.isTreasury && <p>Treasury Wallet</p>}
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-70 text-white p-2 rounded-lg text-sm">
        <p>Scroll to zoom • Drag to pan • Click nodes to inspect</p>
      </div>
    </div>
  );
}

export default NodeGraph;
