#!/usr/bin/env python3
import json
import requests

with open("/home/ubuntu/upload/hey-listen-MASTER-SPEC-v10.md", "r") as f:
    spec_text = f.read()

print(f"[Test] Spec size: {len(spec_text)} chars ({len(spec_text)//1024}KB)")

payload = {
    "json": {
        "specText": spec_text,
        "projectName": "HeyListen"
    }
}

print("[Test] Sending request to TestForge API...")
response = requests.post(
    "http://localhost:3000/api/trpc/analysis.run",
    json=payload,
    timeout=300
)

if response.status_code != 200:
    print(f"[Error] Status {response.status_code}: {response.text[:500]}")
    exit(1)

data = response.json()
result = data.get("result", {}).get("data", {}).get("json", {})

if not result:
    print(f"[Error] Unexpected response structure: {json.dumps(data)[:500]}")
    exit(1)

analysis = result.get("analysisResult", {})
ir = analysis.get("ir", {})
proofs = result.get("proofs", [])
spec_health = analysis.get("specHealth", {})

print("\n=== RAW PIPELINE OUTPUT ===\n")
print("--- IR Summary ---")
print(f"Endpoints: {len(ir.get('apiEndpoints', []))}")
print(f"Behaviors: {len(ir.get('behaviors', []))}")
roles = [r.get('name', '') for r in (ir.get('authModel', {}) or {}).get('roles', [])]
print(f"Roles: {json.dumps(roles)}")
print(f"TenantKey: {ir.get('tenantKey', 'none')}")
sm = ir.get('statusMachine', {}) or {}
print(f"StatusMachine states: {json.dumps(sm.get('states', []))}")
print(f"StatusMachine transitions: {json.dumps(sm.get('transitions', []))}")
sms = ir.get('statusMachines', []) or []
print(f"StatusMachines (array): {len(sms)}")

print("\n--- Spec Health ---")
print(f"Score: {spec_health.get('score', '?')}/100 ({spec_health.get('grade', '?')})")
print(f"Summary: {spec_health.get('summary', '?')}")
dims = spec_health.get('dimensions', {})
for k, v in dims.items():
    print(f"  {k}: {v}")

print("\n--- Proofs ---")
print(f"Total proofs: {len(proofs)}")
validated = [p for p in proofs if p.get('status') == 'validated']
rejected = [p for p in proofs if p.get('status') == 'rejected']
pending = [p for p in proofs if p.get('status') == 'pending']
print(f"  validated: {len(validated)}")
print(f"  rejected: {len(rejected)}")
print(f"  pending: {len(pending)}")

print("\n--- Endpoint Names (first 20) ---")
for ep in ir.get('apiEndpoints', [])[:20]:
    print(f"  {ep.get('name')} [{ep.get('method')}] auth={ep.get('auth')}")

print("\n=== END ===")
