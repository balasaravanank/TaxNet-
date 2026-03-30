import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode, GraphLink, FraudRing } from "../lib/types";
import { scoreColor } from "../lib/api";

interface Props {
  data:          GraphData | null;
  rings:         FraudRing[];
  selectedRing:  FraudRing | null;
  onNodeClick:   (node: GraphNode) => void;
  selectedNode:  GraphNode | null;
}

function nodeRadius(node: GraphNode) {
  const base = 8;
  const degree = (node.in_degree || 0) + (node.out_degree || 0);
  return Math.min(base + Math.sqrt(degree) * 3, 32);
}

export function NetworkGraph({ data, rings, selectedRing, onNodeClick, selectedNode }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const simRef  = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);

  // Build set of edges in the selected ring
  const ringEdges = useRef<Set<string>>(new Set());
  const ringNodes = useRef<Set<string>>(new Set());

  useEffect(() => {
    ringEdges.current.clear();
    ringNodes.current.clear();
    if (selectedRing) {
      const path = selectedRing.cycle_path;
      path.forEach(n => ringNodes.current.add(n));
      for (let i = 0; i < path.length; i++) {
        ringEdges.current.add(`${path[i]}->${path[(i + 1) % path.length]}`);
      }
    }
  }, [selectedRing]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg    = d3.select(svgRef.current);
    const width  = svgRef.current.clientWidth  || 800;
    const height = svgRef.current.clientHeight || 600;

    svg.selectAll("*").remove();

    // Background grid pattern - light theme
    const defs = svg.append("defs");
    const pattern = defs.append("pattern")
      .attr("id", "grid").attr("width", 50).attr("height", 50)
      .attr("patternUnits", "userSpaceOnUse");
    pattern.append("path")
      .attr("d", "M 50 0 L 0 0 0 50").attr("fill", "none")
      .attr("stroke", "#e2e8f0").attr("stroke-width", 1);

    // Arrow markers
    ["default","ring"].forEach(id => {
      defs.append("marker")
        .attr("id", `arrow-${id}`)
        .attr("viewBox", "0 -4 10 8")
        .attr("refX", 22).attr("refY", 0)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-4L10,0L0,4")
        .attr("fill", id === "ring" ? "#dc2626" : "#94a3b8");
    });

    // Drop shadow for nodes
    const filter = defs.append("filter")
      .attr("id", "shadow")
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");
    filter.append("feDropShadow")
      .attr("dx", 0).attr("dy", 2)
      .attr("stdDeviation", 3)
      .attr("flood-color", "rgba(0,0,0,0.1)");

    const g = svg.append("g");

    // Background grid
    g.append("rect")
      .attr("width", width * 3).attr("height", height * 3)
      .attr("x", -width).attr("y", -height)
      .attr("fill", "url(#grid)");

    // Deep copies of nodes/links for simulation
    const nodes: GraphNode[] = data.nodes.map(n => ({ ...n }));
    const links: GraphLink[] = data.links.map(l => ({ ...l }));
    nodesRef.current = nodes;

    // ──── Simulation ────
    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => 100 + Math.log1p((d.weight || 0) / 50000) * 15)
        .strength(0.4))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius(d => nodeRadius(d) + 15));

    simRef.current = sim;

    // ──── Links ────
    const linkGroup = g.append("g");
    const link = linkGroup.selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => Math.min(1.5 + Math.log1p((d.weight || 0) / 100000), 4))
      .attr("stroke", "#cbd5e1")
      .attr("marker-end", "url(#arrow-default)")
      .attr("opacity", 0.6);

    // ──── Nodes ────
    const nodeGroup = g.append("g");
    const node = nodeGroup.selectAll<SVGGElement, GraphNode>("g.node")
      .data(nodes, d => d.id)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          }) as any
      )
      .on("click", (_event, d) => onNodeClick(d));

    // Main circle with shadow
    node.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", "#ffffff")
      .attr("stroke", d => scoreColor(d.fraud_score))
      .attr("stroke-width", d => d.fraud_score >= 61 ? 3 : 2)
      .attr("filter", "url(#shadow)");

    // Inner colored dot
    node.append("circle")
      .attr("r", d => nodeRadius(d) * 0.5)
      .attr("fill", d => scoreColor(d.fraud_score))
      .attr("opacity", 0.2);

    // Company name label
    node.append("text")
      .attr("dy", d => nodeRadius(d) + 18)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .attr("font-family", "var(--font-sans)")
      .attr("fill", "#475569")
      .attr("pointer-events", "none")
      .text(d => d.company_name.length > 12 ? d.company_name.slice(0, 12) + "…" : d.company_name);

    // Score label inside node
    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "700")
      .attr("font-family", "var(--font-mono)")
      .attr("fill", d => scoreColor(d.fraud_score))
      .attr("pointer-events", "none")
      .text(d => d.fraud_score > 10 ? Math.round(d.fraud_score) : "");

    // ──── Zoom ────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", event => g.attr("transform", event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    // Initial zoom out a bit
    svg.call(zoom.transform, d3.zoomIdentity.translate(width * 0.05, height * 0.05).scale(0.9));

    // ──── Tick ────
    sim.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { sim.stop(); };
  }, [data]);

  // ──── Update ring highlights when selectedRing changes ────
  useEffect(() => {
    if (!svgRef.current || !data) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll<SVGLineElement, GraphLink>("line").attr("stroke", d => {
      const srcId = typeof d.source === "object" ? (d.source as GraphNode).id : d.source;
      const tgtId = typeof d.target === "object" ? (d.target as GraphNode).id : d.target;
      const key   = `${srcId}->${tgtId}`;
      return ringEdges.current.has(key) ? "#dc2626" : "#cbd5e1";
    }).attr("stroke-width", d => {
      const srcId = typeof d.source === "object" ? (d.source as GraphNode).id : d.source;
      const tgtId = typeof d.target === "object" ? (d.target as GraphNode).id : d.target;
      return ringEdges.current.has(`${srcId}->${tgtId}`) ? 3 : 1.5;
    }).attr("marker-end", d => {
      const srcId = typeof d.source === "object" ? (d.source as GraphNode).id : d.source;
      const tgtId = typeof d.target === "object" ? (d.target as GraphNode).id : d.target;
      return ringEdges.current.has(`${srcId}->${tgtId}`) ? "url(#arrow-ring)" : "url(#arrow-default)";
    });

    // Highlight ring nodes
    svg.selectAll<SVGCircleElement, GraphNode>("circle:nth-child(1)")
      .attr("stroke-width", d => ringNodes.current.has(d.id) ? 4 : d.fraud_score >= 61 ? 3 : 2)
      .attr("stroke", d => ringNodes.current.has(d.id) ? "#dc2626" : scoreColor(d.fraud_score));

    // ──── Zoom to ring nodes ────
    if (selectedRing && zoomRef.current && nodesRef.current.length > 0) {
      const ringNodeIds = new Set(selectedRing.cycle_path);
      const ringNodesData = nodesRef.current.filter(n => ringNodeIds.has(n.id));
      
      if (ringNodesData.length > 0 && ringNodesData.every(n => n.x !== undefined && n.y !== undefined)) {
        const width = svgRef.current.clientWidth || 800;
        const height = svgRef.current.clientHeight || 600;
        
        // Calculate bounding box of ring nodes
        const xs = ringNodesData.map(n => n.x!);
        const ys = ringNodesData.map(n => n.y!);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        // Add padding
        const padding = 100;
        const boxWidth = Math.max(maxX - minX + padding * 2, 200);
        const boxHeight = Math.max(maxY - minY + padding * 2, 200);
        
        // Calculate scale to fit
        const scale = Math.min(
          width / boxWidth,
          height / boxHeight,
          2 // Max zoom
        ) * 0.85;
        
        // Calculate center
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Animate zoom to ring
        svg.transition()
          .duration(750)
          .call(
            zoomRef.current.transform as any,
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(scale)
              .translate(-centerX, -centerY)
          );
      }
    }

  }, [selectedRing, data]);

  // ──── Highlight selected node ────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGGElement, GraphNode>("g.node circle:nth-child(1)")
      .attr("filter", d => selectedNode?.id === d.id ? "drop-shadow(0 0 8px #2563eb)" : "url(#shadow)");
  }, [selectedNode]);

  // ──── Zoom control handlers ────
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 0.67);
  }, []);

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;
    svg.transition().duration(500).call(
      zoomRef.current.transform as any,
      d3.zoomIdentity.translate(width * 0.05, height * 0.05).scale(0.9)
    );
  }, []);

  const handleFitAll = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || nodesRef.current.length === 0) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;
    
    const nodes = nodesRef.current.filter(n => n.x !== undefined && n.y !== undefined);
    if (nodes.length === 0) return;
    
    const xs = nodes.map(n => n.x!);
    const ys = nodes.map(n => n.y!);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const padding = 80;
    const boxWidth = Math.max(maxX - minX + padding * 2, 200);
    const boxHeight = Math.max(maxY - minY + padding * 2, 200);
    
    const scale = Math.min(width / boxWidth, height / boxHeight, 2) * 0.9;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    svg.transition().duration(500).call(
      zoomRef.current.transform as any,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(scale)
        .translate(-centerX, -centerY)
    );
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%", background: "#f8fafc", touchAction: "none" }} />
      
      {/* Legend - Bottom Left */}
      <div className="graph-legend" style={{
        position: "absolute", 
        bottom: "16px", 
        left: "16px",
        display: "flex", 
        gap: "16px", 
        flexWrap: "wrap",
        background: "var(--bg-surface)",
        padding: "10px 16px",
        borderRadius: "10px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid var(--border)",
      }}>
        {[
          { color: "var(--green)",  label: "Low Risk"  },
          { color: "var(--yellow)", label: "Medium"    },
          { color: "var(--orange)", label: "High Risk" },
          { color: "var(--red)",    label: "Critical"  },
        ].map(l => (
          <div key={l.label} style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "6px", 
            fontSize: "12px", 
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}>
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: "50%", 
              background: l.color,
              border: "2px solid white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }} />
            {l.label}
          </div>
        ))}
        <style>{`
          @media (max-width: 768px) {
            .graph-legend {
              padding: 8px 12px !important;
              gap: 10px !important;
              font-size: 11px !important;
              max-width: calc(100% - 32px);
            }
            .graph-legend > div {
              font-size: 11px !important;
              gap: 4px !important;
            }
          }
          @media (max-width: 640px) {
            .graph-legend {
              bottom: 12px !important;
              left: 12px !important;
            }
            .graph-controls {
              bottom: 12px !important;
              right: 12px !important;
              gap: 10px !important;
            }
          }
        `}</style>
      </div>

      {/* Controls Toolbar - Bottom Right */}
      <div className="graph-controls" style={{
        position: "absolute",
        bottom: "16px",
        right: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        background: "var(--bg-surface)",
        padding: "8px",
        borderRadius: "12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        border: "1px solid var(--border)",
      }}>
        {/* Zoom In */}
        <ToolButton onClick={handleZoomIn} title="Zoom In">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </ToolButton>

        {/* Zoom Out */}
        <ToolButton onClick={handleZoomOut} title="Zoom Out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </ToolButton>

        <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />

        {/* Fit All */}
        <ToolButton onClick={handleFitAll} title="Fit All Nodes">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </ToolButton>

        {/* Reset View */}
        <ToolButton onClick={handleReset} title="Reset View">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </ToolButton>
      </div>
    </div>
  );
}

function ToolButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="graph-control-button"
      style={{
        width: "36px",
        height: "36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: "8px",
        color: "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.background = "var(--primary-light)"; 
        e.currentTarget.style.color = "var(--primary)"; 
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.background = "transparent"; 
        e.currentTarget.style.color = "var(--text-secondary)"; 
      }}
    >
      {children}
      <style>{`
        @media (max-width: 768px) {
          .graph-control-button {
            width: 44px !important;
            height: 44px !important;
            touch-action: manipulation;
          }
        }
      `}</style>
    </button>
  );
}
