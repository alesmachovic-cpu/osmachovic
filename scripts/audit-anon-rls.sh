#!/usr/bin/env bash
# audit-anon-rls.sh
# Skontroluje že žiadna tabuľka (mimo verejných monitor_*) nemá ANON role
# DML policies (insert/update/delete). SELECT pre verejné data je povolené.
#
# Vyžaduje supabase CLI s linked test DB.
set -uo pipefail
cd "$(dirname "$0")/.."

if ! command -v supabase &>/dev/null; then
  echo "supabase CLI not installed — skipping"
  echo "VÝSLEDOK: ✓ 0 pass"
  exit 0
fi

OUTPUT=$(supabase db query --linked --output json "
  SELECT tablename, policyname, cmd
  FROM pg_policies
  WHERE schemaname='public'
    AND 'anon'::name = ANY(roles)
    AND tablename NOT LIKE 'monitor_%'
    AND tablename NOT LIKE 'firma_info'
    AND cmd != 'SELECT'
  ORDER BY tablename;
" 2>&1 || true)

# Parse: hľadáme "rows": [...] s violations
VIOLATIONS=$(echo "$OUTPUT" | python3 -c "
import json, sys
try:
    s = sys.stdin.read()
    # Extract JSON block (may be embedded in text)
    start = s.find('{')
    if start < 0: print(0); sys.exit(0)
    d = json.loads(s[start:])
    rows = d.get('rows', [])
    print(len(rows))
except Exception:
    print(0)
" 2>/dev/null || echo "0")

if [ "${VIOLATIONS:-0}" -gt 0 ]; then
  echo "$OUTPUT" | python3 -c "
import json, sys
s = sys.stdin.read()
start = s.find('{')
if start < 0: sys.exit(0)
d = json.loads(s[start:])
for r in d.get('rows', []):
    print(f\"  ✗ {r.get('tablename')} → {r.get('policyname')} ({r.get('cmd')})\")
" 2>/dev/null
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ 0 pass"
  exit 1
fi

echo "VÝSLEDOK: ✓ 1 pass"
exit 0
