"""
Database schema initialization and migration script
Adds upload_history table, snapshots tracking, and users table
"""
import sqlite3
from pathlib import Path
import json
from datetime import datetime

DB_PATH = Path(__file__).parent / "data" / "gst_fraud.db"
SNAPSHOTS_DIR = Path(__file__).parent / "data" / "snapshots"
SNAPSHOTS_META = SNAPSHOTS_DIR / "snapshots.json"

def init_upload_history_table():
    """Create upload_history table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS upload_history (
            upload_id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            upload_date TEXT NOT NULL,
            records_inserted INTEGER,
            new_entities INTEGER,
            file_size INTEGER,
            csv_content TEXT,
            status TEXT DEFAULT 'success'
        )
    """)
    conn.commit()
    conn.close()
    print("✓ upload_history table created/verified")

def init_users_table():
    """Create users table for authentication."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'auditor', 'analyst')),
            created_at TEXT NOT NULL,
            last_login TEXT,
            is_active INTEGER DEFAULT 1
        )
    """)
    conn.commit()
    conn.close()
    print("✓ users table created/verified")

def init_sessions_table():
    """Create sessions table for token management."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()
    print("✓ sessions table created/verified")

def init_snapshots_dir():
    """Create snapshots directory and metadata file."""
    SNAPSHOTS_DIR.mkdir(exist_ok=True)
    if not SNAPSHOTS_META.exists():
        with open(SNAPSHOTS_META, 'w') as f:
            json.dump({"snapshots": []}, f, indent=2)
    print(f"✓ Snapshots directory initialized: {SNAPSHOTS_DIR}")

def show_tables():
    """Display all tables in database."""
    conn = sqlite3.connect(DB_PATH)
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    print("\nCurrent database tables:")
    for (table,) in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  - {table:20s} ({count} rows)")
    conn.close()

if __name__ == "__main__":
    print("Initializing database schema...")
    init_upload_history_table()
    init_users_table()
    init_sessions_table()
    init_snapshots_dir()
    show_tables()
    print("\n✅ Database schema setup complete!")
