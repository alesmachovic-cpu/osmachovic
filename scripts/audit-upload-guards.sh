#!/usr/bin/env bash
# audit-upload-guards.sh
# Skontroluje že každý endpoint ktorý prijíma multipart/formData má:
#   - requireUser auth
#   - assertFileSize size limit
#   - assertMime MIME whitelist
# (cez src/lib/uploadGuards.ts)
set -uo pipefail
cd "$(dirname "$0")/.."

VIOLATIONS=0
PASSED=0

# Nájdi súbory čo používajú formData() alebo .formData()
FILES=$(grep -rln "\.formData()" src/app/api --include="*.ts" 2>/dev/null || true)

for f in $FILES; do
  rel="${f#$PWD/}"

  HAS_AUTH=$(grep -c "requireUser" "$f" || echo 0)
  HAS_SIZE=$(grep -c "assertFileSize\|UPLOAD_LIMITS\|file\.size" "$f" || echo 0)
  HAS_MIME=$(grep -c "assertMime\|ALLOWED_.*_MIMES\|file\.type" "$f" || echo 0)

  if [ "$HAS_AUTH" -gt 0 ] && [ "$HAS_SIZE" -gt 0 ] && [ "$HAS_MIME" -gt 0 ]; then
    PASSED=$((PASSED + 1))
  else
    VIOLATIONS=$((VIOLATIONS + 1))
    MISSING=""
    [ "$HAS_AUTH" -eq 0 ] && MISSING="$MISSING auth"
    [ "$HAS_SIZE" -eq 0 ] && MISSING="$MISSING size-limit"
    [ "$HAS_MIME" -eq 0 ] && MISSING="$MISSING mime-check"
    echo "  ✗ $rel  (missing:$MISSING)"
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo "VÝSLEDOK: ✗ $VIOLATIONS fail / ✓ $PASSED pass"
  exit 1
fi
echo "VÝSLEDOK: ✓ $PASSED pass"
exit 0
