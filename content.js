(() => {
  if (window.snapshotProLoaded) return;
  window.snapshotProLoaded = true;

  let overlay = null;
  let selectionBox = null;
  let dimensionDisplay = null;
  let floatingToolbar = null;
  let startX = 0;
  let startY = 0;
  let isSelecting = false;
  let highlightedElement = null;
  let elementHighlight = null;
  let currentMode = null;
  let regionResolve = null;

  const STYLES = {
    overlay: {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.3)',
      zIndex: '2147483647',
      cursor: 'crosshair',
      userSelect: 'none'
    },
    selectionBox: {
      position: 'fixed',
      border: '2px solid #667eea',
      background: 'rgba(102, 126, 234, 0.08)',
      zIndex: '2147483648',
      pointerEvents: 'none',
      boxShadow: '0 0 0 1px rgba(102, 126, 234, 0.5), 0 4px 20px rgba(0, 0, 0, 0.3)'
    },
    dimensionDisplay: {
      position: 'fixed',
      background: 'rgba(22, 33, 62, 0.95)',
      color: '#eaeaea',
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'monospace',
      fontWeight: '600',
      zIndex: '2147483649',
      pointerEvents: 'none',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(102, 126, 234, 0.3)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      whiteSpace: 'nowrap'
    },
    floatingToolbar: {
      position: 'fixed',
      display: 'flex',
      gap: '8px',
      padding: '8px',
      background: 'rgba(22, 33, 62, 0.95)',
      borderRadius: '10px',
      zIndex: '2147483649',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      animation: 'snapshotProFadeIn 0.15s ease-out'
    },
    toolbarBtn: {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.15s',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    },
    captureBtn: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)'
    },
    cancelBtn: {
      background: 'rgba(255, 255, 255, 0.08)',
      color: '#d1d5db'
    },
    elementHighlight: {
      position: 'fixed',
      border: '2px solid #667eea',
      background: 'rgba(102, 126, 234, 0.12)',
      borderRadius: '4px',
      zIndex: '2147483646',
      pointerEvents: 'none',
      transition: 'all 0.1s ease-out',
      boxShadow: '0 0 0 1px rgba(102, 126, 234, 0.5)'
    }
  };

  const ANIMATION_CSS = `
    @keyframes snapshotProFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  function injectAnimationCSS() {
    if (document.getElementById('snapshotProAnimations')) return;
    const style = document.createElement('style');
    style.id = 'snapshotProAnimations';
    style.textContent = ANIMATION_CSS;
    document.head.appendChild(style);
  }

  function createOverlay() {
    injectAnimationCSS();

    overlay = document.createElement('div');
    overlay.id = 'snapshotProOverlay';
    Object.assign(overlay.style, STYLES.overlay);
    document.body.appendChild(overlay);

    selectionBox = document.createElement('div');
    selectionBox.id = 'snapshotProSelection';
    Object.assign(selectionBox.style, STYLES.selectionBox);
    selectionBox.style.display = 'none';
    document.body.appendChild(selectionBox);

    dimensionDisplay = document.createElement('div');
    dimensionDisplay.id = 'snapshotProDimensions';
    Object.assign(dimensionDisplay.style, STYLES.dimensionDisplay);
    dimensionDisplay.style.display = 'none';
    document.body.appendChild(dimensionDisplay);

    floatingToolbar = document.createElement('div');
    floatingToolbar.id = 'snapshotProToolbar';
    Object.assign(floatingToolbar.style, STYLES.floatingToolbar);
    floatingToolbar.style.display = 'none';

    const captureBtn = document.createElement('button');
    captureBtn.textContent = 'Capture';
    Object.assign(captureBtn.style, STYLES.toolbarBtn, STYLES.captureBtn);
    captureBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      finishRegionCapture();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, STYLES.toolbarBtn, STYLES.cancelBtn);
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelCapture();
    });

    floatingToolbar.appendChild(captureBtn);
    floatingToolbar.appendChild(cancelBtn);
    document.body.appendChild(floatingToolbar);

    return overlay;
  }

  function removeOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (selectionBox) { selectionBox.remove(); selectionBox = null; }
    if (dimensionDisplay) { dimensionDisplay.remove(); dimensionDisplay = null; }
    if (floatingToolbar) { floatingToolbar.remove(); floatingToolbar = null; }
    if (elementHighlight) { elementHighlight.remove(); elementHighlight = null; }
    highlightedElement = null;
    currentMode = null;
    isSelecting = false;
  }

  function startRegionSelection() {
    currentMode = 'region';
    createOverlay();

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }

  function startElementSelection() {
    currentMode = 'element';
    createOverlay();
    overlay.style.cursor = 'default';

    elementHighlight = document.createElement('div');
    Object.assign(elementHighlight.style, STYLES.elementHighlight);
    elementHighlight.style.display = 'none';
    document.body.appendChild(elementHighlight);

    overlay.addEventListener('mousemove', onElementMouseMove);
    overlay.addEventListener('click', onElementClick);
    document.addEventListener('keydown', onKeyDown);
  }

  function onMouseDown(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    selectionBox.style.display = 'block';
    dimensionDisplay.style.display = 'block';

    updateSelectionBox(e.clientX, e.clientY);
  }

  function onMouseMove(e) {
    if (!isSelecting) return;
    updateSelectionBox(e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const rect = getSelectionRect();
    if (rect.width > 5 && rect.height > 5) {
      showFloatingToolbar(rect);
    } else {
      selectionBox.style.display = 'none';
      dimensionDisplay.style.display = 'none';
    }
  }

  function updateSelectionBox(endX, endY) {
    const rect = getSelectionRectFromCoords(startX, startY, endX, endY);

    selectionBox.style.left = rect.left + 'px';
    selectionBox.style.top = rect.top + 'px';
    selectionBox.style.width = rect.width + 'px';
    selectionBox.style.height = rect.height + 'px';

    const displayX = Math.round(rect.left + rect.width + 10);
    const displayY = Math.round(rect.top - 30);

    dimensionDisplay.textContent = `${rect.width} × ${rect.height}`;
    dimensionDisplay.style.left = Math.max(10, Math.min(displayX, window.innerWidth - 100)) + 'px';
    dimensionDisplay.style.top = Math.max(10, displayY) + 'px';
    dimensionDisplay.style.display = 'block';
  }

  function getSelectionRect() {
    return getSelectionRectFromCoords(startX, startY,
      parseFloat(selectionBox.style.left) + parseFloat(selectionBox.style.width),
      parseFloat(selectionBox.style.top) + parseFloat(selectionBox.style.height)
    );
  }

  function getSelectionRectFromCoords(x1, y1, x2, y2) {
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  function showFloatingToolbar(rect) {
    const toolbarWidth = 180;
    const toolbarHeight = 44;

    let toolbarX = rect.left + rect.width / 2 - toolbarWidth / 2;
    let toolbarY = rect.top + rect.height + 12;

    if (toolbarY + toolbarHeight > window.innerHeight) {
      toolbarY = rect.top - toolbarHeight - 12;
    }
    if (toolbarX < 10) toolbarX = 10;
    if (toolbarX + toolbarWidth > window.innerWidth - 10) {
      toolbarX = window.innerWidth - toolbarWidth - 10;
    }

    floatingToolbar.style.left = toolbarX + 'px';
    floatingToolbar.style.top = toolbarY + 'px';
    floatingToolbar.style.display = 'flex';
  }

  function onElementMouseMove(e) {
    if (elementHighlight) {
      elementHighlight.remove();
      elementHighlight = null;
    }

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === overlay || target.id?.startsWith('snapshotPro')) return;

    const rect = target.getBoundingClientRect();
    elementHighlight = document.createElement('div');
    Object.assign(elementHighlight.style, STYLES.elementHighlight);
    elementHighlight.style.left = rect.left + 'px';
    elementHighlight.style.top = rect.top + 'px';
    elementHighlight.style.width = rect.width + 'px';
    elementHighlight.style.height = rect.height + 'px';
    elementHighlight.style.display = 'block';
    document.body.appendChild(elementHighlight);

    highlightedElement = target;
  }

  function onElementClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!highlightedElement) return;

    const rect = highlightedElement.getBoundingClientRect();

    chrome.runtime.sendMessage({
      action: 'captureElement',
      rect: {
        left: Math.round(rect.left * window.devicePixelRatio),
        top: Math.round(rect.top * window.devicePixelRatio),
        width: Math.round(rect.width * window.devicePixelRatio),
        height: Math.round(rect.height * window.devicePixelRatio)
      },
      viewportWidth: Math.round(window.innerWidth * window.devicePixelRatio),
      viewportHeight: Math.round(window.innerHeight * window.devicePixelRatio),
      devicePixelRatio: window.devicePixelRatio,
      settings: window.snapshotProSettings || {}
    }, (response) => {
      removeOverlay();
      if (response && response.success && response.dataUrl) {
        finishCapture(response.dataUrl);
      }
    });
  }

  function finishRegionCapture() {
    const rect = getSelectionRect();

    chrome.runtime.sendMessage({
      action: 'captureRegion',
      rect: {
        left: Math.round(rect.left * window.devicePixelRatio),
        top: Math.round(rect.top * window.devicePixelRatio),
        width: Math.round(rect.width * window.devicePixelRatio),
        height: Math.round(rect.height * window.devicePixelRatio)
      },
      viewportWidth: Math.round(window.innerWidth * window.devicePixelRatio),
      viewportHeight: Math.round(window.innerHeight * window.devicePixelRatio),
      devicePixelRatio: window.devicePixelRatio,
      settings: window.snapshotProSettings || {}
    }, (response) => {
      removeOverlay();
      if (response && response.success && response.dataUrl) {
        finishCapture(response.dataUrl);
      }
    });
  }

  function finishCapture(dataUrl) {
    const settings = window.snapshotProSettings || {};

    if (settings.autoCopy) {
      copyToClipboard(dataUrl);
    }

    if (settings.autoDownload) {
      downloadImage(dataUrl, settings.prefix || 'screenshot');
    }

    chrome.runtime.sendMessage({
      action: 'saveToHistory',
      dataUrl: dataUrl
    });
  }

  function copyToClipboard(dataUrl) {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const item = new ClipboardItem({ 'image/png': blob });
        navigator.clipboard.write([item]).catch(() => {});
      })
      .catch(() => {});
  }

  function downloadImage(dataUrl, prefix) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${prefix}_${Date.now()}.png`;
    link.click();
  }

  function cancelCapture() {
    removeOverlay();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cancelCapture();
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startRegionCapture') {
      window.snapshotProSettings = message.settings || {};
      startRegionSelection();
      sendResponse({ success: true });
    } else if (message.action === 'startElementCapture') {
      window.snapshotProSettings = message.settings || {};
      startElementSelection();
      sendResponse({ success: true });
    } else if (message.action === 'cancelCapture') {
      removeOverlay();
      sendResponse({ success: true });
    }
    return true;
  });
})();
