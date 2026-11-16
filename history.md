# Project History & Task Tracker: CBT Practice Portal

## 2026-11-16: Adsterra Monetization Tags & Direct Setup Guide Inputs (Update 2)
- **User Request**:
  - Add input fields for JSONBin Bin ID and Master Key directly inside the setup guide modal.
  - Integrate provided Adsterra ad codes and smart link (`https://araplhn.org/4/5b9ffdceaece6bd353e7079b536e74fa`).
  - Add clickable support button in top banner pointing to the smart link.
  - Insert ad banners across the tests catalog list (every 5 tests), at the bottom of the tests catalog, on the performance/attempts list, and between questions in post-exam solution review (every 3 questions).
- **Implementations**:
  - Enhanced `#jsonbinGuideModal` with direct Bin ID & API Key inputs and instant verification/sync button (`#btnSaveGuideCredentials`).
  - Added smart link button in the top banner: `❤️ Click to Support (Sponsor Ad)`.
  - Added native banner container `#container-69f22be2e9a4ef5c2425bc1031cd316d` and script at top of test catalog.
  - Added social bar script (`bauval.org/14/3a33496a1c21bccf192883f2ecbb2dda`) and popunder (`abscloud.org/1/69ea3fa0d64709dae2f4378ed6be0a70`).
  - Inserted iframe-isolated banner ad rows after every 5 test rows in the catalog spreadsheet table.
  - Inserted 728x90 banner at the bottom of the catalog and 468x60 banner above the performance attempts table.
  - Inserted sponsor ad slots between review cards in `#solutionReviewList` every 3 questions.
- **Status**: Tested, verified, and committed.

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
