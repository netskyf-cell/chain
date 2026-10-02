#!/usr/bin/env bash
# A human pushes to production. Blocks commands that deploy, push to the default branch,
# or change the production database. Exit 2 = block.
input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

if printf '%s' "$cmd" | grep -Eq 'vercel +(deploy +)?--prod|vercel +promote|git +push[^|;&]*( |:)(main|master)( |$)|git +push[^|;&]*--force|supabase +db +(push|reset)|supabase +migration +up'; then
  echo "Blocked by production-gate: production changes are made by a person. Open a pull request, or ask the owner to run this command." >&2
  exit 2
fi
exit 0
