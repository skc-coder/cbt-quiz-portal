# Project History & Task Tracker: CBT Practice Portal

## 2026-11-16: Update Smartlink with New Anti-Adblock Tag (Update 7)
- **GitHub Issue**: skc-coder/cbt-quiz-portal#4
- **User Request**:
  - Integrate new Smartlink tag `https://asiafilm.org/4/8e7a72df55209eb75d77dbd9698ccf19` for anti-adblock optimization.
- **Implementations**:
  - Updated the top sponsor support button in `index.html` to point to `https://asiafilm.org/4/8e7a72df55209eb75d77dbd9698ccf19`.
  - Updated `ad links.txt` with the new anti-adblock Smartlink tag.
  - Confirmed the popunder script tag (`https://abscloud.org/1/69ea3fa0d64709dae2f4378ed6be0a70`) is directly active and in sync.
- **Status**: Tested, verified, and committed.

## 2026-11-16: Revert Popunder Throttling to Original Direct Script Tag (Update 6)
- **GitHub Issue**: skc-coder/cbt-quiz-portal#3
- **User Request**:
  - Revert popunder changes and restore popunder ad script exactly as it was originally configured.
- **Implementations**:
  - Removed client-side rate-limiting and localStorage throttling script wrapper from `index.html`.
  - Restored raw, direct Adsterra popunder script tag (`<script data-cfasync="false" src="https://abscloud.org/1/69ea3fa0d64709dae2f4378ed6be0a70"></script>`) as defined in `ad links.txt`.
- **Status**: Tested, verified, and committed.

## 2026-11-16: Disable Social Bar Ad, Retain Ad Boxes, & Android Mobile Responsiveness (Update 5)
- **GitHub Issue**: skc-coder/cbt-quiz-portal#2
- **User Request**:
  - Disable the floating notification-like ad (Social Bar) so it no longer appears.
  - Ensure all ad placeholder containers remain visible on screen even if ads don't load or are ad-blocked.
  - Keep all other ad formats (banners, support link, post-exam banners, review banners, controlled popunder) active.
  - Implement thorough responsive design optimized for Android mobile devices.
- **Implementations**:
  - Removed Social Bar notification script (`https://bauval.org/14/3a33496a1c21bccf192883f2ecbb2dda`) from `index.html`.
  - Added proper mobile viewport meta tag (`<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`) to enable native Android scaling.
  - Preserved `.ad-slot-container` and `.table-ad-row` structure and styling with dashed ash-gray borders so containers remain intact as requested even when blocked by browser ad-blockers or DNS filters.
  - Added comprehensive mobile CSS rules across `src/styles.css` and `style.css` for viewports under 768px and 480px:
    - View tabs now horizontally scroll with touch momentum and hidden scrollbars.
    - Full-width search bar on mobile with clean touch targets.
    - Responsive Excel catalog table with horizontal scrollable wrapper.
    - Single/dual-column responsive grid layout for performance metrics and heatmaps.
    - Optimized TCS iON exam layout for mobile with centered toolbar, stacked hotbar action buttons with touch-friendly paddings, and responsive sliding question palette overlay (up to 85vw width).
    - Mobile-friendly modals and floating calculator positioning.
- **Status**: Tested, verified, and committed.

## 2026-11-16: Popunder Rate-Limiting & CBT Ad Shield (Update 4)
- **User Request**:
  - Stop ad popups from firing during CBT exams.
  - Remove the cross button from the top support banner.
  - Rate-limit / throttle the aggressive popunder behavior.
- **Implementations**:
  - Removed close/cross button from `#supportBanner`.
  - Added strict exam view hide in `switchView` so `#supportBanner` and all ad hooks are forcefully hidden when entering `examView`.
  - Added `in-cbt-exam` state class to `document.body` during live examination.
  - Wrapped Adsterra popunder in a rate-limiting throttle (10-minute cooldown in `localStorage`) and added an active exam check to block popup triggers while taking a test.
- **Status**: Tested, verified, and committed.

## 2026-11-16: UI Refinement & Comprehensive Setup Guide Details (Update 3)
- **User Request**:
  - Remove the intrusive ad container below the tabs/buttons and the ad slot at the very bottom of the catalog.
  - Expand the JSONBin setup guide modal with thorough, detailed step-by-step instructions.
- **Implementations**:
  - Removed top ad slot `#catalogTopAdSlot` from above the catalog toolbar.
  - Removed the bottom ad container from underneath the spreadsheet catalog table.
  - Expanded `#jsonbinGuideModal` with comprehensive, numbered step-by-step instructions (creating account, copying Master Key, creating a private Bin with `{}`, copying the 24-character Bin ID, and explaining when automatic/manual sync occurs) alongside the direct input fields.
- **Status**: Tested, verified, and committed.

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
