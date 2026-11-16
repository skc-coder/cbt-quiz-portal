# Project History & Task Tracker: CBT Practice Portal

## 2026-11-16: Public Release & Vercel Migration (Issue #1)
- **User Request**:
  - Make a public web version hosted on Vercel separate from `gate-quiz-addon`.
  - Monetize using Adsterra (`https://beta.publishers.adsterra.com/stats`) with a top support banner asking users to support by clicking 2-3 ads per session, and strict guarantee of zero ads during live CBT test.
  - Remove all logos and legacy examoverflow/gateoverflow branding.
  - Remove "lucky test 1" / chemical kinetics test from the question bank.
  - Remove Cloudflare worker sync; replace with JSONBin.io cloud sync.
  - Ensure sync is non-destructive (empty local cache does not wipe remote data, merge remote and local attempts).
  - Implement interactive conflict resolution picker allowing candidate to choose between local and cloud attempt if conflict arises.
  - Include setup guide modal when JSONBin is not configured.
- **Root Cause & Details**:
  - The original addon repo was a private repository configured with Cloudflare Workers KV and browser extension packaging.
  - Public deployment requires an isolated public Git repo, clean white-labeling, static asset caching headers for Vercel, and a serverless free JSON storage sync mechanism (JSONBin).
- **Implementations**:
  - Duplicated project to `/home/skc/dev/cbt-quiz-portal` excluding git history, binaries, and test packages.
  - Removed `tests/lucky/lucky test 1.json` and regenerated `src/tests_catalog.json` (1809 active tests).
  - Removed all legacy branding (`examoverflow`, `gateoverflow`) and logo images.
  - Created `vercel.json` with secure HTTP headers and caching configurations.
  - Integrated JSONBin v3 REST API for push, pull, and automatic sync upon exam submission.
  - Implemented interactive conflict resolver modal (`#conflictResolverModal`) and setup guide modal (`#jsonbinGuideModal`).
  - Added Adsterra sponsor slots (`#catalogTopAdSlot`, `#resultTopAdSlot`) and non-intrusive top support banner (`#supportBanner`).
  - Documented relationship with `gate-quiz-addon` in README.md and updated history tracking.
- **Status**: Completed & verified locally.
