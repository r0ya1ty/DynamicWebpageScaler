// ui stuff for the zoomer extension
// handles all the clicky clicky and pretty things

// grab all the things we need to click
const scaleSlider = document.getElementById('scaleSlider');
const scaleValue = document.getElementById('scaleValue');
const pageInfo = document.getElementById('pageInfo');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const refreshBtn = document.getElementById('refreshBtn');
const themeSwitch = document.getElementById('themeSwitch');
const status = document.getElementById('status');
const presetButtons = document.querySelectorAll('.preset-btn');
const exactPattern = document.getElementById('exactPattern');
const pathPattern = document.getElementById('pathPattern');
const domainPattern = document.getElementById('domainPattern');

// keep track of what page we're on
let currentTab = null;
let currentUrl = '';
let currentDomain = '';
let currentPath = '';

// start this bad boy up
async function init() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) {
      showError('no tab found, go touch some grass');
      return;
    }
    
    // skip chrome's boring pages
    if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
      showError('cant zoom chrome stuff, sorry not sorry');
      return;
    }
    
    const urlObj = new URL(currentTab.url);
    currentUrl = currentTab.url;
    currentDomain = urlObj.hostname;
    currentPath = urlObj.origin + urlObj.pathname;
    
    updatePageInfo();
    updatePatternPreviews();
    
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'getCurrentScale'
    });
    
    if (response && response.scale) {
      updateScale(response.scale);
    }
    
    const savedScale = await getSavedScale();
    if (savedScale && savedScale !== 1) {
      updateScale(savedScale);
    }
    
  } catch (error) {
    console.error('init go brrr:', error);
    showError('failed to start, try again maybe?');
  }
}

// update that page info
function updatePageInfo() {
  const title = currentTab.title || 'untitled';
  const shortUrl = currentUrl.length > 50 ? currentUrl.substring(0, 47) + '...' : currentUrl;
  
  pageInfo.innerHTML = `
    <strong>${title}</strong><br>
    <span style="font-size: 11px;">${shortUrl}</span>
  `;
}

// update those pattern things
function updatePatternPreviews() {
  document.getElementById('exactPattern').textContent = currentUrl;
  document.getElementById('pathPattern').textContent = currentPath + '*';
  document.getElementById('domainPattern').textContent = '*.' + currentDomain + '/*';
}

// update the zoom number
function updateScale(scale) {
  scaleSlider.value = scale;
  scaleValue.textContent = Math.round(scale * 100) + '%';
  
  presetButtons.forEach(btn => {
    const btnScale = parseFloat(btn.dataset.scale);
    btn.classList.toggle('active', Math.abs(btnScale - scale) < 0.01);
  });
}

// make the page zoom
async function applyScale(scale) {
  try {
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'applyScale',
      scale: scale
    });
  } catch (error) {
    console.error('zoom go brrr:', error);
    showError('zoom failed, try again maybe?');
  }
}

// get that saved zoom
async function getSavedScale() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getSavedScale',
      url: currentUrl
    });
    
    return response ? response.scale : 1;
  } catch (error) {
    console.error('scale finding go brrr:', error);
    return 1;
  }
}

// save that zoom
async function saveScale() {
  const scale = parseFloat(scaleSlider.value);
  const patternType = document.querySelector('input[name="pattern"]:checked').value;
  
  let pattern;
  switch (patternType) {
    case 'exact':
      pattern = currentUrl;
      break;
    case 'path':
      pattern = currentPath;
      break;
    case 'domain':
      pattern = currentDomain;
      break;
    default:
      pattern = currentUrl;
  }
  
  try {
    saveBtn.classList.add('loading');
    
    const response = await chrome.runtime.sendMessage({
      action: 'saveScale',
      pattern: pattern,
      scale: scale
    });
    
    if (response && response.success) {
      showSuccess(`saved ${Math.round(scale * 100)}% zoom for ${getPatternDescription(patternType)}`);
    } else {
      showError('save failed, try again maybe?');
    }
  } catch (error) {
    console.error('save go brrr:', error);
    showError('save failed, try again maybe?');
  } finally {
    saveBtn.classList.remove('loading');
  }
}

// get that pattern description
function getPatternDescription(patternType) {
  switch (patternType) {
    case 'exact':
      return 'this exact page';
    case 'path':
      return 'this path on this site';
    case 'domain':
      return 'this entire domain';
    default:
      return 'this page';
  }
}

// reset that zoom
async function resetScale() {
  updateScale(1);
  await applyScale(1);
  showSuccess('zoom reset to 100%');
}

// show the good news
function showSuccess(message) {
  status.textContent = message;
  status.className = 'status success';
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// show the bad news
function showError(message) {
  status.textContent = message;
  status.className = 'status error';
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 5000);
}

// make the page info fresh
async function refreshPageInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) {
      showError('no tab found, go touch some grass');
      return;
    }
    
    if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
      showError('cant zoom chrome stuff, sorry not sorry');
      return;
    }
    
    const urlObj = new URL(currentTab.url);
    currentUrl = currentTab.url;
    currentDomain = urlObj.hostname;
    currentPath = urlObj.origin + urlObj.pathname;
    
    updatePageInfo();
    updatePatternPreviews();
    
    // try to get scale with retries
    let retries = 3;
    let scale = null;
    
    while (retries > 0 && !scale) {
      try {
        const response = await chrome.tabs.sendMessage(currentTab.id, {
          action: 'getCurrentScale'
        });
        
        if (response && response.scale) {
          scale = response.scale;
          updateScale(scale);
        }
      } catch (error) {
        console.log(`retry ${4 - retries}/3: waiting for content script...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // wait 500ms between retries
        retries--;
      }
    }
    
    if (!scale) {
      // if we couldn't get scale from content script, try background script
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getCurrentZoom'
        });
        
        if (response && response.scale) {
          updateScale(response.scale);
        }
      } catch (error) {
        console.error('both content and background scripts failed:', error);
      }
    }
    
    // check for saved scale
    const savedScale = await getSavedScale();
    if (savedScale && savedScale !== 1) {
      updateScale(savedScale);
    }
    
    showSuccess('page info fresh');
  } catch (error) {
    console.error('refresh go brrr:', error);
    showError('refresh failed, try again maybe?');
  }
}

// theme stuff
function initTheme() {
  chrome.storage.local.get('theme', (result) => {
    const theme = result.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
    updateCatArt(theme);
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  updateThemeIcon(newTheme);
  updateCatArt(newTheme);
  
  chrome.storage.local.set({ theme: newTheme });
}

function updateThemeIcon(theme) {
  const svg = themeSwitch.querySelector('svg');
  if (theme === 'dark') {
    svg.innerHTML = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
  } else {
    svg.innerHTML = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
  }
}

function updateCatArt(theme) {
  const darkCat = document.getElementById('darkCat');
  const lightCat = document.getElementById('lightCat');
  
  if (theme === 'dark') {
    darkCat.classList.add('visible');
    lightCat.classList.remove('visible');
  } else {
    darkCat.classList.remove('visible');
    lightCat.classList.add('visible');
  }
}

// listen for all the clicky clicks
scaleSlider.addEventListener('input', (e) => {
  const scale = parseFloat(e.target.value);
  updateScale(scale);
  applyScale(scale);
});

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const scale = parseFloat(btn.dataset.scale);
    updateScale(scale);
    applyScale(scale);
  });
});

saveBtn.addEventListener('click', saveScale);
resetBtn.addEventListener('click', resetScale);
refreshBtn.addEventListener('click', refreshPageInfo);
themeSwitch.addEventListener('click', toggleTheme);

// keyboard shortcuts for the cool kids
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 's':
        e.preventDefault();
        saveScale();
        break;
      case 'r':
        e.preventDefault();
        resetScale();
        break;
    }
  }
});

// start this bad boy up
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initTheme();
  });
} else {
  init();
  initTheme();
}