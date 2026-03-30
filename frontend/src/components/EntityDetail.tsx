import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { EntityDetail, ExplainResult } from "../lib/types";
import { scoreColor, riskClass, fmtCurrency, api } from "../lib/api";

interface Props {
  gstin:   string | null;
  onClose: () => void;
}

export function EntityDetail({ gstin, onClose }: Props) {
  const [detail,   setDetail]   = useState<EntityDetail | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [explain,  setExplain]  = useState<ExplainResult | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const radarRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!gstin) { setDetail(null); setExplain(null); return; }
    setLoading(true);
    setExplain(null);
    api.company(gstin)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [gstin]);

  // Draw radar chart
  useEffect(() => {
    if (!detail || !radarRef.current) return;
    const f = detail.features;
    const feats = [
      { label: "Tax Mismatch",  value: Math.min(f.tax_mismatch_ratio / 5, 1) },
      { label: "Vol. Spike",    value: Math.min(f.volume_spike_score / 30, 1) },
      { label: "Duplicates",    value: Math.min(f.duplicate_invoice_count / 10, 1) },
      { label: "Ring Member",   value: Math.min(f.cycle_participation / 5, 1) },
      { label: "Shell Score",   value: f.shell_company_score },
      { label: "PR Anomaly",    value: Math.min(f.pagerank_anomaly / 5, 1) },
    ];
    drawRadar(radarRef.current, feats, scoreColor(detail.company.fraud_score));
  }, [detail]);

  const handleExplain = async () => {
    if (!gstin || explainLoading) return;
    setExplainLoading(true);
    try {
      const result = await api.explain(gstin);
      setExplain(result);
    } catch {
      setExplain({
        gstin: gstin,
        explanation: "Failed to generate explanation. Please check the backend server.",
        sources: [],
        rag_enabled: false,
        llm_model: "error",
      });
    } finally {
      setExplainLoading(false);
    }
  };

  if (!gstin) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(5,12,21,0.88)", backdropFilter: "blur(10px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card fade-in" style={{
        width: "min(880px, 96vw)", maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 0 80px rgba(0,212,255,0.12)",
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--bg-surface)", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              {loading ? "Loading…" : detail?.company.company_name}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "3px" }}>
              {gstin}
            </div>
          </div>
          {detail && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                fontSize: "28px", fontWeight: 800,
                color: scoreColor(detail.company.fraud_score),
                fontFamily: "var(--font-mono)",
              }}>
                {detail.company.fraud_score.toFixed(1)}
              </div>
              <div>
                <div style={{ fontSize: "9px", color: "var(--text-muted)", marginBottom: "4px" }}>FRAUD SCORE</div>
                <span className={riskClass(detail.company.risk_level)}>{detail.company.risk_level}</span>
              </div>
              {/* Explain with AI button */}
              <button
                className="btn btn--primary"
                onClick={handleExplain}
                disabled={explainLoading}
                style={{
                  padding: "8px 14px", fontSize: "12px",
                  background: explainLoading
                    ? "rgba(0,212,255,0.1)"
                    : "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.05))",
                  border: "1px solid rgba(0,212,255,0.4)",
                  borderRadius: "6px", cursor: "pointer",
                  color: "var(--cyan)", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: "6px",
                  transition: "all 200ms ease",
                }}
              >
                {explainLoading ? (
                  <>
                    <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                    Generating…
                  </>
                ) : "🔍 Explain with AI"}
              </button>
            </div>
          )}
          <button className="btn btn--ghost" onClick={onClose} style={{ padding: "6px 10px" }}>✕</button>
        </div>

        {loading && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            Loading entity data…
          </div>
        )}

        {detail && !loading && (
          <div style={{ overflowY: "auto", flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── RAG Explanation Panel ── */}
            {(explain || explainLoading) && (
              <div style={{
                padding: "16px 20px",
                background: "linear-gradient(135deg, rgba(0,212,255,0.06), rgba(0,212,255,0.02))",
                border: "1px solid rgba(0,212,255,0.25)",
                borderRadius: "10px",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                  background: "linear-gradient(90deg, var(--cyan), transparent)",
                }} />
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  marginBottom: "12px",
                }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "6px",
                    background: "rgba(0,212,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px",
                  }}>🤖</div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--cyan)" }}>
                      AI Investigation Summary
                    </div>
                    {explain && (
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "1px" }}>
                        {explain.rag_enabled ? "RAG-enhanced" : "Rule-based"} · {explain.llm_model}
                      </div>
                    )}
                  </div>
                </div>

                {explainLoading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", fontSize: "13px" }}>
                    <div style={{
                      width: "16px", height: "16px", borderRadius: "50%",
                      border: "2px solid var(--border)",
                      borderTopColor: "var(--cyan)",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    Retrieving relevant GST regulations and past case patterns…
                  </div>
                ) : explain && (
                  <>
                    <p style={{
                      fontSize: "13px", lineHeight: "1.7",
                      color: "var(--text-secondary)",
                      margin: "0 0 12px 0",
                    }}>
                      {explain.explanation}
                    </p>
                    {explain.sources.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Sources:</span>
                        {[...new Set(explain.sources)].map(s => (
                          <span key={s} style={{
                            fontSize: "9px", padding: "2px 8px",
                            background: "rgba(0,212,255,0.08)",
                            border: "1px solid rgba(0,212,255,0.15)",
                            borderRadius: "10px", color: "var(--cyan)",
                          }}>
                            {s.replace(".txt", "").replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Two-column body ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flexShrink: 0 }}>
              {/* Left column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Company Info */}
                <Section title="Company Info">
                  <InfoRow label="State"        value={detail.company.state} />
                  <InfoRow label="Registered"   value={detail.company.registration_date} />
                  <InfoRow label="In-degree"    value={String(detail.metrics.in_degree  ?? "—")} />
                  <InfoRow label="Out-degree"   value={String(detail.metrics.out_degree ?? "—")} />
                  <InfoRow label="Total Inflow" value={fmtCurrency(detail.metrics.inflow ?? 0)} />
                  <InfoRow label="Total Outflow" value={fmtCurrency(detail.metrics.outflow ?? 0)} />
                  {(detail.company as any).status && (
                    <InfoRow label="Status" value={(detail.company as any).status} />
                  )}
                </Section>

                {/* Feature Scores */}
                <Section title="Fraud Features">
                  <FeatureBar label="Tax Mismatch Ratio"   value={detail.features.tax_mismatch_ratio}    max={5} />
                  <FeatureBar label="Volume Spike"         value={detail.features.volume_spike_score}     max={30} />
                  <FeatureBar label="Ring Participations"  value={detail.features.cycle_participation}    max={5} />
                  <FeatureBar label="Shell Score"          value={detail.features.shell_company_score}    max={1} />
                  <FeatureBar label="Duplicate Invoices"   value={detail.features.duplicate_invoice_count} max={10} />
                  <FeatureBar label="PageRank Anomaly"     value={detail.features.pagerank_anomaly}       max={5} />
                </Section>

                {/* Fraud Rings */}
                {detail.participating_rings.length > 0 && (
                  <Section title={`Fraud Rings (${detail.participating_rings.length})`}>
                    {detail.participating_rings.map(r => (
                      <div key={r.ring_id} style={{
                        padding: "8px", borderRadius: "6px",
                        background: "rgba(255,71,87,0.06)",
                        border: "1px solid rgba(255,71,87,0.15)",
                        marginBottom: "6px", fontSize: "11px",
                      }}>
                        <span style={{ color: "var(--red)", fontWeight: 600 }}>Ring #{r.ring_id}</span>
                        <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>
                          {r.cycle_length} entities · {fmtCurrency(r.total_cycling_value)}
                        </span>
                      <div style={{ marginTop: "4px", color: "var(--text-muted)", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                          {(Array.isArray(r.cycle_path) ? r.cycle_path : JSON.parse(r.cycle_path as unknown as string)).join(" → ")}
                        </div>
                      </div>
                    ))}
                  </Section>
                )}
              </div>

              {/* Right column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Radar Chart */}
                <Section title="Risk Radar">
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <svg ref={radarRef} width="200" height="200" style={{ overflow: "visible" }} />
                  </div>
                </Section>

                {/* Filing history */}
                <Section title="Monthly Filing (GSTR-3B)">
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "var(--text-muted)" }}>
                          <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 500 }}>Period</th>
                          <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 500 }}>ITC Claimed</th>
                          <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 500 }}>Output Tax</th>
                          <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 500 }}>Net Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.gstr3b.filter(r => r.input_tax_credit_claimed || r.output_tax_declared).slice(-6).map(r => {
                          const mismatch = (r.input_tax_credit_claimed ?? 0) > (r.output_tax_declared ?? 0) * 1.2;
                          return (
                            <tr key={r.period} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "4px 0", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                                {r.period}
                              </td>
                              <td style={{ textAlign: "right", padding: "4px 0", color: mismatch ? "var(--red)" : "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                                {fmtCurrency(r.input_tax_credit_claimed ?? 0)}
                              </td>
                              <td style={{ textAlign: "right", padding: "4px 0", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                                {fmtCurrency(r.output_tax_declared ?? 0)}
                              </td>
                              <td style={{ textAlign: "right", padding: "4px 0", color: "var(--green)", fontFamily: "var(--font-mono)" }}>
                                {fmtCurrency(r.net_tax_paid ?? 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Section>

                {/* Recent invoices */}
                <Section title="Recent Invoices Issued">
                  {detail.invoices_sent.slice(0, 5).map(inv => (
                    <div key={inv.invoice_id} style={{
                      padding: "6px 0", borderBottom: "1px solid var(--border)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      fontSize: "10px",
                    }}>
                      <div>
                        <div style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                          {inv.invoice_id}
                        </div>
                        <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                          To: {inv.buyer_name} · {inv.invoice_date}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                          {fmtCurrency(inv.invoice_amount)}
                        </div>
                        {inv.fraud_tag !== "normal" && (
                          <span style={{ fontSize: "9px", color: "var(--red)", background: "var(--red-dim)", padding: "1px 4px", borderRadius: "3px" }}>
                            {inv.fraud_tag}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </Section>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "14px" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: "11px" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

function FeatureBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 66 ? "var(--red)" : pct > 33 ? "var(--yellow)" : "var(--green)";
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "10px" }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span style={{ color, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
          {typeof value === "number" && value % 1 === 0 ? value : value.toFixed(3)}
        </span>
      </div>
      <div className="score-bar">
        <div className="score-bar__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Radar Chart (D3) ─────────────────────────────────────────────────────────

function drawRadar(svg: SVGSVGElement, feats: { label: string; value: number }[], accentColor: string) {
  const d3svg = d3.select(svg);
  d3svg.selectAll("*").remove();

  const W = 200, H = 200, R = 75;
  const cx = W / 2, cy = H / 2;
  const n = feats.length;
  const step = (2 * Math.PI) / n;

  const levels = 5;
  const levelGroup = d3svg.append("g");
  for (let l = 1; l <= levels; l++) {
    const r = (R / levels) * l;
    const pts = feats.map((_, i) => {
      const angle = i * step - Math.PI / 2;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });
    levelGroup.append("polygon")
      .attr("points", pts.map(p => p.join(",")).join(" "))
      .attr("fill", "none")
      .attr("stroke", "rgba(0,212,255,0.1)")
      .attr("stroke-width", 1);
  }

  // Axes + labels
  feats.forEach((f, i) => {
    const angle = i * step - Math.PI / 2;
    d3svg.append("line")
      .attr("x1", cx).attr("y1", cy)
      .attr("x2", cx + R * Math.cos(angle))
      .attr("y2", cy + R * Math.sin(angle))
      .attr("stroke", "rgba(0,212,255,0.15)").attr("stroke-width", 1);
    const lx = cx + (R + 18) * Math.cos(angle);
    const ly = cy + (R + 18) * Math.sin(angle);
    d3svg.append("text")
      .attr("x", lx).attr("y", ly)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .attr("font-size", "8px").attr("fill", "var(--text-muted)")
      .text(f.label);
  });

  // Data polygon
  const pts = feats.map((f, i) => {
    const angle = i * step - Math.PI / 2;
    const r = f.value * R;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
  });

  d3svg.append("polygon")
    .attr("points", pts.map(p => p.join(",")).join(" "))
    .attr("fill", `${accentColor}20`)
    .attr("stroke", accentColor)
    .attr("stroke-width", 2);

  pts.forEach(([px, py]) => {
    d3svg.append("circle").attr("cx", px).attr("cy", py).attr("r", 3).attr("fill", accentColor);
  });
}
