# Changelog

Alle nennenswerten Änderungen an Schach 9x9. Versionierung folgt [SemVer](https://semver.org/lang/de/).
Generiert aus den Git-Commits via `npm run changelog`.

## [1.0.0] – 2026-07-10

Changes since `v1.0.0-stable`.

### Features

- **aiController:** return null when hint worker pool is empty (6476cdf)
- **aiController:** harden worker pool init with fallback error handling (7d0d30d)
- **aiWorker:** add heartbeat self-monitoring for deadlock protection (429b7a8)
- **ui:** show AI thinking state in spinner-overlay (363a72f)

### Bug Fixes

- remove unused variables and constants in Rust engine (6fb805b)
- remove PIECE_SVGS from window interface to avoid TS2687 conflict (9519124)
- resolve PIECE_SVGS window type conflict (ecedca4)
- resolve PIECE_SVGS type errors in OverlayManager and pieces/index (eb2fd04)
- **ai:** disable root-level probcut that dropped AI moves at elo>=1400 (a415511)
- **ai:** heal JS search bugs found after WASM removal (6de0789)
- **ci:** consolidate Window global types into tracked js/global.d.ts (b30f022)
- **deps:** pin vulnerable transitive deps via overrides (225bf9b)

### Refactoring

- **ai:** remove WASM engine, fix JS search root move bug, clean up CI (8bc2a68)
- **AI:** centralize AI timeout constants in config.ts (6eb26f2)

### Tests

- raise AnalysisUI coverage to 99% lines / 82% branches (9b28225)
- raise coverage on weakest modules (opening db/ui, analysis, tactics) (c472927)
- **aiController:** guard empty pool in getHint() (925a2fb)

### CI / Automation

- make E2E non-blocking and enforce coverage thresholds (89a6ead)
- remove dependency-submission step (action unavailable in this GH setup) (ff8797f)
- fix dependency-submission action version (v4 -> v3) (b1e46e6)
- submit dependency graph snapshot to keep vuln dashboard in sync (296651d)
- remove engine-wasm/target from Rust cache to fix missing WASM artifact (f597c76)
- retrigger (60db38e)
- remove WASM change-detection, always build to fix Dependabot PRs (943ef94)
- retrigger CI after WASM build fix (c3c5a7c)
- trigger WASM build on package-lock.json changes (fix Dependabot PRs) (13a24bc)
- increase bundle budget to 2500 KB and make non-blocking for PRs (6e54678)
- remove engine-wasm/target from Rust cache to fix missing WASM artifact (4e1b9e8)
- remove WASM change-detection, always build to fix Dependabot PRs (03c5502)
- trigger WASM build on package-lock.json changes (fix Dependabot PRs) (98ba861)
- clear eslint cache (35dc8d8)
- **deps:** bump actions/checkout from 6 to 7 (1d1c343)
- **deps:** bump actions/cache from 5 to 6 (25e8c2e)
- **deps:** bump actions/checkout from 6 to 7 (9364084)

### Chores

- chore(deps-dev)(deps-dev): bump @types/node from 25.9.3 to 26.0.0 (65a9582)
- chore(deps-dev)(deps-dev): bump the development-dependencies group with 7 updates (#22) (bf8206d)
- **deps:** prefer focused npm dependency PRs over large bundles in Dependabot (604eaef)
