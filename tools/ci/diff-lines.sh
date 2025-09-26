#!/usr/bin/env bash
# @module: ci
# @tags: git, automation
set -euo pipefail
BASE=${1:-origin/main}
git fetch origin +refs/heads/*:refs/remotes/origin/* >/dev/null 2>&1 || true
git diff --unified=0 --no-color $BASE...HEAD |
  awk '
    /^diff --git/ { file=$4; sub("^b/","",file) }
    /^@@/ {
      if (match($0, /\+([0-9]+)(,([0-9]+))?/, m)) {
        start=m[1]; count=(m[3]==""?1:m[3]);
        for (i=0; i<count; i++) print file ":" start+i;
      }
    }'
