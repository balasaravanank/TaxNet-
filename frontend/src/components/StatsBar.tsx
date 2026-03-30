import React from "react";
import type { DashboardStats } from "../lib/types";
import { fmtCurrency } from "../lib/api";

interface Props { stats: DashboardStats | null; loading: boolean; }

const CARDS = [
  {
    key:   "total_entities",
    label: "Entities Scanned",
    icon:  "🏢",
    color: "var(--cyan)",
    fmt:   (v: number) => v.toLocaleString(),
  },
  {
    key:   "fraud_rings_detected",
    label: "Fraud Rings Found",
    icon:  "🔴",
    color: "var(--red)",
    fmt:   (v: number) => v.toLocaleString(),
  },
  {
    key:   "flagged_high",
    label: "High-Risk Entities",
    icon:  "⚠️",
    color: "var(--orange)",
    fmt:   (v: number) => v.toLocaleString(),
  },
  {
    key:   "suspicious_value",
    label: "Suspicious Value",
    icon:  "💰",
    color: "var(--yellow)",
    fmt:   fmtCurrency,
  },
];

export function StatsBar({ stats, loading }: Props) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "12px",
      padding: "12px 20px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-surface)",
    }}>
      {CARDS.map(card => {
        const value = stats ? (stats as any)[card.key] : null;
        return (
          <div key={card.key} className="card" style={{
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            transition: "box-shadow 200ms ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 20px ${card.color}22`)}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = "")}
          >
            <div style={{
              width: "42px", height: "42px",
              borderRadius: "10px",
              background: `${card.color}18`,
              border: `1px solid ${card.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", flexShrink: 0,
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{
                fontSize: "22px", fontWeight: 700,
                color: loading ? "var(--text-muted)" : card.color,
                fontFamily: "var(--font-mono)",
                letterSpacing: "-0.02em",
              }}>
                {loading ? "—" : value != null ? card.fmt(value) : "—"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", letterSpacing: "0.04em" }}>
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
