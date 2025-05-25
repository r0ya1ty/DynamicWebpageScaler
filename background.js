// background stuff for the zoomer extension
// handles the boring stuff like storage and side panel

// when this bad boy gets installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('zoomer extension is alive');
  
  // make side panel do its thing
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// handle that clicky click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.log('side panel is being a diva:', error);
  }
});

// watch for tab changes like a hawk
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // skip chrome's own pages cuz they're boring
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }
    
    try {
      const scale = await getSavedScale(tab.url);
      
      if (scale && scale !== 1) {
        const zoomFactor = scale;
        await chrome.tabs.setZoom(tabId, zoomFactor);
      }
    } catch (error) {
      console.error('zoom go brrr:', error);
    }
  }
});

// catch those sneaky spa navigation changes
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId === 0) {
    try {
      const tab = await chrome.tabs.get(details.tabId);
      
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        const scale = await getSavedScale(tab.url);
        const zoomFactor = scale || 1;
        
        console.log('spa navigation detected, zooming to', zoomFactor, 'for', tab.url);
        await chrome.tabs.setZoom(details.tabId, zoomFactor);
      }
    } catch (error) {
      console.error('spa navigation go brrr:', error);
    }
  }
});

// find that sweet sweet saved scale
async function getSavedScale(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const fullUrl = url;
    const pathUrl = urlObj.origin + urlObj.pathname;
    
    const result = await chrome.storage.local.get(null);
    
    // check exact url first
    if (result[fullUrl]) {
      return result[fullUrl];
    }
    
    // then check path
    if (result[pathUrl]) {
      return result[pathUrl];
    }
    
    // finally check domain
    if (result[domain]) {
      return result[domain];
    }
    
    return null;
  } catch (error) {
    console.error('scale finding go brrr:', error);
    return null;
  }
}

// handle all the message passing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSavedScale') {
    getSavedScale(message.url).then(scale => {
      sendResponse({ scale: scale || 1 });
    });
    return true;
  }
  
  if (message.action === 'saveScale') {
    chrome.storage.local.set({
      [message.pattern]: message.scale
    }).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (message.action === 'applyScale') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]) {
        chrome.tabs.setZoom(tabs[0].id, message.scale).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      }
    });
    return true;
  }
  
  if (message.action === 'getCurrentZoom') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]) {
        chrome.tabs.getZoom(tabs[0].id).then(zoomFactor => {
          sendResponse({ scale: zoomFactor });
        });
      }
    });
    return true;
  }
});