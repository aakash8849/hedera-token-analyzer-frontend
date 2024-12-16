import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { processVisualizationData } from '../../utils/visualizationUtils';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [timeRange, setTimeRange] = useState(6);
  const [processedData, setProcessedData] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  useEffect(() => {
    if (!data) return;
    const processed = processVisualizationData(data);
    setProcessedData(processed);
  }, [data]);

  useEffect(() => {
    if (!processedData) return;

    const filteredTransactions = filterTransactionsByMonths(processedData.transactions, timeRange);
    const { nodes, links } = processedData;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height]);

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const g = svg.append("g");

    // Define arrow markers with gradient
    const defs = svg.append("defs");
    
    // Gradient for links
    const linkGradient = defs.append("linearGradient")
      .attr("id", "linkGradient")
      .attr("gradientUnits", "userSpaceOnUse");

    linkGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#42C7FF");

    linkGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#42C7FF");

    // Arrow marker
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#42C7FF")
      .attr("d", "M0,-5L10,0L0,5");

    // Create color scale
    const colorScale = d3.scaleOrdinal()
      .domain(['treasury', 'high', 'medium', 'low'])
      .range(['#FFD700', '#FF3B9A', '#7A73FF', '#42C7FF']);

    // Create links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link")
      .attr("stroke", "url(#linkGradient)")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)")
      .style("opacity", 0.3);

    // Create nodes
    const node = g.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("class", "node")
      .attr("r", d => d.radius)
      .attr("fill", d => colorScale(d.isTreasury ? 'treasury' : d.category))
      .style("opacity", 0.7)
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add wallet IDs as labels
    const labels = g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("class", "label")
      .attr("dy", -10)
      .text(d => d.id)
      .style("font-size", "10px")
      .style("fill", "#fff")
      .style("opacity", 0.7)
      .style("pointer-events", "none");

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-1000))
      .force("center", d3.forceCenter())
      .force("collision", d3.forceCollide().radius(d => d.radius + 5));

    // Update positions
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      labels
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    // Node hover effects
    node
      .on("mouseover", handleNodeHover)
      .on("mouseout", handleNodeUnhover);

    function handleNodeHover(event, d) {
      setHoveredNode(d);
      
      // Highlight connected nodes and links
      const connectedNodeIds = new Set();
      links.forEach(link => {
        if (link.source.id === d.id) connectedNodeIds.add(link.target.id);
        if (link.target.id === d.id) connectedNodeIds.add(link.source.id);
      });

      node.style("opacity", n => 
        n.id === d.id || connectedNodeIds.has(n.id) ? 1 : 0.2
      );

      link
        .style("opacity", l => 
          l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
        )
        .style("stroke-width", l => 
          l.source.id === d.id || l.target.id === d.id ? 3 : 2
        );

      labels.style("opacity", n => 
        n.id === d.id || connectedNodeIds.has(n.id) ? 1 : 0.2
      );

      // Show tooltip
      const tooltip = d3.select(tooltipRef.current);
      tooltip
        .style("display", "block")
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 10}px`)
        .html(`
          <div class="p-3 bg-gray-900 rounded-lg">
            <div class="font-bold text-white">Account: ${d.id}</div>
            <div class="text-gray-300">Balance: ${d.value.toLocaleString()}</div>
            ${d.isTreasury ? '<div class="text-yellow-400">Treasury Wallet</div>' : ''}
          </div>
        `);
    }

    function handleNodeUnhover() {
      setHoveredNode(null);
      node.style("opacity", 0.7);
      link.style("opacity", 0.3).style("stroke-width", 2);
      labels.style("opacity", 0.7);
      d3.select(tooltipRef.current).style("display", "none");
    }

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => simulation.stop();
  }, [processedData, timeRange, selectedWallets]);

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden" ref={containerRef}>
      <div className="absolute top-4 right-4 z-10 flex gap-4">
        <TimeFilter value={timeRange} onChange={setTimeRange} />
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
        >
          Back
        </button>
      </div>
      
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

      <svg ref={svgRef} className="w-full h-full" />
      
      <div 
        ref={tooltipRef}
        className="tooltip hidden absolute bg-gray-900 text-white p-3 rounded-lg shadow-lg z-50"
      />
    </div>
  );
}

export default NodeGraph;
