import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { EntityDetail, ExplainResult } from "../lib/types";
import { scoreColor, riskClass, fmtCurrency, api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { XIcon, BotIcon, LoaderIcon, FileTextIcon, SparklesIcon, LinkIcon, BuildingIcon, BarChartIcon, ActivityIcon } from "./Icons";

interface Props {
  gstin:   string | null;
  period?: string;
  onClose: () => void;
}

export function EntityDetail({ gstin, period, onClose }: Props) {
  const { can } = useAuth();
  const [detail,   setDetail]   = useState<EntityDetail | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [explain,  setExplain]  = useState<ExplainResult | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const radarRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!gstin) { setDetail(null); setExplain(null); return; }
    setLoading(true);
    setExplain(null);
    api.company(gstin, period)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [gstin, period]);

  // Draw radar chart
  useEffect(() => {
    if (!detail || !radarRef.current) return;
    const f = detail.features;
    const getVal = (v: any, max: number) => {
      const num = Number(v) || 0;
      // enforce minimum 0.03 radius to prevent 1D 0-area polygons and overlapping center point artifacts
      return Math.max(0.03, Math.min(num / max, 1));
    };

    const feats = [
      { label: "Tax Mismatch",  value: getVal(f.tax_mismatch_ratio, 5) },
      { label: "Vol. Spike",    value: getVal(f.volume_spike_score, 30) },
      { label: "Duplicates",    value: getVal(f.duplicate_invoice_count, 10) },
      { label: "Ring Member",   value: getVal(f.cycle_participation, 5) },
      { label: "Shell Score",   value: getVal(f.shell_company_score, 1) },
      { label: "PR Anomaly",    value: getVal(f.pagerank_anomaly, 5) },
    ];
    drawRadar(radarRef.current, feats, scoreColor(detail.company.fraud_score));
  }, [detail]);

  const handleExplain = async () => {
    if (!gstin || explainLoading) return;
    setExplainLoading(true);
    try {
      const result = await api.explain(gstin, period);
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
    <div className="entity-detail-modal" style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "var(--space-6)",
      background: "rgba(15, 23, 42, 0.5)", 
      backdropFilter: "blur(12px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in entity-detail-content" style={{
        width: "min(1100px, 95vw)", 
        maxHeight: "92vh",
        display: "flex", 
        flexDirection: "column",
        borderRadius: "24px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}>
        {/* ══════════════════════════════════════════════════════════════════════
            HEADER - Company name, score, and actions
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="entity-detail-header" style={{
          padding: "28px 36px",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex", 
          alignItems: "center", 
          gap: "24px",
          flexShrink: 0,
        }}>
          {/* Company Info */}
          <div style={{ flex: 1 }}>
            <h1 style={{ 
              fontSize: "28px", 
              fontWeight: 700, 
              color: "var(--text-primary)",
              marginBottom: "6px",
              letterSpacing: "-0.02em",
            }}>
              {loading ? "Loading…" : detail?.company.company_name}
            </h1>
            <p style={{ 
              fontSize: "15px", 
              color: "var(--text-muted)", 
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}>
              {gstin}
            </p>
          </div>

          {detail && (
            <>
              {/* Fraud Score Badge */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 24px",
                background: "var(--bg-elevated)",
                borderRadius: "16px",
                border: "1px solid var(--border)",
              }}>
                <div style={{
                  fontSize: "42px", 
                  fontWeight: 800,
                  color: scoreColor(detail.company.fraud_score),
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}>
                  {detail.company.fraud_score.toFixed(1)}
                </div>
                <div>
                  <div style={{ 
                    fontSize: "12px", 
                    color: "var(--text-muted)", 
                    marginBottom: "6px",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}>
                    Fraud Score
                  </div>
                  <span className={riskClass(detail.company.risk_level)} style={{
                    fontSize: "13px",
                    padding: "6px 14px",
                    fontWeight: 700,
                  }}>
                    {detail.company.risk_level}
                  </span>
                </div>
              </div>
              
              {/* AI Button - Only for auditors */}
              {can("use_rag_explain") && (
                <button
                  className="btn btn--primary"
                  onClick={handleExplain}
                  disabled={explainLoading}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "10px",
                    padding: "16px 24px",
                    fontSize: "15px",
                    fontWeight: 600,
                    borderRadius: "14px",
                  }}
                >
                  {explainLoading ? (
                    <>
                      <LoaderIcon size={18} />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <SparklesIcon size={18} />
                      Explain with AI
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {/* Close Button */}
          <button 
            onClick={onClose} 
            style={{ 
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-muted)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-surface)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ 
            padding: "80px", 
            textAlign: "center", 
            color: "var(--text-muted)",
            fontSize: "16px",
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <LoaderIcon size={40} color="var(--primary)" />
            </div>
            Loading entity data...
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            MAIN CONTENT
        ══════════════════════════════════════════════════════════════════════ */}
        {detail && !loading && (
          <div style={{ 
            overflowY: "auto", 
            flex: 1, 
            padding: "32px 36px", 
            display: "flex", 
            flexDirection: "column", 
            gap: "28px",
            background: "var(--bg-base)",
          }}>

            {/* AI Explanation Panel */}
            {(explain || explainLoading) && (
              <div style={{
                padding: "24px",
                background: "linear-gradient(135deg, rgba(37, 99, 235, 0.06) 0%, rgba(37, 99, 235, 0.02) 100%)",
                border: "1px solid rgba(37, 99, 235, 0.15)",
                borderRadius: "16px",
                position: "relative",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  marginBottom: "16px",
                }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "12px",
                    background: "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <BotIcon size={22} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)" }}>
                      AI Investigation Summary
                    </div>
                    {explain && (
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {explain.rag_enabled ? "RAG-enhanced" : "Rule-based"} · {explain.llm_model}
                      </div>
                    )}
                  </div>
                </div>

                {explainLoading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-muted)", fontSize: "15px" }}>
                    <LoaderIcon size={18} color="var(--primary)" />
                    Retrieving relevant GST regulations and patterns…
                  </div>
                ) : explain && (
                  <>
                    <FormattedExplanation text={explain.explanation} />
                    {explain.sources.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(37, 99, 235, 0.15)" }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                          <FileTextIcon size={14} />
                          Sources:
                        </span>
                        {[...new Set(explain.sources)].map(s => (
                          <span key={s} style={{
                            fontSize: "12px", padding: "6px 12px",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "20px", 
                            color: "var(--text-secondary)",
                            fontWeight: 500,
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

            {/* ══════════════════════════════════════════════════════════════════
                TWO COLUMN LAYOUT
            ══════════════════════════════════════════════════════════════════ */}
            <div className="entity-detail-grid">
              
              {/* ─────────────────────────────────────────────────────────────────
                  LEFT COLUMN
              ───────────────────────────────────────────────────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

                {/* Company Info Card */}
                <DashboardCard 
                  title="Company Info" 
                  icon={<BuildingIcon size={18} color="var(--primary)" />}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <InfoRow label="State" value={detail.company.state} />
                    <InfoRow label="Registered" value={detail.company.registration_date} />
                    <InfoRow label="In-degree" value={String(detail.metrics.in_degree ?? "—")} />
                    <InfoRow label="Out-degree" value={String(detail.metrics.out_degree ?? "—")} />
                    <InfoRow label="Total Inflow" value={fmtCurrency(detail.metrics.inflow ?? 0)} highlight />
                    <InfoRow label="Total Outflow" value={fmtCurrency(detail.metrics.outflow ?? 0)} highlight />
                    {(detail.company as any).status && (
                      <InfoRow label="Status" value={(detail.company as any).status} />
                    )}
                  </div>
                </DashboardCard>

                {/* Fraud Features Card */}
                <DashboardCard 
                  title="Fraud Features" 
                  icon={<ActivityIcon size={18} color="var(--orange)" />}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <FeatureBar label="Tax Mismatch Ratio" value={detail.features.tax_mismatch_ratio} max={5} />
                    <FeatureBar label="Volume Spike" value={detail.features.volume_spike_score} max={30} />
                    <FeatureBar label="Ring Participations" value={detail.features.cycle_participation} max={5} />
                    <FeatureBar label="Shell Score" value={detail.features.shell_company_score} max={1} />
                    <FeatureBar label="Duplicate Invoices" value={detail.features.duplicate_invoice_count} max={10} />
                    <FeatureBar label="PageRank Anomaly" value={detail.features.pagerank_anomaly} max={5} />
                  </div>
                </DashboardCard>

                {/* Fraud Rings */}
                {detail.participating_rings.length > 0 && (
                  <DashboardCard 
                    title={`Fraud Rings (${detail.participating_rings.length})`}
                    icon={<LinkIcon size={18} color="var(--red)" />}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {detail.participating_rings.map(r => (
                        <div key={r.ring_id} style={{
                          padding: "14px 16px", 
                          borderRadius: "12px",
                          background: "var(--red-light)",
                          border: "1px solid rgba(220, 38, 38, 0.15)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                            <span style={{ color: "var(--red)", fontWeight: 700, fontSize: "14px" }}>Ring #{r.ring_id}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                              {r.cycle_length} entities
                            </span>
                          </div>
                          <div style={{ color: "var(--red)", fontWeight: 600, fontSize: "15px", marginBottom: "6px" }}>
                            {fmtCurrency(r.total_cycling_value)}
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
                            {(Array.isArray(r.cycle_path) ? r.cycle_path : JSON.parse(r.cycle_path as unknown as string)).join(" → ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </DashboardCard>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────────────
                  RIGHT COLUMN
              ───────────────────────────────────────────────────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

                {/* Risk Radar Card - LARGER */}
                <DashboardCard 
                  title="Risk Radar" 
                  icon={<BarChartIcon size={18} color="var(--green)" />}
                >
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "center", 
                    alignItems: "center",
                    padding: "20px 0",
                    minHeight: "280px",
                  }}>
                    <svg ref={radarRef} width="260" height="260" style={{ overflow: "visible" }} />
                  </div>
                </DashboardCard>

                {/* Monthly Filing Table */}
                <DashboardCard title="Monthly Filing (GSTR-3B)">
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border)" }}>
                          <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Period</th>
                          <th style={{ textAlign: "right", padding: "12px 8px", fontWeight: 600, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>ITC Claimed</th>
                          <th style={{ textAlign: "right", padding: "12px 8px", fontWeight: 600, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Output Tax</th>
                          <th style={{ textAlign: "right", padding: "12px 8px", fontWeight: 600, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.gstr3b.filter(r => r.input_tax_credit_claimed || r.output_tax_declared).slice(-6).map(r => {
                          const mismatch = (r.input_tax_credit_claimed ?? 0) > (r.output_tax_declared ?? 0) * 1.2;
                          return (
                            <tr key={r.period} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td style={{ padding: "14px 8px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                                {r.period}
                              </td>
                              <td style={{ textAlign: "right", padding: "14px 8px", color: mismatch ? "var(--red)" : "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: mismatch ? 600 : 400 }}>
                                {fmtCurrency(r.input_tax_credit_claimed ?? 0)}
                              </td>
                              <td style={{ textAlign: "right", padding: "14px 8px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                                {fmtCurrency(r.output_tax_declared ?? 0)}
                              </td>
                              <td style={{ textAlign: "right", padding: "14px 8px", color: "var(--green)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                                {fmtCurrency(r.net_tax_paid ?? 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </DashboardCard>

                {/* Recent Invoices */}
                <DashboardCard title="Recent Invoices Issued">
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {detail.invoices_sent.slice(0, 5).map((inv, idx) => (
                      <div key={inv.invoice_id} style={{
                        padding: "14px 0", 
                        borderBottom: idx < 4 ? "1px solid var(--border)" : "none",
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                      }}>
                        <div>
                          <div style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 500 }}>
                            {inv.invoice_id}
                          </div>
                          <div style={{ color: "var(--text-muted)", marginTop: "4px", fontSize: "13px" }}>
                            To: {inv.buyer_name} · {inv.invoice_date}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "var(--primary)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "15px" }}>
                            {fmtCurrency(inv.invoice_amount)}
                          </div>
                          {inv.fraud_tag !== "normal" && (
                            <span style={{ 
                              fontSize: "11px", 
                              color: "var(--red)", 
                              background: "var(--red-light)", 
                              padding: "3px 8px", 
                              borderRadius: "6px",
                              fontWeight: 600,
                              marginTop: "4px",
                              display: "inline-block",
                            }}>
                              {inv.fraud_tag}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </DashboardCard>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        /* Mobile Responsive Styles for Entity Detail Modal */
        @media (max-width: 900px) {
          .entity-detail-content {
            width: 96vw !important;
            maxHeight: 95vh !important;
            borderRadius: 20px !important;
          }
        }
        
        @media (max-width: 768px) {
          .entity-detail-modal {
            padding: var(--space-3) !important;
          }
          .entity-detail-header {
            padding: 20px 24px !important;
            flex-wrap: wrap;
            gap: 16px !important;
          }
          .entity-detail-header h1 {
            font-size: 22px !important;
          }
          .entity-detail-header p {
            font-size: 13px !important;
          }
          .entity-detail-grid {
            padding: 20px 24px !important;
          }
        }
        
        @media (max-width: 640px) {
          .entity-detail-modal {
            padding: 0 !important;
            align-items: flex-end !important;
          }
          .entity-detail-content {
            width: 100% !important;
            max-height: 95vh !important;
            border-radius: 20px 20px 0 0 !important;
          }
          .entity-detail-header {
            padding: 16px 20px !important;
            flex-direction: column;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .entity-detail-header h1 {
            font-size: 20px !important;
            margin-bottom: 4px !important;
          }
          .entity-detail-header p {
            font-size: 12px !important;
          }
          .entity-detail-header > div:nth-child(2) {
            width: 100%;
            justify-content: space-between;
          }
          .entity-detail-grid {
            padding: 16px 20px !important;
            gap: 20px !important;
          }
          svg[width="260"] {
            width: 100% !important;
            height: auto !important;
            max-width: 240px !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

// Format AI explanation with bold keywords and structured layout
function FormattedExplanation({ text }: { text: string }) {
  // Split by "RECOMMENDED ACTION:" to separate findings from actions
  const parts = text.split(/RECOMMENDED ACTION:/i);
  const findings = parts[0]?.trim() || "";
  const actions = parts[1]?.trim() || "";

  // Function to highlight important terms
  const highlightText = (str: string) => {
    // Patterns to bold - legal sections, key terms, numbers
    const patterns = [
      // Legal sections and rules
      /\b(Section\s+\d+(?:\(\d+\))?(?:\([a-z]\))?)/gi,
      /\b(Rule\s+\d+[A-Z]?)/gi,
      /\b(CBIC\s+Circular\s+[\d/]+)/gi,
      /\b(CGST\s+Act)/gi,
      // Key fraud terms
      /\b(circular\s+trading\s+ring(?:s)?)/gi,
      /\b(carousel\s+fraud)/gi,
      /\b(closed\s+invoice\s+loop)/gi,
      /\b(shell\s+company)/gi,
      /\b(fake\s+invoic(?:e|es|ing))/gi,
      /\b(ITC\s+fraud)/gi,
      /\b(tax\s+evasion)/gi,
      // Numbers and amounts
      /\b(Rs\.?\s*[\d,.]+\s*(?:Crore|Lakh|L)?)/gi,
      /\b(\d+\s*(?:circular\s+trading\s+ring|ring|entities|invoices))/gi,
      // Enforcement terms
      /\b(DGGI)/g,
      /\b(Block\s+ITC)/gi,
      /\b(physical\s+verification)/gi,
    ];

    let result = str;
    patterns.forEach(pattern => {
      result = result.replace(pattern, '<strong>$1</strong>');
    });
    return result;
  };

  return (
    <div style={{ fontSize: "15px", lineHeight: "1.8", color: "var(--text-secondary)" }}>
      {/* Main Findings */}
      <div 
        style={{ marginBottom: actions ? "20px" : 0 }}
        dangerouslySetInnerHTML={{ __html: highlightText(findings) }}
      />
      
      {/* Recommended Actions - separate box */}
      {actions && (
        <div style={{
          marginTop: "16px",
          padding: "16px 20px",
          background: "rgba(234, 88, 12, 0.08)",
          border: "1px solid rgba(234, 88, 12, 0.2)",
          borderRadius: "12px",
          borderLeft: "4px solid var(--orange)",
        }}>
          <div style={{ 
            fontSize: "12px", 
            fontWeight: 700, 
            color: "var(--orange)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            Recommended Action
          </div>
          <div 
            style={{ color: "var(--text-primary)", fontWeight: 500 }}
            dangerouslySetInnerHTML={{ __html: highlightText(actions) }}
          />
        </div>
      )}
    </div>
  );
}

function DashboardCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ 
      background: "var(--bg-surface)", 
      borderRadius: "16px",
      border: "1px solid var(--border)",
      overflow: "hidden",
    }}>
      {/* Card Header */}
      <div style={{ 
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "var(--bg-surface)",
      }}>
        {icon && (
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {icon}
          </div>
        )}
        <h3 style={{ 
          fontSize: "14px", 
          fontWeight: 700, 
          color: "var(--text-primary)",
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
        }}>
          {title}
        </h3>
      </div>
      {/* Card Body */}
      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center",
      padding: "12px 0", 
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>{label}</span>
      <span style={{ 
        color: highlight ? "var(--primary)" : "var(--text-primary)", 
        fontFamily: "var(--font-mono)", 
        fontSize: "14px",
        fontWeight: highlight ? 600 : 500,
      }}>
        {value}
      </span>
    </div>
  );
}

function FeatureBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 66 ? "var(--red)" : pct > 33 ? "var(--orange)" : "var(--green)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{label}</span>
        <span style={{ color, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "14px" }}>
          {typeof value === "number" && value % 1 === 0 ? value : value.toFixed(3)}
        </span>
      </div>
      <div style={{
        height: "8px",
        background: "var(--bg-elevated)",
        borderRadius: "4px",
        overflow: "hidden",
      }}>
        <div style={{ 
          width: `${pct}%`, 
          height: "100%",
          background: color,
          borderRadius: "4px",
          transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Radar Chart (D3) ─────────────────────────────────────────────────────────

function drawRadar(svg: SVGSVGElement, feats: { label: string; value: number }[], accentColor: string) {
  const d3svg = d3.select(svg);
  d3svg.selectAll("*").remove();

  // Larger size for better visibility
  const W = 260, H = 260, R = 95;
  const cx = W / 2, cy = H / 2;
  const n = feats.length;
  const step = (2 * Math.PI) / n;

  // Grid levels - light theme colors
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
      .attr("stroke", "rgba(0, 0, 0, 0.08)")
      .attr("stroke-width", 1);
  }

  // Axes + labels
  feats.forEach((f, i) => {
    const angle = i * step - Math.PI / 2;
    d3svg.append("line")
      .attr("x1", cx).attr("y1", cy)
      .attr("x2", cx + R * Math.cos(angle))
      .attr("y2", cy + R * Math.sin(angle))
      .attr("stroke", "rgba(0, 0, 0, 0.08)")
      .attr("stroke-width", 1);
    const lx = cx + (R + 24) * Math.cos(angle);
    const ly = cy + (R + 24) * Math.sin(angle);
    d3svg.append("text")
      .attr("x", lx).attr("y", ly)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", "#64748b")
      .text(f.label);
  });

  // Data polygon
  const pts = feats.map((f, i) => {
    const angle = i * step - Math.PI / 2;
    const r = f.value * R;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
  });

  // Fill with accent color (with transparency)
  d3svg.append("polygon")
    .attr("points", pts.map(p => p.join(",")).join(" "))
    .attr("fill", `${accentColor}25`)
    .attr("stroke", accentColor)
    .attr("stroke-width", 2.5);

  // Data points
  pts.forEach(([px, py]) => {
    d3svg.append("circle")
      .attr("cx", px)
      .attr("cy", py)
      .attr("r", 5)
      .attr("fill", "white")
      .attr("stroke", accentColor)
      .attr("stroke-width", 2.5);
  });
}
