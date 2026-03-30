import urllib.request, json

# Get the top fraud entity
companies = json.loads(urllib.request.urlopen('http://localhost:5000/api/companies').read())
companies.sort(key=lambda x: x['fraud_score'], reverse=True)
top = companies[0]
print('Testing /api/explain for:', top['company_name'], '| GSTIN:', top['gstin'], '| Score:', top['fraud_score'])
print()

# Call explain
req = urllib.request.Request(
    'http://localhost:5000/api/explain',
    data=json.dumps({'gstin': top['gstin']}).encode(),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
result = json.loads(urllib.request.urlopen(req, timeout=30).read())
print('=== EXPLANATION ===')
print(result['explanation'])
print()
print('Sources:', result['sources'])
print('RAG enabled:', result['rag_enabled'])
print('Model:', result['llm_model'])

# Also test /api/entities
entities = json.loads(urllib.request.urlopen('http://localhost:5000/api/entities').read())
print()
print('/api/entities count:', len(entities))
