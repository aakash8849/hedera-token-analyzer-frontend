import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import WalletList from './WalletList';
import TimeFilter from './TimeFilter';
import { processVisualizationData } from '../../utils/visualizationUtils';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const svgRef = useRef(null);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [processedData, setProcessedData] = useState(null);
  const [simulation, setSimulation] = useState(null);

  useEffect(() => {
    if (!data) return;
    const processed = processVisualizationData(data);
    setProcessedData(processed);
  }, [data]);

  useEffect(() => {
    if (!processedData || !svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Setup SVG
    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;
    svg.attr('width', width).attr('height', height);

    // Create arrow markers
    const defs = svg.append('defs');
    ['#FFD700', '#42C7FF'].forEach(color => {
      defs.append('marker')
        .attr('id', `arrow-${color.slice(1)}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', color)
        .attr('d', 'M0,-5L10,0L0,5');
    });

    // Filter nodes and links based on selected wallets and time
    const filteredNodes = processedData.nodes.filter(node => 
      !selectedWallets.has(node.id)
    );

    const filteredLinks = processedData.links.filter(link => {
      const sourceVisible = !selectedWallets.has(link.source.id || link.source);
      const targetVisible = !selectedWallets.has(link.target.id || link.target);
      const withinTimeRange = new Date(link.timestamp) >= 
        new Date(Date.now() - selectedMonths * 30 * 24 * 60 * 60 * 1000);
      return sourceVisible && targetVisible && withinTimeRange;
    });

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create container for visualization
    const g = svg.append('g')
      .attr('transform', `translate(${width/2},${height/2})`);

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(filteredLinks)
      .join('line')
      .attr('stroke', d => d.color)
      .attr('stroke-width', 1)
      .attr('opacity', 0.4)
      .attr('marker-end', d => `url(#arrow-${d.color.slice(1)})`);

    // Create nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(filteredNodes)
      .join('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add node labels
    const label = g.append('g')
      .selectAll('text')
      .data(filteredNodes)
      .join('text')
      .text(d => d.id)
      .attr('font-size', '10px')
      .attr('fill', '#fff')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.radius + 15);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    // Node hover effects
    node.on('mouseover', (event, d) => {
      // Highlight connected links and nodes
      link
        .attr('opacity', l => 
          l.source.id === d.id || l.target.id === d.id ? 0.8 : 0.1
        )
        .attr('stroke-width', l => 
          l.source.id === d.id || l.target.id === d.id ? 2 : 1
        );

      node
        .attr('opacity', n => 
          n.id === d.id || 
          filteredLinks.some(l => 
            (l.source.id === d.id && l.target.id === n.id) ||
            (l.target.id === d.id && l.source.id === n.id)
          ) ? 1 : 0.3
        );

      // Show tooltip
      tooltip
        .style('opacity', 1)
        .html(`
          <div class="p-2">
            <div>Account: ${d.id}</div>
            <div>Balance: ${d.value.toLocaleString()}</div>
            ${d.isTreasury ? '<div>Treasury Wallet</div>' : ''}
          </div>
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', () => {
      link.attr('opacity', 0.4).attr('stroke-width', 1);
      node.attr('opacity', 1);
      tooltip.style('opacity', 0);
    });

    // Create force simulation
    const sim = d3.forceSimulation(filteredNodes)
      .force('link', d3.forceLink(filteredLinks)
        .id(d => d.id)
        .distance(d => d.source.isTreasury || d.target.isTreasury ? 200 : 100))
      .force('charge', d3.forceManyBody()
        .strength(d => d.isTreasury ? -2000 : -500))
      .force('collide', d3.forceCollide()
        .radius(d => d.radius * 1.5))
      .force('center', d3.forceCenter())
      .force('radial', d3.forceRadial(300)
        .strength(d => d.isTreasury ? 0 : 0.3))
      .on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);

        label
          .attr('x', d => d.x)
          .attr('y', d => d.y);
      });

    setSimulation(sim);

    function dragstarted(event) {
      if (!event.active) sim.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) sim.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      sim.stop();
      tooltip.remove();
    };
  }, [processedData, selectedWallets, selectedMonths]);

  if (!processedData) return null;

  return (
    <div className="fixed inset-0 bg-[#13111C]">
      <WalletList 
        wallets={processedData.nodes}
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

      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}

export default NodeGraph;
