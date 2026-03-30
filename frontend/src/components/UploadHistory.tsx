import React, { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import {
  XIcon,
  RefreshIcon,
  UploadIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  TrashIcon,
  DatabaseIcon,
  ClockIcon,
} from "./Icons";

interface UploadRecord {
  upload_id: string;
  filename: string;
  upload_date: string;
  records_inserted: number;
  new_entities: number;
  file_size: number;
  status: string;
  has_content: boolean;
}

interface Snapshot {
  id: string;
  created_at: string;
  file: string;
  companies_count: number;
  invoices_count: number;
}

interface UploadHistoryProps {
  show: boolean;
  onClose: () => void;
  onDataChange?: () => void;
}

type TabType = "history" | "snapshots" | "manage";

export function UploadHistory({ show, onClose, onDataChange }: UploadHistoryProps) {
  const [activeTab, setActiveTab] = useState<TabType>("history");
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearCompanies, setClearCompanies] = useState(false);
  const [clearHistory, setClearHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.uploadHistory();
      setHistory(data.history || []);
    } catch (err) {
      console.error("Failed to load history:", err);
      setMessage({ type: "error", text: "Failed to load upload history" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listSnapshots();
      setSnapshots(data.snapshots || []);
    } catch (err) {
      console.error("Failed to load snapshots:", err);
      setMessage({ type: "error", text: "Failed to load snapshots" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (show) {
      if (activeTab === "history") loadHistory();
      else if (activeTab === "snapshots") loadSnapshots();
    }
  }, [show, activeTab, loadHistory, loadSnapshots]);

  const handleCreateSnapshot = async () => {
    setActionLoading("create-snapshot");
    try {
      const result = await api.createSnapshot();
      if (result.status === "ok") {
        setMessage({ type: "success", text: `Snapshot created: ${result.snapshot_id}` });
        loadSnapshots();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to create snapshot" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to create snapshot" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!confirm(`Restore database to snapshot ${snapshotId}? Current data will be backed up first.`)) {
      return;
    }
    setActionLoading(`restore-${snapshotId}`);
    try {
      const result = await api.restoreSnapshot(snapshotId);
      if (result.status === "ok") {
        setMessage({ type: "success", text: result.message || "Database restored successfully" });
        onDataChange?.();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to restore snapshot" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to restore snapshot" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearData = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    
    setActionLoading("clear-data");
    try {
      const result = await api.clearData(clearCompanies, clearHistory);
      if (result.status === "ok") {
        let msg = `Cleared ${result.invoices_cleared} invoices`;
        if (clearCompanies) msg += `, ${result.companies_cleared} companies`;
        if (clearHistory) msg += `, ${result.history_cleared} history records`;
        setMessage({ type: "success", text: msg });
        setConfirmClear(false);
        setClearCompanies(false);
        setClearHistory(false);
        if (clearHistory) loadHistory();
        onDataChange?.();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to clear data" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to clear data" });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="fade-in-scale"
        style={{
          width: "min(800px, 95vw)",
          maxHeight: "85vh",
          background: "var(--bg-surface)",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DatabaseIcon size={20} color="var(--primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
                Data Management
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                History, backups & database operations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              border: "none",
              background: "var(--bg-elevated)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={18} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            padding: "0 24px",
          }}
        >
          {[
            { id: "history" as TabType, label: "Upload History", icon: ClockIcon },
            { id: "snapshots" as TabType, label: "Snapshots", icon: DatabaseIcon },
            { id: "manage" as TabType, label: "Manage Data", icon: TrashIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: "14px 20px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: activeTab === id ? "var(--primary)" : "var(--text-secondary)",
                borderBottom: activeTab === id ? "2px solid var(--primary)" : "2px solid transparent",
                marginBottom: "-1px",
                transition: "all 0.2s",
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Message */}
        {message && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "12px 16px",
              borderRadius: "10px",
              background: message.type === "success" ? "var(--green-light)" : "var(--red-light)",
              color: message.type === "success" ? "var(--green)" : "var(--red)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {message.type === "success" ? <CheckCircleIcon size={18} /> : <AlertCircleIcon size={18} />}
            {message.text}
            <button
              onClick={() => setMessage(null)}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <XIcon size={14} color={message.type === "success" ? "var(--green)" : "var(--red)"} />
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <LoaderIcon size={32} />
              <p style={{ marginTop: "12px" }}>Loading...</p>
            </div>
          ) : activeTab === "history" ? (
            /* Upload History Tab */
            history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                <UploadIcon size={48} />
                <p style={{ marginTop: "16px", fontSize: "16px", fontWeight: 500 }}>No uploads yet</p>
                <p style={{ marginTop: "8px", fontSize: "14px" }}>Upload a CSV file to see history here</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={thStyle}>File</th>
                    <th style={thStyle}>Date</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Records</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Entities</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Size</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.upload_id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <UploadIcon size={14} color="var(--text-muted)" />
                          <span style={{ fontWeight: 500 }}>{record.filename}</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {record.upload_id}
                        </div>
                      </td>
                      <td style={tdStyle}>{formatDate(record.upload_date)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {record.records_inserted.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {record.new_entities.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {formatSize(record.file_size)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: record.status === "success" ? "var(--green-light)" : "var(--red-light)",
                            color: record.status === "success" ? "var(--green)" : "var(--red)",
                          }}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : activeTab === "snapshots" ? (
            /* Snapshots Tab */
            <div>
              <div style={{ marginBottom: "20px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleCreateSnapshot}
                  disabled={actionLoading === "create-snapshot"}
                  className="btn btn--primary"
                  style={{ padding: "10px 20px", fontSize: "14px" }}
                >
                  {actionLoading === "create-snapshot" ? <LoaderIcon size={16} /> : <DatabaseIcon size={16} />}
                  Create Snapshot
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                  <DatabaseIcon size={48} />
                  <p style={{ marginTop: "16px", fontSize: "16px", fontWeight: 500 }}>No snapshots yet</p>
                  <p style={{ marginTop: "8px", fontSize: "14px" }}>Create a snapshot to backup your data</p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={thStyle}>Snapshot ID</th>
                      <th style={thStyle}>Created</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Companies</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Invoices</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snap) => (
                      <tr key={snap.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{snap.id}</span>
                        </td>
                        <td style={tdStyle}>{formatDate(snap.created_at)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {snap.companies_count.toLocaleString()}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {snap.invoices_count.toLocaleString()}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <button
                            onClick={() => handleRestoreSnapshot(snap.id)}
                            disabled={actionLoading === `restore-${snap.id}`}
                            className="btn btn--ghost"
                            style={{ padding: "6px 14px", fontSize: "13px" }}
                          >
                            {actionLoading === `restore-${snap.id}` ? <LoaderIcon size={14} /> : <RefreshIcon size={14} />}
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            /* Manage Data Tab */
            <div>
              <div
                style={{
                  padding: "24px",
                  background: "var(--red-light)",
                  borderRadius: "12px",
                  border: "1px solid var(--red)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <AlertCircleIcon size={24} color="var(--red)" />
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--red)" }}>
                    Clear Database
                  </h3>
                </div>
                
                <p style={{ fontSize: "14px", color: "var(--text-primary)", marginBottom: "20px", lineHeight: 1.6 }}>
                  This will permanently delete all invoices, fraud rings, and entity scores from the database.
                  This action cannot be undone. Consider creating a snapshot first.
                </p>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "12px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={clearCompanies}
                    onChange={(e) => setClearCompanies(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--red)" }}
                  />
                  <span style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                    Also clear all companies (full reset)
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "20px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={clearHistory}
                    onChange={(e) => setClearHistory(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--red)" }}
                  />
                  <span style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                    Also clear upload history
                  </span>
                </label>

                {confirmClear ? (
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--red)" }}>
                      Are you sure? This cannot be undone!
                    </span>
                    <button
                      onClick={handleClearData}
                      disabled={actionLoading === "clear-data"}
                      style={{
                        padding: "10px 20px",
                        background: "var(--red)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {actionLoading === "clear-data" ? <LoaderIcon size={16} /> : <TrashIcon size={16} />}
                      Yes, Clear All Data
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="btn btn--ghost"
                      style={{ padding: "10px 20px" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleClearData}
                    style={{
                      padding: "10px 20px",
                      background: "transparent",
                      color: "var(--red)",
                      border: "2px solid var(--red)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <TrashIcon size={16} />
                    Clear Database
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: "14px",
  color: "var(--text-primary)",
};
