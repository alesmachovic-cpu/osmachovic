#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# qa-smoke-test.sh — manuálny trigger Daily Reality Checker (E027).
#
# Použitie:
#   scripts/qa-smoke-test.sh                          # default test.amgd.sk
#   scripts/qa-smoke-test.sh https://test.amgd.sk     # explicit URL
#   scripts/qa-smoke-test.sh https://vianema.amgd.sk  # PROD (nepoužívať bez OK od Aleša!)
#
# ENV:
#   CRON_SECRET    Bearer secret (povinné — inak 401)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:-https://test.amgd.sk}"
SECRET="${CRON_SECRET:-}"

if [ -z "$SECRET" ]; then
  echo "❌ CRON_SECRET nie je v ENV. Pridaj do .env.local alebo export CRON_SECRET=..."
  exit 1
fi

echo "→ QA Smoke Test → $BASE_URL"
echo ""

START=$(date +%s)
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" --max-time 60 \
  -H "Authorization: Bearer $SECRET" \
  "$BASE_URL/api/cron/qa-smoke")
END=$(date +%s)
DURATION=$((END - START))

HTTP_CODE=$(echo "$RESPONSE" | grep "^HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "^HTTP_CODE:")

echo "HTTP: $HTTP_CODE   |   Trvanie: ${DURATION}s"
echo ""
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" != "200" ]; then
  echo ""
  echo "❌ Smoke test endpoint zlyhalo HTTP $HTTP_CODE"
  exit 1
fi

STATUS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
if [ "$STATUS" = "ok" ]; then
  echo ""
  echo "✓ QA smoke OK"
else
  echo ""
  echo "✗ QA smoke FAILED"
  exit 2
fi
