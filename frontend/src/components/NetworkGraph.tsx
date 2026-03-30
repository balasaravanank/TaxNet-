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
  const base = 6;
  const degree = (node.in_degree || 0) + (node.out_degree || 0);
  return Math.min(base + Math.sqrt(degree) * 2.5, 26);
}

export function NetworkGraph({ data, rings, selectedRing, onNodeClick, selectedNode }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const simRef  = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

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

    // Background grid pattern
    const defs = svg.append("defs");
    const pattern = defs.append("pattern")
      .attr("id", "grid").attr("width", 40).attr("height", 40)
      .attr("patternUnits", "userSpaceOnUse");
    pattern.append("path")
      .attr("d", "M 40 0 L 0 0 0 40").attr("fill", "none")
      .attr("stroke", "rgba(0,212,255,0.04)").attr("stroke-width", 1);

    // Arrow markers
    ["default","ring"].forEach(id => {
      defs.append("marker")
        .attr("id", `arrow-${id}`)
        .attr("viewBox", "0 -4 10 8")
        .attr("refX", 20).attr("refY", 0)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-4L10,0L0,4")
        .attr("fill", id === "ring" ? "#ff4757" : "rgba(0,212,255,0.4)");
    });

    const g = svg.append("g");

    // Background grid
    g.append("rect")
      .attr("width", width * 3).attr("height", height * 3)
      .attr("x", -width).attr("y", -height)
      .attr("fill", "url(#grid)");

    // Deep copies of nodes/links for simulation
    const nodes: GraphNode[] = data.nodes.map(n => ({ ...n }));
    const links: GraphLink[] = data.links.map(l => ({ ...l }));

    // ──── Simulation ────
    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => 80 + Math.log1p((d.weight || 0) / 50000) * 10)
        .strength(0.4))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius(d => nodeRadius(d) + 10));

    simRef.current = sim;

    // ──── Links ────
    const linkGroup = g.append("g");
    const link = linkGroup.selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => Math.min(1 + Math.log1p((d.weight || 0) / 100000), 4))
      .attr("stroke", "rgba(0,212,255,0.15)")
      .attr("marker-end", "url(#arrow-default)")
      .attr("opacity", 0.7);

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

    // Outer pulse ring (for high-risk)
    node.append("circle")
      .attr("r", d => nodeRadius(d) + 6)
      .attr("fill", "none")
      .attr("stroke", d => scoreColor(d.fraud_score))
      .attr("stroke-width", 1.5)
      .attr("opacity", d => d.fraud_score >= 61 ? 0.4 : 0)
      .attr("class", "pulse-ring");

    // Main circle
    node.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", d => {
        const c = scoreColor(d.fraud_score);
        return `${c}22`;
      })
      .attr("stroke", d => scoreColor(d.fraud_score))
      .attr("stroke-width", d => d.fraud_score >= 61 ? 2 : 1.5);

    // Company name label
    node.append("text")
      .attr("dy", d => nodeRadius(d) + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("font-family", "var(--font-mono)")
      .attr("fill", "var(--text-secondary)")
      .attr("pointer-events", "none")
      .text(d => d.company_name.length > 14 ? d.company_name.slice(0, 14) + "…" : d.company_name);

    // Score label inside node
    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
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
      return ringEdges.current.has(key) ? "#ff4757" : "rgba(0,212,255,0.15)";
    }).attr("stroke-width", d => {
      const srcId = typeof d.source === "object" ? (d.source as GraphNode).id : d.source;
      const tgtId = typeof d.target === "object" ? (d.target as GraphNode).id : d.target;
      return ringEdges.current.has(`${srcId}->${tgtId}`) ? 3 : 1;
    }).attr("marker-end", d => {
      const srcId = typeof d.source === "object" ? (d.source as GraphNode).id : d.source;
      const tgtId = typeof d.target === "object" ? (d.target as GraphNode).id : d.target;
      return ringEdges.current.has(`${srcId}->${tgtId}`) ? "url(#arrow-ring)" : "url(#arrow-default)";
    });

    // Highlight ring nodes
    svg.selectAll<SVGCircleElement, GraphNode>("circle:nth-child(2)")
      .attr("stroke-width", d => ringNodes.current.has(d.id) ? 3 : d.fraud_score >= 61 ? 2 : 1.5)
      .attr("stroke", d => ringNodes.current.has(d.id) ? "#ff4757" : scoreColor(d.fraud_score));

  }, [selectedRing, data]);

  // ──── Highlight selected node ────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGGElement, GraphNode>("g.node circle:nth-child(2)")
      .attr("filter", d => selectedNode?.id === d.id ? "drop-shadow(0 0 8px var(--cyan))" : "none");
  }, [selectedNode]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%", background: "transparent" }} />
      <div style={{
        position: "absolute", bottom: "12px", left: "12px",
        display: "flex", gap: "12px", flexWrap: "wrap",
      }}>
        {[
          { color: "var(--green)",  label: "Low Risk"  },
          { color: "var(--yellow)", label: "Medium Risk"},
          { color: "var(--orange)", label: "High Risk"  },
          { color: "var(--red)",    label: "Critical"   },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "var(--text-muted)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
