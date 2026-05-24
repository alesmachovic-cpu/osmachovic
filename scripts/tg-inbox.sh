#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# tg-inbox.sh — Claude turn-start inbox pre Telegram správy od CEO.
#
# Pri každom mojom turn-e tento skript zavolá Telegram getUpdates a vypíše
# všetky NOVÉ správy od posledného uloženého update_id. Posledný update_id
# je v .tg-inbox-cursor (gitignored).
#
# Použitie:
#   scripts/tg-inbox.sh           # vypíše nové správy + advance cursor
#   scripts/tg-inbox.sh peek      # vypíše nové správy, NEMENÍ cursor (dry-run)
#   scripts/tg-inbox.sh reset     # vymaže cursor, ďalší beh prečíta všetko
#
# ENV (povinné):
#   TELEGRAM_BOT_TOKEN    bot token (z @BotFather)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CURSOR_FILE="$(cd "$(dirname "$0")/.." && pwd)/.tg-inbox-cursor"
TOKEN="${TELEGRAM_BOT_TOKEN:-8988573310:AAHo8YSggicOIadutg6Lq_H5W4brpLmXCn8}"

if [ "${1:-}" = "reset" ]; then
  rm -f "$CURSOR_FILE"
  echo "tg-inbox: cursor reset."
  exit 0
fi

MODE="${1:-advance}"
LAST_SEEN=$(cat "$CURSOR_FILE" 2>/dev/null || echo 0)
OFFSET=$((LAST_SEEN + 1))

RAW=$(curl -s --max-time 10 "https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${OFFSET}&timeout=0") || {
  echo "tg-inbox: getUpdates fetch failed" >&2
  exit 1
}

python3 - "$RAW" "$CURSOR_FILE" "$MODE" <<'PY'
import json, sys, os, datetime
raw, cursor_file, mode = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    d = json.loads(raw)
except Exception as e:
    print(f"tg-inbox: invalid JSON ({e})", file=sys.stderr); sys.exit(1)
if not d.get("ok"):
    print(f"tg-inbox: telegram error: {d.get('description')}", file=sys.stderr); sys.exit(1)

results = d.get("result", [])
new = []
max_id = 0
for u in results:
    uid = int(u.get("update_id", 0))
    if uid > max_id: max_id = uid
    msg = u.get("message") or u.get("edited_message")
    if not msg: continue
    text = msg.get("text") or msg.get("caption")
    if not text: continue
    ts = datetime.datetime.fromtimestamp(msg.get("date", 0)).strftime("%H:%M:%S")
    name = (msg.get("from") or {}).get("first_name", "?")
    new.append((uid, ts, name, text))

if not new:
    print("tg-inbox: (žiadne nové správy)")
    sys.exit(0)

print(f"tg-inbox: {len(new)} nová správa(y):")
for uid, ts, name, text in new:
    print(f"  [{ts}] {name} (id={uid}): {text}")

if mode == "advance" and max_id > 0:
    with open(cursor_file, "w") as f:
        f.write(str(max_id))
    print(f"tg-inbox: cursor → {max_id}")
PY
