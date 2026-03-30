import React from "react";
import type { FraudRing } from "../lib/types";
import { fmtCurrency } from "../lib/api";
import { LinkIcon, CheckCircleIcon, LoaderIcon, ArrowRightIcon, CornerDownLeftIcon, EyeIcon } from "./Icons";

interface Props {
  rings:      FraudRing[];
  loading:    boolean;
  selected:   FraudRing | null;
  onSelect:   (ring: FraudRing | null) => void;
  onViewRing?: (ring: FraudRing) => void;
}

export function RingExplorer({ rings, loading, selected, onSelect, onViewRing }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "var(--space-4) var(--space-5)",
        borderBottom: "1px solid var(--border)",
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        background: "var(--bg-surface)",
      }}>
        <h3 style={{ 
          fontWeight: 700, 
          fontSize: "var(--text-base)", 
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}>
          <LinkIcon size={18} color="var(--red)" />
          Fraud Rings
        </h3>
        <span style={{ 
          fontSize: "var(--text-xs)", 
          background: rings.length > 0 ? "var(--red-light)" : "var(--bg-elevated)",
          padding: "var(--space-1) var(--space-3)",
          borderRadius: "var(--radius-full)",
          fontWeight: rings.length > 0 ? 600 : 400,
          color: rings.length > 0 ? "var(--red)" : "var(--text-muted)",
        }}>
          {rings.length} detected
        </span>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div style={{
          padding: "var(--space-3) var(--space-5)",
          background: "var(--red-light)",
          borderBottom: "1px solid var(--border)",
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
        }}>
          <span style={{ 
            fontSize: "var(--text-sm)", 
            color: "var(--red)",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}>
            <span style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--red)",
            }} />
            Ring highlighted on graph
          </span>
          <button 
            className="btn btn--ghost" 
            style={{ 
              padding: "var(--space-1) var(--space-3)", 
              fontSize: "var(--text-xs)" 
            }}
            onClick={() => onSelect(null)}
          >
            Clear
          </button>
        </div>
      )}

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div style={{ 
            padding: "var(--space-8)", 
            textAlign: "center", 
            color: "var(--text-muted)", 
            fontSize: "var(--text-sm)" 
          }}>
            <div style={{
              width: "32px",
              height: "32px",
              margin: "0 auto var(--space-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <LoaderIcon size={24} color="var(--primary)" />
            </div>
            Detecting rings...
          </div>
        ) : rings.length === 0 ? (
          <div style={{ 
            padding: "var(--space-8)", 
            textAlign: "center", 
            color: "var(--text-muted)", 
            fontSize: "var(--text-sm)" 
          }}>
            <div style={{ 
              width: "48px", 
              height: "48px", 
              margin: "0 auto var(--space-3)",
              background: "var(--green-light)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <CheckCircleIcon size={24} color="var(--green)" />
            </div>
            <p style={{ fontWeight: 500, color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
              No fraud rings detected
            </p>
            <p>All transaction cycles appear legitimate</p>
          </div>
        ) : rings.map((ring, index) => (
          <RingCard 
            key={ring.ring_id} 
            ring={ring}
            isSelected={selected?.ring_id === ring.ring_id}
            onClick={() => onSelect(selected?.ring_id === ring.ring_id ? null : ring)}
            onView={onViewRing ? () => onViewRing(ring) : undefined}
            index={index}
          />
        ))}
      </div>

      {/* View on Map button when ring is selected */}
      {selected && onViewRing && (
        <div style={{
          padding: "var(--space-4) var(--space-5)",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-surface)",
        }}>
          <button
            onClick={() => onViewRing(selected)}
            style={{
              width: "100%",
              padding: "var(--space-3) var(--space-4)",
              background: "var(--red)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)",
              transition: "all var(--duration) var(--ease)",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <EyeIcon size={16} />
            View Ring on Full Map
          </button>
        </div>
      )}
    </div>
  );
}

function RingCard({ ring, isSelected, onClick, onView, index }: {
  ring: FraudRing; isSelected: boolean; onClick: () => void; onView?: () => void; index: number;
}) {
  return (
    <div
      className="fade-in"
      style={{
        padding: "var(--space-4) var(--space-5)",
        borderBottom: "1px solid var(--border)",
        background: isSelected ? "var(--red-light)" : "transparent",
        borderLeft: isSelected ? "3px solid var(--red)" : "3px solid transparent",
        transition: "all var(--duration) var(--ease)",
        animationDelay: `${index * 0.05}s`,
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-elevated)"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Header */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        marginBottom: "var(--space-3)" 
      }}>
        <div 
          onClick={onClick}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", cursor: "pointer", flex: 1 }}
        >
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-md)",
            background: "var(--red-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--red)",
          }}>
            <LinkIcon size={18} />
          </div>
          <div>
            <span style={{ 
              fontSize: "var(--text-sm)", 
              fontWeight: 700, 
              color: "var(--text-primary)" 
            }}>
              Ring #{ring.ring_id}
            </span>
            <div style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              marginTop: "2px",
            }}>
              {ring.cycle_length} entities in cycle
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ 
            fontSize: "var(--text-sm)", 
            color: "var(--red)", 
            fontWeight: 700, 
            fontFamily: "var(--font-mono)" 
          }}>
            {fmtCurrency(ring.total_cycling_value)}
          </span>
          {onView && (
            <button
              onClick={(e) => { e.stopPropagation(); onView(); }}
              style={{
                padding: "var(--space-2) var(--space-3)",
                background: "var(--red)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                transition: "all var(--duration) var(--ease)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#b91c1c"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--red)"}
            >
              <EyeIcon size={12} />
              View
            </button>
          )}
        </div>
      </div>

      {/* Entity chain */}
      <div className="ring-cycle-path" style={{
        display: "flex", 
        flexWrap: "wrap", 
        gap: "var(--space-2)", 
        alignItems: "center",
      }}>
        {ring.cycle_path.map((gstin, i) => (
          <React.Fragment key={gstin}>
            <span style={{
              padding: "var(--space-1) var(--space-3)",
              background: isSelected ? "white" : "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-xs)",
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
            }}>
              {gstin.slice(0, 8)}…
            </span>
            {i < ring.cycle_path.length - 1 && (
              <ArrowRightIcon size={12} color="var(--red)" />
            )}
          </React.Fragment>
        ))}
        <CornerDownLeftIcon size={12} color="var(--red)" />
      </div>
      
      <style>{`
        @media (max-width: 640px) {
          .ring-cycle-path {
            gap: 6px !important;
            font-size: 11px !important;
          }
          .ring-cycle-path span {
            padding: 4px 8px !important;
            font-size: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}
