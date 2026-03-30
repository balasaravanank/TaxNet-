import React, { useState, useEffect, useCallback } from "react";
import { StatsBar }        from "./StatsBar";
import { NetworkGraph }    from "./NetworkGraph";
import { FraudLeaderboard } from "./FraudLeaderboard";
import { RingExplorer }    from "./RingExplorer";
import { EntityDetail }    from "./EntityDetail";
import { api }             from "../lib/api";
import type {
  DashboardStats, GraphData, Company, FraudRing, GraphNode
} from "../lib/types";

type Tab = "leaderboard" | "rings";

export function Dashboard() {
  const [stats,     setStats]     = useState<DashboardStats | null>(null);
  const [graph,     setGraph]     = useState<GraphData | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [rings,     setRings]     = useState<FraudRing[]>([]);
  const [loading,   setLoading]   = useState(true);

  const [tab,          setTab]          = useState<Tab>("leaderboard");
  const [selectedRing, setSelectedRing] = useState<FraudRing | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [detailGstin,  setDetailGstin]  = useState<string | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [hasRun,       setHasRun]       = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g, c, r] = await Promise.all([
        api.stats(), api.graph(), api.companies(), api.rings(),
      ]);
      setStats(s); setGraph(g); setCompanies(c); setRings(r);
    } catch (e) {
      console.error("Load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setDetailGstin(node.id);
  }, []);

  const handleCompanySelect = useCallback((c: Company) => {
    setDetailGstin(c.gstin);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await api.refresh();
    await load();
    setHasRun(true);
    setRefreshing(false);
  };

  const handleRunDetection = async () => {
    setHasRun(true);
    await handleRefresh();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await (api as any).ingest(file);
      await load();
    } catch (err) {
      console.error("Ingest error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* ── Top Bar ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: "52px", flexShrink: 0,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,212,255,0.05))",
            border: "1px solid rgba(0,212,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>🔍</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", letterSpacing: "0.02em" }}>
              GST FraudNet
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              AI-BASED FRAUD IDENTIFICATION SYSTEM
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            padding: "4px 10px",
            background: "rgba(46,213,115,0.1)",
            border: "1px solid rgba(46,213,115,0.2)",
            borderRadius: "4px",
            fontSize: "10px", color: "var(--green)", fontFamily: "var(--font-mono)",
          }}>
            ● LIVE
          </div>
          {/* CSV Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <button
            className="btn btn--ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload GSTR CSV to ingest new data"
            style={{ fontSize: "12px", padding: "6px 12px" }}
          >
            {uploading ? "⟳ Ingesting…" : "📂 Upload CSV"}
          </button>
          <button
            className="btn btn--primary"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{ fontSize: "12px", padding: "6px 12px" }}
          >
            {refreshing ? "⟳ Refreshing…" : "⟳ Refresh"}
          </button>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Team Code Novas · ITERYX '26
          </div>
        </div>
      </header>

      {/* ── Stats Bar ── */}
      <StatsBar stats={stats} loading={loading} />

      {/* ── Main Content ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left sidebar */}
        <div style={{
          width: "280px", flexShrink: 0,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Tab bar */}
          <div style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
          }}>
            {(["leaderboard", "rings"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "10px 0",
                background: tab === t ? "var(--bg-card)" : "transparent",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--cyan)" : "2px solid transparent",
                color: tab === t ? "var(--cyan)" : "var(--text-muted)",
                fontSize: "11px", fontWeight: 600, cursor: "pointer",
                letterSpacing: "0.04em", textTransform: "uppercase",
                transition: "all 150ms ease",
              }}>
                {t === "leaderboard" ? "🏆 Rankings" : "🔄 Rings"}
              </button>
            ))}
          </div>

          {tab === "leaderboard" ? (
            <FraudLeaderboard
              companies={companies}
              loading={loading}
              onSelect={handleCompanySelect}
              selected={companies.find(c => c.gstin === detailGstin) ?? null}
            />
          ) : (
            <RingExplorer
              rings={rings}
              loading={loading}
              selected={selectedRing}
              onSelect={ring => { setSelectedRing(ring); if (ring) setTab("rings"); }}
            />
          )}
        </div>

        {/* Graph area */}
        <div style={{
          flex: 1, position: "relative", overflow: "hidden",
          background: "var(--bg-base)",
        }}>
          {loading && (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "16px", zIndex: 10,
              background: "var(--bg-base)",
            }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                border: "3px solid var(--border)",
                borderTopColor: "var(--cyan)",
                animation: "spin 1s linear infinite",
              }} />
              <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                Building transaction graph…
              </div>
            </div>
          )}

          {/* ── Run Fraud Detection CTA (demo money shot) ── */}
          {!loading && !hasRun && (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "24px", zIndex: 5,
              background: "rgba(5,12,21,0.6)", backdropFilter: "blur(2px)",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", letterSpacing: "0.08em" }}>
                  TRANSACTION NETWORK LOADED · {stats?.total_entities ?? 0} ENTITIES · {stats?.total_invoices ?? 0} INVOICES
                </div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  Ready to run AI fraud detection
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Graph analysis · Isolation Forest · Cycle detection · RAG scoring
                </div>
              </div>
              <button
                onClick={handleRunDetection}
                disabled={refreshing}
                style={{
                  padding: "14px 36px",
                  fontSize: "15px", fontWeight: 700,
                  background: "linear-gradient(135deg, rgba(255,71,87,0.25), rgba(255,71,87,0.08))",
                  border: "1px solid rgba(255,71,87,0.5)",
                  borderRadius: "10px",
                  color: "var(--red)",
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  transition: "all 200ms ease",
                  boxShadow: "0 0 40px rgba(255,71,87,0.15)",
                  display: "flex", alignItems: "center", gap: "10px",
                }}
              >
                {refreshing ? (
                  <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Running…</>
                ) : (
                  <>🔍 Run Fraud Detection</>
                )}
              </button>
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                Will score {stats?.total_entities ?? 0} entities using 5 fraud signals in seconds
              </div>
            </div>
          )}
          <NetworkGraph
            data={graph}
            rings={rings}
            selectedRing={selectedRing}
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
          />

          {/* Ring selector overlay */}
          {rings.length > 0 && (
            <div style={{
              position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)",
              display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center",
              pointerEvents: "none",
            }}>
              {rings.slice(0, 5).map(ring => (
                <div key={ring.ring_id} style={{
                  padding: "4px 10px",
                  background: selectedRing?.ring_id === ring.ring_id
                    ? "rgba(255,71,87,0.2)" : "rgba(5,12,21,0.7)",
                  border: `1px solid ${selectedRing?.ring_id === ring.ring_id ? "var(--red)" : "var(--border)"}`,
                  borderRadius: "20px",
                  fontSize: "10px",
                  color: selectedRing?.ring_id === ring.ring_id ? "var(--red)" : "var(--text-muted)",
                  pointerEvents: "auto", cursor: "pointer",
                  backdropFilter: "blur(4px)",
                }}
                onClick={() => {
                  setSelectedRing(selectedRing?.ring_id === ring.ring_id ? null : ring);
                  setTab("rings");
                }}>
                  Ring #{ring.ring_id}
                </div>
              ))}
            </div>
          )}

          {/* Click hint */}
          <div style={{
            position: "absolute", top: "12px", right: "12px",
            padding: "6px 12px",
            background: "rgba(5,12,21,0.7)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "10px", color: "var(--text-muted)",
            backdropFilter: "blur(4px)",
          }}>
            Click any node to inspect · Drag to move · Scroll to zoom
          </div>
        </div>
      </div>

      {/* Entity detail modal */}
      {detailGstin && (
        <EntityDetail
          gstin={detailGstin}
          onClose={() => { setDetailGstin(null); setSelectedNode(null); }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
