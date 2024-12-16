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
  const [timeRange, setTimeRange] = useState(6);
  const [processedData, setProcessedData] = useState(null);

  useEffect(() => {
    if (!data) return;
    const processed = processVisualizationData(data);
    setProcessedData(processed);
  }, [data]);

  useEffect(() => {
    if (!processedData) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Setup zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Filter nodes based on selected wallets and time range
    const filteredNodes = processedData.nodes.filter(node => 
      selectedWallets.size === 0 || selectedWallets.has(node.id)
    );

    const filteredLinks = processedData.links.filter(link => {
      const sourceVisible = filteredNodes.some(n => n.id === link.source);
      const targetVisible = filteredNodes.some(n => n.id === link.target);
      return sourceVisible && targetVisible;
    });

    // Create arrow marker
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#FFD700")
      .attr("d", "M0,-5L10,0L0,5");

    // Create links
    const link = g.append("g")
      .selectAll("line")
      .data(filteredLinks)
      .join("line")
      .attr("stroke", d => d.source === processedData.treasuryId ? "#FFD700" : "#42C7FF")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)")
      .style("opacity", 0.6);

    // Create nodes
    const node = g.append("g")
      .selectAll("circle")
      .data(filteredNodes)
      .join("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => d.id === processedData.treasuryId ? "#FFD700" : "#42C7FF")
      .style("cursor", "pointer")
      .style("opacity", 0.8);

    // Add labels
    const label = g.append("g")
      .selectAll("text")
      .data(filteredNodes)
      .join("text")
      .text(d => d.id)
      .attr("font-size", "10px")
      .attr("fill", "#fff")
      .attr("dy", -10)
      .style("pointer-events", "none")
      .style("opacity", 0.7);

    // Force simulation
    const simulation = d3.forceSimulation(filteredNodes)
      .force("link", d3.forceLink(filteredLinks).id(d => d.id).distance(200))
      .force("charge", d3.forceManyBody().strength(-2000))
      .force("collide", d3.forceCollide().radius(d => d.radius + 10))
      .force("center", d3.forceCenter());

    // Node hover effects
    node.on("mouseover", function(event, d) {
      const tooltip = d3.select(tooltipRef.current);
      tooltip.style("display", "block")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
        .html(`
          <div class="bg-gray-900 p-2 rounded">
            <div>Account: ${d.id}</div>
            <div>Balance: ${d.value.toLocaleString()}</div>
          </div>
        `);

      // Highlight connected nodes and links
      const connectedNodes = new Set();
      filteredLinks.forEach(link => {
        if (link.source.id === d.id) connectedNodes.add(link.target.id);
        if (link.target.id === d.id) connectedNodes.add(link.source.id);
      });

      node.style("opacity", n => 
        n.id === d.id || connectedNodes.has(n.id) ? 1 : 0.3
      );

      link
        .style("opacity", l => 
          l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
        )
        .style("stroke-width", l => 
          l.source.id === d.id || l.target.id === d.id ? 2 : 1.5
        );

      label.style("opacity", n => 
        n.id === d.id || connectedNodes.has(n.id) ? 1 : 0.3
      );
    })
    .on("mouseout", function() {
      d3.select(tooltipRef.current).style("display", "none");
      node.style("opacity", 0.8);
      link.style("opacity", 0.6).style("stroke-width", 1.5);
      label.style("opacity", 0.7);
    });

    // Add drag behavior
    node.call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

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

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    return () => simulation.stop();
  }, [processedData, selectedWallets, timeRange]);

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
      <div className="absolute top-4 right-4 z-10 flex gap-4">
        <TimeFilter value={timeRange} onChange={setTimeRange} />
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
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
      <div ref={tooltipRef} className="hidden absolute bg-gray-900 text-white p-2 rounded shadow-lg z-50" />
    </div>
  );
}

export default NodeGraph;
