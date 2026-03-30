import React from "react";
import type { Company } from "../lib/types";
import { riskClass, scoreColor, fmtCurrency } from "../lib/api";

interface Props {
  companies:    Company[];
  loading:      boolean;
  onSelect:     (c: Company) => void;
  selected:     Company | null;
}

export function FraudLeaderboard({ companies, loading, onSelect, selected }: Props) {
  const top = companies.slice(0, 25);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
          🚨 Fraud Leaderboard
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          Top {top.length} entities
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? (
          <Skeleton />
        ) : top.map((c, i) => (
          <LeaderboardRow
            key={c.gstin}
            rank={i + 1}
            company={c}
            isSelected={selected?.gstin === c.gstin}
            onClick={() => onSelect(c)}
          />
        ))}
      </div>
    </div>
  );
}

function LeaderboardRow({ rank, company, isSelected, onClick }: {
  rank: number; company: Company; isSelected: boolean; onClick: () => void;
}) {
  const isPodium = rank <= 3;
  const podiumColors = ["var(--red)", "var(--orange)", "var(--yellow)"];

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: "10px",
        cursor: "pointer",
        background: isSelected ? "rgba(0,212,255,0.06)" : "transparent",
        borderLeft: isSelected ? "2px solid var(--cyan)" : "2px solid transparent",
        borderBottom: "1px solid var(--border)",
        transition: "background 150ms ease",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(0,212,255,0.03)"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Rank */}
      <div style={{
        width: "20px", textAlign: "center",
        fontSize: "11px", fontWeight: 700,
        color: isPodium ? podiumColors[rank - 1] : "var(--text-muted)",
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
      }}>
        {isPodium ? ["🥇","🥈","🥉"][rank-1] : rank}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "12px", fontWeight: 500,
          color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {company.company_name}
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
          {company.gstin.slice(0, 10)}…
        </div>
      </div>

      {/* Score + badge */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
        <div style={{
          fontSize: "14px", fontWeight: 700,
          color: scoreColor(company.fraud_score),
          fontFamily: "var(--font-mono)",
        }}>
          {company.fraud_score.toFixed(1)}
        </div>
        <span className={riskClass(company.risk_level)}>
          {company.risk_level}
        </span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", gap: "10px", alignItems: "center",
        }}>
          <div style={{ width: 20, height: 16, background: "var(--bg-card-hover)", borderRadius: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, background: "var(--bg-card-hover)", borderRadius: 4, marginBottom: 6 }} />
            <div style={{ height: 10, width: "60%", background: "var(--bg-card-hover)", borderRadius: 4 }} />
          </div>
          <div style={{ width: 36, height: 20, background: "var(--bg-card-hover)", borderRadius: 4 }} />
        </div>
      ))}
    </>
  );
}
