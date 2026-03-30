import React from "react";
import type { DashboardStats } from "../lib/types";
import { fmtCurrency } from "../lib/api";
import { BuildingIcon, LinkIcon, AlertTriangleIcon, DollarIcon } from "./Icons";

interface Props { stats: DashboardStats | null; loading: boolean; }

const CARDS = [
  {
    key:   "total_entities",
    label: "Entities Scanned",
    Icon:  BuildingIcon,
    color: "#2563eb",
    bgColor: "rgba(37, 99, 235, 0.08)",
    fmt:   (v: number) => v.toLocaleString(),
  },
  {
    key:   "fraud_rings_detected",
    label: "Fraud Rings Found",
    Icon:  LinkIcon,
    color: "#dc2626",
    bgColor: "rgba(220, 38, 38, 0.08)",
    fmt:   (v: number) => v.toLocaleString(),
  },
  {
    key:   "flagged_high",
    label: "High-Risk Entities",
    Icon:  AlertTriangleIcon,
    color: "#ea580c",
    bgColor: "rgba(234, 88, 12, 0.08)",
    fmt:   (v: number) => v.toLocaleString(),
  },
  {
    key:   "suspicious_value",
    label: "Suspicious Value",
    Icon:  DollarIcon,
    color: "#ca8a04",
    bgColor: "rgba(202, 138, 4, 0.08)",
    fmt:   (v: number) => {
      // Format as ₹X.XX Cr for large values
      if (v >= 10000000) {
        return `₹${(v / 10000000).toFixed(2)} Cr`;
      } else if (v >= 100000) {
        return `₹${(v / 100000).toFixed(2)} L`;
      }
      return fmtCurrency(v);
    },
  },
];

export function StatsBar({ stats, loading }: Props) {
  return (
    <div className="stats-bar">
      {CARDS.map((card, index) => {
        const value = stats ? (stats as any)[card.key] : null;
        const Icon = card.Icon;
        return (
          <div 
            key={card.key} 
            className="stats-card fade-in" 
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {/* Icon Box */}
            <div 
              className="stats-card__icon"
              style={{ background: card.bgColor }}
            >
              <Icon size={24} color={card.color} />
            </div>
            
            {/* Content */}
            <div className="stats-card__content">
              <div 
                className="stats-card__value"
                style={{ color: loading ? "var(--text-muted)" : card.color }}
              >
                {loading ? (
                  <div className="skeleton" style={{ width: "80px", height: "32px" }} />
                ) : value != null ? card.fmt(value) : "—"}
              </div>
              <div className="stats-card__label">
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
      
      <style>{`
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          padding: 20px 32px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
        }
        
        .stats-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          transition: all 0.2s ease;
        }
        
        .stats-card:hover {
          border-color: rgba(37, 99, 235, 0.2);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
        }
        
        .stats-card__icon {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .stats-card__content {
          flex: 1;
          min-width: 0;
        }
        
        .stats-card__value {
          font-size: 28px;
          font-weight: 700;
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        
        .stats-card__label {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 4px;
          font-weight: 500;
        }
        
        @media (max-width: 1200px) {
          .stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 640px) {
          .stats-bar {
            grid-template-columns: 1fr;
            padding: 16px;
            gap: 12px;
          }
          .stats-card {
            padding: 16px 20px;
          }
          .stats-card__value {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
