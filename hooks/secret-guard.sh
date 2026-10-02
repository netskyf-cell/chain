#!/usr/bin/env bash
# Blocks writes that contain likely secrets. Exit 2 = block, message goes back to Claude.
input=$(cat)
text=$(printf '%s' "$input" | python3 -c '
import json,sys
d=json.load(sys.stdin).get("tool_input",{})
print(d.get("content","")+"\n"+d.get("new_string",""))
' 2>/dev/null)

if printf '%s' "$text" | grep -Eq 'sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|SERVICE_ROLE_KEY *[=:] *["'"'"']?[A-Za-z0-9]'; then
  echo "Blocked by secret-guard: the content looks like it contains a secret. Use an environment variable and .env.example instead." >&2
  exit 2
fi
exit 0
