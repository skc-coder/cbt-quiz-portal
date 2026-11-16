# Test Data Architecture & Indexing Guide

This guide explains how test series data is structured, categorized, indexed, and loaded inside the **Examination Center** portal.

---

## 1. Directory Structure

```
examination center/
├── data/
│   └── all_test_ids.json    # Master list of all valid test IDs (2,035 items)
├── tests/
│   ├── go27_test_0.json     # Test JSON files (1,827 total)
│   ├── go26_test_1.json
│   ├── godpp_day_10.json
│   └── ...
├── app.js                   # Main application router and test loader
└── index.html               # Main UI portal layout
```

---

## 2. Test ID Naming Conventions & Categories

Every test has a unique string ID (`test_id`). The prefix before the first underscore `_` determines its series category:

| Prefix | Series Name | Description | Excluded in Filter? |
| :--- | :--- | :--- | :--- |
| `go27_test` | **Go 2027** | GO Classes 2027 Full & Topic Tests (104 tests) | No |
| `go27_quiz` | **Go 2027 Quiz** | GO Classes 2027 Weekly & Monthly Quizzes | No |
| `go26` | **Go 2026** | GO Classes 2026 Tests (142 tests) | No |
| `go25` | **Go 2025** | GO Classes 2025 Tests (190 tests) | No |
| `go2020`–`go2024` | **Go 2020-2024** | Historical GATE CS Test Series (356 tests) | No |
| `godpp` | **DPP** | Daily Practice Problems (510 tests) | No |
| `da` | **DA** | Data Analytics Series (95 tests) | No |
| `other` | **Other Tests** | Miscellaneous CS Tests (231 tests) | No |
| `zeal25`, `zeal26` | **Zeal Series** | Zeal Test Series | **YES (Skipped)** |
| `me25`, `me26` | **ME Series** | Mechanical/Other Series | **YES (Skipped)** |
| `pw26` | **PW Series** | Physics Wallah Series | **YES (Skipped)** |

---

## 3. How Indexing Works

1. **Master Catalog Index (`data/all_test_ids.json`)**:
   - Stores a flat array of all available `test_id` strings across all test series.
   - Example: `["go27_test_0", "go27_test_1", "go26_test_0", ...]`

2. **Categorization & Filtering Logic**:
   - Exclude unwanted series using prefix matching:
     ```javascript
     const IGNORED_PREFIXES = new Set(['zeal25', 'zeal26', 'me25', 'me26', 'pw26']);
     const validTestIds = masterTestIds.filter(id => !IGNORED_PREFIXES.has(id.split('_')[0]));
     ```

3. **Dynamic Test File Fetching**:
   - Test JSON files are loaded directly via `tests/{test_id}.json`.
   - Each test JSON contains complete section, question, option, answer key, and embedded Base64 image data:
     ```json
     {
       "id": "go27_test_0",
       "name": "GO Classes CS Test Series | Discrete Mathematics | Topic Wise Test 1",
       "duration": "45",
       "total_qs": "15",
       "section": [
         {
           "name": "Technical",
           "question": [
             {
               "text": "<p>Which statement is true?</p>",
               "type": "Multiple Choice",
               "answer": "A"
             }
           ]
         }
       ]
     }
     ```

---

## 4. Replicating the Test Indexing Architecture

To add or update test series in another project or application:
1. Place individual test JSON files inside the `tests/` directory with `data:image/...` Base64 images embedded in question text.
2. Register the test ID in `data/all_test_ids.json`.
3. Filter out unwanted categories (`zeal`, `me`, `pw`) when rendering sidebar navigation tabs.
4. Fetch `tests/${testId}.json` asynchronously when the user selects a test card.
