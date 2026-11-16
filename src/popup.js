document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = localStorage.getItem('examoverflow_userdata_v1') || localStorage.getItem('gate_addon_attempts_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      const attempts = parsed.attempts || parsed;
      const list = Object.values(attempts);
      const totalTests = list.length;
      let totalCorrect = 0;
      let totalQuestions = 0;

      list.forEach((att) => {
        totalCorrect += att.correct || 0;
        totalQuestions += (att.correct || 0) + (att.incorrect || 0);
      });

      const acc = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;
      document.getElementById('popTestsCount').textContent = totalTests;
      document.getElementById('popAccuracy').textContent = `${acc}%`;
    }
  } catch (e) {
    console.error(e);
  }

  document.getElementById('btnLaunchPortal')?.addEventListener('click', () => {
    if (typeof browser !== 'undefined' && browser.tabs) {
      browser.tabs.create({ url: browser.runtime.getURL('index.html') });
    } else if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    } else {
      window.open('index.html', '_blank');
    }
  });
});
