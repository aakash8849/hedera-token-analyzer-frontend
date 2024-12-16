import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { processVisualizationData } from '../../utils/visualizationUtils';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [timeRange, setTimeRange] = useState(6); // Default 6 months
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

    // Define arrow markers
    svg.append("defs").selectAll("marker")
      .data(["arrow"])
      .join("marker")
      .attr("id", d => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#42C7FF")
      .attr("d", "M0,-5L10,0L0,5");

    // Create color scale
    const colorScale = d3.scaleOrdinal()
      .domain(['high', 'medium', 'low'])
      .range(['#FF3B9A', '#7A73FF', '#42C7FF']);

    // Create links
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link")
      .attr("stroke", "#42C7FF")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)")
      .style("opacity", 0.3);

    // Create nodes
    const node = svg.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("class", "node")
      .attr("r", d => d.radius)
      .attr("fill", d => colorScale(d.category))
      .style("opacity", 0.7)
      .on("mouseover", handleNodeHover)
      .on("mouseout", handleNodeUnhover);

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter())
      .force("collision", d3.forceCollide().radius(d => d.radius + 2));

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    });

    function handleNodeHover(event, d) {
      setHoveredNode(d);
      
      // Highlight connected nodes and links
      const connectedNodeIds = new Set();
      links.forEach(link => {
        if (link.source.id === d.id) connectedNodeIds.add(link.target.id);
        if (link.target.id === d.id) connectedNodeIds.add(link.source.id);
      });

      node.style("opacity", n => 
        n.id === d.id || connectedNodeIds.has(n.id) ? 1 : 0.3
      );

      link.style("opacity", l => 
        l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
      );

      // Show tooltip
      const tooltip = d3.select(tooltipRef.current);
      tooltip
        .style("display", "block")
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 10}px`)
        .html(`
          <div class="p-2">
            <div class="font-bold">Account: ${d.id}</div>
            <div>Balance: ${d.value.toLocaleString()}</div>
          </div>
        `);
    }

    function handleNodeUnhover() {
      setHoveredNode(null);
      node.style("opacity", 0.7);
      link.style("opacity", 0.3);
      d3.select(tooltipRef.current).style("display", "none");
    }

    return () => simulation.stop();
  }, [processedData, timeRange, selectedWallets]);

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
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
        className="tooltip hidden absolute bg-gray-900 text-white p-3 rounded-lg shadow-lg"
      />
    </div>
  );
}

export default NodeGraph;
