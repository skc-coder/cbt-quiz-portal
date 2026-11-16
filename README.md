# CBT Practice Portal

A lightweight, zero-bloat, high-performance Computer-Based Test (CBT) examination simulator web application. Fully compatible with static hosting on Vercel and GitHub Pages.

---

## ⚠️ Relationship with `gate-quiz-addon`
This project is an **independent, public web deployment** branched from the private `gate-quiz-addon` repository:
1. **Public & White-Labeled**: Exam-agnostic CBT simulator engine with zero third-party trademarks or proprietary logos.
2. **Hosting**: Hosted statically on Vercel with clean URL routing, asset caching, and security headers (`vercel.json`).
3. **Cloud Sync**: Uses **JSONBin.io** for multi-device progress synchronization with non-destructive merge and conflict resolution.
4. **Adsterra Monetization**: Non-intrusive sponsor support banner and dedicated ad placement outside live test sessions.

---

## Setup & Installation

Clone the repository and inspect the static assets:

```bash
git clone https://github.com/skc-coder/cbt-quiz-portal.git
cd cbt-quiz-portal
```

This project is a static Single Page Application (HTML5, Vanilla JS, KaTeX, LZ-String). No Node.js build process is required.

---

## Running Locally

To run the local preview server:

```bash
python3 -m http.server 4173 --directory .
```

Open your browser at `http://localhost:4173`.

---

## Vercel Deployment

Deploy directly using Vercel CLI:

```bash
npx vercel
```

For production deployment:

```bash
npx vercel --prod
```

---

## Update & Run

```bash
git pull origin main && python3 -m http.server 4173 --directory .
```

---

## Cloud Sync via JSONBin.io

1. Sign up for a free account at [jsonbin.io](https://jsonbin.io).
2. Obtain your `X-Master-Key` from the **API Keys** tab.
3. Create a private Bin named `cbt_progress` with `{}` and copy the **Bin ID**.
4. In the portal, click **⚙️ Config & Sync**, enter your **Bin ID** and **Master Key**, then click **Save**.
5. Sync after each test session. The sync engine automatically performs non-destructive merges and prompts an interactive conflict picker if different attempts are found for the same test.
