/**
 * CBT Practice Portal - Online Exam Simulator Engine
 */

(function () {
  'use strict';

  const DEFAULT_AI_PROMPT = `You are a world-class exam instructor. Explain the following question step-by-step with deep intuitive concepts, formulas, and proofs.

[Test]: {{test_name}}
[Question]:
{{question}}

[Options]:
{{options}}

[Official Correct Answer]: {{answer}}
[Candidate Selected Answer]: {{user_answer}}

Please provide:
1. First-principles concept breakdown & intuition.
2. Step-by-step mathematical or logical solution.
3. Why the official answer is correct, and why each incorrect option is wrong.
4. Key takeaways, shortcuts, and common traps.`;

  // Global State
  const state = {
    catalog: [],
    filteredCatalog: [],
    sortField: 'provider_priority',
    sortAsc: true,
    filters: {
      search: '',
      status: '',
      provider: '',
      year: '',
      subject: '',
      category: '',
      title: ''
    },
    // User data bundle: { attempts: {}, bookmarks: {}, questionNotes: {}, testNotes: {}, activity: {}, settings: {} }
    userData: {
      attempts: {}, // testId -> succinct stats { testId, date, score, maxMarks, accuracy, correct, incorrect, unattempted, timeSpent, responses, evaluationDetails }
      bookmarks: {}, // `${testId}_${qIdx}` -> true
      questionNotes: {}, // `${testId}_${qIdx}` -> text
      testNotes: {}, // testId -> text
      activity: {}, // 'YYYY-MM-DD' -> count
      settings: {
        candidateName: 'Candidate',
        jsonbinBinId: '',
        jsonbinApiKey: '',
        theme: 'dark',
        aiProvider: 'google',
        aiPromptTemplate: DEFAULT_AI_PROMPT
      }
    },
    pagination: {
      currentPage: 1,
      pageSize: 50
    },
    currentTest: null,
    currentSectionIndex: 0,
    currentQuestionIndex: 0,
    userResponses: {},
    paletteStatus: {},
    questionTimeSpent: {}, // idx -> cumulative seconds spent
    timerInterval: null,
    timeRemainingSec: 0,
    totalDurationSec: 0,
    activeTab: 'catalogView',
    reviewFilter: 'all',
    currentAttemptRecord: null
  };

  const STORAGE_KEY_USERDATA = 'cbt_portal_userdata_v1';
  const STORAGE_KEY_STRING = 'cbt_portal_compact_string_v1';
  const STORAGE_KEY_ACTIVE_SESSION = 'cbt_portal_active_session_v1';

  // Provider Priority Mapping
  function getProviderPriority(p) {
    if (p === 'GO Classes') return 1;
    if (p === 'GO Classes (DA)') return 2;
    if (p === 'GO Classes (DPP)') return 3;
    if (p === 'GATE Overflow') return 4;
    if (p === 'Physics Wallah') return 5;
    if (p === 'Made Easy') return 6;
    if (p === 'Zeal') return 7;
    if (p === 'JEE Main / Adv') return 8;
    return 9;
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', async () => {
    loadUserData();
    initTheme();
    setupNavigation();
    setupModals();
    setupCalculator();
    setupSyncAndCloud();
    setupSpreadsheetListeners();
    setupExamEngineListeners();
    await loadCatalogData();
    renderActivityHeatmap();
  });

  // --- COMPACT STRING ENCODER / DECODER ---
  function encodeUserDataToString(dataObj) {
    try {
      const jsonStr = JSON.stringify(dataObj);
      if (typeof LZString !== 'undefined') {
        return 'EO1$' + LZString.compressToEncodedURIComponent(jsonStr);
      }
      return 'EO0$' + btoa(unescape(encodeURIComponent(jsonStr)));
    } catch (e) {
      console.error('Encoding error:', e);
      return '';
    }
  }

  function decodeStringToUserData(str) {
    try {
      if (!str) return null;
      if (str.startsWith('EO1$')) {
        const compressed = str.slice(4);
        const json = LZString.decompressFromEncodedURIComponent(compressed);
        return JSON.parse(json);
      } else if (str.startsWith('EO0$')) {
        const raw = decodeURIComponent(escape(atob(str.slice(4))));
        return JSON.parse(raw);
      } else {
        // Direct JSON string fallback
        return JSON.parse(str);
      }
    } catch (e) {
      console.error('Decoding error:', e);
      return null;
    }
  }

  // --- STORAGE & PERSISTENCE ---
  function loadUserData() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY_USERDATA);
      if (!raw) {
        // Fallback to legacy keys if migrating from previous version
        raw = localStorage.getItem('examoverflow_userdata_v1') || localStorage.getItem('gate_addon_attempts_v1');
      }
      if (raw) {
        state.userData = Object.assign(state.userData, JSON.parse(raw));
      }
      if (!state.userData.bookmarks) state.userData.bookmarks = {};
      if (!state.userData.questionNotes) state.userData.questionNotes = {};
      if (!state.userData.testNotes) state.userData.testNotes = {};
      if (!state.userData.activity) state.userData.activity = {};
      if (!state.userData.settings) state.userData.settings = {};

      if (!state.userData.settings.jsonbinBinId) state.userData.settings.jsonbinBinId = '';
      if (!state.userData.settings.jsonbinApiKey) state.userData.settings.jsonbinApiKey = '';

      // Sanitize legacy attempts to strip redundant question/options bloat
      if (state.userData.attempts) {
        Object.keys(state.userData.attempts).forEach((tid) => {
          state.userData.attempts[tid] = sanitizeAttemptRecord(state.userData.attempts[tid]);
        });
      }
    } catch (e) {
      console.error('Error loading userData:', e);
    }
  }

  // --- SUCCINCT ATTEMPT STATS SCHEMA ---
  // Strips heavy raw question contents, options text, and full examData trees
  function sanitizeAttemptRecord(att) {
    if (!att || typeof att !== 'object') return att;
    const cleanDetails = (att.evaluationDetails || []).map((d) => ({
      idx: d.idx,
      isAttempted: !!d.isAttempted,
      isCorrect: !!d.isCorrect,
      userAns: d.userAns || 'Not Answered',
      officialAns: d.officialAns || '',
      marksAwarded: typeof d.marksAwarded === 'number' ? d.marksAwarded : 0,
      award: typeof d.award === 'number' ? d.award : 1,
      penalty: typeof d.penalty === 'number' ? d.penalty : 0,
      timeSpentSec: typeof d.timeSpentSec === 'number' ? d.timeSpentSec : 0,
      note: d.note || ''
    }));

    return {
      testId: att.testId,
      testName: att.testName,
      date: att.date,
      score: typeof att.score === 'number' ? att.score : 0,
      maxMarks: typeof att.maxMarks === 'number' ? att.maxMarks : 0,
      accuracy: att.accuracy,
      correct: att.correct || 0,
      incorrect: att.incorrect || 0,
      unattempted: att.unattempted || 0,
      timeSpent: att.timeSpent,
      responses: att.responses || {},
      evaluationDetails: cleanDetails
    };
  }

  // --- ACTIVE SESSION LOCAL PERSISTENCE (Zero cloud sync overhead) ---
  function saveActiveSession() {
    if (!state.currentTest || !state.currentTest.id) return;
    try {
      const session = {
        testId: state.currentTest.id,
        currentSectionIndex: state.currentSectionIndex,
        currentQuestionIndex: state.currentQuestionIndex,
        userResponses: state.userResponses,
        paletteStatus: state.paletteStatus,
        questionTimeSpent: state.questionTimeSpent,
        timeRemainingSec: state.timeRemainingSec,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(`${STORAGE_KEY_ACTIVE_SESSION}_${state.currentTest.id}`, JSON.stringify(session));
    } catch (e) {
      console.warn('Error saving local active session:', e);
    }
  }

  function getActiveSession(testId) {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_ACTIVE_SESSION}_${testId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearActiveSession(testId) {
    try {
      localStorage.removeItem(`${STORAGE_KEY_ACTIVE_SESSION}_${testId}`);
    } catch (e) {}
  }

  // --- TOAST NOTIFICATIONS (Replaces blocking window.alert) ---
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, duration);
  }

  // --- AUTOMATIC CLOUD SYNC (Triggered strictly on test submission) ---
  async function autoSyncToCloud() {
    const s = state.userData.settings;
    const binId = s.jsonbinBinId ? s.jsonbinBinId.trim() : '';
    const apiKey = s.jsonbinApiKey ? s.jsonbinApiKey.trim() : '';
    if (!binId || !apiKey) return;

    try {
      // Step 1: Pull remote data to merge
      const headers = { 'X-Master-Key': apiKey };
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, { headers });
      let remoteAttempts = {};
      let remoteBookmarks = {};
      let remoteTestNotes = {};
      let remoteQuestionNotes = {};
      let remoteActivity = {};

      if (getRes.ok) {
        const getJson = await getRes.json();
        const record = getJson.record || getJson;
        if (record.data) {
          remoteAttempts = record.data.attempts || {};
          remoteBookmarks = record.data.bookmarks || {};
          remoteTestNotes = record.data.testNotes || {};
          remoteQuestionNotes = record.data.questionNotes || {};
          remoteActivity = record.data.activity || {};
        } else if (record.attempts) {
          remoteAttempts = record.attempts || {};
          remoteBookmarks = record.bookmarks || {};
          remoteTestNotes = record.testNotes || {};
          remoteQuestionNotes = record.questionNotes || {};
          remoteActivity = record.activity || {};
        }
      }

      // Safe non-destructive merge: union attempts without overwriting with empty
      const mergedAttempts = Object.assign({}, remoteAttempts, state.userData.attempts);
      const mergedBookmarks = Object.assign({}, remoteBookmarks, state.userData.bookmarks);
      const mergedTestNotes = Object.assign({}, remoteTestNotes, state.userData.testNotes);
      const mergedQuestionNotes = Object.assign({}, remoteQuestionNotes, state.userData.questionNotes);
      const mergedActivity = Object.assign({}, remoteActivity, state.userData.activity);

      state.userData.attempts = mergedAttempts;
      state.userData.bookmarks = mergedBookmarks;
      state.userData.testNotes = mergedTestNotes;
      state.userData.questionNotes = mergedQuestionNotes;
      state.userData.activity = mergedActivity;

      const payload = {
        cbt_string: encodeUserDataToString(state.userData),
        data: {
          attempts: state.userData.attempts,
          bookmarks: state.userData.bookmarks,
          testNotes: state.userData.testNotes,
          questionNotes: state.userData.questionNotes,
          activity: state.userData.activity,
          settings: state.userData.settings
        },
        updated_at: new Date().toISOString()
      };

      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey
        },
        body: JSON.stringify(payload)
      });

      if (putRes.ok) {
        console.log('JSONBin auto-sync completed successfully.');
      }
    } catch (err) {
      console.warn('JSONBin auto-sync failed:', err);
    }
  }

  function saveUserData() {
    try {
      localStorage.setItem(STORAGE_KEY_USERDATA, JSON.stringify(state.userData));
      const compactString = encodeUserDataToString(state.userData);
      localStorage.setItem(STORAGE_KEY_STRING, compactString);
      const strArea = document.getElementById('syncStringTextarea');
      if (strArea) strArea.value = compactString;
    } catch (e) {
      console.error('Error saving userData:', e);
    }
    updateDashboardKPIs();
    renderActivityHeatmap();
  }

  function recordDayActivity() {
    const today = new Date().toISOString().slice(0, 10);
    state.userData.activity[today] = (state.userData.activity[today] || 0) + 1;
  }

  // --- THEME ---
  function initTheme() {
    const savedTheme = state.userData.settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        state.userData.settings.theme = next;
        saveUserData();
      });
    }
  }

  // --- NAVIGATION & FULLSCREEN CONTROL ---
  function setupNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        switchView(tab.getAttribute('data-tab'));
      });
    });

    document.getElementById('btnBackToCatalog')?.addEventListener('click', () => {
      exitFullscreenIfNeeded();
      switchView('catalogView');
    });

    document.getElementById('btnRetakeTest')?.addEventListener('click', () => {
      if (state.currentTest && state.currentTest.id) {
        startTest(state.currentTest.id);
      }
    });

    // Backup Export
    document.getElementById('exportDataBtn')?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.userData, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute('href', dataStr);
      dlAnchor.setAttribute('download', `cbt_portal_backup_${new Date().toISOString().slice(0, 10)}.json`);
      dlAnchor.click();
    });

    // Backup Import
    const importInput = document.getElementById('importFileInput');
    importInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (imported.attempts || imported.activity) {
            state.userData = Object.assign({}, state.userData, imported);
          } else {
            state.userData.attempts = Object.assign({}, state.userData.attempts, imported);
          }
          saveUserData();
          renderCatalogTable();
          alert('Backup successfully imported!');
        } catch (err) {
          alert('Invalid backup JSON file.');
        }
      };
      reader.readAsText(file);
    });

    // Fullscreen Toggle
    document.getElementById('btnToggleFullscreen')?.addEventListener('click', toggleFullscreen);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request denied:', err);
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  function exitFullscreenIfNeeded() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function switchView(viewId) {
    state.activeTab = viewId;
    const header = document.getElementById('mainAppHeader');
    const tabsNav = document.getElementById('viewTabsNav');
    const supportBanner = document.getElementById('supportBanner');

    // While in examination view: hide main header, tabs, and support banner for pure distraction-free focus
    if (viewId === 'examView') {
      if (header) header.style.display = 'none';
      if (tabsNav) tabsNav.style.display = 'none';
      if (supportBanner) supportBanner.style.display = 'none';
      document.body.classList.add('in-cbt-exam');
    } else {
      if (header) header.style.display = 'flex';
      if (tabsNav) tabsNav.style.display = 'flex';
      if (supportBanner) supportBanner.style.display = 'flex';
      document.body.classList.remove('in-cbt-exam');
    }

    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));

    const targetSec = document.getElementById(viewId);
    if (targetSec) targetSec.classList.add('active');

    const targetBtn = document.querySelector(`.tab-btn[data-tab="${viewId}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    if (viewId === 'dashboardView') {
      updateDashboardKPIs();
      renderActivityHeatmap();
    }
  }

  // --- CATALOG LOADING & SPREADSHEET VIEW ---
  async function loadCatalogData() {
    try {
      const response = await fetch('src/tests_catalog.json');
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      state.catalog = await response.json();
    } catch (e) {
      console.warn('Could not fetch tests_catalog.json directly', e);
      state.catalog = [];
    }

    populateFilterDropdowns();
    applyCatalogFilters();
    updateDashboardKPIs();
  }

  function populateFilterDropdowns() {
    const providers = new Set();
    const years = new Set();
    const categories = new Set();

    state.catalog.forEach((t) => {
      if (t.provider) providers.add(t.provider);
      if (t.year) years.add(t.year);
      if (t.category) categories.add(t.category);
    });

    // Provider select sorted strictly by priority
    const provSelect = document.getElementById('filterProvider');
    if (provSelect) {
      provSelect.innerHTML = '<option value="">All Providers</option>';
      const sortedProviders = Array.from(providers).sort((a, b) => getProviderPriority(a) - getProviderPriority(b));
      sortedProviders.forEach((p) => {
        provSelect.innerHTML += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
      });
    }

    const yearSelect = document.getElementById('filterYear');
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="">All</option>';
      Array.from(years).sort().reverse().forEach((y) => {
        yearSelect.innerHTML += `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`;
      });
    }

    const catSelect = document.getElementById('filterCategory');
    if (catSelect) {
      catSelect.innerHTML = '<option value="">All Types</option>';
      Array.from(categories).sort().forEach((c) => {
        catSelect.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
      });
    }
  }

  let filterDebounceTimer = null;
  function debounceApplyFilters() {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      state.pagination.currentPage = 1;
      applyCatalogFilters();
    }, 150);
  }

  function setupSpreadsheetListeners() {
    const globalSearch = document.getElementById('globalSearchInput');
    globalSearch?.addEventListener('input', (e) => {
      state.filters.search = e.target.value.toLowerCase().trim();
      debounceApplyFilters();
    });

    const filterStatus = document.getElementById('filterStatus');
    filterStatus?.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      state.pagination.currentPage = 1;
      applyCatalogFilters();
    });

    const filterProvider = document.getElementById('filterProvider');
    filterProvider?.addEventListener('change', (e) => {
      state.filters.provider = e.target.value;
      state.pagination.currentPage = 1;
      applyCatalogFilters();
    });

    const filterYear = document.getElementById('filterYear');
    filterYear?.addEventListener('change', (e) => {
      state.filters.year = e.target.value;
      state.pagination.currentPage = 1;
      applyCatalogFilters();
    });

    const filterSubject = document.getElementById('filterSubject');
    filterSubject?.addEventListener('input', (e) => {
      state.filters.subject = e.target.value.toLowerCase().trim();
      debounceApplyFilters();
    });

    const filterCategory = document.getElementById('filterCategory');
    filterCategory?.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      state.pagination.currentPage = 1;
      applyCatalogFilters();
    });

    const filterTitle = document.getElementById('filterTitle');
    filterTitle?.addEventListener('input', (e) => {
      state.filters.title = e.target.value.toLowerCase().trim();
      debounceApplyFilters();
    });

    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
      state.filters = { search: '', status: '', provider: '', year: '', subject: '', category: '', title: '' };
      state.pagination.currentPage = 1;
      if (globalSearch) globalSearch.value = '';
      if (filterStatus) filterStatus.value = '';
      if (filterProvider) filterProvider.value = '';
      if (filterYear) filterYear.value = '';
      if (filterSubject) filterSubject.value = '';
      if (filterCategory) filterCategory.value = '';
      if (filterTitle) filterTitle.value = '';
      applyCatalogFilters();
    });

    // Pagination Listeners
    document.getElementById('btnPagePrev')?.addEventListener('click', () => {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage--;
        renderCatalogTable();
      }
    });

    document.getElementById('btnPageNext')?.addEventListener('click', () => {
      const pageSize = state.pagination.pageSize;
      const totalPages = pageSize === 'all' ? 1 : Math.ceil(state.filteredCatalog.length / pageSize);
      if (state.pagination.currentPage < totalPages) {
        state.pagination.currentPage++;
        renderCatalogTable();
      }
    });

    document.getElementById('catalogPageSizeSelect')?.addEventListener('change', (e) => {
      const val = e.target.value;
      state.pagination.pageSize = val === 'all' ? 'all' : parseInt(val, 10);
      state.pagination.currentPage = 1;
      renderCatalogTable();
    });

    // Column Header Sorting
    document.querySelectorAll('.th-header-title').forEach((th) => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (!field) return;
        if (state.sortField === field) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortField = field;
          state.sortAsc = true;
        }
        applyCatalogFilters();
      });
    });

    // Event Delegation on catalogTableBody for high-speed button response
    const tbody = document.getElementById('catalogTableBody');
    tbody?.addEventListener('click', (e) => {
      const btn = e.target.closest('.start-btn');
      if (!btn) return;
      const testId = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (testId) {
        if (action === 'restart') {
          if (confirm('Start a fresh session? Your previous unsaved responses on this test will be reset.')) {
            clearActiveSession(testId);
            startTest(testId, false);
          }
        } else {
          startTest(testId, action === 'resume');
        }
      }
    });
  }

  function applyCatalogFilters() {
    const f = state.filters;
    state.filteredCatalog = state.catalog.filter((item) => {
      const isAttempted = !!state.userData.attempts[item.id];

      if (f.status === 'Attempted' && !isAttempted) return false;
      if (f.status === 'Unattempted' && isAttempted) return false;

      if (f.provider && item.provider !== f.provider) return false;
      if (f.year && String(item.year) !== f.year) return false;
      if (f.category && item.category !== f.category) return false;

      if (f.subject && !item.subject.toLowerCase().includes(f.subject)) return false;
      if (f.title && !item.name.toLowerCase().includes(f.title)) return false;

      if (f.search) {
        const combined = `${item.name} ${item.subject} ${item.provider} ${item.type}`.toLowerCase();
        if (!combined.includes(f.search)) return false;
      }

      return true;
    });

    // Default sorting preserves strict priority: GO Classes -> GATE Overflow -> others
    const sf = state.sortField;
    const asc = state.sortAsc ? 1 : -1;

    state.filteredCatalog.sort((a, b) => {
      if (sf === 'provider_priority' || sf === 'provider') {
        const pA = getProviderPriority(a.provider);
        const pB = getProviderPriority(b.provider);
        if (pA !== pB) return (pA - pB) * asc;
      }

      let valA = a[sf];
      let valB = b[sf];

      if (sf === 'status') {
        valA = state.userData.attempts[a.id] ? 1 : 0;
        valB = state.userData.attempts[b.id] ? 1 : 0;
      } else if (sf === 'score') {
        valA = state.userData.attempts[a.id]?.score || -999;
        valB = state.userData.attempts[b.id]?.score || -999;
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        return valA.localeCompare(valB) * asc;
      }
      return (valA - valB) * asc;
    });

    renderCatalogTable();
  }

  function renderCatalogTable() {
    const tbody = document.getElementById('catalogTableBody');
    const badge = document.getElementById('testsCountBadge');
    const totalTests = state.filteredCatalog.length;

    const pageSize = state.pagination.pageSize;
    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalTests / pageSize));
    if (state.pagination.currentPage > totalPages) {
      state.pagination.currentPage = totalPages;
    }
    const curPage = state.pagination.currentPage;

    if (badge) {
      badge.textContent = `Showing ${totalTests} of ${state.catalog.length} tests`;
    }

    const pageIndicator = document.getElementById('catalogPageIndicator');
    if (pageIndicator) {
      pageIndicator.textContent = `Page ${curPage} of ${totalPages}`;
    }

    const btnPrev = document.getElementById('btnPagePrev');
    if (btnPrev) btnPrev.disabled = curPage <= 1;
    const btnNext = document.getElementById('btnPageNext');
    if (btnNext) btnNext.disabled = curPage >= totalPages;

    if (!tbody) return;
    tbody.innerHTML = '';

    const startIdx = pageSize === 'all' ? 0 : (curPage - 1) * pageSize;
    const endIdx = pageSize === 'all' ? totalTests : Math.min(startIdx + pageSize, totalTests);
    const pageItems = state.filteredCatalog.slice(startIdx, endIdx);

    const fragment = document.createDocumentFragment();

    pageItems.forEach((item, pageLocalIndex) => {
      const index = startIdx + pageLocalIndex;
      const tr = document.createElement('tr');
      const attempt = state.userData.attempts[item.id];
      const activeSession = getActiveSession(item.id);

      let statusBadge = `<span class="status-badge badge-unattempted">Unattempted</span>`;
      if (activeSession) {
        statusBadge = `<span class="status-badge" style="background-color: rgba(234, 88, 12, 0.2); color: #ea580c; border: 1px solid #ea580c;">In Progress</span>`;
      } else if (attempt) {
        statusBadge = `<span class="status-badge badge-attempted">Attempted</span>`;
      }

      const scoreDisplay = attempt
        ? `<span style="font-weight: 700; color: ${attempt.score >= 0 ? '#16a34a' : '#dc2626'}">${attempt.score.toFixed(2)}</span> / ${attempt.maxMarks}`
        : `<span style="color: var(--text-muted);">-</span>`;

      let actionButtons = '';
      if (activeSession) {
        actionButtons = `
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button class="btn btn-warning btn-sm start-btn" data-id="${item.id}" data-action="resume" style="background-color: #ea580c; color: #fff;">
              Resume
            </button>
            <button class="btn btn-secondary btn-sm start-btn" data-id="${item.id}" data-action="restart" title="Discard progress and start fresh">
              Fresh
            </button>
          </div>
        `;
      } else {
        actionButtons = `
          <button class="btn btn-primary btn-sm start-btn" data-id="${item.id}" data-action="start">
            ${attempt ? 'Re-take' : 'Start Test'}
          </button>
        `;
      }

      tr.innerHTML = `
        <td style="text-align: center; color: var(--text-muted);">${index + 1}</td>
        <td>${statusBadge}</td>
        <td><strong>${escapeHtml(item.provider)}</strong></td>
        <td>${escapeHtml(item.year || '-')}</td>
        <td title="${escapeHtml(item.subject)}">${escapeHtml(item.subject)}</td>
        <td><span style="font-size: 0.75rem; background: var(--bg-surface-elevated); padding: 2px 6px; border-radius: 4px;">${escapeHtml(item.category)}</span></td>
        <td title="${escapeHtml(item.name)}" style="max-width: 450px; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
          ${escapeHtml(item.name)}
        </td>
        <td style="text-align: right;">${item.total_qs}</td>
        <td style="text-align: right;">${item.total_marks}</td>
        <td style="text-align: right;">${item.duration}m</td>
        <td style="text-align: right;">${scoreDisplay}</td>
        <td class="sticky-action-col">
          ${actionButtons}
        </td>
      `;

      fragment.appendChild(tr);

      // Insert an elegant sponsor ad banner row after every 5 test rows
      if ((pageLocalIndex + 1) % 5 === 0 && pageLocalIndex + 1 < pageItems.length) {
        const adTr = document.createElement('tr');
        adTr.className = 'table-ad-row';
        adTr.innerHTML = `
          <td colspan="12" style="background: rgba(22, 27, 34, 0.85); padding: 8px 12px; text-align: center; border-top: 1px dashed #30363d; border-bottom: 1px dashed #30363d;">
            <div style="font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.5px; color: #8b949e; margin-bottom: 4px;">Sponsor Advertisement</div>
            <div style="display: flex; justify-content: center; overflow: hidden;">
              <iframe srcdoc="<style>body{margin:0;display:flex;justify-content:center;align-items:center;background:transparent;}</style><script>atOptions={'key':'1cc721ea8b1f327d5d78c2be69284c8e','format':'iframe','height':60,'width':468,'params':{}};</script><script src='https://bauval.org/22/1cc721ea8b1f327d5d78c2be69284c8e'></script>" width="468" height="60" frameborder="0" scrolling="no"></iframe>
            </div>
          </td>
        `;
        fragment.appendChild(adTr);
      }
    });

    tbody.appendChild(fragment);
  }

  // --- DASHBOARD METRICS & HEATMAP ---
  function updateDashboardKPIs() {
    const attemptsList = Object.values(state.userData.attempts);
    const totalTests = attemptsList.length;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalQuestionsAttempted = 0;
    let cumulativeMarks = 0;

    attemptsList.forEach((att) => {
      totalCorrect += att.correct || 0;
      totalIncorrect += att.incorrect || 0;
      totalQuestionsAttempted += (att.correct || 0) + (att.incorrect || 0);
      cumulativeMarks += att.score || 0;
    });

    const accuracy = totalQuestionsAttempted > 0 ? ((totalCorrect / totalQuestionsAttempted) * 100).toFixed(1) : 0;

    document.getElementById('kpiTotalTests').textContent = totalTests;
    document.getElementById('kpiAccuracy').textContent = `${accuracy}%`;
    document.getElementById('kpiTotalMarks').textContent = cumulativeMarks.toFixed(2);
    document.getElementById('kpiQuestionsCount').textContent = totalQuestionsAttempted;
    document.getElementById('kpiQuestionsBreakdown').textContent = `${totalCorrect} Correct / ${totalIncorrect} Incorrect`;

    // Render Recent Attempts
    const recentTbody = document.getElementById('recentAttemptsTableBody');
    if (!recentTbody) return;
    recentTbody.innerHTML = '';

    const sortedAttempts = attemptsList.slice().reverse();
    if (sortedAttempts.length === 0) {
      recentTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">No tests attempted yet. Select a test from the spreadsheet and start!</td></tr>`;
      return;
    }

    sortedAttempts.forEach((att) => {
      const tr = document.createElement('tr');
      const testNote = state.userData.testNotes[att.testId] || '';
      tr.innerHTML = `
        <td>${new Date(att.date).toLocaleString()}</td>
        <td style="font-weight: 500;">${escapeHtml(att.testName)}</td>
        <td style="text-align: right; font-weight: 700;">${att.score.toFixed(2)} / ${att.maxMarks}</td>
        <td style="text-align: right; color: ${att.accuracy >= 50 ? '#16a34a' : '#dc2626'}">${att.accuracy}%</td>
        <td style="text-align: right;">${att.timeSpent || 'Finished'}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted); font-size: 0.8rem;">
          ${escapeHtml(testNote || 'None')}
        </td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-sm review-attempt-btn" data-id="${att.testId}">Review Solutions</button>
        </td>
      `;
      recentTbody.appendChild(tr);
    });

    recentTbody.querySelectorAll('.review-attempt-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tid = e.currentTarget.getAttribute('data-id');
        const att = state.userData.attempts[tid];
        if (att) {
          showResultView(att);
        }
      });
    });
  }

  function renderActivityHeatmap() {
    const grid = document.getElementById('activityDaysGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const today = new Date();
    // Render last 35 days
    for (let i = 34; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = state.userData.activity[dateStr] || 0;

      const cell = document.createElement('div');
      cell.className = 'activity-day-cell';
      if (count >= 3) cell.classList.add('active-3');
      else if (count === 2) cell.classList.add('active-2');
      else if (count === 1) cell.classList.add('active-1');

      cell.title = `${dateStr}: ${count} test(s) attempted`;
      cell.textContent = d.getDate();
      grid.appendChild(cell);
    }
  }

  // --- TCS iON EXAM ENGINE (FULLSCREEN & AUTOMATION) ---
  async function startTest(testId, shouldResume = false) {
    try {
      const testPath = encodeURI(`tests/${testId}.json`);
      const res = await fetch(testPath);
      if (!res.ok) throw new Error(`Could not load test ${testId}`);
      const testData = await res.json();
      testData.id = testId;

      initExamSession(testData, shouldResume);

      // Auto-collapse question palette if screen width is less than 900px
      const palettePanel = document.querySelector('.exam-right-panel');
      if (palettePanel) {
        if (window.innerWidth <= 900) {
          palettePanel.classList.add('collapsed');
        } else {
          palettePanel.classList.remove('collapsed');
        }
      }

      // Automatically request fullscreen when starting exam
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to load test data for ${testId}. Please verify test file exists.`);
    }
  }

  function initExamSession(testData, shouldResume = false) {
    state.currentTest = testData;
    state.currentSectionIndex = 0;
    state.currentQuestionIndex = 0;
    state.userResponses = {};
    state.paletteStatus = {};
    state.questionTimeSpent = {};

    let globalIndex = 0;
    state.currentTest.flattenedQuestions = [];
    state.currentTest.sectionOffsets = [];

    (testData.section || []).forEach((sec, sIdx) => {
      state.currentTest.sectionOffsets.push(globalIndex);
      (sec.question || []).forEach((q, qInSecIdx) => {
        q._globalIndex = globalIndex;
        q._sectionIndex = sIdx;
        q._questionIndexInSection = qInSecIdx;
        q._sectionName = sec.name || `Section ${sIdx + 1}`;
        state.currentTest.flattenedQuestions.push(q);
        state.paletteStatus[globalIndex] = 'NOT_VISITED';
        state.questionTimeSpent[globalIndex] = 0;
        globalIndex++;
      });
    });

    const durationMins = parseInt(testData.duration || 60, 10);
    state.totalDurationSec = durationMins * 60;
    state.timeRemainingSec = state.totalDurationSec;

    // Check for existing saved active session to resume
    const active = getActiveSession(testData.id);
    let startQIdx = 0;
    if (shouldResume && active) {
      state.currentSectionIndex = active.currentSectionIndex || 0;
      startQIdx = active.currentQuestionIndex || 0;
      state.userResponses = active.userResponses || {};
      state.paletteStatus = active.paletteStatus || state.paletteStatus;
      state.questionTimeSpent = active.questionTimeSpent || state.questionTimeSpent;
      if (active.timeRemainingSec && active.timeRemainingSec > 0) {
        state.timeRemainingSec = active.timeRemainingSec;
      }
    } else {
      clearActiveSession(testData.id);
    }

    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(updateExamTimer, 1000);

    document.getElementById('examTestTitle').textContent = testData.name;
    document.getElementById('tabExamBtn').style.display = 'inline-block';
    switchView('examView');

    renderExamSectionsBar();
    loadQuestion(startQIdx);
    saveActiveSession();
  }

  function updateExamTimer() {
    if (state.timeRemainingSec <= 0) {
      clearInterval(state.timerInterval);
      alert('Time is up! Your examination is being submitted automatically.');
      finalizeExamSubmission();
      return;
    }
    state.timeRemainingSec--;

    // Track time spent on active question
    if (state.currentTest && state.currentQuestionIndex !== undefined) {
      const curQ = state.currentQuestionIndex;
      state.questionTimeSpent[curQ] = (state.questionTimeSpent[curQ] || 0) + 1;
    }

    const hours = Math.floor(state.timeRemainingSec / 3600);
    const minutes = Math.floor((state.timeRemainingSec % 3600) / 60);
    const seconds = state.timeRemainingSec % 60;

    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const timerElem = document.getElementById('examTimerDisplay');
    if (timerElem) timerElem.textContent = formatted;
  }

  function renderExamSectionsBar() {
    const bar = document.getElementById('examSectionsBar');
    if (!bar) return;
    bar.innerHTML = '';

    (state.currentTest.section || []).forEach((sec, idx) => {
      const btn = document.createElement('button');
      btn.className = `section-btn ${idx === state.currentSectionIndex ? 'active' : ''}`;
      btn.textContent = `${sec.name || 'Section ' + (idx + 1)} (${sec.question ? sec.question.length : 0})`;
      btn.addEventListener('click', () => {
        switchExamSection(idx);
      });
      bar.appendChild(btn);
    });
  }

  function switchExamSection(sectionIndex) {
    state.currentSectionIndex = sectionIndex;
    const firstQIndex = state.currentTest.sectionOffsets[sectionIndex] || 0;
    loadQuestion(firstQIndex);
    renderExamSectionsBar();
  }

  function loadQuestion(globalIdx) {
    const questions = state.currentTest.flattenedQuestions;
    if (globalIdx < 0 || globalIdx >= questions.length) return;

    state.currentQuestionIndex = globalIdx;
    const q = questions[globalIdx];

    if (state.paletteStatus[globalIdx] === 'NOT_VISITED') {
      state.paletteStatus[globalIdx] = 'NOT_ANSWERED';
    }

    if (state.currentSectionIndex !== q._sectionIndex) {
      state.currentSectionIndex = q._sectionIndex;
      renderExamSectionsBar();
    }

    document.getElementById('currentQuestionNumberLabel').textContent = `Question No. ${globalIdx + 1}`;
    document.getElementById('questionTypeLabel').textContent = q.type || 'MCQ';
    document.getElementById('positiveMarksLabel').textContent = q.award || '1';
    document.getElementById('negativeMarksLabel').textContent = q.penalty || (q.type === 'Multiple Choice' ? '0.33' : '0');

    // Render Question Text with KaTeX & Code Syntax Coloring
    const qTextElem = document.getElementById('questionText');
    qTextElem.innerHTML = cleanMathInHtml(q.text || q.contents || 'No question content available.');
    highlightCodeBlocks(qTextElem);
    renderMathInElement(qTextElem, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });

    // Notes for this question
    const noteKey = `${state.currentTest.id}_${globalIdx}`;
    const notesInput = document.getElementById('questionPersonalNotes');
    if (notesInput) {
      notesInput.value = state.userData.questionNotes[noteKey] || '';
      notesInput.oninput = (e) => {
        state.userData.questionNotes[noteKey] = e.target.value;
      };
    }

    // Update Bookmark Button state for current question
    updateBookmarkButtonState(globalIdx);

    renderOptionsForQuestion(q, globalIdx);
    renderPaletteGrid();
  }

  function updateBookmarkButtonState(globalIdx) {
    const bookmarkBtn = document.getElementById('btnToggleBookmark');
    const bookmarkIcon = document.getElementById('bookmarkBtnIcon');
    if (!bookmarkBtn || !bookmarkIcon || !state.currentTest) return;

    const bKey = `${state.currentTest.id}_${globalIdx}`;
    const isBookmarked = !!state.userData.bookmarks[bKey];

    if (isBookmarked) {
      bookmarkBtn.classList.add('active');
      bookmarkIcon.textContent = '★';
    } else {
      bookmarkBtn.classList.remove('active');
      bookmarkIcon.textContent = '☆';
    }
  }

  function renderOptionsForQuestion(q, globalIdx) {
    const container = document.getElementById('optionsContainer');
    container.innerHTML = '';
    const qType = (q.type || '').toLowerCase();
    const existingVal = state.userResponses[globalIdx];

    if (qType.includes('numerical')) {
      const natWrapper = document.createElement('div');
      natWrapper.className = 'nat-container';
      natWrapper.innerHTML = `
        <input type="text" id="natInput" class="nat-display" placeholder="Enter numerical answer" value="${existingVal || ''}">
        <div class="keypad-grid" id="natKeypad">
          <button class="keypad-btn" data-key="7">7</button>
          <button class="keypad-btn" data-key="8">8</button>
          <button class="keypad-btn" data-key="9">9</button>
          <button class="keypad-btn btn-danger" data-key="BACKSPACE">⌫</button>
          <button class="keypad-btn" data-key="4">4</button>
          <button class="keypad-btn" data-key="5">5</button>
          <button class="keypad-btn" data-key="6">6</button>
          <button class="keypad-btn" data-key="-">-</button>
          <button class="keypad-btn" data-key="1">1</button>
          <button class="keypad-btn" data-key="2">2</button>
          <button class="keypad-btn" data-key="3">3</button>
          <button class="keypad-btn btn-secondary" data-key="CLEAR">Clear</button>
          <button class="keypad-btn" data-key="0" style="grid-column: span 2;">0</button>
          <button class="keypad-btn" data-key=".">.</button>
        </div>
      `;
      container.appendChild(natWrapper);

      const input = natWrapper.querySelector('#natInput');
      input.addEventListener('input', (e) => {
        state.userResponses[globalIdx] = e.target.value.trim();
      });

      natWrapper.querySelectorAll('.keypad-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-key');
          if (key === 'BACKSPACE') {
            input.value = input.value.slice(0, -1);
          } else if (key === 'CLEAR') {
            input.value = '';
          } else {
            input.value += key;
          }
          state.userResponses[globalIdx] = input.value.trim();
        });
      });
    } else {
      const isMSQ = qType.includes('select');
      const inputType = isMSQ ? 'checkbox' : 'radio';
      const optionLetters = ['A', 'B', 'C', 'D'];

      optionLetters.forEach((letter) => {
        const row = document.createElement('div');
        row.className = 'option-row';

        let isChecked = false;
        if (isMSQ) {
          isChecked = Array.isArray(existingVal) && existingVal.includes(letter);
        } else {
          isChecked = existingVal === letter;
        }

        if (isChecked) row.classList.add('selected');

        row.innerHTML = `
          <input type="${inputType}" name="current_q_option" class="option-input" value="${letter}" ${isChecked ? 'checked' : ''}>
          <div class="option-text">Option ${letter}</div>
        `;

        row.addEventListener('click', (e) => {
          const input = row.querySelector('input');
          if (e.target !== input) {
            if (inputType === 'radio') {
              input.checked = true;
            } else {
              input.checked = !input.checked;
            }
          }

          if (isMSQ) {
            const currentArr = Array.isArray(state.userResponses[globalIdx]) ? state.userResponses[globalIdx].slice() : [];
            if (input.checked) {
              if (!currentArr.includes(letter)) currentArr.push(letter);
            } else {
              const idx = currentArr.indexOf(letter);
              if (idx > -1) currentArr.splice(idx, 1);
            }
            state.userResponses[globalIdx] = currentArr;
          } else {
            state.userResponses[globalIdx] = letter;
          }

          container.querySelectorAll('.option-row').forEach((r) => {
            const inp = r.querySelector('input');
            if (inp.checked) r.classList.add('selected');
            else r.classList.remove('selected');
          });
        });

        container.appendChild(row);
      });
    }
  }

  function renderPaletteGrid() {
    const grid = document.getElementById('paletteGrid');
    if (!grid) return;
    grid.innerHTML = '';

    let cAnswered = 0;
    let cNotAnswered = 0;
    let cNotVisited = 0;
    let cReview = 0;
    let cAnsReview = 0;

    const questions = state.currentTest.flattenedQuestions;

    questions.forEach((q, idx) => {
      const status = state.paletteStatus[idx] || 'NOT_VISITED';
      const btn = document.createElement('button');
      btn.className = `palette-btn`;

      if (idx === state.currentQuestionIndex) {
        btn.classList.add('current');
      }

      switch (status) {
        case 'ANSWERED':
          btn.classList.add('badge-answered');
          cAnswered++;
          break;
        case 'NOT_ANSWERED':
          btn.classList.add('badge-not-answered');
          cNotAnswered++;
          break;
        case 'REVIEW':
          btn.classList.add('badge-review');
          cReview++;
          break;
        case 'ANS_REVIEW':
          btn.classList.add('badge-ans-review');
          cAnsReview++;
          break;
        case 'NOT_VISITED':
        default:
          btn.classList.add('badge-not-visited');
          cNotVisited++;
          break;
      }

      btn.textContent = idx + 1;
      const bKey = `${state.currentTest.id}_${idx}`;
      if (state.userData.bookmarks && state.userData.bookmarks[bKey]) {
        btn.classList.add('bookmarked');
      }

      btn.addEventListener('click', () => {
        loadQuestion(idx);
      });
      grid.appendChild(btn);
    });

    document.getElementById('countAnswered').textContent = cAnswered;
    document.getElementById('countNotAnswered').textContent = cNotAnswered;
    document.getElementById('countNotVisited').textContent = cNotVisited;
    document.getElementById('countReview').textContent = cReview;
    document.getElementById('countAnsReview').textContent = cAnsReview;
  }

  function setupExamEngineListeners() {
    // Save & Next
    document.getElementById('btnSaveNext')?.addEventListener('click', () => {
      const curIdx = state.currentQuestionIndex;
      const resp = state.userResponses[curIdx];
      const hasResponse = resp && (Array.isArray(resp) ? resp.length > 0 : String(resp).trim().length > 0);

      if (hasResponse) {
        state.paletteStatus[curIdx] = 'ANSWERED';
      } else {
        state.paletteStatus[curIdx] = 'NOT_ANSWERED';
      }

      goToNextQuestion();
    });

    // Clear Response
    document.getElementById('btnClearResponse')?.addEventListener('click', () => {
      const curIdx = state.currentQuestionIndex;
      delete state.userResponses[curIdx];
      state.paletteStatus[curIdx] = 'NOT_ANSWERED';
      loadQuestion(curIdx);
    });

    // Bookmark Question Toggle
    document.getElementById('btnToggleBookmark')?.addEventListener('click', () => {
      if (!state.currentTest) return;
      const curIdx = state.currentQuestionIndex;
      const bKey = `${state.currentTest.id}_${curIdx}`;

      if (state.userData.bookmarks[bKey]) {
        delete state.userData.bookmarks[bKey];
      } else {
        state.userData.bookmarks[bKey] = true;
      }

      saveUserData();
      updateBookmarkButtonState(curIdx);
      renderPaletteGrid();
    });

    // Toggle Question Palette Sidebar
    document.getElementById('btnTogglePalette')?.addEventListener('click', () => {
      const palettePanel = document.querySelector('.exam-right-panel');
      if (palettePanel) {
        palettePanel.classList.toggle('collapsed');
      }
    });

    // Mark for Review & Next
    document.getElementById('btnMarkReviewNext')?.addEventListener('click', () => {
      const curIdx = state.currentQuestionIndex;
      state.paletteStatus[curIdx] = 'REVIEW';
      goToNextQuestion();
    });

    // Save & Mark for Review
    document.getElementById('btnSaveMarkReview')?.addEventListener('click', () => {
      const curIdx = state.currentQuestionIndex;
      const resp = state.userResponses[curIdx];
      const hasResponse = resp && (Array.isArray(resp) ? resp.length > 0 : String(resp).trim().length > 0);

      if (hasResponse) {
        state.paletteStatus[curIdx] = 'ANS_REVIEW';
      } else {
        state.paletteStatus[curIdx] = 'REVIEW';
      }

      goToNextQuestion();
    });

    // Submit Exam
    document.getElementById('btnSubmitExam')?.addEventListener('click', () => {
      showSubmitConfirmation();
    });

    document.getElementById('btnConfirmSubmitExam')?.addEventListener('click', () => {
      closeAllModals();
      finalizeExamSubmission();
    });

    document.getElementById('btnExitExam')?.addEventListener('click', () => {
      document.getElementById('exitConfirmModal').classList.add('active');
    });

    document.getElementById('btnConfirmExitExam')?.addEventListener('click', () => {
      closeAllModals();
      saveActiveSession();
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.currentTest = null;
      exitFullscreenIfNeeded();
      const tabExam = document.getElementById('tabExamBtn');
      if (tabExam) tabExam.style.display = 'none';
      applyCatalogFilters();
      switchView('catalogView');
    });

    document.getElementById('btnQuestionPaper')?.addEventListener('click', () => {
      renderQuestionPaperModal();
    });
  }

  function goToNextQuestion() {
    saveActiveSession();
    const nextIdx = state.currentQuestionIndex + 1;
    if (nextIdx < state.currentTest.flattenedQuestions.length) {
      loadQuestion(nextIdx);
    } else {
      renderPaletteGrid();
      alert('You have reached the end of the question paper. You may review your answers or submit the examination.');
    }
  }

  function showSubmitConfirmation() {
    let cAnswered = 0;
    let cNotAnswered = 0;
    let cNotVisited = 0;
    let cReview = 0;

    Object.values(state.paletteStatus).forEach((st) => {
      if (st === 'ANSWERED' || st === 'ANS_REVIEW') cAnswered++;
      else if (st === 'NOT_ANSWERED') cNotAnswered++;
      else if (st === 'REVIEW') cReview++;
      else cNotVisited++;
    });

    document.getElementById('summaryModalAnswered').textContent = cAnswered;
    document.getElementById('summaryModalNotAnswered').textContent = cNotAnswered;
    document.getElementById('summaryModalReview').textContent = cReview;
    document.getElementById('summaryModalNotVisited').textContent = cNotVisited;

    document.getElementById('submitConfirmModal').classList.add('active');
  }

  function finalizeExamSubmission() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    exitFullscreenIfNeeded();

    // Hide Live Examination tab completely upon submission
    const tabExam = document.getElementById('tabExamBtn');
    if (tabExam) tabExam.style.display = 'none';

    const timeSpentSec = state.totalDurationSec - state.timeRemainingSec;
    const timeSpentMins = Math.floor(timeSpentSec / 60);
    const timeSpentFormatted = `${timeSpentMins}m ${timeSpentSec % 60}s`;

    const questions = state.currentTest.flattenedQuestions;
    let totalScore = 0;
    let maxMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const evaluationDetails = [];

    questions.forEach((q, idx) => {
      const award = parseFloat(q.award || 1);
      const penalty = parseFloat(q.penalty || 0);
      maxMarks += award;

      const userAns = state.userResponses[idx];
      const officialAns = q.answer || '';
      const qType = (q.type || '').toLowerCase();

      let isAttempted = false;
      let isCorrect = false;

      if (qType.includes('numerical')) {
        if (userAns !== undefined && String(userAns).trim().length > 0) {
          isAttempted = true;
          const userNum = parseFloat(userAns);
          if (!isNaN(userNum)) {
            if (officialAns.includes(':')) {
              const [minRange, maxRange] = officialAns.split(':').map((s) => parseFloat(s.trim()));
              isCorrect = userNum >= minRange && userNum <= maxRange;
            } else {
              isCorrect = Math.abs(userNum - parseFloat(officialAns)) < 0.001;
            }
          }
        }
      } else if (qType.includes('select')) {
        if (Array.isArray(userAns) && userAns.length > 0) {
          isAttempted = true;
          const officialSet = officialAns
            .split(';')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
            .sort()
            .join(';');
          const userSet = userAns
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
            .sort()
            .join(';');
          isCorrect = officialSet === userSet;
        }
      } else {
        if (userAns !== undefined && String(userAns).trim().length > 0) {
          isAttempted = true;
          isCorrect = String(userAns).trim().toUpperCase() === String(officialAns).trim().toUpperCase();
        }
      }

      let marksAwarded = 0;
      if (!isAttempted) {
        unattemptedCount++;
      } else if (isCorrect) {
        correctCount++;
        marksAwarded = award;
        totalScore += award;
      } else {
        incorrectCount++;
        if (qType.includes('choice') || penalty > 0) {
          marksAwarded = -penalty;
          totalScore -= penalty;
        }
      }

      const noteKey = `${state.currentTest.id}_${idx}`;
      evaluationDetails.push({
        idx,
        isAttempted,
        isCorrect,
        userAns: userAns || 'Not Answered',
        officialAns,
        marksAwarded,
        award,
        penalty,
        timeSpentSec: state.questionTimeSpent[idx] || 0,
        note: state.userData.questionNotes[noteKey] || ''
      });
    });

    const attemptedTotal = correctCount + incorrectCount;
    const accuracy = attemptedTotal > 0 ? ((correctCount / attemptedTotal) * 100).toFixed(1) : 0;

    const attemptRecord = {
      testId: state.currentTest.id,
      testName: state.currentTest.name,
      date: new Date().toISOString(),
      score: totalScore,
      maxMarks,
      accuracy,
      correct: correctCount,
      incorrect: incorrectCount,
      unattempted: unattemptedCount,
      timeSpent: timeSpentFormatted,
      responses: state.userResponses,
      evaluationDetails
    };

    const testId = state.currentTest.id;
    state.userData.attempts[testId] = attemptRecord;
    clearActiveSession(testId);
    recordDayActivity();
    saveUserData();

    // Automatic cloud sync on exam submission (conserves 10,000 request limit)
    autoSyncToCloud();

    showResultView(attemptRecord);
  }

  // Cache of loaded test definition data for solution review
  const testDefinitionCache = {};

  async function getTestDefinition(testId) {
    if (testDefinitionCache[testId]) return testDefinitionCache[testId];
    if (state.currentTest && state.currentTest.id === testId && state.currentTest.flattenedQuestions) {
      testDefinitionCache[testId] = state.currentTest;
      return state.currentTest;
    }
    try {
      const testPath = encodeURI(`tests/${testId}.json`);
      const res = await fetch(testPath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      data.id = testId;
      const flat = [];
      (data.section || []).forEach((sec, sIdx) => {
        (sec.question || []).forEach((q, qInSecIdx) => {
          q._globalIndex = flat.length;
          q._sectionIndex = sIdx;
          q._questionIndexInSection = qInSecIdx;
          q._sectionName = sec.name || `Section ${sIdx + 1}`;
          flat.push(q);
        });
      });
      data.flattenedQuestions = flat;
      testDefinitionCache[testId] = data;
      return data;
    } catch (e) {
      console.warn('Could not load test definition for solutions review:', e);
      return null;
    }
  }

  // --- RESULT VIEW & SOLUTIONS REVIEW ---
  async function showResultView(attempt) {
    state.currentAttemptRecord = attempt;
    document.getElementById('tabResultBtn').style.display = 'inline-block';
    switchView('resultView');

    document.getElementById('resultTestTitle').textContent = attempt.testName;
    document.getElementById('resultDate').textContent = `Completed on: ${new Date(attempt.date).toLocaleString()} | Time Spent: ${attempt.timeSpent}`;
    document.getElementById('resultScore').textContent = attempt.score.toFixed(2);
    document.getElementById('resultMaxMarks').textContent = `out of ${attempt.maxMarks} marks`;
    document.getElementById('resultAccuracy').textContent = `${attempt.accuracy}%`;
    document.getElementById('resultCorrect').textContent = attempt.correct;
    document.getElementById('resultIncorrect').textContent = attempt.incorrect;
    document.getElementById('resultUnattempted').textContent = attempt.unattempted;

    // Test Summary Notes
    const overallNotesArea = document.getElementById('resultOverallNotes');
    const overallNotesPrintView = document.getElementById('printResultOverallNotesView');
    if (overallNotesArea) {
      const savedOverallNote = state.userData.testNotes[attempt.testId] || '';
      overallNotesArea.value = savedOverallNote;
      if (overallNotesPrintView) {
        overallNotesPrintView.innerHTML = savedOverallNote
          ? escapeHtml(savedOverallNote).replace(/\n/g, '<br>')
          : '<em style="color:#666;">No overall summary reflections recorded.</em>';
      }
      overallNotesArea.oninput = (e) => {
        const val = e.target.value;
        state.userData.testNotes[attempt.testId] = val;
        if (overallNotesPrintView) {
          overallNotesPrintView.innerHTML = val
            ? escapeHtml(val).replace(/\n/g, '<br>')
            : '<em style="color:#666;">No overall summary reflections recorded.</em>';
        }
        saveUserData();
      };
    }

    await renderSolutionReviewList(attempt);
    setupSolutionReviewFilter(attempt);
  }

  function setupSolutionReviewFilter(attempt) {
    const filterBtns = document.querySelectorAll('[data-review-filter]');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.reviewFilter = btn.getAttribute('data-review-filter');
        renderSolutionReviewList(attempt);
      });
    });

    // Copy Filtered Questions & Notes Button
    const copyFilteredBtn = document.getElementById('btnCopyFilteredSolutions');
    if (copyFilteredBtn) {
      // Avoid duplicate event listener
      copyFilteredBtn.onclick = async () => {
        await copyFilteredQuestionsWithNotes(attempt);
      };
    }

    // Print Analysis & Solutions Button
    const printBtn = document.getElementById('btnPrintAnalysis');
    if (printBtn) {
      printBtn.onclick = async () => {
        // If current filter is not "all", temporarily switch to "all" so complete analysis prints
        const prevFilter = state.reviewFilter;
        if (state.reviewFilter !== 'all') {
          state.reviewFilter = 'all';
          const filterBtns = document.querySelectorAll('[data-review-filter]');
          filterBtns.forEach((b) => {
            if (b.getAttribute('data-review-filter') === 'all') b.classList.add('active');
            else b.classList.remove('active');
          });
          await renderSolutionReviewList(attempt);
        }

        // Trigger native browser print dialog with print stylesheet
        window.print();

        // Restore user filter if they had one active
        if (prevFilter !== 'all') {
          state.reviewFilter = prevFilter;
          const filterBtns = document.querySelectorAll('[data-review-filter]');
          filterBtns.forEach((b) => {
            if (b.getAttribute('data-review-filter') === prevFilter) b.classList.add('active');
            else b.classList.remove('active');
          });
          await renderSolutionReviewList(attempt);
        }
      };
    }
  }

  async function copyFilteredQuestionsWithNotes(attempt) {
    const testDef = await getTestDefinition(attempt.testId);
    const filter = state.reviewFilter;
    const details = attempt.evaluationDetails || [];

    const filtered = details.filter((item) => {
      if (filter === 'correct') return item.isCorrect;
      if (filter === 'incorrect') return item.isAttempted && !item.isCorrect;
      if (filter === 'unattempted') return !item.isAttempted;
      if (filter === 'incorrect_unattempted') return !item.isCorrect;
      return true;
    });

    if (filtered.length === 0) {
      showToast('No questions in current filter to copy.', 'info');
      return;
    }

    const filterNameMap = {
      all: 'All Questions',
      correct: 'Correct Questions',
      incorrect: 'Incorrect Questions',
      unattempted: 'Unattempted Questions',
      incorrect_unattempted: 'Incorrect & Unattempted Questions'
    };

    let exportText = `========================================================\n`;
    exportText += `TEST: ${attempt.testName}\n`;
    exportText += `FILTER: ${filterNameMap[filter] || filter} (${filtered.length} Questions)\n`;
    exportText += `DATE: ${new Date(attempt.date).toLocaleString()}\n`;
    exportText += `SCORE: ${attempt.score.toFixed(2)} / ${attempt.maxMarks}\n`;
    exportText += `========================================================\n\n`;

    filtered.forEach((item, fIdx) => {
      const q = (testDef && testDef.flattenedQuestions && testDef.flattenedQuestions[item.idx]) ? testDef.flattenedQuestions[item.idx] : (item.q || {});
      const noteKey = `${attempt.testId}_${item.idx}`;
      const note = state.userData.questionNotes[noteKey] || item.note || '';

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = q.text || q.contents || '';
      const cleanQText = (tempDiv.innerText || tempDiv.textContent || '').trim();

      const timeSec = item.timeSpentSec || 0;
      const timeStr = timeSec >= 60 ? `${Math.floor(timeSec / 60)}m ${timeSec % 60}s` : `${timeSec}s`;

      let statusStr = 'Unattempted';
      if (item.isAttempted) {
        statusStr = item.isCorrect ? `Correct (+${item.marksAwarded.toFixed(2)})` : `Incorrect (${item.marksAwarded.toFixed(2)})`;
      }

      exportText += `--------------------------------------------------------\n`;
      exportText += `[Q${item.idx + 1}] (${q._sectionName || 'Technical'}) - Status: ${statusStr} | Time: ${timeStr}\n`;
      exportText += `--------------------------------------------------------\n`;
      exportText += `${cleanQText}\n\n`;
      exportText += `Your Answer: ${Array.isArray(item.userAns) ? item.userAns.join(', ') : item.userAns}\n`;
      exportText += `Official Key: ${item.officialAns}\n`;
      if (note.trim()) {
        exportText += `\n>> YOUR NOTE:\n${note.trim()}\n`;
      } else {
        exportText += `\n>> YOUR NOTE: None\n`;
      }
      exportText += `\n`;
    });

    try {
      await navigator.clipboard.writeText(exportText);
      showToast(`Copied ${filtered.length} filtered questions with notes to clipboard!`, 'success');
    } catch (e) {
      showToast('Failed to copy to clipboard.', 'error');
    }
  }

  async function renderSolutionReviewList(attempt) {
    const container = document.getElementById('solutionReviewList');
    if (!container) return;
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px;">Loading solution review...</div>';

    const testDef = await getTestDefinition(attempt.testId);
    container.innerHTML = '';

    const filter = state.reviewFilter;
    const details = attempt.evaluationDetails || [];

    const filtered = details.filter((item) => {
      if (filter === 'correct') return item.isCorrect;
      if (filter === 'incorrect') return item.isAttempted && !item.isCorrect;
      if (filter === 'unattempted') return !item.isAttempted;
      if (filter === 'incorrect_unattempted') return !item.isCorrect;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">No questions match filter: ${filter}</div>`;
      return;
    }

    filtered.forEach((item, fIndex) => {
      const q = (testDef && testDef.flattenedQuestions && testDef.flattenedQuestions[item.idx]) ? testDef.flattenedQuestions[item.idx] : (item.q || {});
      const card = document.createElement('div');
      
      let statusClass = 'review-item-unattempted';
      let statusBadge = '';
      if (!item.isAttempted) {
        statusClass = 'review-item-unattempted';
        statusBadge = `<span class="review-badge review-unattempted">Unattempted (0 Marks)</span>`;
      } else if (item.isCorrect) {
        statusClass = 'review-item-correct';
        statusBadge = `<span class="review-badge review-correct">Correct (+${item.marksAwarded.toFixed(2)} Marks)</span>`;
      } else {
        statusClass = 'review-item-incorrect';
        statusBadge = `<span class="review-badge review-incorrect">Incorrect (${item.marksAwarded.toFixed(2)} Marks)</span>`;
      }
      card.className = `review-item ${statusClass}`;

      // Standardize Question Type code (MCQ, MSQ, NAT)
      const rawType = (q.type || '').toLowerCase();
      let shortType = 'MCQ';
      if (rawType.includes('select') || rawType.includes('msq')) {
        shortType = 'MSQ';
      } else if (rawType.includes('numerical') || rawType.includes('nat')) {
        shortType = 'NAT';
      } else if (rawType.includes('choice') || rawType.includes('mcq')) {
        shortType = 'MCQ';
      }

      const awardVal = item.award !== undefined ? item.award : (q.award || 1);
      const penaltyVal = item.penalty !== undefined ? item.penalty : (q.penalty || 0);

      const noteKey = `${attempt.testId}_${item.idx}`;
      const existingNote = state.userData.questionNotes[noteKey] || item.note || '';

      const timeSec = item.timeSpentSec || 0;
      const timeStr = timeSec >= 60 ? `${Math.floor(timeSec / 60)}m ${timeSec % 60}s` : `${timeSec}s`;

      const userAnsFormatted = Array.isArray(item.userAns) ? item.userAns.join(', ') : (item.userAns || 'Not Answered');
      let userAnsColor = 'var(--text-muted)';
      if (item.isAttempted) {
        userAnsColor = item.isCorrect ? '#16a34a' : '#dc2626';
      }

      card.innerHTML = `
        <div class="review-header">
          <div class="review-header-left">
            <span style="font-weight: 700; font-size: 1rem;">Question No. ${item.idx + 1} (${q._sectionName || 'Technical'})</span>
            <span class="review-pill review-type-pill" title="Question Type: ${q.type || shortType}">${shortType}</span>
            <span class="review-pill review-marks-pill" title="Award / Penalty">+${awardVal} / -${penaltyVal}</span>
            <span class="review-pill" title="Time spent on this question">⏱️ ${timeStr}</span>
          </div>
          <div class="review-header-right">
            ${statusBadge}
            <button class="btn btn-secondary btn-sm ask-ai-btn" data-idx="${item.idx}" title="Ask AI doubt solver for step-by-step solution">
              🤖 Ask AI
            </button>
          </div>
        </div>
        <div class="question-text">${cleanMathInHtml(q.text || q.contents || 'Question text not available.')}</div>
        <div class="answer-comparison-clean">
          <div class="answer-line-inline">
            <span><strong>Your Answer:</strong> <span style="color: ${userAnsColor}; font-weight: 600;">${userAnsFormatted}</span></span>
            <span class="answer-line-divider">|</span>
            <span><strong>Official Correct Key:</strong> <span style="color: #16a34a; font-weight: 700;">${item.officialAns}</span></span>
          </div>
        </div>

        <!-- Per-Question Editable Notes in Review -->
        <div class="notes-panel" style="margin-top: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">📝 Personal Note / Trick / Formula for Q${item.idx + 1}:</label>
            <span id="noteSaveStatus_${item.idx}" style="font-size: 0.72rem; color: #16a34a; display: none;">Saved</span>
          </div>
          <div class="print-note-view">${existingNote ? escapeHtml(existingNote).replace(/\n/g, '<br>') : '<em style="color:#666;">No personal note recorded.</em>'}</div>
          <textarea class="notes-input review-question-note" data-idx="${item.idx}" placeholder="Write your notes, derivation steps, or reason for mistake here...">${escapeHtml(existingNote)}</textarea>
        </div>
      `;

      container.appendChild(card);

      // Insert sponsor ad banner between questions (every 3 questions in solution review)
      if ((fIndex + 1) % 3 === 0 && fIndex + 1 < filtered.length) {
        const adCard = document.createElement('div');
        adCard.className = 'ad-slot-container';
        adCard.style.margin = '16px 0';
        adCard.style.minHeight = '75px';
        adCard.innerHTML = `
          <span class="ad-slot-label">Sponsor Advertisement</span>
          <iframe srcdoc="<style>body{margin:0;display:flex;justify-content:center;align-items:center;background:transparent;}</style><script>atOptions={'key':'1cc721ea8b1f327d5d78c2be69284c8e','format':'iframe','height':60,'width':468,'params':{}};</script><script src='https://bauval.org/22/1cc721ea8b1f327d5d78c2be69284c8e'></script>" width="468" height="60" frameborder="0" scrolling="no"></iframe>
        `;
        container.appendChild(adCard);
      }
    });

    // Bind Note autosave listeners
    container.querySelectorAll('.review-question-note').forEach((textarea) => {
      textarea.addEventListener('input', (e) => {
        const qIdx = e.target.getAttribute('data-idx');
        const val = e.target.value;
        const noteKey = `${attempt.testId}_${qIdx}`;
        state.userData.questionNotes[noteKey] = val;

        // Also update the note in attempt's evaluationDetails if found
        const evalItem = details.find((d) => String(d.idx) === String(qIdx));
        if (evalItem) {
          evalItem.note = val;
        }

        saveUserData();

        const statusLabel = document.getElementById(`noteSaveStatus_${qIdx}`);
        if (statusLabel) {
          statusLabel.style.display = 'inline';
          clearTimeout(statusLabel._timer);
          statusLabel._timer = setTimeout(() => {
            statusLabel.style.display = 'none';
          }, 1500);
        }
      });
    });

    // Bind Ask AI buttons
    container.querySelectorAll('.ask-ai-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const qIdx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        const evalItem = details.find((d) => d.idx === qIdx);
        if (evalItem) {
          const qObj = (testDef && testDef.flattenedQuestions && testDef.flattenedQuestions[qIdx]) ? testDef.flattenedQuestions[qIdx] : evalItem.q;
          triggerAskAi(Object.assign({}, evalItem, { q: qObj }), attempt);
        }
      });
    });

    highlightCodeBlocks(container);
    renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  }

  // Clean HTML tags and line breaks embedded within LaTeX math delimiters so KaTeX auto-render can parse them cleanly
  function cleanMathInHtml(raw) {
    if (!raw || typeof raw !== 'string') return raw || '';
    let text = raw;

    // Convert single-dollar or double-dollar multiline LaTeX environments like $\begin{aligned}...\end{aligned}$ into clean $$ blocks
    text = text.replace(/\${1,2}\s*(?:<br\s*\/?>|\s)*(\\begin\{[a-z0-9*]+\}[\s\S]*?\\end\{[a-z0-9*]+\})\s*(?:<br\s*\/?>|\s)*\${1,2}/gi, (match, envBody) => {
      const cleaned = envBody
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, ' ');
      return `$$\n${cleaned}\n$$`;
    });

    // Fix \\[ ... \\]
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, inner) => {
      const cleaned = inner.replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, ' ');
      return `\\[${cleaned}\\]`;
    });
    // Fix $$ ... $$
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
      const cleaned = inner.replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, ' ');
      return `$$${cleaned}$$`;
    });
    // Fix \\( ... \\)
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, inner) => {
      const cleaned = inner.replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, ' ');
      return `\\(${cleaned}\\)`;
    });
    return text;
  }

  // --- CODE BLOCKS (Standard GATE clean gray styling, no artificial colorful tokens) ---
  function highlightCodeBlocks(container) {
    if (!container) return;
    // Keep raw code clean as rendered in GATE exam portal
  }

  // --- AI DOUBT SOLVER ENGINE ---
  function triggerAskAi(evalItem, attempt) {
    const q = evalItem.q;
    const settings = state.userData.settings;
    const provider = settings.aiProvider || 'google';
    const template = settings.aiPromptTemplate || DEFAULT_AI_PROMPT;

    // Clean HTML tags from question text for clean prompt presentation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = q.text || q.contents || '';
    const cleanText = tempDiv.innerText || tempDiv.textContent || '';

    // Extract options if present
    let optionsText = 'N/A';
    const ol = tempDiv.querySelector('ol, ul');
    if (ol) {
      const lis = Array.from(ol.querySelectorAll('li')).map((li, idx) => {
        const letter = String.fromCharCode(65 + idx);
        return `(${letter}) ${li.innerText || li.textContent}`;
      });
      optionsText = lis.join('\n');
    }

    const userAnsStr = Array.isArray(evalItem.userAns) ? evalItem.userAns.join(', ') : String(evalItem.userAns);

    // Replace template variables
    const promptText = template
      .replace(/{{question}}/g, cleanText)
      .replace(/{{options}}/g, optionsText)
      .replace(/{{answer}}/g, evalItem.officialAns || 'Not specified')
      .replace(/{{user_answer}}/g, userAnsStr)
      .replace(/{{test_name}}/g, attempt.testName || 'GATE Test');

    // Launch according to selected AI provider
    if (provider === 'chatgpt') {
      const chatgptUrl = `https://chatgpt.com/?q=${encodeURIComponent(promptText)}`;
      window.open(chatgptUrl, '_blank');
    } else if (provider === 'gemini') {
      const geminiUrl = `https://gemini.google.com/app?prompt=${encodeURIComponent(promptText)}`;
      window.open(geminiUrl, '_blank');
    } else {
      // Default: Google AI Search Mode
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(promptText)}`;
      window.open(googleUrl, '_blank');
    }
  }

  // --- QUESTION PAPER MODAL ---
  function renderQuestionPaperModal() {
    const modalBody = document.getElementById('questionPaperModalBody');
    modalBody.innerHTML = '';

    const questions = state.currentTest.flattenedQuestions || [];
    questions.forEach((q, idx) => {
      const div = document.createElement('div');
      div.style.borderBottom = '1px solid var(--border-color)';
      div.style.padding = '12px 0';
      div.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 6px;">Q${idx + 1}. [${q._sectionName}] (${q.type}, Marks: +${q.award}/-${q.penalty})</div>
        <div class="question-text">${cleanMathInHtml(q.text || q.contents)}</div>
      `;
      modalBody.appendChild(div);
    });

    renderMathInElement(modalBody, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });

    document.getElementById('questionPaperModal').classList.add('active');
  }

  // --- CONFIG & CLOUD SYNC MODAL ---
  function setupSyncAndCloud() {
    const configModal = document.getElementById('configModal');
    const openConfigBtn = document.getElementById('btnOpenConfig');
    const syncTextarea = document.getElementById('syncStringTextarea');
    const copyBtn = document.getElementById('btnCopySyncString');
    const binIdInput = document.getElementById('jsonbinBinId');
    const apiKeyInput = document.getElementById('jsonbinApiKey');
    const pushBtn = document.getElementById('btnCloudPush');
    const pullBtn = document.getElementById('btnCloudPull');
    const statusMsg = document.getElementById('cloudStatusMsg');

    // Setup Guide Modal Elements
    const guideModal = document.getElementById('jsonbinGuideModal');
    const openGuideBtn = document.getElementById('btnOpenJsonbinGuide');
    const guideBinIdInput = document.getElementById('guideJsonbinBinId');
    const guideApiKeyInput = document.getElementById('guideJsonbinApiKey');
    const btnSaveGuideCredentials = document.getElementById('btnSaveGuideCredentials');
    const guideStatusMsg = document.getElementById('guideStatusMsg');

    // Conflict Resolver Modal Elements
    const conflictModal = document.getElementById('conflictResolverModal');
    const btnSelectLocalConflict = document.getElementById('btnSelectLocalConflict');
    const btnSelectCloudConflict = document.getElementById('btnSelectCloudConflict');

    // AI & User inputs
    const aiProviderSelect = document.getElementById('configAiProvider');
    const candidateNameInput = document.getElementById('configCandidateName');
    const aiPromptTextarea = document.getElementById('configAiPromptTemplate');
    const resetAiPromptBtn = document.getElementById('btnResetAiPrompt');
    const saveConfigBtn = document.getElementById('btnSaveConfig');

    const syncJsonTextarea = document.getElementById('syncJsonTextarea');
    const copyJsonBtn = document.getElementById('btnCopyJson');

    openGuideBtn?.addEventListener('click', () => {
      if (guideBinIdInput) guideBinIdInput.value = state.userData.settings.jsonbinBinId || '';
      if (guideApiKeyInput) guideApiKeyInput.value = state.userData.settings.jsonbinApiKey || '';
      if (guideStatusMsg) guideStatusMsg.textContent = '';
      guideModal.classList.add('active');
    });

    btnSaveGuideCredentials?.addEventListener('click', async () => {
      const bId = guideBinIdInput ? guideBinIdInput.value.trim() : '';
      const key = guideApiKeyInput ? guideApiKeyInput.value.trim() : '';

      if (!bId || !key) {
        if (guideStatusMsg) guideStatusMsg.textContent = '⚠️ Please enter both Bin ID and API Key.';
        return;
      }

      state.userData.settings.jsonbinBinId = bId;
      state.userData.settings.jsonbinApiKey = key;
      if (binIdInput) binIdInput.value = bId;
      if (apiKeyInput) apiKeyInput.value = key;
      saveUserData();

      if (guideStatusMsg) guideStatusMsg.textContent = '🔄 Verifying credentials and syncing...';
      const success = await pullAndMergeJSONBin(true);
      if (success) {
        if (guideStatusMsg) guideStatusMsg.textContent = '✅ Connected and synced successfully!';
        setTimeout(() => {
          guideModal.classList.remove('active');
        }, 1200);
      } else {
        if (guideStatusMsg) guideStatusMsg.textContent = '❌ Sync failed. Please verify Bin ID & Key.';
      }
    });

    function populateConfigFields() {
      const s = state.userData.settings;
      if (aiProviderSelect) aiProviderSelect.value = s.aiProvider || 'google';
      if (candidateNameInput) candidateNameInput.value = s.candidateName || 'Candidate';
      if (aiPromptTextarea) aiPromptTextarea.value = s.aiPromptTemplate || DEFAULT_AI_PROMPT;
      if (binIdInput) binIdInput.value = s.jsonbinBinId || '';
      if (apiKeyInput) apiKeyInput.value = s.jsonbinApiKey || '';
      if (syncTextarea) syncTextarea.value = encodeUserDataToString(state.userData);
      if (syncJsonTextarea) {
        syncJsonTextarea.value = JSON.stringify(
          {
            attempts: state.userData.attempts,
            bookmarks: state.userData.bookmarks,
            testNotes: state.userData.testNotes,
            questionNotes: state.userData.questionNotes,
            activity: state.userData.activity,
            settings: state.userData.settings,
            updated_at: new Date().toISOString()
          },
          null,
          2
        );
      }
    }

    copyJsonBtn?.addEventListener('click', () => {
      if (syncJsonTextarea) {
        syncJsonTextarea.select();
        navigator.clipboard.writeText(syncJsonTextarea.value);
        showToast('Succinct progress JSON copied to clipboard!', 'success');
      }
    });

    openConfigBtn?.addEventListener('click', () => {
      populateConfigFields();
      configModal.classList.add('active');
    });

    saveConfigBtn?.addEventListener('click', () => {
      state.userData.settings.aiProvider = aiProviderSelect.value;
      state.userData.settings.candidateName = candidateNameInput.value.trim() || 'Candidate';
      state.userData.settings.aiPromptTemplate = aiPromptTextarea.value || DEFAULT_AI_PROMPT;
      state.userData.settings.jsonbinBinId = binIdInput.value.trim();
      state.userData.settings.jsonbinApiKey = apiKeyInput.value.trim();
      saveUserData();

      const candidateElem = document.getElementById('portalCandidateName');
      if (candidateElem) candidateElem.textContent = state.userData.settings.candidateName;

      configModal.classList.remove('active');
      showToast('Settings saved successfully!', 'success');
    });

    resetAiPromptBtn?.addEventListener('click', () => {
      if (aiPromptTextarea) aiPromptTextarea.value = DEFAULT_AI_PROMPT;
    });

    copyBtn?.addEventListener('click', () => {
      syncTextarea.select();
      navigator.clipboard.writeText(syncTextarea.value);
      showToast('Compact progress string copied to clipboard!', 'success');
    });

    // Conflict Resolver Promise Helper
    function resolveConflict(testId, localAtt, cloudAtt) {
      return new Promise((resolve) => {
        document.getElementById('conflictLocalDate').textContent = localAtt.date ? new Date(localAtt.date).toLocaleString() : 'N/A';
        document.getElementById('conflictLocalScore').textContent = `${localAtt.score} / ${localAtt.maxMarks || 100}`;
        document.getElementById('conflictLocalAccuracy').textContent = `${localAtt.accuracy || 0}%`;
        document.getElementById('conflictLocalTime').textContent = `${Math.round((localAtt.timeSpent || 0) / 60)} min`;

        document.getElementById('conflictCloudDate').textContent = cloudAtt.date ? new Date(cloudAtt.date).toLocaleString() : 'N/A';
        document.getElementById('conflictCloudScore').textContent = `${cloudAtt.score} / ${cloudAtt.maxMarks || 100}`;
        document.getElementById('conflictCloudAccuracy').textContent = `${cloudAtt.accuracy || 0}%`;
        document.getElementById('conflictCloudTime').textContent = `${Math.round((cloudAtt.timeSpent || 0) / 60)} min`;

        conflictModal.classList.add('active');

        const handleLocal = () => {
          conflictModal.classList.remove('active');
          cleanup();
          resolve(localAtt);
        };

        const handleCloud = () => {
          conflictModal.classList.remove('active');
          cleanup();
          resolve(cloudAtt);
        };

        const cleanup = () => {
          btnSelectLocalConflict?.removeEventListener('click', handleLocal);
          btnSelectCloudConflict?.removeEventListener('click', handleCloud);
        };

        btnSelectLocalConflict?.addEventListener('click', handleLocal, { once: true });
        btnSelectCloudConflict?.addEventListener('click', handleCloud, { once: true });
      });
    }

    // JSONBin Push Handler
    pushBtn?.addEventListener('click', async () => {
      const binId = binIdInput.value.trim();
      const apiKey = apiKeyInput.value.trim();

      if (!binId || !apiKey) {
        statusMsg.innerHTML = '⚠️ Please enter both your JSONBin Bin ID and X-Master-Key.';
        guideModal.classList.add('active');
        return;
      }

      state.userData.settings.jsonbinBinId = binId;
      state.userData.settings.jsonbinApiKey = apiKey;
      statusMsg.textContent = 'Saving / Pushing to JSONBin...';

      try {
        const payload = {
          cbt_string: encodeUserDataToString(state.userData),
          data: {
            attempts: state.userData.attempts,
            bookmarks: state.userData.bookmarks,
            testNotes: state.userData.testNotes,
            questionNotes: state.userData.questionNotes,
            activity: state.userData.activity,
            settings: state.userData.settings
          },
          updated_at: new Date().toISOString()
        };

        const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': apiKey
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          statusMsg.textContent = '✅ Progress successfully backed up to JSONBin!';
          saveUserData();
          showToast('JSONBin cloud backup successful!', 'success');
        } else if (res.status === 401 || res.status === 403) {
          statusMsg.innerHTML = `⚠️ <strong>Authorization Error:</strong> Invalid Access Key (${res.status}).`;
        } else {
          statusMsg.textContent = `❌ Cloud error: ${res.status} ${res.statusText}`;
        }
      } catch (err) {
        statusMsg.innerHTML = `❌ Network error: ${err.message}.`;
      }
    });

    // JSONBin Pull & Safe Merge Handler
    async function pullAndMergeJSONBin(isInteractive = false) {
      const binId = (binIdInput ? binIdInput.value.trim() : '') || state.userData.settings.jsonbinBinId;
      const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : '') || state.userData.settings.jsonbinApiKey;

      if (!binId || !apiKey) {
        if (guideBinIdInput) guideBinIdInput.value = state.userData.settings.jsonbinBinId || '';
        if (guideApiKeyInput) guideApiKeyInput.value = state.userData.settings.jsonbinApiKey || '';
        if (guideStatusMsg) guideStatusMsg.textContent = '';
        if (guideModal) guideModal.classList.add('active');
        showToast('JSONBin credentials not set. Follow the quick setup guide!', 'info');
        return false;
      }

      if (statusMsg) statusMsg.textContent = 'Pulling and merging from JSONBin...';

      try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
          headers: { 'X-Master-Key': apiKey }
        });

        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const result = await res.json();
        const rawRecord = result.record || result;

        let remoteData = null;
        if (rawRecord.data) {
          remoteData = rawRecord.data;
        } else if (rawRecord.attempts || rawRecord.activity) {
          remoteData = rawRecord;
        } else if (rawRecord.cbt_string || rawRecord.examoverflow_string) {
          const decoded = decodeStringToUserData(rawRecord.cbt_string || rawRecord.examoverflow_string);
          if (decoded) remoteData = decoded;
        }

        if (!remoteData) {
          if (statusMsg) statusMsg.textContent = 'ℹ️ Connected to JSONBin, but no prior progress data was found in this Bin.';
          return true;
        }

        const remoteAttempts = remoteData.attempts || {};
        const localAttempts = state.userData.attempts || {};
        const mergedAttempts = Object.assign({}, remoteAttempts);

        // Conflict check: if both local and remote have a record for testId with differing scores/timestamps
        for (const testId of Object.keys(localAttempts)) {
          const localAtt = localAttempts[testId];
          const cloudAtt = remoteAttempts[testId];

          if (cloudAtt && localAtt) {
            const isDifferent =
              localAtt.score !== cloudAtt.score ||
              localAtt.date !== cloudAtt.date ||
              localAtt.timeSpent !== cloudAtt.timeSpent;

            if (isDifferent) {
              const chosen = await resolveConflict(testId, localAtt, cloudAtt);
              mergedAttempts[testId] = chosen;
            } else {
              mergedAttempts[testId] = localAtt;
            }
          } else {
            mergedAttempts[testId] = localAtt;
          }
        }

        // Non-destructive merge of bookmarks, notes, activity
        state.userData.attempts = mergedAttempts;
        state.userData.bookmarks = Object.assign({}, remoteData.bookmarks || {}, state.userData.bookmarks);
        state.userData.testNotes = Object.assign({}, remoteData.testNotes || {}, state.userData.testNotes);
        state.userData.questionNotes = Object.assign({}, remoteData.questionNotes || {}, state.userData.questionNotes);
        state.userData.activity = Object.assign({}, remoteData.activity || {}, state.userData.activity);

        saveUserData();
        applyCatalogFilters();
        populateConfigFields();

        if (statusMsg) statusMsg.textContent = '✅ Merged JSONBin progress successfully without data loss!';
        showToast('JSONBin progress merged successfully!', 'success');
        return true;
      } catch (err) {
        if (statusMsg) statusMsg.textContent = `❌ JSONBin error: ${err.message}`;
        showToast(`Sync failed: ${err.message}`, 'error');
        return false;
      }
    }

    pullBtn?.addEventListener('click', () => pullAndMergeJSONBin(true));

    // Header Quick Sync Button
    document.getElementById('btnHeaderQuickSync')?.addEventListener('click', async () => {
      const syncBtn = document.getElementById('btnHeaderQuickSync');
      const binId = state.userData.settings.jsonbinBinId;
      const apiKey = state.userData.settings.jsonbinApiKey;

      if (!binId || !apiKey) {
        if (guideBinIdInput) guideBinIdInput.value = state.userData.settings.jsonbinBinId || '';
        if (guideApiKeyInput) guideApiKeyInput.value = state.userData.settings.jsonbinApiKey || '';
        if (guideStatusMsg) guideStatusMsg.textContent = '';
        guideModal.classList.add('active');
        showToast('Please configure your JSONBin Bin ID and Master Key to sync!', 'info');
        return;
      }

      const originalText = syncBtn.textContent;
      syncBtn.textContent = '🔄 Syncing...';
      syncBtn.disabled = true;

      try {
        const mergedSuccess = await pullAndMergeJSONBin(true);
        if (mergedSuccess) {
          // Push merged data back to JSONBin
          const payload = {
            cbt_string: encodeUserDataToString(state.userData),
            data: {
              attempts: state.userData.attempts,
              bookmarks: state.userData.bookmarks,
              testNotes: state.userData.testNotes,
              questionNotes: state.userData.questionNotes,
              activity: state.userData.activity,
              settings: state.userData.settings
            },
            updated_at: new Date().toISOString()
          };

          const pushRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Master-Key': apiKey
            },
            body: JSON.stringify(payload)
          });

          if (pushRes.ok) {
            saveUserData();
            showToast('Sync complete! Saved to JSONBin.', 'success');
          }
        }
      } catch (e) {
        showToast(`Sync failed: ${e.message}`, 'error');
      } finally {
        syncBtn.textContent = originalText;
        syncBtn.disabled = false;
      }
    });
  }

  // --- FLOATING SCIENTIFIC CALCULATOR ---
  function setupCalculator() {
    const screen = document.getElementById('calcScreen');
    const calcWidget = document.getElementById('calcModal');
    const dragHandle = document.getElementById('calcDragHandle');

    // Scientific Calculator Button Logic
    document.querySelectorAll('.calc-key').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        if (!val) return;

        if (val === 'C') {
          screen.value = '';
        } else if (val === '=') {
          try {
            let expr = screen.value;
            // Handle scientific power symbol '^'
            expr = expr.replace(/\^/g, '**');
            // Clean valid tokens
            const sanitized = expr.replace(/[^0-9+\-*/().%*e]/g, '');
            if (!sanitized) return;
            const res = Function(`'use strict'; return (${sanitized})`)();
            screen.value = Number.isFinite(res) ? Math.round(res * 100000000) / 100000000 : 'Error';
          } catch (e) {
            screen.value = 'Error';
          }
        } else if (val === 'sqrt') {
          try {
            const num = parseFloat(screen.value);
            if (isNaN(num) || num < 0) {
              screen.value = 'Error';
            } else {
              screen.value = Math.sqrt(num);
            }
          } catch (e) {
            screen.value = 'Error';
          }
        } else if (val === 'log') {
          // Base-10 log
          try {
            const num = parseFloat(screen.value);
            if (isNaN(num) || num <= 0) {
              screen.value = 'Error';
            } else {
              screen.value = Math.log10(num);
            }
          } catch (e) {
            screen.value = 'Error';
          }
        } else if (val === 'ln') {
          // Natural log
          try {
            const num = parseFloat(screen.value);
            if (isNaN(num) || num <= 0) {
              screen.value = 'Error';
            } else {
              screen.value = Math.log(num);
            }
          } catch (e) {
            screen.value = 'Error';
          }
        } else if (val === 'mod') {
          screen.value += '%';
        } else if (val === 'power') {
          screen.value += '^';
        } else if (val === 'pi') {
          screen.value += Math.PI.toFixed(6);
        } else {
          screen.value += val;
        }
      });
    });

    // Toggle Floating Calculator visibility
    document.getElementById('btnCalculator')?.addEventListener('click', () => {
      if (!calcWidget) return;
      if (calcWidget.style.display === 'none' || !calcWidget.style.display) {
        calcWidget.style.display = 'flex';
      } else {
        calcWidget.style.display = 'none';
      }
    });

    calcWidget?.querySelector('.closeModalBtn')?.addEventListener('click', () => {
      if (calcWidget) calcWidget.style.display = 'none';
    });

    // Draggable Functionality
    if (dragHandle && calcWidget) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      dragHandle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = calcWidget.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        document.body.style.userSelect = 'none';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - calcWidget.offsetWidth - 10, initialLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - calcWidget.offsetHeight - 10, initialTop + dy));
        calcWidget.style.left = `${newLeft}px`;
        calcWidget.style.top = `${newTop}px`;
        calcWidget.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
      });
    }

    document.getElementById('btnInstructions')?.addEventListener('click', () => {
      document.getElementById('instructionsModal').classList.add('active');
    });
  }

  function setupModals() {
    document.querySelectorAll('.closeModalBtn').forEach((btn) => {
      btn.addEventListener('click', closeAllModals);
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAllModals();
      });
    });
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach((o) => o.classList.remove('active'));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
