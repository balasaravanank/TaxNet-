import sqlite3
db = sqlite3.connect('data/gst_fraud.db')
db.row_factory = sqlite3.Row

rows = db.execute("SELECT company_name, fraud_score, risk_level FROM companies ORDER BY fraud_score DESC LIMIT 8").fetchall()
print("Companies top 8:")
for r in rows:
    print(f"  {r['risk_level']:8s} {r['fraud_score']:5.1f}  {r['company_name']}")

print()
es = db.execute("SELECT gstin, composite_score FROM entity_scores ORDER BY composite_score DESC LIMIT 3").fetchall()
print("entity_scores top 3:")
for r in es:
    print(f"  {r['gstin']}: {r['composite_score']}")
db.close()
