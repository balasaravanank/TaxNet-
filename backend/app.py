"""
Flask REST API — GST Fraud Identification System
Team Code Novas | ITERYX '26
"""

import sqlite3
import json
import os
import io
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(Path(__file__).parent / ".env")

from graph_analysis import (
    build_transaction_graph, run_full_analysis, graph_to_json
)
from fraud_scoring import run_fraud_scoring
from rag_engine import explain_entity

# ─── App Setup ────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")
CORS(app, resources={r"/api/*": {"origins": "*"}})

DB_PATH = Path(__file__).parent / "data" / "gst_fraud.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Cache (analysis results) ─────────────────────────────────────────────────

_cache = {}

def get_analysis():
    """Run analysis once and cache results."""
    if "G" not in _cache:
        refresh_analysis()
    return _cache


def refresh_analysis():
    print("▶ Running graph + fraud analysis...")
    G, metrics, rings, shells = run_full_analysis()
    features, if_results, composite = run_fraud_scoring(G, metrics, shells)
    _cache.update({
        "G":         G,
        "metrics":   metrics,
        "rings":     rings,
        "shells":    shells,
        "features":  features,
        "if_results": if_results,
        "composite": composite,
    })
    print(f"✓ Analysis done: {G.number_of_nodes()} nodes, {len(rings)} rings found")


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "GST FraudNet API running"})


@app.route("/api/refresh", methods=["POST"])
def refresh():
    """Re-run full analysis (e.g. after upload)."""
    refresh_analysis()
    return jsonify({"status": "ok", "message": "Analysis refreshed"})


@app.route("/api/dashboard-stats")
def dashboard_stats():
    cache = get_analysis()
    db = get_db()

    total_entities = db.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
    critical = db.execute("SELECT COUNT(*) FROM companies WHERE risk_level='CRITICAL'").fetchone()[0]
    high     = db.execute("SELECT COUNT(*) FROM companies WHERE risk_level='HIGH'").fetchone()[0]
    medium   = db.execute("SELECT COUNT(*) FROM companies WHERE risk_level='MEDIUM'").fetchone()[0]
    total_invoices = db.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
    total_value = db.execute("SELECT SUM(invoice_amount) FROM invoices").fetchone()[0] or 0
    rings_detected = db.execute("SELECT COUNT(*) FROM fraud_rings").fetchone()[0]
    suspicious_value = db.execute("""
        SELECT SUM(i.invoice_amount) FROM invoices i
        JOIN companies c ON i.seller_gstin = c.gstin
        WHERE c.risk_level IN ('CRITICAL','HIGH')
    """).fetchone()[0] or 0

    db.close()
    return jsonify({
        "total_entities":      total_entities,
        "flagged_high":        critical + high,
        "critical_entities":   critical,
        "high_entities":       high,
        "medium_entities":     medium,
        "total_invoices":      total_invoices,
        "total_value":         round(total_value, 2),
        "fraud_rings_detected": rings_detected,
        "suspicious_value":    round(suspicious_value, 2),
    })


@app.route("/api/companies")
def companies():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM companies ORDER BY fraud_score DESC"
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


# Alias: /api/entities matches the document spec
@app.route("/api/entities")
def entities():
    return companies()


@app.route("/api/company/<gstin>")
def company_detail(gstin):
    cache = get_analysis()
    db = get_db()

    company = db.execute("SELECT * FROM companies WHERE gstin=?", (gstin,)).fetchone()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    scores = db.execute("SELECT * FROM entity_scores WHERE gstin=?", (gstin,)).fetchone()

    gstr1 = db.execute(
        "SELECT * FROM gstr1_returns WHERE gstin=? ORDER BY period", (gstin,)
    ).fetchall()
    gstr3b = db.execute(
        "SELECT * FROM gstr3b_returns WHERE gstin=? ORDER BY period", (gstin,)
    ).fetchall()

    # Invoices sent
    invoices_sent = db.execute(
        "SELECT i.*, c.company_name buyer_name FROM invoices i "
        "JOIN companies c ON i.buyer_gstin=c.gstin WHERE i.seller_gstin=? ORDER BY i.invoice_date DESC LIMIT 20",
        (gstin,)
    ).fetchall()

    # Invoices received
    invoices_recv = db.execute(
        "SELECT i.*, c.company_name seller_name FROM invoices i "
        "JOIN companies c ON i.seller_gstin=c.gstin WHERE i.buyer_gstin=? ORDER BY i.invoice_date DESC LIMIT 20",
        (gstin,)
    ).fetchall()

    # Rings this entity participates in — parse cycle_path JSON string → list
    all_rings = db.execute("SELECT * FROM fraud_rings").fetchall()
    my_rings = []
    for r in all_rings:
        path = json.loads(r["cycle_path"])
        if gstin in path:
            rd = dict(r)
            rd["cycle_path"] = path   # send as array, not string
            my_rings.append(rd)

    db.close()

    # Metrics
    metrics  = cache.get("metrics", {}).get(gstin, {})
    features = cache.get("features", {}).get(gstin, {})
    if_res   = cache.get("if_results", {}).get(gstin, {})

    return jsonify({
        "company":         dict(company),
        "scores":          dict(scores) if scores else {},
        "metrics":         metrics,
        "features":        features,
        "isolation_forest": if_res,
        "gstr1":           [dict(r) for r in gstr1],
        "gstr3b":          [dict(r) for r in gstr3b],
        "invoices_sent":   [dict(r) for r in invoices_sent],
        "invoices_received":[dict(r) for r in invoices_recv],
        "participating_rings": my_rings,
    })


@app.route("/api/graph")
def graph():
    cache = get_analysis()
    G = cache["G"]
    composite = cache.get("composite", {})
    data = graph_to_json(G, fraud_scores=composite)
    return jsonify(data)


@app.route("/api/fraud-rings")
def fraud_rings():
    db = get_db()
    rings = db.execute(
        "SELECT * FROM fraud_rings ORDER BY total_cycling_value DESC"
    ).fetchall()
    db.close()

    result = []
    for r in rings:
        rd = dict(r)
        rd["cycle_path"] = json.loads(rd["cycle_path"])
        result.append(rd)
    return jsonify(result)


@app.route("/api/anomalies")
def anomalies():
    db = get_db()
    rows = db.execute("""
        SELECT c.gstin, c.company_name, c.state, c.fraud_score, c.risk_level,
               es.cycle_participation, es.tax_mismatch_ratio,
               es.shell_company_score, es.volume_spike_score,
               es.isolation_forest_label
        FROM companies c
        JOIN entity_scores es ON c.gstin = es.gstin
        WHERE c.fraud_score > 30
        ORDER BY c.fraud_score DESC
        LIMIT 30
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


# ─── RAG Explain Endpoint ─────────────────────────────────────────────────────

@app.route("/api/explain", methods=["POST"])
def explain():
    """
    POST {gstin: "...", fraud_signals: {...}}
    Returns RAG-generated investigation summary.
    The fraud_signals are optional — if not provided, fetched from DB.
    """
    body  = request.json or {}
    gstin = body.get("gstin", "").strip()

    if not gstin:
        return jsonify({"error": "gstin is required"}), 400

    # Fetch full entity data from DB/cache
    cache = get_analysis()
    db    = get_db()

    company = db.execute("SELECT * FROM companies WHERE gstin=?", (gstin,)).fetchone()
    if not company:
        db.close()
        return jsonify({"error": "Company not found"}), 404

    all_rings = db.execute("SELECT * FROM fraud_rings").fetchall()
    my_rings  = [
        dict(r) for r in all_rings
        if gstin in json.loads(r["cycle_path"])
    ]
    db.close()

    metrics  = cache.get("metrics", {}).get(gstin, {})
    features = cache.get("features", {}).get(gstin, {})

    fraud_data = {
        "company":            dict(company),
        "metrics":            metrics,
        "features":           features,
        "participating_rings": my_rings,
    }

    result = explain_entity(gstin, fraud_data)
    return jsonify(result)


# ─── Real CSV Ingest Endpoint ─────────────────────────────────────────────────

@app.route("/api/ingest", methods=["POST"])
def ingest():
    """
    POST multipart/form-data with 'file' (CSV)
    Accepts GSTR-1 or GSTR-3B CSV → parses → inserts into DB → refreshes analysis.
    Expected CSV columns (GSTR-1 style):
      seller_gstin, buyer_gstin, invoice_date, taxable_value, cgst, sgst, igst, total_tax, invoice_amount
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send 'file' in multipart/form-data."}), 400

    f = request.files["file"]
    if not f.filename.endswith(".csv"):
        return jsonify({"error": "Only .csv files are accepted"}), 400

    try:
        import pandas as pd
        import uuid

        content = f.read().decode("utf-8")
        df = pd.read_csv(io.StringIO(content))

        # Normalize column names to lowercase
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        required = {"seller_gstin", "buyer_gstin", "invoice_date", "invoice_amount"}
        missing = required - set(df.columns)
        if missing:
            return jsonify({
                "error": f"Missing required columns: {', '.join(missing)}",
                "columns_found": list(df.columns)
            }), 400

        # Fill optional columns with defaults
        for col, default in [
            ("cgst", 0.0), ("sgst", 0.0), ("igst", 0.0),
            ("total_tax", 0.0), ("taxable_value", 0.0), ("fraud_tag", "uploaded")
        ]:
            if col not in df.columns:
                df[col] = default

        db = get_db()

        # Ensure all GSTINs in the CSV exist in companies table
        existing_gstins = {
            r[0] for r in db.execute("SELECT gstin FROM companies").fetchall()
        }

        new_companies = []
        for gstin in set(df["seller_gstin"].tolist() + df["buyer_gstin"].tolist()):
            if gstin not in existing_gstins:
                new_companies.append((
                    str(gstin), f"Entity {str(gstin)[:12]}", "Unknown",
                    "2020-01-01", 0.0, "LOW"
                ))
                existing_gstins.add(gstin)

        if new_companies:
            db.executemany(
                "INSERT OR IGNORE INTO companies VALUES (?,?,?,?,?,?)", new_companies
            )

        # Insert invoices
        inserted = 0
        for _, row in df.iterrows():
            inv_id = "INV" + uuid.uuid4().hex[:8].upper()
            try:
                db.execute(
                    "INSERT OR IGNORE INTO invoices VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        inv_id,
                        str(row["seller_gstin"]),
                        str(row["buyer_gstin"]),
                        str(row["invoice_date"]),
                        float(row.get("taxable_value", 0)),
                        float(row.get("cgst", 0)),
                        float(row.get("sgst", 0)),
                        float(row.get("igst", 0)),
                        float(row.get("total_tax", 0)),
                        float(row["invoice_amount"]),
                        str(row.get("fraud_tag", "uploaded")),
                    )
                )
                inserted += 1
            except Exception:
                continue

        db.commit()
        db.close()

        # Re-run full analysis on updated data
        refresh_analysis()

        return jsonify({
            "status": "ok",
            "message": f"Ingested {inserted} invoices from {f.filename}. Analysis refreshed.",
            "invoices_inserted": inserted,
            "new_entities": len(new_companies),
        })

    except Exception as e:
        return jsonify({"error": f"Ingest failed: {str(e)}"}), 500


# Legacy upload endpoint (now wraps ingest logic)
@app.route("/api/upload", methods=["POST"])
def upload():
    """Legacy endpoint — re-runs analysis without file upload."""
    refresh_analysis()
    return jsonify({"status": "ok", "message": "Data re-analyzed successfully"})


# ─── Serve React frontend ─────────────────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    dist = Path(app.static_folder)
    if path and (dist / path).exists():
        return send_from_directory(dist, path)
    index = dist / "index.html"
    if index.exists():
        return send_from_directory(dist, "index.html")
    return jsonify({"message": "React frontend not built. Run: npm run build in frontend/"}), 200


# ─── Startup ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not DB_PATH.exists():
        print("⚠  Database not found! Run generate_data.py first.")
        print("   python generate_data.py")
    else:
        refresh_analysis()
    app.run(host="0.0.0.0", port=5000, debug=False)
