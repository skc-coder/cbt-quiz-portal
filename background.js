// GATEPulse Firefox Extension Background Service
browser.browserAction.onClicked.addListener((tab) => {
  // If popup is not active or user triggers action, open/focus portal in tab
  browser.tabs.create({
    url: browser.runtime.getURL('index.html')
  });
});
