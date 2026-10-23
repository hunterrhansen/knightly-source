#!/bin/sh
# SessionStart: pushes are only checked locally (CI is not running per push),
# so warn when this clone has not enabled the pre-push hook.
cd "$CLAUDE_PROJECT_DIR" || exit 0
if [ "$(git config core.hooksPath)" != ".githooks" ]; then
  echo "Pre-push hook not installed: run \`npm run hooks:install\` so every push runs \`npm run verify\`. See docs/runtime-verification.md#ci-and-pre-push."
fi
