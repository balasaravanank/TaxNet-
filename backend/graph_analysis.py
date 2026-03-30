"""
Graph Analysis Module — NetworkX
Builds transaction graph, detects circular trading rings,
identifies shell companies, and computes per-node metrics.
Team Code Novas | ITERYX '26
"""

import sqlite3
import json
import math
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

import networkx as nx

DB_PATH = Path(__file__).parent / "data" / "gst_fraud.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Build Graph ──────────────────────────────────────────────────────────────

def build_transaction_graph(days=None):
    """Build a weighted directed graph from the invoices table."""
    conn = get_connection()
    
    if days:
        latest = conn.execute("SELECT MAX(invoice_date) FROM invoices").fetchone()[0]
        if latest:
            invoices = conn.execute(
                f"SELECT seller_gstin, buyer_gstin, total_tax, invoice_amount FROM invoices WHERE invoice_date >= date('{latest}', '-{days} days')"
            ).fetchall()
        else:
            invoices = conn.execute("SELECT seller_gstin, buyer_gstin, total_tax, invoice_amount FROM invoices").fetchall()
    else:
        invoices = conn.execute(
            "SELECT seller_gstin, buyer_gstin, total_tax, invoice_amount FROM invoices"
        ).fetchall()
        
    conn.close()

    G = nx.DiGraph()

    for inv in invoices:
        seller = inv["seller_gstin"]
        buyer  = inv["buyer_gstin"]
        amt    = inv["invoice_amount"]

        if G.has_edge(seller, buyer):
            G[seller][buyer]["weight"]        += amt
            G[seller][buyer]["invoice_count"] += 1
        else:
            G.add_edge(seller, buyer, weight=amt, invoice_count=1)

    return G


# ─── Circular Trading Detection ───────────────────────────────────────────────

def _detect_rings_in_scc(args):
    """Worker: detect cycles in a single SCC subgraph."""
    scc, G, max_cycle_length, max_rings = args
    rings = []
    sub = G.subgraph(scc)
    try:
        for cycle in nx.simple_cycles(sub):
            if len(rings) >= max_rings:
                break
            if 2 <= len(cycle) <= max_cycle_length:
                total_value = sum(
                    sub[cycle[i]][(cycle[(i+1) % len(cycle)])].get("weight", 0)
                    for i in range(len(cycle))
                    if sub.has_edge(cycle[i], cycle[(i+1) % len(cycle)])
                )
                rings.append({
                    "cycle_path":          list(cycle),
                    "cycle_length":        len(cycle),
                    "total_cycling_value": round(total_value, 2),
                })
    except Exception:
        pass
    return rings


def detect_fraud_rings(G, max_cycle_length=6, max_rings=150, timeout=10):
    """
    Timeout-safe fraud ring detection.
    Runs in a background thread; gives up after `timeout` seconds.
    Only processes SCCs (the only subgraphs that can have cycles).
    """
    # Small SCCs first (4-node rings are clearest fraud signal)
    sccs = sorted(
        [scc for scc in nx.strongly_connected_components(G) if 1 < len(scc) <= 12],
        key=len
    )

    all_rings = []

    def _run():
        for scc in sccs:
            if len(all_rings) >= max_rings:
                break
            partial = _detect_rings_in_scc((scc, G, max_cycle_length, max_rings - len(all_rings)))
            all_rings.extend(partial)

    with ThreadPoolExecutor(max_workers=1) as exe:
        fut = exe.submit(_run)
        try:
            fut.result(timeout=timeout)
        except FuturesTimeout:
            print(f"  ⚠ Ring detection timed out after {timeout}s — using {len(all_rings)} rings found so far")
        except Exception as e:
            print(f"  Ring detection error: {e}")

    all_rings.sort(key=lambda r: r["total_cycling_value"], reverse=True)
    print(f"  ✓ {len(all_rings)} fraud rings detected")
    return all_rings


# ─── Shell Company Detection ──────────────────────────────────────────────────

def detect_shell_companies(G):
    """
    Shell companies: high in-degree (receive lots of invoices),
    near-zero out-degree (never sell to anyone meaningful).
    Returns dict gstin → shell_score (0–1)
    """
    shell_scores = {}
    for node in G.nodes():
        in_deg  = G.in_degree(node)
        out_deg = G.out_degree(node)
        in_wt   = sum(d["weight"] for _, _, d in G.in_edges(node, data=True))
        out_wt  = sum(d["weight"] for _, _, d in G.out_edges(node, data=True))

        if in_deg >= 4 and out_deg == 0:
            shell_scores[node] = 1.0
        elif in_deg > 2 and out_deg < in_deg * 0.2:
            # High inflow, tiny outflow → partial shell
            ratio = 1 - (out_deg / max(in_deg, 1))
            shell_scores[node] = round(min(ratio, 0.9), 3)
        else:
            shell_scores[node] = 0.0

    return shell_scores


# ─── Node Metrics ─────────────────────────────────────────────────────────────

def compute_node_metrics(G):
    """
    Compute per-node centrality and flow metrics.
    Returns dict gstin → {in_degree, out_degree, inflow, outflow,
                           pagerank, betweenness, cycle_participation}
    """
    # Pagerank on weighted graph
    try:
        pagerank = nx.pagerank(G, weight="weight", max_iter=200)
    except Exception:
        pagerank = {n: 1/G.number_of_nodes() for n in G.nodes()}

    # Betweenness centrality (normalized)
    try:
        betweenness = nx.betweenness_centrality(G, weight="weight", normalized=True)
    except Exception:
        betweenness = {n: 0.0 for n in G.nodes()}

    # Cycle participation per node
    rings = detect_fraud_rings(G)
    cycle_participation = defaultdict(int)
    for ring in rings:
        for node in ring["cycle_path"]:
            cycle_participation[node] += 1

    metrics = {}
    for node in G.nodes():
        in_wt  = sum(d["weight"] for _, _, d in G.in_edges(node, data=True))
        out_wt = sum(d["weight"] for _, _, d in G.out_edges(node, data=True))
        metrics[node] = {
            "in_degree":          G.in_degree(node),
            "out_degree":         G.out_degree(node),
            "inflow":             round(in_wt, 2),
            "outflow":            round(out_wt, 2),
            "pagerank":           round(pagerank.get(node, 0), 6),
            "betweenness":        round(betweenness.get(node, 0), 6),
            "cycle_participation": cycle_participation.get(node, 0)
        }

    return metrics, rings


# ─── Pagerank Anomaly ─────────────────────────────────────────────────────────

def pagerank_anomaly_scores(metrics):
    """
    Z-score based anomaly on pagerank values.
    Returns dict gstin → anomaly_score (higher = more anomalous)
    """
    values = [m["pagerank"] for m in metrics.values()]
    if not values:
        return {}
    mean_pr = sum(values) / len(values)
    variance = sum((v - mean_pr) ** 2 for v in values) / len(values)
    std_pr = math.sqrt(variance) if variance > 0 else 1e-9

    return {
        gstin: round(abs(m["pagerank"] - mean_pr) / std_pr, 4)
        for gstin, m in metrics.items()
    }


# ─── Graph JSON for API ───────────────────────────────────────────────────────

def graph_to_json(G, fraud_scores=None):
    """
    Serialize the graph for D3.js force-directed layout.
    nodes: [{id, company_name, fraud_score, risk_level, ...}]
    links: [{source, target, weight, invoice_count}]
    """
    conn = get_connection()
    companies = {
        row["gstin"]: dict(row)
        for row in conn.execute("SELECT * FROM companies").fetchall()
    }
    conn.close()

    nodes = []
    for node in G.nodes():
        co = companies.get(node, {})
        score = 0.0
        if fraud_scores and node in fraud_scores:
            score = fraud_scores[node]
        elif co:
            score = co.get("fraud_score", 0.0)
        nodes.append({
            "id":           node,
            "company_name": co.get("company_name", node[:12]),
            "state":        co.get("state", ""),
            "fraud_score":  round(score, 1),
            "risk_level":   _risk_level(score),
            "in_degree":    G.in_degree(node),
            "out_degree":   G.out_degree(node),
        })

    links = []
    for u, v, data in G.edges(data=True):
        links.append({
            "source":        u,
            "target":        v,
            "weight":        round(data.get("weight", 0), 2),
            "invoice_count": data.get("invoice_count", 1)
        })

    return {"nodes": nodes, "links": links}


def _risk_level(score):
    if score >= 86:  return "CRITICAL"
    if score >= 61:  return "HIGH"
    if score >= 31:  return "MEDIUM"
    return "LOW"


# ─── Persist Rings to DB ──────────────────────────────────────────────────────

def save_rings_to_db(rings):
    conn = get_connection()
    conn.execute("DELETE FROM fraud_rings")
    now = __import__("datetime").datetime.utcnow().isoformat()
    for ring in rings:
        # Confidence: longer rings with higher value = more confident
        length_factor = min(ring["cycle_length"] / 6, 1.0)   # max at 6-node ring
        value_factor  = min(ring["total_cycling_value"] / 5_000_000, 1.0)  # max at 50L
        confidence    = round(0.7 + 0.2 * value_factor + 0.1 * length_factor, 3)
        conn.execute(
            "INSERT INTO fraud_rings (cycle_path, cycle_length, total_cycling_value, confidence, detected_at) VALUES (?,?,?,?,?)",
            (json.dumps(ring["cycle_path"]), ring["cycle_length"],
             ring["total_cycling_value"], confidence, now)
        )
    conn.commit()
    conn.close()



# ─── Full Analysis Pipeline ───────────────────────────────────────────────────

def run_full_analysis(days=None):
    """Build graph, detect rings, compute metrics. Returns (G, metrics, rings, shell_scores)."""
    G = build_transaction_graph(days=days)
    metrics, rings = compute_node_metrics(G)
    shell_scores = detect_shell_companies(G)
    pr_anomalies = pagerank_anomaly_scores(metrics)

    # Attach pagerank anomaly to metrics
    for gstin in metrics:
        metrics[gstin]["pagerank_anomaly"] = pr_anomalies.get(gstin, 0.0)

    save_rings_to_db(rings)
    return G, metrics, rings, shell_scores
