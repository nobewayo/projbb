#!/usr/bin/env bash
set -euo pipefail

OUT=""
ALLOW_DIRTY=0
BASE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) OUT="$2"; shift 2 ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    -h|--help)
      echo "Usage: $0 [base|auto] [--out <path>] [--allow-dirty]"
      echo "Default: auto detect base. Writes to STDOUT unless --out is given."
      exit 0 ;;
    *) BASE="$1"; shift ;;
  esac
done

# Ensure we are in a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo"; exit 1; }

# Reject dirty tree unless user opted in
if [[ $ALLOW_DIRTY -eq 0 ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Working tree is dirty. Commit first, then run this script."
    echo "For a preview, pass --allow-dirty."
    exit 2
  fi
fi

# Find a reasonable base if not provided or set to 'auto'
detect_base() {
  # CI hints first
  if [[ -n "${GITHUB_BASE_SHA:-}" ]]; then echo "$GITHUB_BASE_SHA"; return; fi
  if [[ -n "${GITHUB_BASE_REF:-}" ]]; then echo "origin/${GITHUB_BASE_REF}"; return; fi

  # Current branch upstream
  if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
    git rev-parse --abbrev-ref --symbolic-full-name @{u}
    return
  fi

  # origin/HEAD or origin/main
  if git rev-parse origin/HEAD >/dev/null 2>&1; then
    # origin/HEAD is a symref like origin/main
    git symbolic-ref -q --short origin/HEAD || echo "origin/main"
    return
  fi
  if git rev-parse origin/main >/dev/null 2>&1; then echo "origin/main"; return; fi

  # Local main or master
  if git rev-parse main >/dev/null 2>&1; then echo "main"; return; fi
  if git rev-parse master >/dev/null 2>&1; then echo "master"; return; fi

  # Fallback to previous commit
  if git rev-parse HEAD~1 >/dev/null 2>&1; then echo "HEAD~1"; return; fi

  # Final fallback to empty tree
  echo "$(git hash-object -t tree /dev/null)"
}

if [[ -z "$BASE" || "$BASE" == "auto" ]]; then
  BASE="$(detect_base)"
fi

# Ensure we have the ref locally if it is remote
if [[ "$BASE" == origin/* ]]; then git fetch -q origin || true; fi

DIFF=$(git diff --unified=0 --no-color "$BASE"...HEAD || true)

# Produce file:line for added lines
LINES=$(awk '
  BEGIN{ file="" }
  /^diff --git/ { file=$4; sub("^b/","",file) }
  /^@@/ {
    if (match($0, /\+([0-9]+)(,([0-9]+))?/, m)) {
      start=m[1]; count=(m[3]==""?1:m[3]);
      for (i=0; i<count; i++) print file ":" start+i;
    }
  }
' <<< "$DIFF")

if [[ -n "$OUT" ]]; then
  mkdir -p "$(dirname "$OUT")"
  printf "%s\n" "$LINES" > "$OUT"
else
  printf "%s\n" "$LINES"
fi

echo "Base: $BASE" >&2
echo "Lines: $(printf "%s\n" "$LINES" | grep -c . || true)" >&2
