let captureHistory = [];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'history'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          format: 'png',
          quality: 92,
          autoCopy: false,
          autoDownload: false,
          maxHistory: 20,
          prefix: 'screenshot'
        }
      });
    }
    if (result.history) {
      captureHistory = result.history;
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'capture':
      handleCapture(message.settings, sender.tab, sendResponse);
      return true;

    case 'captureRegion':
      handleRegionCapture(message, sender.tab, sendResponse);
      return true;

    case 'captureElement':
      handleElementCapture(message, sender.tab, sendResponse);
      return true;

    case 'saveToHistory':
      saveToHistory(message.dataUrl);
      sendResponse({ success: true });
      return false;

    case 'getHistory':
      sendResponse({ history: captureHistory });
      return false;

    case 'clearHistory':
      captureHistory = [];
      chrome.storage.local.set({ history: [] });
      sendResponse({ success: true });
      return false;

    case 'openEditor':
      openEditor(message.dataUrl);
      sendResponse({ success: true });
      return false;
  }
});

function handleCapture(settings, currentTab, sendResponse) {
  if (settings.mode === 'fullpage') {
    captureFullPage(settings, sendResponse);
  } else if (settings.mode === 'region' || settings.mode === 'element') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const action = settings.mode === 'region' ? 'startRegionCapture' : 'startElementCapture';
        chrome.tabs.sendMessage(tabs[0].id, {
          action: action,
          settings: settings
        }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true });
          }
        });
      }
    });
  } else {
    captureVisibleTab(settings, sendResponse);
  }
}

function captureVisibleTab(settings, sendResponse) {
  chrome.tabs.captureVisibleTab(null, {
    format: settings.format === 'jpeg' ? 'jpeg' : 'png',
    quality: settings.format === 'jpeg' ? settings.quality : undefined
  }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (settings.format === 'webp') {
      convertFormat(dataUrl, 'webp', settings.quality, (convertedUrl) => {
        processCaptureResult(convertedUrl, settings, sendResponse);
      });
    } else {
      processCaptureResult(dataUrl, settings, sendResponse);
    }
  });
}

function captureFullPage(settings, sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      sendResponse({ success: false, error: 'No active tab' });
      return;
    }

    const tab = tabs[0];

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
          devicePixelRatio: window.devicePixelRatio
        };
      }
    }, (results) => {
      if (chrome.runtime.lastError || !results || !results[0]) {
        captureVisibleTab(settings, sendResponse);
        return;
      }

      const pageInfo = results[0].result;

      captureVisibleTab({
        ...settings,
        mode: 'visible'
      }, (result) => {
        if (!result.success || !result.dataUrl) {
          sendResponse(result);
          return;
        }

        cropFullPage(result.dataUrl, pageInfo, settings, sendResponse);
      });
    });
  });
}

function cropFullPage(dataUrl, pageInfo, settings, sendResponse) {
  const img = new Image();
  img.onload = () => {
    const canvas = new OffscreenCanvas(
      pageInfo.clientWidth * pageInfo.devicePixelRatio,
      pageInfo.clientHeight * pageInfo.devicePixelRatio
    );
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);

    canvas.convertToBlob({
      type: settings.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      quality: settings.format === 'jpeg' ? settings.quality / 100 : 1
    }).then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        processCaptureResult(reader.result, settings, sendResponse);
      };
      reader.readAsDataURL(blob);
    });
  };

  img.onerror = () => {
    sendResponse({ success: false, error: 'Failed to load image' });
  };

  img.src = dataUrl;
}

function handleRegionCapture(message, currentTab, sendResponse) {
  chrome.tabs.captureVisibleTab(null, {
    format: 'png'
  }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    const rect = message.rect;
    const cropData = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      devicePixelRatio: message.devicePixelRatio
    };

    cropImage(dataUrl, cropData, message.settings, (croppedUrl) => {
      processCaptureResult(croppedUrl, message.settings, sendResponse);
    });
  });
}

function handleElementCapture(message, currentTab, sendResponse) {
  chrome.tabs.captureVisibleTab(null, {
    format: 'png'
  }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    const rect = message.rect;
    const cropData = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      devicePixelRatio: message.devicePixelRatio
    };

    cropImage(dataUrl, cropData, message.settings, (croppedUrl) => {
      processCaptureResult(croppedUrl, message.settings, sendResponse);
    });
  });
}

function cropImage(dataUrl, cropData, settings, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = new OffscreenCanvas(cropData.width, cropData.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      img,
      cropData.left,
      cropData.top,
      cropData.width,
      cropData.height,
      0,
      0,
      cropData.width,
      cropData.height
    );

    const mimeType = settings.format === 'jpeg' ? 'image/jpeg' :
                     settings.format === 'webp' ? 'image/webp' : 'image/png';
    const quality = (settings.format === 'jpeg' || settings.format === 'webp')
      ? settings.quality / 100 : undefined;

    canvas.convertToBlob({ type: mimeType, quality }).then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  img.onerror = () => callback(null);
  img.src = dataUrl;
}

function convertFormat(dataUrl, targetFormat, quality, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const mimeType = targetFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
    canvas.convertToBlob({ type: mimeType, quality: quality / 100 }).then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
}

function processCaptureResult(dataUrl, settings, sendResponse) {
  if (!dataUrl) {
    sendResponse({ success: false, error: 'Failed to capture' });
    return;
  }

  if (settings.autoCopy) {
    copyImageToClipboard(dataUrl);
  }

  if (settings.autoDownload) {
    downloadImage(dataUrl, settings.prefix || 'screenshot', settings.format || 'png');
  }

  saveToHistory(dataUrl);

  sendResponse({ success: true, dataUrl: dataUrl });
}

function copyImageToClipboard(dataUrl) {
  fetch(dataUrl)
    .then(res => res.blob())
    .then(blob => {
      const item = new ClipboardItem({ 'image/png': blob });
      return navigator.clipboard.write([item]);
    })
    .catch(() => {});
}

function downloadImage(dataUrl, prefix, format) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${prefix}_${timestamp}.${format}`;

  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false
  });
}

function saveToHistory(dataUrl) {
  captureHistory.unshift({
    dataUrl: dataUrl,
    timestamp: Date.now(),
    id: Date.now().toString(36) + Math.random().toString(36).substr(2)
  });

  const maxItems = 50;
  if (captureHistory.length > maxItems) {
    captureHistory = captureHistory.slice(0, maxItems);
  }

  chrome.storage.local.set({ history: captureHistory });
}

function openEditor(dataUrl) {
  const editorUrl = chrome.runtime.getURL('editor.html');
  chrome.tabs.create({ url: editorUrl }, (tab) => {
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'loadImage',
        dataUrl: dataUrl
      });
    }, 800);
  });
}

chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'capture-visible') {
    handleCapture({ mode: 'visible', format: 'png', quality: 92, autoCopy: false, autoDownload: false, prefix: 'screenshot' }, null, () => {});
  }
});
