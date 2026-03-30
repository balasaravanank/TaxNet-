import React from "react";
import type { FraudRing } from "../lib/types";
import { fmtCurrency } from "../lib/api";

interface Props {
  rings:      FraudRing[];
  loading:    boolean;
  selected:   FraudRing | null;
  onSelect:   (ring: FraudRing | null) => void;
}

export function RingExplorer({ rings, loading, selected, onSelect }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
          🔄 Fraud Ring Explorer
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {rings.length} rings detected
        </div>
      </div>

      {selected && (
        <div style={{
          padding: "8px 16px",
          background: "rgba(255,71,87,0.08)",
          borderBottom: "1px solid rgba(255,71,87,0.2)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "11px", color: "var(--red)" }}>
            🔴 Ring highlighted on graph
          </span>
          <button className="btn btn--ghost" style={{ padding: "2px 8px", fontSize: "10px" }}
            onClick={() => onSelect(null)}>
            Clear
          </button>
        </div>
      )}

      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
            Detecting rings…
          </div>
        ) : rings.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
            No rings detected
          </div>
        ) : rings.map(ring => (
          <RingCard key={ring.ring_id} ring={ring}
            isSelected={selected?.ring_id === ring.ring_id}
            onClick={() => onSelect(selected?.ring_id === ring.ring_id ? null : ring)} />
        ))}
      </div>
    </div>
  );
}

function RingCard({ ring, isSelected, onClick }: {
  ring: FraudRing; isSelected: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: isSelected ? "rgba(255,71,87,0.08)" : "transparent",
        borderLeft: isSelected ? "2px solid var(--red)" : "2px solid transparent",
        transition: "all 150ms ease",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,71,87,0.03)"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "var(--red)",
            boxShadow: isSelected ? "0 0 6px var(--red)" : "none",
          }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
            Ring #{ring.ring_id} — {ring.cycle_length} entities
          </span>
        </div>
        <span style={{ fontSize: "11px", color: "var(--red)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
          {fmtCurrency(ring.total_cycling_value)}
        </span>
      </div>

      {/* Entity chain */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center",
      }}>
        {ring.cycle_path.map((gstin, i) => (
          <React.Fragment key={gstin}>
            <span style={{
              padding: "1px 6px",
              background: "rgba(255,71,87,0.1)",
              border: "1px solid rgba(255,71,87,0.2)",
              borderRadius: "4px",
              fontSize: "9px",
              fontFamily: "var(--font-mono)",
              color: "var(--red)",
            }}>
              {gstin.slice(0, 8)}…
            </span>
            {i < ring.cycle_path.length - 1 && (
              <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>→</span>
            )}
          </React.Fragment>
        ))}
        <span style={{ fontSize: "9px", color: "var(--red)" }}>↩</span>
      </div>
    </div>
  );
}
