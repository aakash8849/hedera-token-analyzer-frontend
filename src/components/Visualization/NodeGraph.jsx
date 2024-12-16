import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { processVisualizationData } from '../../utils/visualizationProcessor';

function NodeGraph({ data }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data) return;

    const { nodes, links } = processVisualizationData(data);
    const width = window.innerWidth;
    const height = window.innerHeight * 0.8;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [-width / 2, -height / 2, width, height]);

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id))
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter())
      .force("collision", d3.forceCollide().radius(d => d.radius + 2));

    // Create links
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value));

    // Create nodes
    const node = svg.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => d.radius)
      .attr("fill", "#69b3a2")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .call(drag(simulation));

    // Add tooltips
    node.append("title")
      .text(d => `Account: ${d.id}\nBalance: ${d.value}`);

    // Update positions on simulation tick
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

    // Drag behavior
    function drag(simulation) {
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
      
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => simulation.stop();
  }, [data]);

  return (
    <div className="visualization-container">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}

export default NodeGraph;
