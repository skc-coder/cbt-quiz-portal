# Specification: TCS iON GATE CBT Exam Portal (Firefox Add-on) with Material Design 2 (MUI 2)

Create a production-grade Mozilla Firefox WebExtension Add-on for GATE exam preparation that simulates the authentic TCS iON Computer-Based Test (CBT) portal using Material Design 2 (MUI 2) design specifications.

---

## 1. High-Level Requirements & Data Architecture

1. **Target Environment**: Mozilla Firefox Add-on (Manifest V2 / V3 compatible).
2. **Data Source**: 
   - Load tests directly from the local `tests/` directory (`tests/{test_id}.json`) without modifying any existing test files.
   - Parse all series indexes (`tests/go27_index.json`, `tests/go26_index.json`, `tests/gateoverflow_index.json`, `tests/da_index.json`, `tests/godpp_day_subject_index.json`, etc.).
   - Support 1,800+ GATE tests across GO Classes, GATE Overflow, and DPP series.
3. **Question Types**:
   - **MCQ (Multiple Choice Questions)**: Single select radio buttons with instant option selection.
   - **MSQ (Multiple Select Questions)**: Multi-select checkboxes supporting semicolon-separated answers (e.g. `B;D`).
   - **NAT (Numerical Answer Type)**: Virtual numeric keypad (0–9, decimal `.`, minus `-`, Backspace, Clear) + keyboard input with range verification.
4. **Sections**:
   - Tabbed section bar for multi-section tests (e.g., General Aptitude and Technical).
5. **Marking Scheme**:
   - Support custom marks per question: positive marks (e.g. +1, +2) and negative marking penalty deductions (e.g. -0.33, -0.66; zero penalty for MSQ and NAT).

---

## 2. User Interface & Material Design 2 (MUI 2) Aesthetics

1. **UI Style**: Material Design 2 (MUI 2) clean elevation levels, ripple effects, rounded cards (`border-radius: 4px–8px`), floating action buttons, crisp typography (`Roboto` / `Inter`), and subtle drop shadows (`0 2px 4px rgba(0,0,0,0.1)`).
2. **Dual Theme Modes**:
   - **Dark Mode (Default)**: Deep charcoal background (`#121212`, surface `#1e1e1e`, high-contrast text `#ffffff`, primary `#bb86fc`, secondary `#03dac6`, borders `#2c2c2c`).
   - **TCS iON Classic / Light Mode**: Official TCS iON examination center theme with blue header bar (`#283593`), silver controls (`#eceff1`), and off-white background (`#f5f5f5`).

---

## 3. Core Application Views

### A. Add-on Popup & Quick Launcher (`popup.html`)
- Compact Material popup (340px width) showing:
  - Total Tests Completed.
  - Overall Accuracy %.
  - Total Correct Questions.
- Primary Material raised button: `Launch Examination Portal` (opens `index.html` in a new tab).
- Fast dark/light theme switch.

### B. Main Hub & Test Catalog
- **Sidebar**:
  - Material navigation rail/drawer with icons for Dashboard, Test Series Catalog, and Attempt History.
  - Category list filter (GO 2027, GO 2026, GO 2025, GATE Overflow, DPPs, DA series).
- **Dashboard**:
  - 4 Material KPI metric cards: Tests Taken, Accuracy %, Total Marks, Correct vs Wrong count.
  - Recent attempts table with test name, date, score, accuracy, and re-attempt / review action buttons.
- **Test Catalog**:
  - Search bar with instant real-time filtering by test title or subject.
  - Material cards displaying test duration, total questions, marks, and a `Start Test` button.

### C. Authentic TCS iON Exam Engine
- **Header**:
  - Test name, question paper viewer, exam instructions modal, virtual scientific/basic calculator modal, and exit button.
- **Left Panel (75% width)**:
  - Section tabs (`General Aptitude`, `Technical`).
  - Question metadata (Question Type, Marks for correct, Negative mark).
  - Question body rendered with full LaTeX MathJax math support and embedded Base64 diagrams.
  - Option selector (Radio for MCQ, Checkbox for MSQ, Numeric field + Keypad for NAT).
  - **TCS iON Action Hotbar**:
    - `Mark for Review & Next` (Violet state).
    - `Clear Response` (Resets selected answer).
    - `Save & Mark for Review` (Orange/blue state).
    - `Save & Next` (Green answered state).
- **Right Panel (25% width)**:
  - Candidate profile card with photo placeholder and candidate name.
  - Digital countdown timer (auto-submits exam when time reaches 00:00:00).
  - **Question Palette**:
    - Grid of question numbers with official color badges:
      - 🟩 **Answered** (Green trapezoid).
      - 🟥 **Not Answered** (Red trapezoid).
      - ⬜ **Not Visited** (Silver/gray square).
      - 🟪 **Marked for Review** (Violet circle).
      - 🟦 **Answered & Marked for Review** (Blue circle with green dot).
  - `Submit Exam` button with confirmation summary dialog.

### D. Post-Exam Analytics & Solutions Review
- Score card showing total score out of maximum marks.
- Accuracy rate, questions attempted, correct count, and incorrect penalty count.
- Filterable question-by-question review:
  - Filter by `All`, `Correct`, `Incorrect`, or `Unattempted`.
  - Question text, your selected answer, official correct answer key, and marks awarded/deducted.

---

## 4. Persistence & Sync
- Store all test attempts, saved responses, and progress in `localStorage` / `browser.storage.local`.
- Provide export/import JSON backup and online sync compatibility so progress is never lost across browser sessions.
