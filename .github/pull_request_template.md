<!-- @module: ci -->
<!-- @tags: pr-template -->
- [ ] Generated `.ci/changed-lines.txt` with: `tools/ci/diff-lines.sh auto --out .ci/changed-lines.txt`
- [ ] Ran `pnpm codemap` and committed `codemap.json` and `CODEMAP.md`
- [ ] Branch is up to date with main
- [ ] All required checks are green (Codemap, Smoke, Pre-Cutover)
- [ ] Linked Smoke screenshot artifact (or noted N/A)
- [ ] If behavior changed: added an entry to `docs/DECISIONS.md` (Spec delta)
