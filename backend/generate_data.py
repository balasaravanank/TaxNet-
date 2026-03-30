"""
Synthetic GST Data Generator
Generates realistic fake companies and invoices with embedded fraud patterns.
Team Code Novas | ITERYX '26
"""

import csv
import json
import random
import sqlite3
import os
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

# ─── Config ──────────────────────────────────────────────────────────────────
NUM_COMPANIES    = 80
NUM_INVOICES     = 900
DATA_DIR         = Path(__file__).parent / "data"
DB_PATH          = DATA_DIR / "gst_fraud.db"

STATES = ["Maharashtra", "Tamil Nadu", "Karnataka", "Delhi", "Gujarat",
          "Rajasthan", "Uttar Pradesh", "West Bengal", "Telangana", "Kerala"]

STATE_CODES = {
    "Maharashtra": "27", "Tamil Nadu": "33", "Karnataka": "29",
    "Delhi": "07", "Gujarat": "24", "Rajasthan": "08",
    "Uttar Pradesh": "09", "West Bengal": "19", "Telangana": "36", "Kerala": "32"
}

BUSINESS_PREFIXES = [
    "Sri", "Shri", "New", "Modern", "National", "Global", "Prime", "Smart",
    "Tech", "Indo", "Bharat", "Apex", "Star", "Royal", "Elite", "Pioneer"
]
BUSINESS_SUFFIXES = [
    "Enterprises", "Traders", "Industries", "Solutions", "Corp", "Trading Co",
    "Pvt Ltd", "Services", "Associates", "Ventures", "Exports", "Imports",
    "Manufacturing", "Distributors", "Suppliers"
]

# ─── Helpers ─────────────────────────────────────────────────────────────────

def random_gstin(state_code, pan_chars):
    """Generate a fake but realistic GSTIN."""
    pan = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=5)) + \
          "".join(random.choices("0123456789", k=4)) + \
          random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    return f"{state_code}{pan}1Z{random.choice('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')}"

def random_company_name():
    return f"{random.choice(BUSINESS_PREFIXES)} {random.choice(BUSINESS_SUFFIXES)}"

def random_date(start="2023-04-01", end="2024-03-31"):
    s = datetime.strptime(start, "%Y-%m-%d")
    e = datetime.strptime(end, "%Y-%m-%d")
    return (s + timedelta(days=random.randint(0, (e - s).days))).strftime("%Y-%m-%d")

def invoice_id():
    return "INV" + "".join(random.choices("0123456789", k=8))

def compute_taxes(taxable_value, inter_state=False):
    rate = random.choice([0.05, 0.12, 0.18, 0.28])
    total_tax = round(taxable_value * rate, 2)
    if inter_state:
        return 0.0, 0.0, total_tax, total_tax
    half = round(total_tax / 2, 2)
    return half, half, 0.0, total_tax

# ─── Step 1: Generate Companies ──────────────────────────────────────────────

def generate_companies(n=NUM_COMPANIES):
    companies = []
    used_gstins = set()
    for i in range(n):
        state  = random.choice(STATES)
        scode  = STATE_CODES[state]
        gstin  = random_gstin(scode, str(i))
        while gstin in used_gstins:
            gstin = random_gstin(scode, str(i) + "x")
        used_gstins.add(gstin)
        reg_date = random_date("2018-01-01", "2022-12-31")
        companies.append({
            "gstin": gstin,
            "company_name": random_company_name(),
            "state": state,
            "registration_date": reg_date,
            "fraud_score": 0.0,
            "risk_level": "LOW",
            "status": "Active",
            "is_fraud_ring": 0,
        })
    return companies


# ─── Step 2: Embed Fraud Patterns ────────────────────────────────────────────

def embed_fraud_patterns(companies, invoices_list):
    gstins = [c["gstin"] for c in companies]

    # ── Pattern 1: Circular Trading Ring A→B→C→D→A ──────────────────────────
    ring1 = gstins[0:4]   # 4-entity ring
    ring2 = gstins[4:8]   # another 4-entity ring
    ring3 = gstins[8:11]  # 3-entity ring

    # Mark ring members with is_fraud_ring=1
    all_ring_gstins = set(ring1 + ring2 + ring3)
    for c in companies:
        if c["gstin"] in all_ring_gstins:
            c["is_fraud_ring"] = 1

    for ring in [ring1, ring2, ring3]:
        base_amount = round(random.uniform(500000, 2000000), 2)
        date = random_date("2023-07-01", "2024-01-31")
        for i in range(len(ring)):
            seller  = ring[i]
            buyer   = ring[(i + 1) % len(ring)]
            cgst, sgst, igst, total_tax = compute_taxes(base_amount, inter_state=False)
            invoices_list.append({
                "invoice_id":     invoice_id(),
                "seller_gstin":   seller,
                "buyer_gstin":    buyer,
                "invoice_date":   date,
                "taxable_value":  base_amount,
                "cgst":           cgst,
                "sgst":           sgst,
                "igst":           igst,
                "total_tax":      total_tax,
                "invoice_amount": round(base_amount + total_tax, 2),
                "fraud_tag":      "circular_ring"
            })
            # Repeat invoice twice a month for 3 months
            for _ in range(2):
                d2 = (datetime.strptime(date, "%Y-%m-%d") + timedelta(days=random.randint(15, 45))).strftime("%Y-%m-%d")
                cgst2, sgst2, igst2, tt2 = compute_taxes(base_amount)
                invoices_list.append({
                    "invoice_id":     invoice_id(),
                    "seller_gstin":   seller,
                    "buyer_gstin":    buyer,
                    "invoice_date":   d2,
                    "taxable_value":  base_amount,
                    "cgst":           cgst2,
                    "sgst":           sgst2,
                    "igst":           igst2,
                    "total_tax":      tt2,
                    "invoice_amount": round(base_amount + tt2, 2),
                    "fraud_tag":      "circular_ring"
                })

    # ── Pattern 2: Shell Companies (only receive, never sell) ─────────────────
    shells = gstins[20:25]  # 5 shell companies
    buyers_for_shells = gstins[30:45]  # they harvest ITC from these
    for shell in shells:
        for real_entity in random.sample(buyers_for_shells, k=4):
            amt = round(random.uniform(200000, 800000), 2)
            cgst, sgst, igst, tt = compute_taxes(amt)
            invoices_list.append({
                "invoice_id":     invoice_id(),
                "seller_gstin":   real_entity,
                "buyer_gstin":    shell,
                "invoice_date":   random_date(),
                "taxable_value":  amt,
                "cgst":           cgst,
                "sgst":           sgst,
                "igst":           igst,
                "total_tax":      tt,
                "invoice_amount": round(amt + tt, 2),
                "fraud_tag":      "shell_company"
            })

    # ── Pattern 3: Tax Mismatch (claim >> collect) ────────────────────────────
    mismatchers = gstins[25:30]
    for m in mismatchers:
        for _ in range(5):
            amt = round(random.uniform(1000000, 4000000), 2)  # huge claim
            buyer = random.choice(gstins[45:65])
            cgst, sgst, igst, tt = compute_taxes(amt)
            invoices_list.append({
                "invoice_id":     invoice_id(),
                "seller_gstin":   buyer,
                "buyer_gstin":    m,
                "invoice_date":   random_date(),
                "taxable_value":  amt,
                "cgst":           cgst,
                "sgst":           sgst,
                "igst":           igst,
                "total_tax":      tt,
                "invoice_amount": round(amt + tt, 2),
                "fraud_tag":      "tax_mismatch"
            })

    # ── Pattern 4: Volume Spike ───────────────────────────────────────────────
    spikers = gstins[15:18]
    for spiker in spikers:
        # Normal months: 2–3 invoices, then spike month: 30+ invoices
        spike_month = random.choice(["2023-11", "2023-12", "2024-01"])
        for _ in range(30):
            amt = round(random.uniform(50000, 200000), 2)
            partner = random.choice(gstins[50:75])
            d = f"{spike_month}-{random.randint(1,28):02d}"
            cgst, sgst, igst, tt = compute_taxes(amt)
            invoices_list.append({
                "invoice_id":     invoice_id(),
                "seller_gstin":   spiker,
                "buyer_gstin":    partner,
                "invoice_date":   d,
                "taxable_value":  amt,
                "cgst":           cgst,
                "sgst":           sgst,
                "igst":           igst,
                "total_tax":      tt,
                "invoice_amount": round(amt + tt, 2),
                "fraud_tag":      "volume_spike"
            })

    # ── Pattern 5: Duplicate Invoices ─────────────────────────────────────────
    dup_seller = gstins[11]
    dup_buyer  = gstins[12]
    dup_amt    = round(random.uniform(100000, 500000), 2)
    dup_date   = random_date()
    cgst, sgst, igst, tt = compute_taxes(dup_amt)
    base_inv = {
        "seller_gstin":   dup_seller,
        "buyer_gstin":    dup_buyer,
        "invoice_date":   dup_date,
        "taxable_value":  dup_amt,
        "cgst":           cgst,
        "sgst":           sgst,
        "igst":           igst,
        "total_tax":      tt,
        "invoice_amount": round(dup_amt + tt, 2),
        "fraud_tag":      "duplicate_invoice"
    }
    for _ in range(5):  # 5 copies of same invoice
        inv = dict(base_inv)
        inv["invoice_id"] = invoice_id()
        invoices_list.append(inv)


# ─── Step 3: Normal Invoices ──────────────────────────────────────────────────

# Fraud-reserved GSTINs (indices 0–18 are ring/spike/dup nodes).
# Normal invoices must NOT include these to keep their SCCs small.
FRAUD_RESERVED_INDICES = set(range(19))

def generate_normal_invoices(companies, n):
    gstins = [c["gstin"] for c in companies]
    # Pool: only non-fraud-reserved companies
    clean_pool = [g for i, g in enumerate(gstins) if i not in FRAUD_RESERVED_INDICES]
    invoices = []
    for _ in range(n):
        seller, buyer = random.sample(clean_pool, 2)
        amt = round(random.uniform(10000, 300000), 2)
        inter = random.random() < 0.3
        cgst, sgst, igst, tt = compute_taxes(amt, inter)
        invoices.append({
            "invoice_id":     invoice_id(),
            "seller_gstin":   seller,
            "buyer_gstin":    buyer,
            "invoice_date":   random_date(),
            "taxable_value":  amt,
            "cgst":           cgst,
            "sgst":           sgst,
            "igst":           igst,
            "total_tax":      tt,
            "invoice_amount": round(amt + tt, 2),
            "fraud_tag":      "normal"
        })
    return invoices


# ─── Step 4: GSTR Summaries ───────────────────────────────────────────────────

def generate_gstr_returns(companies, invoices):
    """Aggregate monthly GSTR-1 (outward) and GSTR-3B (summary) per company."""
    gstr1, gstr3b = [], []
    # Build lookup
    by_seller = {}
    by_buyer  = {}
    for inv in invoices:
        by_seller.setdefault(inv["seller_gstin"], []).append(inv)
        by_buyer.setdefault(inv["buyer_gstin"],   []).append(inv)

    months = [f"2023-{m:02d}" for m in range(4, 13)] + ["2024-01", "2024-02", "2024-03"]

    for company in companies:
        gstin = company["gstin"]
        for month in months:
            sold = [i for i in by_seller.get(gstin, []) if i["invoice_date"].startswith(month)]
            bought = [i for i in by_buyer.get(gstin, []) if i["invoice_date"].startswith(month)]

            out_tax = sum(i["total_tax"] for i in sold)
            in_tax  = sum(i["total_tax"] for i in bought)
            out_val = sum(i["invoice_amount"] for i in sold)
            in_val  = sum(i["invoice_amount"] for i in bought)

            # GSTR-1: outward supplies
            gstr1.append({
                "gstin": gstin,
                "period": month,
                "num_invoices_issued": len(sold),
                "outward_taxable_value": round(out_val, 2),
                "output_tax_collected": round(out_tax, 2)
            })

            # GSTR-3B: net liability (sometimes mismatch for fraud entities)
            # Fraud entities "forget" to report some output tax
            fudge = 0.6 if gstin in [c["gstin"] for c in companies[25:30]] else 1.0
            gstr3b.append({
                "gstin": gstin,
                "period": month,
                "input_tax_credit_claimed": round(in_tax, 2),
                "output_tax_declared": round(out_tax * fudge, 2),
                "net_tax_paid": round(max(0, out_tax * fudge - in_tax), 2)
            })

    return gstr1, gstr3b


# ─── Step 5: Write CSV + DB ───────────────────────────────────────────────────

def save_csv(rows, filename, fieldnames):
    path = DATA_DIR / filename
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ {filename} ({len(rows)} rows)")

def save_db(companies, invoices, gstr1, gstr3b):
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    cur.executescript("""
        CREATE TABLE companies (
            gstin TEXT PRIMARY KEY,
            company_name TEXT,
            state TEXT,
            registration_date TEXT,
            fraud_score REAL DEFAULT 0,
            risk_level TEXT DEFAULT 'LOW',
            status TEXT DEFAULT 'Active',
            is_fraud_ring INTEGER DEFAULT 0
        );
        CREATE TABLE invoices (
            invoice_id TEXT PRIMARY KEY,
            seller_gstin TEXT,
            buyer_gstin TEXT,
            invoice_date TEXT,
            taxable_value REAL,
            cgst REAL, sgst REAL, igst REAL,
            total_tax REAL,
            invoice_amount REAL,
            fraud_tag TEXT DEFAULT 'normal',
            FOREIGN KEY (seller_gstin) REFERENCES companies(gstin),
            FOREIGN KEY (buyer_gstin)  REFERENCES companies(gstin)
        );
        CREATE TABLE gstr1_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gstin TEXT, period TEXT,
            num_invoices_issued INTEGER,
            outward_taxable_value REAL,
            output_tax_collected REAL
        );
        CREATE TABLE gstr3b_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gstin TEXT, period TEXT,
            input_tax_credit_claimed REAL,
            output_tax_declared REAL,
            net_tax_paid REAL
        );
        CREATE TABLE fraud_rings (
            ring_id INTEGER PRIMARY KEY AUTOINCREMENT,
            cycle_path TEXT,
            cycle_length INTEGER,
            total_cycling_value REAL,
            confidence REAL DEFAULT 0.85,
            detected_at TEXT
        );
        CREATE TABLE entity_scores (
            gstin TEXT PRIMARY KEY,
            tax_mismatch_ratio REAL,
            volume_spike_score REAL,
            duplicate_invoice_count INTEGER,
            cycle_participation INTEGER,
            shell_company_score REAL,
            pagerank_anomaly REAL,
            isolation_forest_label INTEGER,
            composite_score REAL
        );
    """)

    cur.executemany("INSERT INTO companies VALUES (?,?,?,?,?,?,?,?)",
        [(c["gstin"], c["company_name"], c["state"],
          c["registration_date"], c["fraud_score"], c["risk_level"],
          c.get("status", "Active"), c.get("is_fraud_ring", 0))
         for c in companies])

    cur.executemany(
        "INSERT OR IGNORE INTO invoices VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [(i["invoice_id"], i["seller_gstin"], i["buyer_gstin"],
          i["invoice_date"], i["taxable_value"],
          i["cgst"], i["sgst"], i["igst"],
          i["total_tax"], i["invoice_amount"], i.get("fraud_tag","normal"))
         for i in invoices])

    cur.executemany(
        "INSERT INTO gstr1_returns (gstin,period,num_invoices_issued,outward_taxable_value,output_tax_collected) VALUES (?,?,?,?,?)",
        [(r["gstin"],r["period"],r["num_invoices_issued"],r["outward_taxable_value"],r["output_tax_collected"])
         for r in gstr1])

    cur.executemany(
        "INSERT INTO gstr3b_returns (gstin,period,input_tax_credit_claimed,output_tax_declared,net_tax_paid) VALUES (?,?,?,?,?)",
        [(r["gstin"],r["period"],r["input_tax_credit_claimed"],r["output_tax_declared"],r["net_tax_paid"])
         for r in gstr3b])

    conn.commit()
    conn.close()
    print(f"  ✓ gst_fraud.db created")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print("🔧 Generating synthetic GST data...")

    companies = generate_companies(NUM_COMPANIES)

    invoices = []
    embed_fraud_patterns(companies, invoices)
    invoices += generate_normal_invoices(companies, NUM_INVOICES)

    # Deduplicate invoice IDs (extremely rare but safe)
    seen = set()
    unique_invoices = []
    for inv in invoices:
        if inv["invoice_id"] not in seen:
            seen.add(inv["invoice_id"])
            unique_invoices.append(inv)
    invoices = unique_invoices

    gstr1, gstr3b = generate_gstr_returns(companies, invoices)

    # Save CSVs
    save_csv(companies, "companies.csv",
             ["gstin","company_name","state","registration_date","fraud_score","risk_level","status","is_fraud_ring"])
    save_csv(invoices, "invoices.csv",
             ["invoice_id","seller_gstin","buyer_gstin","invoice_date",
              "taxable_value","cgst","sgst","igst","total_tax","invoice_amount","fraud_tag"])
    save_csv(gstr1, "gstr1_returns.csv",
             ["gstin","period","num_invoices_issued","outward_taxable_value","output_tax_collected"])
    save_csv(gstr3b, "gstr3b_returns.csv",
             ["gstin","period","input_tax_credit_claimed","output_tax_declared","net_tax_paid"])

    save_db(companies, invoices, gstr1, gstr3b)

    print(f"\n✅ Done! {len(companies)} companies, {len(invoices)} invoices.")
    print(f"   Fraud patterns embedded: circular rings, shells, tax mismatch, volume spike, duplicates")
    print(f"   Data saved to: {DATA_DIR}")

if __name__ == "__main__":
    main()
