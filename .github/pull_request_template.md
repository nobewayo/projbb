<!-- @module: ci -->
<!-- @tags: pr-template -->
- [ ] Ran `pnpm codemap` and committed the updated map
- [ ] After committing, ran `tools/ci/diff-lines.sh origin/main > .ci/changed-lines.txt`
- [ ] CI "Codemap" is green
- [ ] CI "Smoke" uploaded the client screenshot, see Actions → Artifacts
