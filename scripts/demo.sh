#!/usr/bin/env bash
# FlagForge success-criteria demo (docs/00-problem.md):
#   create a flag with a 50% rollout and prove that evaluation is deterministic and fast.
# Needs only bash, curl and coreutils. Run after `docker compose up`.
#
#   ./scripts/demo.sh                      # against http://localhost:3000 with demo credentials
#   BASE_URL=http://host:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... ./scripts/demo.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@flagforge.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-flagforge-demo}"
API="$BASE_URL/api/v1"
RUNS=100
USERS=200

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31mFAIL:\033[0m %s\n' "$*" >&2; exit 1; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
json_field() { grep -o "\"$1\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }

bold "1. Waiting for $BASE_URL"
for _ in $(seq 1 30); do
  curl -fs "$BASE_URL/readyz" > /dev/null && break
  sleep 1
done
curl -fs "$BASE_URL/readyz" > /dev/null || fail "FlagForge is not ready at $BASE_URL (is docker compose up?)"
ok "API and database are ready"

bold "2. Signing in as $ADMIN_EMAIL"
COOKIE=$(curl -s -D - -o /dev/null -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" |
  grep -i '^set-cookie: ff_session=' | sed -E 's/^[Ss]et-[Cc]ookie: ([^;]*).*/\1/')
[ -n "$COOKIE" ] || fail "login failed — check ADMIN_EMAIL / ADMIN_PASSWORD"
ok "session cookie received"

bold "3. Creating a workspace and a 50% rollout flag"
WS=$(curl -fs -X POST "$API/workspaces" -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Demo $(date +%Y-%m-%dT%H:%M:%S)\"}")
ENV_ID=$(echo "$WS" | grep -o '"id":"[^"]*","workspaceId":"[^"]*","name":"Production"' | cut -d'"' -f4)
SDK_KEY=$(echo "$WS" | grep -o '"sdkKey":"ff_live_[^"]*"' | cut -d'"' -f4)
[ -n "$ENV_ID" ] && [ -n "$SDK_KEY" ] || fail "could not create workspace: $WS"
ok "Production environment $ENV_ID, SDK key ${SDK_KEY:0:12}…"

FLAG=$(curl -fs -X POST "$API/environments/$ENV_ID/flags" -H "Cookie: $COOKIE" \
  -H 'Content-Type: application/json' \
  -d '{"key":"new-checkout","name":"New checkout","isEnabled":true,"percentageRollout":50}')
FLAG_ID=$(echo "$FLAG" | json_field id)
[ -n "$FLAG_ID" ] || fail "could not create flag: $FLAG"
ok "flag new-checkout: on, 50% rollout"

evaluate() { # $1 = userId; prints "<body>\t<seconds>"
  curl -s -w '\t%{time_total}' -X POST "$API/evaluate" \
    -H "X-Environment-Key: $SDK_KEY" -H 'Content-Type: application/json' \
    -d "{\"flagKey\":\"new-checkout\",\"userId\":\"$1\"}"
}

bold "4. Determinism: evaluating usr_1001 $RUNS times"
TIMES=$(mktemp)
trap 'rm -f "$TIMES"' EXIT
FIRST=""
for _ in $(seq 1 "$RUNS"); do
  IFS=$'\t' read -r BODY ELAPSED <<< "$(evaluate usr_1001)"
  [ -z "$FIRST" ] && FIRST="$BODY"
  [ "$BODY" = "$FIRST" ] || fail "non-deterministic result: $BODY vs $FIRST"
  echo "$ELAPSED" >> "$TIMES"
done
ok "all $RUNS responses identical: $FIRST"

sort -n "$TIMES" | awk -v n="$RUNS" '
  { t[NR] = $1 * 1000 }
  END {
    printf "  round-trip latency (curl, incl. connection): p50 %.1f ms · p95 %.1f ms · max %.1f ms\n",
      t[int(n * 0.50)], t[int(n * 0.95)], t[n]
    if (t[int(n * 0.95)] >= 15) exit 1
  }' && ok "p95 under 15 ms (NFR-01 target)" ||
  printf '\033[33m!\033[0m p95 at or above 15 ms on this machine — see scripts/load-test.mjs for the NFR-01 measurement\n'

bold "5. Distribution: $USERS different users at 50%"
ON=0
for i in $(seq 1 "$USERS"); do
  evaluate "user-$i" | grep -q '"value":true' && ON=$((ON + 1))
done
ok "$ON of $USERS users get the feature (~50% expected; the same users every run)"

bold "6. Kill-switch"
curl -fs -o /dev/null -X PATCH "$API/flags/$FLAG_ID" -H "Cookie: $COOKIE" \
  -H 'Content-Type: application/json' -d '{"isEnabled":false}'
AFTER=$(evaluate usr_1001 | cut -f1)
echo "$AFTER" | grep -q '"reason":"DISABLED"' || fail "kill-switch did not apply: $AFTER"
ok "next evaluation after turning it off: $AFTER"

bold "Done. Open $BASE_URL to see the flag and its audit log in the dashboard."
