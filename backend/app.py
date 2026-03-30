"""
Flask REST API — GST Fraud Identification System
Team Code Novas | ITERYX '26
"""

import sqlite3
import json
import os
import io
import secrets
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from functools import wraps
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
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

DB_PATH = Path(__file__).parent / "data" / "gst_fraud.db"

DB_PATH = Path(__file__).parent / "data" / "gst_fraud.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Authentication Helpers ───────────────────────────────────────────────────

def hash_password(password: str, salt: str = None) -> tuple:
    """Hash password with salt using SHA-256."""
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return hashed, salt

def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """Verify password against stored hash."""
    hashed, _ = hash_password(password, salt)
    return hashed == password_hash

def create_session(user_id: int) -> str:
    """Create a new session token for user."""
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now() + timedelta(hours=24)).isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)",
        (token, user_id, datetime.now().isoformat(), expires_at)
    )
    db.commit()
    db.close()
    return token

def get_current_user(token: str):
    """Get user from session token."""
    if not token:
        return None
    db = get_db()
    session = db.execute(
        "SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    if not session:
        db.close()
        return None
    if datetime.fromisoformat(session["expires_at"]) < datetime.now():
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        db.commit()
        db.close()
        return None
    user = db.execute(
        "SELECT id, email, name, role, is_active FROM users WHERE id = ?",
        (session["user_id"],)
    ).fetchone()
    db.close()
    if user and user["is_active"]:
        return dict(user)
    return None

def require_auth(roles=None):
    """Decorator to require authentication and optionally specific roles."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = request.headers.get("Authorization", "").replace("Bearer ", "")
            user = get_current_user(token)
            if not user:
                return jsonify({"error": "Authentication required"}), 401
            if roles and user["role"] not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            request.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator


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


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def login():
    """Authenticate user and return session token."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    
    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE LOWER(email) = ? AND is_active = 1",
        (email,)
    ).fetchone()
    
    if not user:
        db.close()
        return jsonify({"error": "Invalid credentials"}), 401
    
    if not verify_password(password, user["password_hash"], user["password_salt"]):
        db.close()
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Update last login
    db.execute(
        "UPDATE users SET last_login = ? WHERE id = ?",
        (datetime.now().isoformat(), user["id"])
    )
    db.commit()
    db.close()
    
    # Create session
    token = create_session(user["id"])
    
    return jsonify({
        "status": "ok",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    })

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    """Invalidate session token."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        db = get_db()
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        db.commit()
        db.close()
    return jsonify({"status": "ok"})

@app.route("/api/auth/me")
def get_me():
    """Get current user info from token."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user = get_current_user(token)
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"user": user})

@app.route("/api/auth/users")
@require_auth(roles=["admin"])
def list_users():
    """List all users (admin only)."""
    db = get_db()
    users = db.execute(
        "SELECT id, email, name, role, created_at, last_login, is_active FROM users"
    ).fetchall()
    db.close()
    return jsonify({"users": [dict(u) for u in users]})

@app.route("/api/auth/users", methods=["POST"])
@require_auth(roles=["admin"])
def create_user():
    """Create new user (admin only)."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "").strip()
    role = data.get("role", "analyst")
    
    if not email or not password or not name:
        return jsonify({"error": "Email, password, and name required"}), 400
    
    if role not in ("admin", "auditor", "analyst"):
        return jsonify({"error": "Invalid role"}), 400
    
    hashed, salt = hash_password(password)
    
    try:
        db = get_db()
        db.execute(
            "INSERT INTO users (email, password_hash, password_salt, name, role, created_at) VALUES (?,?,?,?,?,?)",
            (email, hashed, salt, name, role, datetime.now().isoformat())
        )
        db.commit()
        user_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        db.close()
        return jsonify({"status": "ok", "user_id": user_id})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email already exists"}), 409

@app.route("/api/auth/users/<int:user_id>", methods=["DELETE"])
@require_auth(roles=["admin"])
def delete_user(user_id):
    """Deactivate user (admin only)."""
    if request.current_user["id"] == user_id:
        return jsonify({"error": "Cannot delete yourself"}), 400
    
    db = get_db()
    db.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))
    db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    db.commit()
    db.close()
    return jsonify({"status": "ok"})


# ─── API Routes ───────────────────────────────────────────────────────────────

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
        from datetime import datetime

        content = f.read().decode("utf-8")
        file_size = len(content)
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

        # Build a map of GSTIN -> company name from CSV if columns exist
        gstin_names = {}
        if "seller_name" in df.columns:
            for _, row in df.iterrows():
                gstin_names[str(row["seller_gstin"])] = str(row["seller_name"])
        if "buyer_name" in df.columns:
            for _, row in df.iterrows():
                gstin_names[str(row["buyer_gstin"])] = str(row["buyer_name"])

        new_companies = []
        updated_companies = []
        for gstin in set(df["seller_gstin"].tolist() + df["buyer_gstin"].tolist()):
            gstin_str = str(gstin)
            # Use name from CSV if available, otherwise generate from GSTIN
            name = gstin_names.get(gstin_str, f"Entity {gstin_str[:12]}")
            
            if gstin_str not in existing_gstins:
                new_companies.append((
                    gstin_str, name, "Unknown",
                    "2020-01-01", 0.0, "LOW", "Active", 0
                ))
                existing_gstins.add(gstin_str)
            elif gstin_str in gstin_names:
                # Update existing company name if CSV provides a name
                updated_companies.append((name, gstin_str))

        if new_companies:
            db.executemany(
                "INSERT OR IGNORE INTO companies VALUES (?,?,?,?,?,?,?,?)", new_companies
            )
        
        # Update names for existing companies if CSV had names
        if updated_companies:
            db.executemany(
                "UPDATE companies SET name = ? WHERE gstin = ?", updated_companies
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

        # Log upload to history
        upload_id = "UPL" + uuid.uuid4().hex[:8].upper()
        db.execute(
            "INSERT INTO upload_history VALUES (?,?,?,?,?,?,?,?)",
            (
                upload_id,
                f.filename,
                datetime.now().isoformat(),
                inserted,
                len(new_companies),
                file_size,
                content if file_size < 50000 else None,  # Store content if < 50KB
                "success"
            )
        )
        
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


# ─── Upload History & Database Management ─────────────────────────────────────

@app.route("/api/upload-history")
def upload_history():
    """Get all CSV upload history records."""
    try:
        limit = request.args.get("limit", type=int)
        db = get_db()
        
        query = "SELECT * FROM upload_history ORDER BY upload_date DESC"
        if limit:
            query += f" LIMIT {limit}"
        
        rows = db.execute(query).fetchall()
        db.close()
        
        history = []
        for row in rows:
            history.append({
                "upload_id": row["upload_id"],
                "filename": row["filename"],
                "upload_date": row["upload_date"],
                "records_inserted": row["records_inserted"],
                "new_entities": row["new_entities"],
                "file_size": row["file_size"],
                "status": row["status"],
                "has_content": bool(row["csv_content"])
            })
        
        return jsonify({"history": history})
    except Exception as e:
        return jsonify({"error": f"Failed to fetch history: {str(e)}"}), 500


@app.route("/api/upload-history/<upload_id>/content")
def upload_content(upload_id):
    """Get CSV content for a specific upload (if stored)."""
    try:
        db = get_db()
        row = db.execute(
            "SELECT csv_content, filename FROM upload_history WHERE upload_id = ?",
            (upload_id,)
        ).fetchone()
        db.close()
        
        if not row or not row["csv_content"]:
            return jsonify({"error": "CSV content not available"}), 404
        
        return jsonify({
            "filename": row["filename"],
            "content": row["csv_content"]
        })
    except Exception as e:
        return jsonify({"error": f"Failed to fetch content: {str(e)}"}), 500


@app.route("/api/snapshot", methods=["POST"])
def create_snapshot():
    """Create a backup snapshot of current database."""
    try:
        from datetime import datetime
        import shutil
        
        SNAPSHOTS_DIR = Path(__file__).parent / "data" / "snapshots"
        SNAPSHOTS_META = SNAPSHOTS_DIR / "snapshots.json"
        SNAPSHOTS_DIR.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        snapshot_id = f"snapshot_{timestamp}"
        snapshot_file = SNAPSHOTS_DIR / f"{snapshot_id}.db"
        
        # Copy database file
        shutil.copy2(DB_PATH, snapshot_file)
        
        # Get database stats
        db = get_db()
        companies_count = db.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
        invoices_count = db.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        db.close()
        
        # Update metadata
        metadata = {"snapshots": []}
        if SNAPSHOTS_META.exists():
            with open(SNAPSHOTS_META, 'r') as f:
                metadata = json.load(f)
        
        metadata["snapshots"].append({
            "id": snapshot_id,
            "created_at": datetime.now().isoformat(),
            "file": f"{snapshot_id}.db",
            "companies_count": companies_count,
            "invoices_count": invoices_count
        })
        
        with open(SNAPSHOTS_META, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return jsonify({
            "status": "ok",
            "message": f"Snapshot created: {snapshot_id}",
            "snapshot_id": snapshot_id,
            "companies": companies_count,
            "invoices": invoices_count
        })
    except Exception as e:
        return jsonify({"error": f"Snapshot failed: {str(e)}"}), 500


@app.route("/api/snapshots")
def list_snapshots():
    """List all available database snapshots."""
    try:
        SNAPSHOTS_DIR = Path(__file__).parent / "data" / "snapshots"
        SNAPSHOTS_META = SNAPSHOTS_DIR / "snapshots.json"
        
        if not SNAPSHOTS_META.exists():
            return jsonify({"snapshots": []})
        
        with open(SNAPSHOTS_META, 'r') as f:
            metadata = json.load(f)
        
        return jsonify(metadata)
    except Exception as e:
        return jsonify({"error": f"Failed to list snapshots: {str(e)}"}), 500


@app.route("/api/restore/<snapshot_id>", methods=["POST"])
def restore_snapshot(snapshot_id):
    """Restore database from a snapshot."""
    try:
        import shutil
        
        SNAPSHOTS_DIR = Path(__file__).parent / "data" / "snapshots"
        snapshot_file = SNAPSHOTS_DIR / f"{snapshot_id}.db"
        
        if not snapshot_file.exists():
            return jsonify({"error": "Snapshot not found"}), 404
        
        # Create backup of current state before restoring
        backup_file = Path(__file__).parent / "data" / "gst_fraud_pre_restore.db"
        shutil.copy2(DB_PATH, backup_file)
        
        # Restore from snapshot
        shutil.copy2(snapshot_file, DB_PATH)
        
        # Refresh analysis with restored data
        refresh_analysis()
        
        return jsonify({
            "status": "ok",
            "message": f"Database restored from {snapshot_id}",
            "backup": "Pre-restore backup saved as gst_fraud_pre_restore.db"
        })
    except Exception as e:
        return jsonify({"error": f"Restore failed: {str(e)}"}), 500


@app.route("/api/clear-data", methods=["POST"])
def clear_data():
    """Clear all invoices and optionally companies/history (reset database for testing)."""
    try:
        data = request.get_json() or {}
        clear_companies = data.get("clear_companies", False)
        clear_history = data.get("clear_history", False)
        confirmation = data.get("confirmation", "")
        
        # Require confirmation token to prevent accidents
        if confirmation != "CLEAR_ALL_DATA":
            return jsonify({
                "error": "Confirmation required. Send {\"confirmation\": \"CLEAR_ALL_DATA\"}"
            }), 400
        
        db = get_db()
        
        # Get counts before clearing
        invoices_count = db.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        companies_count = db.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
        history_count = db.execute("SELECT COUNT(*) FROM upload_history").fetchone()[0]
        
        # Clear tables
        db.execute("DELETE FROM invoices")
        db.execute("DELETE FROM fraud_rings")
        db.execute("DELETE FROM entity_scores")
        
        if clear_companies:
            db.execute("DELETE FROM companies")
        
        if clear_history:
            db.execute("DELETE FROM upload_history")
        
        db.commit()
        db.close()
        
        # Refresh analysis
        refresh_analysis()
        
        message = f"Cleared {invoices_count} invoices"
        if clear_companies:
            message += f", {companies_count} companies"
        if clear_history:
            message += f", {history_count} history records"
        
        return jsonify({
            "status": "ok",
            "message": message,
            "invoices_cleared": invoices_count,
            "companies_cleared": companies_count if clear_companies else 0,
            "history_cleared": history_count if clear_history else 0
        })
    except Exception as e:
        return jsonify({"error": f"Clear failed: {str(e)}"}), 500


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
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
