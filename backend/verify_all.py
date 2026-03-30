"""Final verification — tests every gap fix end-to-end."""
import urllib.request, json, sys

BASE = "http://localhost:5000/api"

def get(path):
    return json.loads(urllib.request.urlopen(f"{BASE}{path}", timeout=10).read())

def post(path, body):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

def post_empty(path):
    """POST with no body."""
    req = urllib.request.Request(f"{BASE}{path}", method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

ok = 0; fail = 0

def check(name, cond, detail=""):
    global ok, fail
    if cond:
        print(f"  ✅ {name}")
        ok += 1
    else:
        print(f"  ❌ {name}  {detail}")
        fail += 1

print("=" * 55)
print(" GST FraudNet — Final Gap Verification")
print("=" * 55)

# Health
h = get("/health")
check("Backend running", h["status"] == "ok")

# Stats
s = get("/dashboard-stats")
check("80 entities in DB",         s["total_entities"] == 80)
check("Fraud rings detected",      s["fraud_rings_detected"] >= 3)
check("CRITICAL entities exist",   s["critical_entities"] >= 1,
      f"got {s['critical_entities']}")
check("/api/dashboard-stats works", "suspicious_value" in s)

# Companies
c = get("/companies")
check("/api/companies returns list",    len(c) == 80)
top = max(c, key=lambda x: x["fraud_score"])
check("Top entity is CRITICAL",    top["risk_level"] == "CRITICAL",
      f"got {top['risk_level']} score={top['fraud_score']}")
check("Fraud score >= 86 (CRITICAL)",  top["fraud_score"] >= 86,
      f"got {top['fraud_score']}")

# GAP-12: /api/entities alias
e = get("/entities")
check("GAP-12: /api/entities alias works", len(e) == 80)

# GAP-5: schema columns
co = top
check("GAP-5: companies.status field exists",       "status" in co)
check("GAP-5: companies.is_fraud_ring field exists", "is_fraud_ring" in co)

# Fraud rings
rings = get("/fraud-rings")
check("Fraud rings returned",      len(rings) >= 3)
r0 = rings[0]
check("GAP-5: rings.confidence field exists",  "confidence" in r0,
      str(r0.keys()))
check("ring.cycle_path is a list", isinstance(r0["cycle_path"], list),
      f"type={type(r0['cycle_path'])}")

# Company detail + cycle_path fix
gstin = top["gstin"]
detail = get(f"/company/{gstin}")
check("Company detail endpoint works",     "features" in detail)
check("participating_rings included",      "participating_rings" in detail)
if detail["participating_rings"]:
    cp = detail["participating_rings"][0]["cycle_path"]
    check("BUG FIX: cycle_path is array (not string)", isinstance(cp, list),
          f"type={type(cp)}")

# GAP-4: Weights (verify cycle score dominates)
feats = detail["features"]
check("GAP-4: cycle_participation in features",  "cycle_participation" in feats)

# GAP-1 & GAP-2: /api/explain
print("\n  Testing /api/explain (RAG engine)...")
ex = post("/explain", {"gstin": gstin})
check("GAP-2: /api/explain endpoint works",    "explanation" in ex)
check("GAP-1: RAG retrieval active",           ex.get("rag_enabled") == True,
      f"rag_enabled={ex.get('rag_enabled')}")
check("Explanation is non-empty",             len(ex.get("explanation","")) > 100)
check("Sources list returned",                len(ex.get("sources",[])) > 0)
check("Fallback model (no API key set)",      ex.get("llm_model") == "rule-based-fallback"
      or "claude" in ex.get("llm_model","") or "gpt" in ex.get("llm_model",""))

# ═══════════════════════════════════════════════════════════════════════════════
# UPLOAD HISTORY & DATA MANAGEMENT TESTS
# ═══════════════════════════════════════════════════════════════════════════════
print("\n  Testing Upload History & Data Management...")

# Upload History endpoint
hist = get("/upload-history")
check("Upload history endpoint works",  "history" in hist)
check("History is a list",              isinstance(hist["history"], list))

# If there are history records, verify structure
if hist["history"]:
    record = hist["history"][0]
    check("History has upload_id",      "upload_id" in record)
    check("History has filename",       "filename" in record)
    check("History has upload_date",    "upload_date" in record)
    check("History has records_inserted", "records_inserted" in record)

# Upload history with limit parameter
hist_limited = get("/upload-history?limit=5")
check("History limit param works",      len(hist_limited["history"]) <= 5)

# Snapshots list endpoint
snaps = get("/snapshots")
check("Snapshots list endpoint works",  "snapshots" in snaps)
check("Snapshots is a list",            isinstance(snaps["snapshots"], list))

# Create a snapshot
print("\n  Creating test snapshot...")
snap_result = post_empty("/snapshot")
check("Snapshot creation works",        snap_result.get("status") == "ok")
check("Snapshot returns ID",            "snapshot_id" in snap_result)

# Verify snapshot appeared
snaps_after = get("/snapshots")
check("Snapshot appears in list",       len(snaps_after["snapshots"]) > len(snaps["snapshots"]))

# Verify snapshot structure
if snaps_after["snapshots"]:
    snap = snaps_after["snapshots"][0]
    check("Snapshot has id",            "id" in snap)
    check("Snapshot has created_at",    "created_at" in snap)
    check("Snapshot has counts",        "companies_count" in snap and "invoices_count" in snap)

# Clear data endpoint - test without confirmation (should fail)
try:
    bad_clear = post("/clear-data", {"confirmation": "wrong"})
    check("Clear data rejects bad confirm", bad_clear.get("error") is not None)
except urllib.error.HTTPError as e:
    check("Clear data rejects bad confirm", e.code == 400)

print()
print("=" * 55)
print(f" Results: {ok} passed, {fail} failed")
print("=" * 55)

if fail > 0:
    sys.exit(1)
