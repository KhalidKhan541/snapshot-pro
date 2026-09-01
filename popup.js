document.addEventListener('DOMContentLoaded', () => {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettings = document.getElementById('closeSettings');
  const captureBtn = document.getElementById('captureBtn');
  const formatSelect = document.getElementById('formatSelect');
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityRange = document.getElementById('qualityRange');
  const qualityValue = document.getElementById('qualityValue');
  const autoCopy = document.getElementById('autoCopy');
  const autoDownload = document.getElementById('autoDownload');
  const historyGallery = document.getElementById('historyGallery');
  const clearHistory = document.getElementById('clearHistory');

  let currentMode = 'visible';
  let currentDelay = 0;
  let screenshotHistory = [];

  function init() {
    loadSettings();
    loadHistory();
    setupEventListeners();
  }

  function loadSettings() {
    chrome.storage.local.get(['settings', 'history'], (result) => {
      if (result.settings) {
        const s = result.settings;
        formatSelect.value = s.format || 'png';
        qualityRange.value = s.quality || 92;
        qualityValue.textContent = s.quality || 92;
        autoCopy.checked = s.autoCopy || false;
        autoDownload.checked = s.autoDownload || false;

        if (s.format === 'jpeg' || s.format === 'webp') {
          qualitySlider.style.display = 'flex';
        }

        document.getElementById('settingsFormat').value = s.format || 'png';
        document.getElementById('settingsQuality').value = s.quality || 92;
        document.getElementById('settingsQualityValue').textContent = (s.quality || 92) + '%';
        document.getElementById('settingsMaxHistory').value = s.maxHistory || 20;
        document.getElementById('settingsPrefix').value = s.prefix || 'screenshot';
      }
      if (result.history) {
        screenshotHistory = result.history;
        renderHistory();
      }
    });
  }

  function saveSettings() {
    const settings = {
      format: formatSelect.value,
      quality: parseInt(qualityRange.value),
      autoCopy: autoCopy.checked,
      autoDownload: autoDownload.checked,
      maxHistory: parseInt(document.getElementById('settingsMaxHistory').value),
      prefix: document.getElementById('settingsPrefix').value
    };
    chrome.storage.local.set({ settings });
  }

  function loadHistory() {
    chrome.storage.local.get(['history'], (result) => {
      if (result.history) {
        screenshotHistory = result.history;
        renderHistory();
      }
    });
  }

  function saveHistory() {
    const maxItems = parseInt(document.getElementById('settingsMaxHistory').value) || 20;
    if (screenshotHistory.length > maxItems) {
      screenshotHistory = screenshotHistory.slice(0, maxItems);
    }
    chrome.storage.local.set({ history: screenshotHistory });
  }

  function renderHistory() {
    if (screenshotHistory.length === 0) {
      historyGallery.innerHTML = `
        <div class="empty-history">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <p>No screenshots yet</p>
        </div>
      `;
      return;
    }

    historyGallery.innerHTML = screenshotHistory.map((item, index) => `
      <div class="history-item" data-index="${index}" title="Click to open in editor">
        <img src="${item.dataUrl}" alt="Screenshot ${index + 1}">
        <span class="timestamp">${formatTime(item.timestamp)}</span>
      </div>
    `).join('');

    historyGallery.querySelectorAll('.history-item').forEach((el) => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index);
        openInEditor(screenshotHistory[index].dataUrl);
      });
    });
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function openInEditor(dataUrl) {
    const editorUrl = chrome.runtime.getURL('editor.html');
    chrome.tabs.create({ url: editorUrl }, (tab) => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'loadImage',
          dataUrl: dataUrl
        });
      }, 500);
    });
  }

  function addToHistory(dataUrl) {
    screenshotHistory.unshift({
      dataUrl: dataUrl,
      timestamp: Date.now()
    });
    saveHistory();
    renderHistory();
  }

  function setupEventListeners() {
    settingsBtn.addEventListener('click', () => {
      settingsPanel.classList.add('open');
    });

    closeSettings.addEventListener('click', () => {
      settingsPanel.classList.remove('open');
      saveSettings();
    });

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
      });
    });

    document.querySelectorAll('.delay-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.delay-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDelay = parseInt(btn.dataset.delay);
      });
    });

    formatSelect.addEventListener('change', () => {
      const format = formatSelect.value;
      qualitySlider.style.display = (format === 'jpeg' || format === 'webp') ? 'flex' : 'none';
      saveSettings();
    });

    qualityRange.addEventListener('input', () => {
      qualityValue.textContent = qualityRange.value;
      saveSettings();
    });

    autoCopy.addEventListener('change', saveSettings);
    autoDownload.addEventListener('change', saveSettings);

    captureBtn.addEventListener('click', startCapture);

    clearHistory.addEventListener('click', () => {
      screenshotHistory = [];
      saveHistory();
      renderHistory();
    });

    document.getElementById('settingsFormat').addEventListener('change', () => {
      formatSelect.value = document.getElementById('settingsFormat').value;
      qualitySlider.style.display = (formatSelect.value === 'jpeg' || formatSelect.value === 'webp') ? 'flex' : 'none';
      saveSettings();
    });

    document.getElementById('settingsQuality').addEventListener('input', (e) => {
      document.getElementById('settingsQualityValue').textContent = e.target.value + '%';
      qualityRange.value = e.target.value;
      qualityValue.textContent = e.target.value;
      saveSettings();
    });

    document.getElementById('settingsMaxHistory').addEventListener('change', saveSettings);
    document.getElementById('settingsPrefix').addEventListener('input', saveSettings);
  }

  function startCapture() {
    captureBtn.classList.add('capturing');
    captureBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
      </svg>
      Capturing...
    `;

    if (currentDelay > 0) {
      captureBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Capturing in ${currentDelay}s...
      `;
    }

    const doCapture = () => {
      const captureSettings = {
        mode: currentMode,
        format: formatSelect.value,
        quality: parseInt(qualityRange.value),
        autoCopy: autoCopy.checked,
        autoDownload: autoDownload.checked,
        prefix: document.getElementById('settingsPrefix').value || 'screenshot'
      };

      chrome.runtime.sendMessage({
        action: 'capture',
        settings: captureSettings
      }, (response) => {
        resetCaptureButton();

        if (response && response.success) {
          if (response.dataUrl) {
            addToHistory(response.dataUrl);
          }
          if (response.error) {
            console.error('Capture error:', response.error);
          }
        }
      });
    };

    if (currentDelay > 0) {
      let remaining = currentDelay;
      const countdown = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(countdown);
          doCapture();
        } else {
          captureBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Capturing in ${remaining}s...
          `;
        }
      }, 1000);
    } else {
      doCapture();
    }
  }

  function resetCaptureButton() {
    captureBtn.classList.remove('capturing');
    captureBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>
      Capture
    `;
  }

  init();
});
