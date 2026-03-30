"""
Fraud Scoring Module
Isolation Forest + Z-Score + composite weighted fraud score.
Team Code Novas | ITERYX '26
"""

import sqlite3
import json
import math
from pathlib import Path
from collections import defaultdict

import numpy as np
from sklearn.ensemble import IsolationForest
from scipy import stats

DB_PATH = Path(__file__).parent / "data" / "gst_fraud.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Feature Extraction ───────────────────────────────────────────────────────

def extract_features(G, node_metrics, shell_scores, days=None):
    """
    Compute 6 fraud features per entity:
    1. tax_mismatch_ratio
    2. volume_spike_score
    3. duplicate_invoice_count
    4. cycle_participation
    5. shell_company_score
    6. pagerank_anomaly
    """
    conn = get_connection()
    gstins = [row["gstin"] for row in conn.execute("SELECT gstin FROM companies").fetchall()]

    # Tax mismatch from GSTR aggregates
    gstr1 = conn.execute(
        "SELECT gstin, SUM(output_tax_collected) as out_tax FROM gstr1_returns GROUP BY gstin"
    ).fetchall()
    gstr3b = conn.execute(
        "SELECT gstin, SUM(input_tax_credit_claimed) as in_tax FROM gstr3b_returns GROUP BY gstin"
    ).fetchall()

    out_tax_map = {r["gstin"]: r["out_tax"] or 0 for r in gstr1}
    in_tax_map  = {r["gstin"]: r["in_tax"]  or 0 for r in gstr3b}

    # Build optional date filter based on latest invoice available
    date_filter = ""
    if days:
        latest = conn.execute("SELECT MAX(invoice_date) FROM invoices").fetchone()[0]
        if latest:
            date_filter = f"WHERE invoice_date >= date('{latest}', '-{days} days')"

    # Monthly invoice counts per company (for spike detection)
    monthly_counts = conn.execute(f"""
        SELECT seller_gstin, strftime('%Y-%m', invoice_date) as month, COUNT(*) as cnt
        FROM invoices
        {date_filter}
        GROUP BY seller_gstin, month
    """).fetchall()

    monthly_by_gstin = defaultdict(list)
    for row in monthly_counts:
        monthly_by_gstin[row["seller_gstin"]].append(row["cnt"])

    # Duplicate invoices: same (seller, buyer, amount, date)
    duplicates = conn.execute(f"""
        SELECT seller_gstin, COUNT(*) - 1 as dup_count
        FROM invoices
        {date_filter}
        GROUP BY seller_gstin, buyer_gstin, invoice_amount, invoice_date
        HAVING COUNT(*) > 1
    """).fetchall()

    dup_by_gstin = defaultdict(int)
    for row in duplicates:
        dup_by_gstin[row["seller_gstin"]] += row["dup_count"]

    conn.close()

    features = {}
    for gstin in gstins:
        out_tax = out_tax_map.get(gstin, 0)
        in_tax  = in_tax_map.get(gstin, 0)

        # 1. Tax mismatch ratio
        if out_tax > 0:
            mismatch = max(0, (in_tax - out_tax) / out_tax)
        else:
            mismatch = min(in_tax / 1_000_000, 5.0) if in_tax > 0 else 0.0

        # 2. Volume spike score
        counts = monthly_by_gstin.get(gstin, [0])
        avg_cnt = sum(counts) / len(counts) if counts else 1
        max_cnt = max(counts) if counts else 0
        spike = max_cnt / avg_cnt if avg_cnt > 0 else 0

        # 3. Duplicate invoice count
        dup_count = dup_by_gstin.get(gstin, 0)

        # 4. Cycle participation
        cycle_part = node_metrics.get(gstin, {}).get("cycle_participation", 0)

        # 5. Shell company score
        shell_sc = shell_scores.get(gstin, 0.0)

        # 6. Pagerank anomaly
        pr_anom = node_metrics.get(gstin, {}).get("pagerank_anomaly", 0.0)

        features[gstin] = {
            "tax_mismatch_ratio":     round(mismatch, 4),
            "volume_spike_score":     round(spike, 4),
            "duplicate_invoice_count": int(dup_count),
            "cycle_participation":    int(cycle_part),
            "shell_company_score":    round(shell_sc, 4),
            "pagerank_anomaly":       round(pr_anom, 4),
        }

    return features


# ─── Isolation Forest ──────────────────────────────────────────────────────────

def run_isolation_forest(features):
    """
    Run Isolation Forest on the feature matrix.
    Returns dict gstin → label (-1 = anomaly, 1 = normal) and raw score (0–1, higher = more anomalous)
    """
    gstins = list(features.keys())
    if not gstins:
        return {}
    
    X = np.array([
        [
            features[g]["tax_mismatch_ratio"],
            features[g]["volume_spike_score"],
            features[g]["duplicate_invoice_count"],
            features[g]["cycle_participation"],
            features[g]["shell_company_score"],
            features[g]["pagerank_anomaly"],
        ]
        for g in gstins
    ])

    clf = IsolationForest(n_estimators=200, contamination=0.15, random_state=42)
    labels = clf.fit_predict(X)                    # -1 anomaly, 1 normal
    raw_scores = clf.decision_function(X)           # lower = more anomalous

    # Normalize raw scores to 0–1 (1 = most anomalous)
    min_s, max_s = raw_scores.min(), raw_scores.max()
    norm_scores = 1 - (raw_scores - min_s) / (max_s - min_s + 1e-9)

    return {
        gstins[i]: {
            "label":      int(labels[i]),
            "if_score":   round(float(norm_scores[i]), 4)
        }
        for i in range(len(gstins))
    }


# ─── Z-Score Flagging ─────────────────────────────────────────────────────────

def zscore_flags(features, threshold=2.5):
    """Flag per-feature outliers using Z-Score. Returns dict gstin → list of flagged features."""
    feat_names = ["tax_mismatch_ratio","volume_spike_score","duplicate_invoice_count",
                  "cycle_participation","shell_company_score","pagerank_anomaly"]
    gstins = list(features.keys())

    flags = {g: [] for g in gstins}
    for fn in feat_names:
        vals = [features[g][fn] for g in gstins]
        arr = np.array(vals, dtype=float)
        if arr.std() < 1e-9:
            continue
        z = np.abs(stats.zscore(arr))
        for i, g in enumerate(gstins):
            if z[i] > threshold:
                flags[g].append(fn)

    return flags


# ─── Composite Score ──────────────────────────────────────────────────────────

WEIGHTS = {
    "cycle_participation":    0.40,   # doc: 40% — circular chain is strongest signal
    "tax_mismatch_ratio":     0.25,   # doc: 25% — ITC claimed vs tax actually paid
    "if_score":               0.20,   # doc: 20% — Isolation Forest anomaly score
    "volume_spike_score":     0.10,   # doc: 10% — duplicate/Z-score anomaly
    "shell_company_score":    0.05,   # doc:  5% — shell indicators
}

def compute_composite_score(features, if_results):
    """
    Compute weighted composite fraud score 0–100.
    Returns dict gstin → composite_score (float)
    """
    gstins = list(features.keys())
    if not gstins:
        return {}

    scores = {}

    # Pre-compute max values for normalisation — cap at reasonable fraud ceilings
    max_spike    = max(features[g]["volume_spike_score"]   for g in gstins) or 1
    max_mismatch = max(features[g]["tax_mismatch_ratio"]   for g in gstins) or 1

    for g in gstins:
        f   = features[g]
        ifl = if_results.get(g, {})

        # Cycle participation — normalize 0→1 (1+ rings = full score)
        cycle_part = f["cycle_participation"]
        s_cycle   = min(cycle_part / 1.0, 1.0)  # any ring = max signal

        # Tax mismatch — cap at 3x mismatch for full score
        s_mismatch = min(f["tax_mismatch_ratio"] / 3.0, 1.0)

        # Isolation Forest anomaly score (already 0–1)
        s_if      = ifl.get("if_score", 0.0)

        # Volume spike — normalize
        s_spike   = min(f["volume_spike_score"] / max(max_spike, 10), 1.0)

        # Shell score (already 0–1)
        s_shell   = f["shell_company_score"]

        raw = (
            WEIGHTS["cycle_participation"] * s_cycle   +
            WEIGHTS["tax_mismatch_ratio"]  * s_mismatch +
            WEIGHTS["if_score"]            * s_if       +
            WEIGHTS["volume_spike_score"]  * s_spike    +
            WEIGHTS["shell_company_score"] * s_shell
        )

        # Confirmed ring members get CRITICAL floor — circular trading = highest fraud signal
        # per CBIC Circular 171/03/2022 and document's fraud score interpretation guide
        if cycle_part >= 1 and s_shell > 0.5:
            raw = max(raw, 0.93)   # ring member + shell = near-certain fraud
        elif cycle_part >= 1:
            raw = max(raw, 0.88)   # confirmed ring member → CRITICAL
        elif s_shell > 0.7:
            raw = max(raw, 0.65)   # pure shell company → HIGH

        scores[g] = round(min(raw * 100, 100), 2)

    return scores


def risk_level(score):
    if score >= 86: return "CRITICAL"
    if score >= 61: return "HIGH"
    if score >= 31: return "MEDIUM"
    return "LOW"


# ─── Persist Scores ───────────────────────────────────────────────────────────

def save_scores(features, if_results, composite_scores):
    conn = get_connection()
    conn.execute("DELETE FROM entity_scores")
    for g, feats in features.items():
        ifl = if_results.get(g, {})
        conn.execute(
            """INSERT OR REPLACE INTO entity_scores VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                g,
                feats["tax_mismatch_ratio"],
                feats["volume_spike_score"],
                feats["duplicate_invoice_count"],
                feats["cycle_participation"],
                feats["shell_company_score"],
                feats["pagerank_anomaly"],
                ifl.get("label", 1),
                composite_scores.get(g, 0.0),
            )
        )
    # Update fraud scores on the companies table
    for g, score in composite_scores.items():
        conn.execute(
            "UPDATE companies SET fraud_score=?, risk_level=? WHERE gstin=?",
            (score, risk_level(score), g)
        )
    conn.commit()
    conn.close()


# ─── Full Scoring Pipeline ────────────────────────────────────────────────────

def run_fraud_scoring(G, node_metrics, shell_scores, days=None):
    """Main pipeline: extract → IF → Z-Score → composite → persist."""
    print("  Computing features...")
    features  = extract_features(G, node_metrics, shell_scores, days=days)

    print("  Running Isolation Forest...")
    if_results = run_isolation_forest(features)

    print("  Computing composite scores...")
    composite  = compute_composite_score(features, if_results)

    print("  Saving to database...")
    save_scores(features, if_results, composite)

    return features, if_results, composite
