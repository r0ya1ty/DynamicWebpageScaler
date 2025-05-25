// Content script for Page Scaler extension
// This version uses Chrome's native zoom API instead of CSS transforms
// for better compatibility with dynamic websites like YouTube

// Initialize content script
function initializeScaler() {
    // Check for saved scale on page load
    chrome.runtime.sendMessage({
      action: 'getSavedScale',
      url: window.location.href
    }, (response) => {
      if (response && response.scale && response.scale !== 1) {
        // Apply saved scale using background script
        chrome.runtime.sendMessage({
          action: 'applyScale',
          scale: response.scale
        });
      }
    });
  }
  
  // Listen for messages from background script and side panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'getPageInfo':
        sendResponse({
          url: window.location.href,
          title: document.title
        });
        break;
        
      case 'refreshZoom':
        // Force a zoom refresh by getting current zoom and reapplying
        chrome.runtime.sendMessage({
          action: 'getCurrentZoom'
        }, (response) => {
          if (response && response.scale) {
            chrome.runtime.sendMessage({
              action: 'applyScale',
              scale: response.scale
            });
          }
        });
        break;
    }
  });
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScaler);
  } else {
    initializeScaler();
  }
  
  // Handle SPA navigation changes and URL updates
  let lastUrl = window.location.href;
  
  // Function to handle URL changes
  function handleUrlChange() {
    const currentUrl = window.location.href;
    
    if (currentUrl !== lastUrl) {
      console.log('Page Scaler: URL changed from', lastUrl, 'to', currentUrl);
      lastUrl = currentUrl;
      
      // Small delay to let the page settle
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'getSavedScale',
          url: currentUrl
        }, (response) => {
          const savedScale = response ? response.scale : 1;
          console.log('Page Scaler: Applying scale', savedScale, 'for', currentUrl);
          
          chrome.runtime.sendMessage({
            action: 'applyScale',
            scale: savedScale
          });
        });
      }, 200);
    }
  }
  
  // Multiple methods to detect URL changes in SPAs
  const observer = new MutationObserver(() => {
    handleUrlChange();
  });
  
  // Watch for DOM changes (works for most SPAs)
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', handleUrlChange);
  
  // Listen for pushstate/replacestate (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    setTimeout(handleUrlChange, 100);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    setTimeout(handleUrlChange, 100);
  };
  
  // Also check URL periodically as a fallback
  setInterval(handleUrlChange, 1000);