#!/bin/sh
# PostToolUse: format the JavaScript/TypeScript file Claude just edited with Biome.
# Lint findings are left to `npm run lint`; this only applies safe fixes.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts | *.tsx | *.js | *.mjs) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
npx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true "$file" >/dev/null 2>&1 || true
