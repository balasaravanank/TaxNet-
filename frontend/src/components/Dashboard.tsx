import React, { useState, useEffect, useCallback } from "react";
import { StatsBar }        from "./StatsBar";
import { NetworkGraph }    from "./NetworkGraph";
import { FraudLeaderboard } from "./FraudLeaderboard";
import { RingExplorer }    from "./RingExplorer";
import { EntityDetail }    from "./EntityDetail";
import { Notification }    from "./Notification";
import { UploadHistory }   from "./UploadHistory";
import { AdminConsole }    from "./AdminConsole2";
import { api, fmtCurrency } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { ROLE_CONFIG } from "../lib/permissions";
import { 
  ShieldIcon, 
  RefreshIcon, 
  UploadIcon, 
  SearchIcon, 
  RocketIcon, 
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderIcon,
  ActivityIcon,
  TargetIcon,
  NetworkIcon,
  ArrowRightIcon,
  GridIcon,
  EyeIcon,
  XIcon,
  LinkIcon,
  DatabaseIcon,
  UserIcon,
  LogoutIcon,
  ChevronDownIcon,
  CalendarIcon,
} from "./Icons";
import type {
  DashboardStats, GraphData, Company, FraudRing, GraphNode
} from "../lib/types";

type Page = "dashboard" | "graph";
type Tab = "leaderboard" | "rings";

export function Dashboard() {
  const { user, logout, can } = useAuth();
  const [stats,     setStats]     = useState<DashboardStats | null>(null);
  const [graph,     setGraph]     = useState<GraphData | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [rings,     setRings]     = useState<FraudRing[]>([]);
  const [loading,   setLoading]   = useState(true);

  const [page,         setPage]         = useState<Page>("dashboard");
  const [tab,          setTab]          = useState<Tab>("leaderboard");
  const [selectedRing, setSelectedRing] = useState<FraudRing | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [detailGstin,  setDetailGstin]  = useState<string | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [hasRun,       setHasRun]       = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [showHistory, setShowHistory]  = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdminConsole, setShowAdminConsole] = useState(false);
  const [period, setPeriod] = useState<string>("all");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Notification state
  const [notification, setNotification] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
    details?: { label: string; value: string | number }[];
  }>({
    show: false,
    type: "success",
    title: "",
    message: "",
    details: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = period === "all" ? undefined : period;
      const [s, g, c, r] = await Promise.all([
        api.stats(p), api.graph(p), api.companies(p), api.rings(p),
      ]);
      setStats(s); setGraph(g); setCompanies(c); setRings(r);
    } catch (e) {
      console.error("Load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

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
    const p = period === "all" ? undefined : period;
    await api.refresh(p);
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
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setNotification({
        show: true,
        type: "error",
        title: "Invalid File Type",
        message: "Please upload a CSV file with .csv extension.",
        details: [],
      });
      return;
    }
    
    setUploading(true);
    try {
      const result = await api.ingest(file);
      console.log("Upload result:", result);
      
      // Show success message
      if (result.status === 'ok') {
        setNotification({
          show: true,
          type: "success",
          title: "Success!",
          message: result.message || "CSV uploaded and analysis completed successfully.",
          details: [
            { label: "Invoices Inserted", value: result.invoices_inserted || 0 },
            { label: "New Entities", value: result.new_entities || 0 },
          ],
        });
        
        // Reload data
        await load();
      } else {
        setNotification({
          show: true,
          type: "error",
          title: "Upload Failed",
          message: result.error || "Unknown error occurred during upload.",
          details: [],
        });
      }
    } catch (err: any) {
      console.error("Ingest error:", err);
      
      // Try to parse error response
      let errorMsg = 'Upload failed. Check console for details.';
      try {
        if (err.response) {
          const errorData = await err.response.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } else if (err.message) {
          errorMsg = err.message;
        }
      } catch {}
      
      setNotification({
        show: true,
        type: "error",
        title: "Upload Error",
        message: errorMsg,
        details: [
          { label: "Backend Status", value: "Check port 5000" },
          { label: "CSV Format", value: "Verify columns" },
        ],
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // FULL GRAPH PAGE
  // ══════════════════════════════════════════════════════════════════════════════
  if (page === "graph") {
    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        height: "100vh", 
        overflow: "hidden",
        background: "var(--bg-base)"
      }}>
        {/* Graph Page Header */}
        <header className="graph-page-header" style={{
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          padding: "0 24px", 
          height: "64px", 
          flexShrink: 0,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => setPage("dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                color: "var(--text-secondary)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-surface)"; e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              <ChevronLeftIcon size={18} />
              Back to Dashboard
            </button>
            <div style={{ height: "24px", width: "1px", background: "var(--border)" }} />
            <h1 style={{ 
              fontSize: "18px", 
              fontWeight: 700, 
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <NetworkIcon size={22} color="var(--primary)" />
              Transaction Network Graph
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Ring Filter Pills */}
            {rings.length > 0 && (
              <div style={{ display: "flex", gap: "8px", marginRight: "8px" }}>
                {rings.slice(0, 5).map(ring => (
                  <button
                    key={ring.ring_id}
                    onClick={() => setSelectedRing(selectedRing?.ring_id === ring.ring_id ? null : ring)}
                    style={{
                      padding: "6px 14px",
                      background: selectedRing?.ring_id === ring.ring_id ? "var(--red)" : "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: selectedRing?.ring_id === ring.ring_id ? "white" : "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Ring #{ring.ring_id}
                  </button>
                ))}
              </div>
            )}
            
            <div style={{
              padding: "8px 14px",
              background: "var(--bg-elevated)",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              <ActivityIcon size={14} />
              {graph?.nodes?.length ?? 0} Nodes · {graph?.links?.length ?? 0} Edges
            </div>
          </div>
        </header>

        {/* Full Graph Area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <NetworkGraph
            data={graph}
            rings={rings}
            selectedRing={selectedRing}
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
          />

          {/* Selected Ring Info Banner */}
          {selectedRing && (
            <div style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "12px 20px",
              background: "var(--red-light)",
              border: "2px solid var(--red)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              boxShadow: "0 8px 24px rgba(220, 38, 38, 0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <LinkIcon size={18} color="var(--red)" />
                <span style={{ fontWeight: 700, color: "var(--red)", fontSize: "15px" }}>
                  Ring #{selectedRing.ring_id}
                </span>
                <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  — {selectedRing.cycle_length} entities · {fmtCurrency(selectedRing.total_cycling_value)} cycled
                </span>
              </div>
              <button
                onClick={() => setSelectedRing(null)}
                style={{
                  padding: "6px 12px",
                  background: "white",
                  border: "1px solid var(--red)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--red)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <XIcon size={12} />
                Clear
              </button>
            </div>
          )}

          {/* Help hint */}
          <div style={{
            position: "absolute", 
            top: "20px", 
            left: "20px",
            padding: "12px 16px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            fontSize: "13px", 
            color: "var(--text-muted)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <EyeIcon size={16} />
            Click nodes to inspect · Drag to pan · Scroll to zoom
          </div>
        </div>

        {/* Entity Detail Modal */}
        {detailGstin && (
          <EntityDetail
            gstin={detailGstin}
            period={period === "all" ? undefined : period}
            onClose={() => { setDetailGstin(null); setSelectedNode(null); }}
          />
        )}

        {/* Custom Notification */}
        <Notification
          show={notification.show}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          details={notification.details}
          onClose={() => setNotification({ ...notification, show: false })}
        />
        
        <style>{`
          /* Graph Page Mobile Responsive Styles */
          @media (max-width: 768px) {
            .graph-page-header {
              padding: 0 16px !important;
              height: auto !important;
              min-height: 56px;
              flex-wrap: wrap;
              gap: 12px !important;
            }
            .graph-page-header h1 {
              font-size: 16px !important;
            }
            .graph-page-header > div:first-child {
              width: 100%;
            }
            .graph-page-header > div:last-child {
              width: 100%;
              justify-content: flex-start;
              flex-wrap: wrap;
              gap: 8px !important;
            }
            .graph-page-header button {
              font-size: 12px !important;
              padding: 6px 12px !important;
            }
          }
          
          @media (max-width: 640px) {
            .graph-page-header {
              padding: 0 12px !important;
            }
            .graph-page-header > div:first-child > div:first-child {
              display: none; /* Hide separator */
            }
            .graph-page-header > div:last-child > div {
              font-size: 11px !important;
              padding: 6px 10px !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN DASHBOARD PAGE
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100vh", 
      overflow: "hidden",
      background: "var(--bg-base)"
    }}>

      {/* ════════════════════════════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════════════════════════ */}
      <header style={{
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        padding: "0 32px", 
        height: "72px", 
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Logo */}
          <div style={{
            width: "48px", 
            height: "48px", 
            borderRadius: "14px",
            background: "linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            color: "white",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
          }}>
            <ShieldIcon size={26} />
          </div>
          <div>
            <h1 style={{ 
              fontWeight: 800, 
              fontSize: "22px", 
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}>
              TaxNet
            </h1>
            <p style={{ 
              fontSize: "13px", 
              color: "var(--text-muted)",
              marginTop: "2px",
            }}>
              AI-Powered Fraud Detection
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Time Filter */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary)",
              pointerEvents: "none",
              display: "flex"
            }}>
              <CalendarIcon size={16} />
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={loading || refreshing || uploading}
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                padding: "8px 36px 8px 36px",
                borderRadius: "8px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
                minWidth: "160px",
                transition: "all 0.2s ease",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                opacity: (loading || refreshing || uploading) ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading && !refreshing && !uploading) {
                  e.currentTarget.style.borderColor = "var(--primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && !refreshing && !uploading) {
                  e.currentTarget.style.borderColor = "var(--border)";
                }
              }}
              onFocus={(e) => { 
                e.currentTarget.style.borderColor = "var(--primary)"; 
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(37,99,235,0.2)"; 
              }}
              onBlur={(e) => { 
                e.currentTarget.style.borderColor = "var(--border)"; 
                e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)"; 
              }}
            >
              <option value="14d">Last 14 Days</option>
              <option value="1m">Last 1 Month</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last 1 Year</option>
              <option value="all">All Time</option>
            </select>
            <div style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary)",
              pointerEvents: "none",
              display: "flex"
            }}>
              <ChevronDownIcon size={16} />
            </div>
          </div>

          {/* Status Badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "var(--green-light)",
            borderRadius: "20px",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--green)",
          }}>
            <span style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--green)",
              animation: "pulse 2s infinite",
            }} />
            System Active
          </div>

          {/* CSV Upload - Admin only */}
          {can("upload_data") && (
            <>
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
                title="Upload GSTR CSV"
                style={{ padding: "10px 18px", fontSize: "14px" }}
              >
                {uploading ? <LoaderIcon size={16} /> : <UploadIcon size={16} />}
                {uploading ? "Uploading..." : "Upload CSV"}
              </button>
            </>
          )}

          {/* Data Management - Admin only */}
          {can("manage_data") && (
            <button
              className="btn btn--ghost"
              onClick={() => setShowHistory(true)}
              title="Data Management"
              style={{ padding: "10px 18px", fontSize: "14px" }}
            >
              <DatabaseIcon size={16} />
              Data
            </button>
          )}
          
          {/* Refresh/Analysis - Auditor and Admin */}
          {can("run_analysis") && (
            <button
              className="btn btn--primary"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              style={{ padding: "10px 18px", fontSize: "14px" }}
            >
              {refreshing ? <LoaderIcon size={16} /> : <RefreshIcon size={16} />}
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          )}

          {/* User Menu */}
          <div style={{ position: "relative", marginLeft: "8px" }}>
            <button
              className="btn btn--ghost"
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ 
                padding: "8px 12px", 
                display: "flex", 
                alignItems: "center", 
                gap: "8px",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: user?.role ? ROLE_CONFIG[user.role]?.bg : "var(--primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserIcon size={16} color={user?.role ? ROLE_CONFIG[user.role]?.color : "var(--primary)"} />
              </div>
              <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {user?.name || "User"}
                </div>
                <div style={{ 
                  fontSize: "10px", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.05em",
                  color: user?.role ? ROLE_CONFIG[user.role]?.color : "var(--text-secondary)",
                }}>
                  {user?.role ? ROLE_CONFIG[user.role]?.label : "unknown"}
                </div>
              </div>
              <ChevronDownIcon 
                size={14} 
                color="var(--text-secondary)" 
                style={{ 
                  transform: showUserMenu ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }} 
              />
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <>
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 99,
                  }}
                  onClick={() => setShowUserMenu(false)}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                    minWidth: "200px",
                    overflow: "hidden",
                    zIndex: 100,
                    animation: "fadeIn 0.15s ease",
                  }}
                >
                  <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {user?.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {user?.email}
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "4px 10px",
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderRadius: "6px",
                        display: "inline-block",
                        background: user?.role ? ROLE_CONFIG[user.role]?.bg : "var(--primary-light)",
                        color: user?.role ? ROLE_CONFIG[user.role]?.color : "var(--primary)",
                      }}
                    >
                      {user?.role ? ROLE_CONFIG[user.role]?.label : "unknown"}
                    </div>
                  </div>
                  
                  {/* Admin Console - Admin only */}
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowAdminConsole(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "transparent",
                        border: "none",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                        borderBottom: "1px solid var(--border)",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(59,130,246,0.08)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <ShieldIcon size={16} />
                      Admin Console
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "transparent",
                      border: "none",
                      color: "var(--error)",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <LogoutIcon size={16} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════════════
          STATS BAR
      ════════════════════════════════════════════════════════════════════════ */}
      <StatsBar stats={stats} loading={loading} />

      {/* ════════════════════════════════════════════════════════════════════════
          MAIN CONTENT - Dashboard Grid
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="dashboard-grid">

        {/* ─────────────────────────────────────────────────────────────────────
            GRAPH BOX (Left Column)
        ───────────────────────────────────────────────────────────────────── */}
        <div 
          className="dashboard-graph-card"
          style={{
            background: "var(--bg-surface)",
            borderRadius: "16px",
            border: "1px solid var(--border)",
            overflow: "hidden",
            transition: "all 0.2s ease",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <NetworkIcon size={20} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                  Transaction Network
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {graph?.nodes?.length ?? 0} entities · {graph?.links?.length ?? 0} connections
                </p>
              </div>
            </div>
            <button
              onClick={() => setPage("graph")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                background: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View Full Graph
              <ArrowRightIcon size={16} />
            </button>
          </div>

          {/* Graph Area - Always Visible */}
          <div style={{ flex: 1, minHeight: "400px", position: "relative", overflow: "hidden" }}>
            {loading ? (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
              }}>
                <LoaderIcon size={40} color="var(--primary)" />
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading network data...</p>
              </div>
            ) : (
              <NetworkGraph
                data={graph}
                rings={rings}
                selectedRing={selectedRing}
                onNodeClick={handleNodeClick}
                selectedNode={selectedNode}
              />
            )}

            {/* Help hint */}
            <div style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              padding: "8px 14px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--text-muted)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              Click nodes to inspect · Drag to pan · Scroll to zoom
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            SIDEBAR PANELS
        ───────────────────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}>
          {/* Tab Switcher */}
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "16px",
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex",
              background: "var(--bg-elevated)",
              padding: "8px",
              gap: "8px",
            }}>
              {(["leaderboard", "rings"] as Tab[]).map(t => (
                <button 
                  key={t} 
                  onClick={() => setTab(t)} 
                  style={{
                    flex: 1, 
                    padding: "12px 16px",
                    background: tab === t ? "var(--bg-surface)" : "transparent",
                    border: "none",
                    borderRadius: "10px",
                    color: tab === t ? "var(--primary)" : "var(--text-muted)",
                    fontSize: "14px", 
                    fontWeight: 600, 
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: tab === t ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {t === "leaderboard" ? (
                    <>
                      <TargetIcon size={16} />
                      Risk Rankings
                    </>
                  ) : (
                    <>
                      <NetworkIcon size={16} />
                      Fraud Rings
                    </>
                  )}
                </button>
              ))}
            </div>

            <div style={{ height: "460px", overflow: "hidden" }}>
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
                  onSelect={ring => { setSelectedRing(ring); }}
                  onViewRing={ring => { setSelectedRing(ring); setPage("graph"); }}
                />
              )}
            </div>
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

      {/* Custom Notification */}
      <Notification
        show={notification.show}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        details={notification.details}
        onClose={() => setNotification({ ...notification, show: false })}
      />

      {/* Upload History & Data Management Modal */}
      <UploadHistory
        show={showHistory}
        onClose={() => setShowHistory(false)}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 24px;
          padding: 24px 32px;
          flex: 1;
          overflow: hidden;
        }
        
        .dashboard-graph-card {
          min-height: 0;
        }
        
        .dashboard-graph-card:hover {
          border-color: var(--primary);
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.1);
        }
        
        /* Tablet Landscape */
        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
            overflow: auto;
          }
          .dashboard-graph-card {
            min-height: 500px;
          }
        }
        
        /* Tablet Portrait */
        @media (max-width: 768px) {
          .dashboard-grid {
            padding: 16px;
            gap: 16px;
          }
          header {
            padding: 0 16px !important;
            height: 64px !important;
          }
          .dashboard-graph-card {
            min-height: 400px;
          }
        }
        
        /* Mobile Phone */
        @media (max-width: 640px) {
          .dashboard-grid {
            padding: 12px;
            gap: 12px;
          }
          header {
            padding: 0 12px !important;
            height: auto !important;
            min-height: 56px;
            flex-wrap: wrap;
            gap: 8px !important;
          }
          header > div:first-child {
            flex: 1;
            min-width: 200px;
          }
          header > div:first-child > div:first-child {
            width: 40px !important;
            height: 40px !important;
          }
          header > div:first-child h1 {
            font-size: 18px !important;
          }
          header > div:first-child p {
            font-size: 11px !important;
          }
          header > div:last-child {
            width: 100%;
            justify-content: space-between;
            gap: 6px !important;
          }
          header > div:last-child > div:first-child {
            display: none; /* Hide status badge on mobile */
          }
          header > div:last-child button {
            flex: 1;
            padding: 8px 12px !important;
            font-size: 13px !important;
          }
          .dashboard-graph-card {
            min-height: 300px;
          }
        }
      `}</style>
      
      {/* Admin Console Modal */}
      <AdminConsole
        isOpen={showAdminConsole}
        onClose={() => setShowAdminConsole(false)}
      />
    </div>
  );
}
