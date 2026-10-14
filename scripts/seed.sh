#!/usr/bin/env bash
# FlagForge sample data: a workspace with flags for the SRS use cases (UC-01 – UC-03)
# and acceptance criteria (AC-01 – AC-03), created through the public API so the audit log
# fills in naturally. Prints both SDK keys in full — they are shown only once.
# Needs only bash, curl and coreutils. Run after `docker compose up`.
#
#   ./scripts/seed.sh
#   BASE_URL=http://host:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... WORKSPACE_NAME=... ./scripts/seed.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@flagforge.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-flagforge-demo}"
WORKSPACE_NAME="${WORKSPACE_NAME:-Acme Store}"
API="$BASE_URL/api/v1"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31mFAIL:\033[0m %s\n' "$*" >&2; exit 1; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
json_field() { grep -o "\"$1\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }
env_field() { # $1 = workspace JSON, $2 = environment name, $3 = id|sdkKey
  case "$3" in
    id) echo "$1" | grep -o "\"id\":\"[^\"]*\",\"workspaceId\":\"[^\"]*\",\"name\":\"$2\"" | cut -d'"' -f4 ;;
    sdkKey) echo "$1" | grep -o "\"name\":\"$2\"[^}]*\"sdkKey\":\"[^\"]*\"" | grep -o '"sdkKey":"[^"]*"' | cut -d'"' -f4 ;;
  esac
}

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

admin() { # $1 = method, $2 = path, $3 = JSON body
  curl -fs -X "$1" "$API$2" -H "Cookie: $COOKIE" -H 'Content-Type: application/json' -d "$3"
}

bold "3. Creating workspace \"$WORKSPACE_NAME\""
if curl -fs "$API/workspaces" -H "Cookie: $COOKIE" | grep -q "\"name\":\"$WORKSPACE_NAME\""; then
  fail "workspace \"$WORKSPACE_NAME\" already exists. Its SDK keys were shown when it was created;
      rotate them on the SDK key page, or seed another one: WORKSPACE_NAME='Acme Store 2' $0"
fi
WS=$(admin POST /workspaces "{\"name\":\"$WORKSPACE_NAME\"}")
WS_ID=$(echo "$WS" | grep -o '"workspace":{"id":"[^"]*"' | cut -d'"' -f6)
DEV_ID=$(env_field "$WS" Development id)
DEV_KEY=$(env_field "$WS" Development sdkKey)
PROD_ID=$(env_field "$WS" Production id)
PROD_KEY=$(env_field "$WS" Production sdkKey)
[ -n "$WS_ID" ] && [ -n "$DEV_KEY" ] && [ -n "$PROD_KEY" ] || fail "could not create workspace: $WS"
ok "workspace with Development and Production environments"

bold "4. Creating flags"
# UC-01 / AC-01: created at 10%, then raised to 30%, so the audit log shows an update.
CHECKOUT=$(admin POST "/environments/$DEV_ID/flags" \
  '{"key":"new-checkout","name":"New checkout","description":"Redesigned checkout flow","isEnabled":true,"percentageRollout":10}')
admin PATCH "/flags/$(echo "$CHECKOUT" | json_field id)" '{"percentageRollout":30}' > /dev/null
ok "Development / new-checkout: on, rollout raised 10% → 30% (UC-01, AC-01)"

# UC-03 / AC-02: only enterprise customers, nobody through the rollout.
admin POST "/environments/$DEV_ID/flags" \
  '{"key":"beta-dashboard","name":"Beta dashboard","isEnabled":true,"percentageRollout":0,"targetingRules":[{"attribute":"plan","operator":"EQUALS","values":["enterprise"],"value":true}]}' > /dev/null
ok "Development / beta-dashboard: on, 0%, rule plan = enterprise → On (UC-03, AC-02)"

# UC-02 / AC-03: switched off despite 100% and a matching rule.
admin POST "/environments/$DEV_ID/flags" \
  '{"key":"dark-mode","name":"Dark mode","isEnabled":false,"percentageRollout":100,"targetingRules":[{"attribute":"country","operator":"IN","values":["UA","PL"],"value":true}]}' > /dev/null
ok "Development / dark-mode: off, 100%, rule country in UA,PL (UC-02, AC-03)"

# UC-01 in Production: the same feature at its first rollout step.
admin POST "/environments/$PROD_ID/flags" \
  '{"key":"new-checkout","name":"New checkout","description":"Redesigned checkout flow","isEnabled":true,"percentageRollout":5}' > /dev/null
ok "Production / new-checkout: on, rollout 5% (UC-01)"

bold "5. Checking the flags through the evaluation API"
evaluate() { # $1 = flag key, $2 = context JSON (without flagKey)
  curl -fs -X POST "$API/evaluate" -H "X-Environment-Key: $DEV_KEY" \
    -H 'Content-Type: application/json' -d "{\"flagKey\":\"$1\",$2}"
}
expect() { # $1 = flag key, $2 = context, $3 = expected value, $4 = expected reason
  local body
  body=$(evaluate "$1" "$2")
  echo "$body" | grep -q "\"value\":$3,\"reason\":\"$4\"" || fail "$1: expected $3 / $4, got $body"
  ok "$1 → $3 ($4)"
}
expect new-checkout '"userId":"usr_1001"' true PERCENTAGE_ROLLOUT
expect beta-dashboard '"userId":"usr_99","attributes":{"plan":"enterprise"}' true TARGETING_MATCH
expect dark-mode '"userId":"usr_1001","attributes":{"country":"UA"}' false DISABLED

bold "Done. Save these SDK keys — FlagForge stores only their hashes and won't show them again:"
printf '  Development  %s\n  Production   %s\n' "$DEV_KEY" "$PROD_KEY"

bold "Dashboard"
printf '  %s/w/%s/e/%s/flags  (sign in as %s)\n' "$BASE_URL" "$WS_ID" "$DEV_ID" "$ADMIN_EMAIL"
printf '  Playground: paste the Development key and evaluate new-checkout for usr_1001 (bucket 28 of 30%%).\n'

bold "Try it with curl"
cat <<EOF
  curl -s -X POST $API/evaluate \\
    -H "X-Environment-Key: $DEV_KEY" \\
    -H "Content-Type: application/json" \\
    -d '{"flagKey":"beta-dashboard","userId":"usr_99","attributes":{"plan":"enterprise"}}'
EOF
