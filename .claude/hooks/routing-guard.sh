#!/usr/bin/env bash
# Blocks internal links without the hash route (ADR-0009). Applies to files under public/.
input=$(cat)
path=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)
case "$path" in
  */public/*) ;;
  *) exit 0 ;;
esac
text=$(printf '%s' "$input" | python3 -c '
import json,sys
d=json.load(sys.stdin).get("tool_input",{})
print(d.get("content","")+"\n"+d.get("new_string",""))
' 2>/dev/null)

# href="/something" that is not "/#/" and not an asset path
if printf '%s' "$text" | grep -Eq 'href="/[^#/]'; then
  echo "Blocked by routing-guard: internal links must use hash routes, for example href=\"/#/waiting\" (ADR-0009)." >&2
  exit 2
fi
exit 0
