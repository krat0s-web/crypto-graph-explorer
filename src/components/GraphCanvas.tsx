import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { NodeData, EdgeData } from '@/lib/graphTypes';
import { getNodeColor, shortenAddress } from '@/lib/graphUtils';

interface GraphCanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  onNodeSelect: (node: NodeData | null) => void;
  selectedNode: NodeData | null;
  removedNodes: Set<string>;
  highlightedNodes?: Set<string>;
  highlightedEdges?: Array<{source: string, target: string}>;
  visualizationMode?: string | null;
}

export default function GraphCanvas({ 
  nodes, 
  edges, 
  onNodeSelect, 
  selectedNode, 
  removedNodes,
  highlightedNodes = new Set(),
  highlightedEdges = [],
  visualizationMode = null
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const linkRef = useRef<any>(null);
  const nodeRef = useRef<any>(null);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Update edge and node styles when selectedNode changes
  useEffect(() => {
    if (!linkRef.current || !nodeRef.current) return;

    const isEdgeHighlighted = (d: any) => {
      const srcId = typeof d.source === 'object' ? d.source.id : d.source;
      const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
      return highlightedEdges.some(e => 
        (e.source === srcId && e.target === tgtId) || 
        (e.source === tgtId && e.target === srcId)
      );
    };

    linkRef.current
      .attr('stroke', (d: any) => {
        if (highlightedEdges.length > 0 && isEdgeHighlighted(d)) {
          return visualizationMode === 'bridges' ? '#ef4444' : '#3b82f6';
        }
        if (!selectedNode) return '#9ca3af';
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        return (srcId === selectedNode.id || tgtId === selectedNode.id) ? '#000000' : '#9ca3af';
      })
      .attr('stroke-width', (d: any) => {
        if (highlightedEdges.length > 0 && isEdgeHighlighted(d)) return 3;
        if (!selectedNode) return 1.5;
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        return (srcId === selectedNode.id || tgtId === selectedNode.id) ? 2.5 : 1.5;
      })
      .attr('stroke-opacity', (d: any) => {
        if (highlightedEdges.length > 0) {
          return isEdgeHighlighted(d) ? 1 : 0.1;
        }
        if (!selectedNode) return 0.3;
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        return (srcId === selectedNode.id || tgtId === selectedNode.id) ? 0.9 : 0.2;
      });

    nodeRef.current.select('circle')
      .attr('stroke-width', (d: any) => {
        if (highlightedNodes.has(d.id)) return 4;
        return selectedNode?.id === d.id ? 3 : 1.5;
      })
      .attr('stroke', (d: any) => {
        if (highlightedNodes.has(d.id)) {
          if (visualizationMode === 'path') return '#3b82f6';
          if (visualizationMode === 'flow') return '#8b5cf6';
          if (visualizationMode === 'kcore') return '#10b981';
          return '#f59e0b';
        }
        return '#ffffff';
      })
      .attr('fill-opacity', (d: any) => {
        if (highlightedNodes.size > 0) {
          return highlightedNodes.has(d.id) ? 1 : 0.3;
        }
        return 0.9;
      });
  }, [selectedNode, highlightedNodes, highlightedEdges, visualizationMode]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const activeNodes = nodes.filter(n => !removedNodes.has(n.id));
    const activeNodeIds = new Set(activeNodes.map(n => n.id));
    const activeEdges = edges
      .filter(e => {
        const src = typeof e.source === 'object' ? (e.source as any).id : e.source;
        const tgt = typeof e.target === 'object' ? (e.target as any).id : e.target;
        return activeNodeIds.has(src) && activeNodeIds.has(tgt);
      })
      .map(e => ({
        source: typeof e.source === 'object' ? (e.source as any).id : e.source,
        target: typeof e.target === 'object' ? (e.target as any).id : e.target,
      }));

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Scale node sizes
    const maxDeg = Math.max(...activeNodes.map(n => n.degree), 1);
    const sizeScale = d3.scaleSqrt().domain([0, maxDeg]).range([3, 25]);

    const simulation = d3.forceSimulation(activeNodes as any)
      .force('link', d3.forceLink(activeEdges as any).id((d: any) => d.id).distance(180).strength(0.2))
      .force('charge', d3.forceManyBody().strength(-500).distanceMax(800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => sizeScale(d.degree) + 20).strength(1))
      .alphaDecay(0.01)
      .velocityDecay(0.2);

    // Draw edges - gray lines that turn black when connected to selected node
    const link = g.append('g')
      .selectAll('line')
      .data(activeEdges)
      .join('line')
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3);
    
    linkRef.current = link;

    // Draw nodes
    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(activeNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => onNodeSelect(d))
      .call(d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    const node = nodeGroup.append('circle')
      .attr('r', (d) => sizeScale(d.degree))
      .attr('fill', (d) => getNodeColor(d.community))
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .on('mouseenter', function(_, d) {
        d3.select(this).attr('fill-opacity', 1).attr('stroke-width', 3);
        tooltip.style('display', 'block')
          .html(`<strong>${shortenAddress(d.id)}</strong><br/>Degree: ${d.degree}<br/>PageRank: ${d.pagerank.toFixed(6)}`);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.offsetX + 15) + 'px').style('top', (event.offsetY - 10) + 'px');
      })
      .on('mouseleave', function(_, d) {
        d3.select(this)
          .attr('fill-opacity', 0.9)
          .attr('stroke-width', selectedNode?.id === d.id ? 3 : 1.5);
        tooltip.style('display', 'none');
      });

    nodeRef.current = nodeGroup;

    // Add labels to nodes
    const labels = nodeGroup.append('text')
      .text((d) => shortenAddress(d.id))
      .attr('font-size', '11px')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .attr('font-weight', '500')
      .attr('fill', '#1f2937')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => sizeScale(d.degree) + 14)
      .attr('pointer-events', 'none')
      .style('user-select', 'none');

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .append('div')
      .attr('class', 'absolute pointer-events-none glass rounded px-3 py-2 text-xs font-mono z-50')
      .style('display', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      nodeGroup.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [nodes, edges, dimensions, removedNodes, onNodeSelect]);

  return (
    <div ref={containerRef} className="relative w-full h-full grid-bg">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />
    </div>
  );
}
