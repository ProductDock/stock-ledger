#!/usr/bin/env bash
set -uo pipefail

# A lightweight eval, not a unit test: runs resolver-agent against all six
# seeded SKUs and checks whether recommendedAction lands where
# scenarios/SCENARIOS.md says it should. 
#
# This calls the real Claude API — it costs real tokens, and the exact reasoning text can vary between runs even
# when the decision doesn't — so it's deliberately not part of `npm test` or
# CI. Run it by hand after touching the system prompt, the tools, or the
# seed data, to catch a regression in the *decision*, not the wording.
#
# Requires resolver-agent (and the two services behind it) to already be
# running — see the root README for how to start them.

AGENT_URL="${AGENT_URL:-http://localhost:4003}"

expected_action() {
  case "$1" in
    SKU-001|SKU-003) echo "trust_wms" ;;
    SKU-002|SKU-004) echo "trust_storefront" ;;
    SKU-005|SKU-006) echo "needs_human_review" ;;
  esac
}

failures=0

for sku in SKU-001 SKU-002 SKU-003 SKU-004 SKU-005 SKU-006; do
  response=$(curl -s -X POST "${AGENT_URL}/resolve/${sku}")

  if [ -z "$response" ]; then
    actual="<no response>"
  else
    actual=$(echo "$response" | jq -r '.recommendedAction // "<no response>"' 2>/dev/null)
    [ -z "$actual" ] && actual="<no response>"
  fi
  want=$(expected_action "$sku")

  if [ "$actual" = "$want" ]; then
    echo "PASS  ${sku}: ${actual}"
  else
    echo "FAIL  ${sku}: expected ${want}, got ${actual}"
    echo "$response" | jq . >&2
    failures=$((failures + 1))
  fi
done

echo
if [ "$failures" -eq 0 ]; then
  echo "All 6 scenarios resolved as expected."
else
  echo "${failures} of 6 scenario(s) did not match the expected recommendedAction."
  exit 1
fi
