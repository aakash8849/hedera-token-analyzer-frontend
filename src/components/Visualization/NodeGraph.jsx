import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import TimeFilter from './TimeFilter';
import WalletList from './WalletList';
import { filterTransactionsByMonths } from '../../utils/dateUtils';

function NodeGraph({ data, onClose }) {
  const svgRef = useRef(null);
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [selectedWallets, setSelectedWallets] = useState(new Set());
  const [processedData, setProcessedData] = useState(null);

  useEffect(() => {
    if (!data) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Clear previous content
    svg.selectAll('*').remove();

    // Define arrow markers
    svg.append('defs').selectAll('marker')
      .data(['yellow', 'blue'])
      .join('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', d => d === 'yellow' ? '#FFD700' : '#42C7FF')
      .attr('d', 'M0,-5L10,0L0,5');

    // Create container group and add zoom behavior
    const g = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Filter data based on selected months
    const filteredTransactions = filterTransactionsByMonths(processedData.transactions, selectedMonths);
    const filteredLinks = processedData.links.filter(link => {
      const tx = filteredTransactions.find(t => 
        t.sender === link.source.id && t.receiver === link.target.id
      );
      return tx && (!selectedWallets.has(link.source.id) && !selectedWallets.has(link.target.id));
    });

    const filteredNodes = processedData.nodes.filter(node => 
      !selectedWallets.has(node.id)
    );

    // Create force simulation
    const simulation = d3.forceSimulation(filteredNodes)
      .force('link', d3.forceLink(filteredLinks)
        .id(d => d.id)
        .distance(200))
      .force('charge', d3.forceManyBody()
        .strength(-1000))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 10));

    // Draw links
    const links = g.append('g')
      .selectAll('line')
      .data(filteredLinks)
      .join('line')
      .attr('stroke', d => d.isTreasuryTransaction ? '#FFD700' : '#42C7FF')
      .attr('stroke-width', 1)
      .attr('opacity', 0.4)
      .attr('marker-end', d => `url(#arrow-${d.isTreasuryTransaction ? 'yellow' : 'blue'})`);

    // Draw nodes with grey border
    const nodes = g.append('g')
      .selectAll('g')
      .data(filteredNodes)
      .join('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circle with border
    nodes.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', '#2A2A3C')
      .attr('stroke-width', 2);

    // Add labels
    nodes.append('text')
      .text(d => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', 'white')
      .style('font-size', '12px');

    // Add hover effects
    nodes.on('mouseover', function(event, d) {
      // Highlight connected links and nodes
      links
        .attr('opacity', l => 
          l.source.id === d.id || l.target.id === d.id ? 0.8 : 0.1
        )
        .attr('stroke-width', l => 
          l.source.id === d.id || l.target.id === d.id ? 2 : 1
        );

      nodes.attr('opacity', n => 
        n.id === d.id || 
        filteredLinks.some(l => 
          (l.source.id === d.id && l.target.id === n.id) ||
          (l.target.id === d.id && l.source.id === n.id)
        ) ? 1 : 0.3
      );

      // Show tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0,0,0,0.8)')
        .style('color', 'white')
        .style('padding', '10px')
        .style('border-radius', '5px')
        .style('pointer-events', 'none');

      tooltip.html(`
        Account: ${d.id}<br/>
        Balance: ${d.value.toLocaleString()}<br/>
        ${d.isTreasury ? '(Treasury Wallet)' : ''}
      `);

      tooltip
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', function() {
      links
        .attr('opacity', 0.4)
        .attr('stroke-width', 1);
      nodes.attr('opacity', 1);
      d3.selectAll('.tooltip').remove();
    });

    // Update positions on each tick
    simulation.on('tick', () => {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const angle = Math.atan2(dy, dx);
          return d.target.x - (d.target.radius + 2) * Math.cos(angle);
        })
        .attr('y2', d => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const angle = Math.atan2(dy, dx);
          return d.target.y - (d.target.radius + 2) * Math.sin(angle);
        });

      nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    });

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

  }, [data, selectedMonths, selectedWallets, processedData]);

  return (
    <div className="fixed inset-0 bg-[#13111C] overflow-hidden">
      <div className="absolute top-4 right-4 z-10 flex space-x-4">
        <TimeFilter value={selectedMonths} onChange={setSelectedMonths} />
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
    </div>
  );
}

export default NodeGraph;
