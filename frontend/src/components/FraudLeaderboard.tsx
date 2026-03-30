import React from "react";
import type { Company } from "../lib/types";
import { riskClass, scoreColor, fmtCurrency } from "../lib/api";
import { AlertCircleIcon, BarChartIcon } from "./Icons";

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
          <AlertCircleIcon size={18} color="var(--red)" />
          Fraud Leaderboard
        </h3>
        <span style={{ 
          fontSize: "var(--text-xs)", 
          color: "var(--text-muted)",
          background: "var(--bg-elevated)",
          padding: "var(--space-1) var(--space-3)",
          borderRadius: "var(--radius-full)",
        }}>
          Top {top.length}
        </span>
      </div>

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? (
          <Skeleton />
        ) : top.length === 0 ? (
          <div style={{ 
            padding: "var(--space-8)", 
            textAlign: "center", 
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}>
            <div style={{ 
              width: "48px", 
              height: "48px", 
              margin: "0 auto var(--space-3)",
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <BarChartIcon size={24} color="var(--text-muted)" />
            </div>
            No entities analyzed yet
          </div>
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
      className="leaderboard-row"
      onClick={onClick}
      style={{
        padding: "var(--space-4) var(--space-5)",
        display: "flex", 
        alignItems: "center", 
        gap: "var(--space-4)",
        cursor: "pointer",
        background: isSelected ? "var(--primary-light)" : "transparent",
        borderLeft: isSelected ? "3px solid var(--primary)" : "3px solid transparent",
        borderBottom: "1px solid var(--border)",
        transition: "all var(--duration) var(--ease)",
        minHeight: "48px",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-elevated)"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Rank */}
      <div style={{
        width: "32px", 
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        background: isPodium ? `${podiumColors[rank - 1]}15` : "var(--bg-elevated)",
        fontSize: "var(--text-sm)",
        fontWeight: 700,
        color: isPodium ? podiumColors[rank - 1] : "var(--text-muted)",
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
      }}>
        {rank}
      </div>

      {/* Company Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--text-sm)", 
          fontWeight: 600,
          color: "var(--text-primary)",
          overflow: "hidden", 
          textOverflow: "ellipsis", 
          whiteSpace: "nowrap",
          marginBottom: "2px",
        }}>
          {company.company_name}
        </div>
        <div style={{ 
          fontSize: "var(--text-xs)", 
          color: "var(--text-muted)", 
          fontFamily: "var(--font-mono)",
        }}>
          {company.gstin.slice(0, 12)}…
        </div>
      </div>

      {/* Score & Badge */}
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "flex-end", 
        gap: "var(--space-1)", 
        flexShrink: 0 
      }}>
        <div style={{
          fontSize: "var(--text-lg)", 
          fontWeight: 700,
          color: scoreColor(company.fraud_score),
          fontFamily: "var(--font-mono)",
        }}>
          {Math.round(company.fraud_score)}
        </div>
        <span className={riskClass(company.risk_level)}>
          {company.risk_level}
        </span>
      </div>
      
      <style>{`
        @media (max-width: 640px) {
          .leaderboard-row {
            padding: 12px 16px !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          padding: "var(--space-4) var(--space-5)", 
          borderBottom: "1px solid var(--border)",
          display: "flex", 
          gap: "var(--space-4)", 
          alignItems: "center",
        }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)" }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 6, borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton" style={{ height: 12, width: "60%", borderRadius: "var(--radius-sm)" }} />
          </div>
          <div className="skeleton" style={{ width: 48, height: 24, borderRadius: "var(--radius-sm)" }} />
        </div>
      ))}
    </>
  );
}
