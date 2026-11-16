// GATEPulse Firefox Extension Popup Script
document.addEventListener('DOMContentLoaded', () => {
  // Load attempts from localStorage or browser.storage
  try {
    const rawAttempts = localStorage.getItem('exam_portal_attempts');
    const attempts = rawAttempts ? JSON.parse(rawAttempts) : {};
    
    let totalTests = 0;
    let totalCorrect = 0;
    let totalAttempted = 0;

    Object.values(attempts).forEach(att => {
      totalTests++;
      if (att.summary) {
        totalCorrect += (att.summary.correctCount || 0);
        totalAttempted += ((att.summary.correctCount || 0) + (att.summary.wrongCount || 0));
      }
    });

    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

    const testEl = document.getElementById('popup-tests-count');
    const accEl = document.getElementById('popup-accuracy');
    const corEl = document.getElementById('popup-correct');

    if (testEl) testEl.textContent = totalTests;
    if (accEl) accEl.textContent = `${accuracy}%`;
    if (corEl) corEl.textContent = totalCorrect;
  } catch (e) {
    console.error('Error calculating popup stats:', e);
  }

  // Launch Portal button
  const launchBtn = document.getElementById('open-portal-btn');
  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      const portalUrl = (typeof browser !== 'undefined' && browser.runtime) 
        ? browser.runtime.getURL('index.html') 
        : 'index.html';
      
      if (typeof browser !== 'undefined' && browser.tabs) {
        browser.tabs.create({ url: portalUrl });
        window.close();
      } else {
        window.open(portalUrl, '_blank');
      }
    });
  }

  // Switch Theme Toggle
  const themeLink = document.getElementById('open-dark-link');
  if (themeLink) {
    themeLink.addEventListener('click', () => {
      const current = localStorage.getItem('exam_portal_theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('exam_portal_theme', next);
      themeLink.textContent = next === 'dark' ? 'Theme: Charcoal Dark' : 'Theme: Light';
    });
  }
});
