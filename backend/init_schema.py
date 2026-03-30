"""
Database schema initialization and migration script
Adds upload_history table and snapshots tracking
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
    init_snapshots_dir()
    show_tables()
    print("\n✅ Database schema setup complete!")
