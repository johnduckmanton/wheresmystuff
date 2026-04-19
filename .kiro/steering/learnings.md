---
inclusion: auto
---

# Learnings & Gotchas

## Vitest Commands
When running frontend tests, do NOT double up flags. The `npm test` script already includes `--run`:
- WRONG: `vitest --run --run --reporter=verbose`
- WRONG: `npm test -- --run --reporter=verbose`
- RIGHT: `npm test` (in frontend directory)
- RIGHT: `vitest --run` (if calling vitest directly)
