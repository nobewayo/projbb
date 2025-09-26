#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [<base-ref>] [--allow-dirty]"
  echo "Default base is origin/main. Generates .ci/changed-lines.txt to STDOUT."
}

BASE="origin/main"
ALLOW_DIRTY=0

for a in "$@"; do
  case "$a" in
    --allow-dirty) ALLOW_DIRTY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) BASE="$a" ;;
  esac
done

# Refuse to run if there are uncommitted changes, unless allow-dirty is set.
if [ $ALLOW_DIRTY -eq 0 ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Working tree is dirty. Commit first, then run this script."
    echo "If you really need a preview, run with --allow-dirty, but prefer after-commit."
    exit 2
  fi
fi

git fetch -q origin || true
# List added and modified line numbers compared to the base
git diff --unified=0 --no-color "$BASE"...HEAD |
  awk '
    /^diff --git/ { file=$4; sub("^b/","",file) }
    /^@@/ {
      if (match($0, /\+([0-9]+)(,([0-9]+))?/, m)) {
        start=m[1]; count=(m[3]==""?1:m[3]);
        for (i=0; i<count; i++) print file ":" start+i;
      }
    }'
