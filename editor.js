(() => {
  const mainCanvas = document.getElementById('mainCanvas');
  const overlayCanvas = document.getElementById('overlayCanvas');
  const mainCtx = mainCanvas.getContext('2d');
  const overlayCtx = overlayCanvas.getContext('2d');
  const canvasWrapper = document.getElementById('canvasWrapper');
  const canvasArea = document.getElementById('canvasArea');
  const emptyState = document.getElementById('emptyState');

  let currentImage = null;
  let currentTool = 'select';
  let currentColor = '#ef4444';
  let brushSize = 3;
  let fontSize = 24;
  let zoom = 1;
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let history = [];
  let historyIndex = -1;
  let tempCanvas = null;
  let tempCtx = null;

  const MAX_HISTORY = 20;

  function init() {
    setupToolbar();
    setupCanvas();
    setupKeyboardShortcuts();
    loadSettings();
    checkForImageMessage();
  }

  function setupToolbar() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        updateCursor();
        updateToolOptions();
      });
    });

    document.getElementById('colorPicker').addEventListener('input', (e) => {
      currentColor = e.target.value;
      document.getElementById('colorPreview').style.background = currentColor;
    });
    document.getElementById('colorPreview').style.background = currentColor;

    document.getElementById('brushSize').addEventListener('input', (e) => {
      brushSize = parseInt(e.target.value);
      document.getElementById('brushSizeValue').textContent = brushSize;
    });

    document.getElementById('fontSize').addEventListener('input', (e) => {
      fontSize = parseInt(e.target.value);
    });

    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    document.getElementById('zoomInBtn').addEventListener('click', () => setZoom(zoom + 0.1));
    document.getElementById('zoomOutBtn').addEventListener('click', () => setZoom(zoom - 0.1));
    document.getElementById('zoomResetBtn').addEventListener('click', () => setZoom(1));

    document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
    document.getElementById('downloadBtn').addEventListener('click', downloadImage);
    document.getElementById('saveBtn').addEventListener('click', openSaveModal);

    document.getElementById('saveFormat').addEventListener('change', (e) => {
      const q = document.getElementById('saveQualityGroup');
      q.style.display = (e.target.value === 'jpeg' || e.target.value === 'webp') ? 'flex' : 'none';
    });

    document.getElementById('saveQuality').addEventListener('input', (e) => {
      document.getElementById('saveQualityValue').textContent = e.target.value;
    });

    document.getElementById('cancelSave').addEventListener('click', () => {
      document.getElementById('saveModal').classList.remove('open');
    });

    document.getElementById('confirmSave').addEventListener('click', saveWithSettings);
  }

  function setupCanvas() {
    overlayCanvas.addEventListener('mousedown', onMouseDown);
    overlayCanvas.addEventListener('mousemove', onMouseMove);
    overlayCanvas.addEventListener('mouseup', onMouseUp);
    overlayCanvas.addEventListener('mouseleave', onMouseUp);
    overlayCanvas.addEventListener('wheel', onWheel, { passive: false });
  }

  function updateCursor() {
    switch (currentTool) {
      case 'select':
        overlayCanvas.style.cursor = 'default';
        break;
      case 'pen':
      case 'highlighter':
        overlayCanvas.style.cursor = 'crosshair';
        break;
      case 'rectangle':
      case 'circle':
      case 'arrow':
      case 'line':
        overlayCanvas.style.cursor = 'crosshair';
        break;
      case 'text':
        overlayCanvas.style.cursor = 'text';
        break;
      case 'blur':
      case 'crop':
        overlayCanvas.style.cursor = 'crosshair';
        break;
      default:
        overlayCanvas.style.cursor = 'crosshair';
    }
  }

  function updateToolOptions() {
    const fontSizeControl = document.getElementById('fontSizeControl');
    fontSizeControl.style.display = currentTool === 'text' ? 'flex' : 'none';
  }

  function getCanvasCoords(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    };
  }

  function onMouseDown(e) {
    if (!currentImage) return;
    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;
    isDrawing = true;

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = mainCanvas.width;
      tempCanvas.height = mainCanvas.height;
      tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(mainCanvas, 0, 0);

      overlayCtx.beginPath();
      overlayCtx.moveTo(startX, startY);
      overlayCtx.strokeStyle = currentTool === 'highlighter'
        ? 'rgba(255, 255, 0, 0.35)' : currentColor;
      overlayCtx.lineWidth = currentTool === 'highlighter' ? brushSize * 4 : brushSize;
      overlayCtx.lineCap = 'round';
      overlayCtx.lineJoin = 'round';
    } else if (currentTool === 'text') {
      addTextAnnotation(coords.x, coords.y);
      isDrawing = false;
    } else if (currentTool === 'blur') {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = mainCanvas.width;
      tempCanvas.height = mainCanvas.height;
      tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(mainCanvas, 0, 0);
    }
  }

  function onMouseMove(e) {
    if (!isDrawing || !currentImage) return;
    const coords = getCanvasCoords(e);

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      overlayCtx.lineTo(coords.x, coords.y);
      overlayCtx.stroke();
    } else if (['rectangle', 'circle', 'arrow', 'line', 'blur', 'crop'].includes(currentTool)) {
      drawTempShape(coords.x, coords.y);
    }
  }

  function onMouseUp(e) {
    if (!isDrawing || !currentImage) return;
    isDrawing = false;
    const coords = getCanvasCoords(e);

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      mainCtx.drawImage(overlayCanvas, 0, 0);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      saveState();
    } else if (['rectangle', 'circle', 'arrow', 'line'].includes(currentTool)) {
      drawShape(mainCtx, startX, startY, coords.x, coords.y);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      saveState();
    } else if (currentTool === 'blur') {
      applyBlurRegion(coords.x, coords.y);
      saveState();
    } else if (currentTool === 'crop') {
      applyCrop(coords.x, coords.y);
    }

    tempCanvas = null;
    tempCtx = null;
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(zoom + delta);
  }

  function drawTempShape(endX, endY) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (currentTool === 'crop') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);

      overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlayCtx.clearRect(x, y, w, h);

      overlayCtx.strokeStyle = '#667eea';
      overlayCtx.lineWidth = 2 / zoom;
      overlayCtx.setLineDash([5 / zoom, 5 / zoom]);
      overlayCtx.strokeRect(x, y, w, h);
      overlayCtx.setLineDash([]);
    } else if (currentTool === 'blur') {
      if (tempCtx) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        overlayCtx.drawImage(tempCanvas, 0, 0);

        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);

        const imageData = overlayCtx.getImageData(x, y, w, h);
        const pixelSize = 8;
        for (let py = 0; py < h; py += pixelSize) {
          for (let px = 0; px < w; px += pixelSize) {
            const i = (py * w + px) * 4;
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            overlayCtx.fillStyle = `rgb(${r},${g},${b})`;
            overlayCtx.fillRect(x + px, y + py, pixelSize, pixelSize);
          }
        }
      }
    } else {
      drawShape(overlayCtx, startX, startY, endX, endY);
    }
  }

  function drawShape(ctx, x1, y1, x2, y2) {
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (currentTool) {
      case 'rectangle':
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        break;

      case 'circle':
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'arrow':
        drawArrow(ctx, x1, y1, x2, y2);
        break;

      case 'line':
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;
    }
  }

  function drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLength = 15 + brushSize * 2;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }

  function addTextAnnotation(x, y) {
    const text = prompt('Enter text:');
    if (!text) return;

    mainCtx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    mainCtx.fillStyle = currentColor;
    mainCtx.textBaseline = 'top';
    mainCtx.fillText(text, x, y);
    saveState();
  }

  function applyBlurRegion(endX, endY) {
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    if (w < 2 || h < 2) return;

    const imageData = mainCtx.getImageData(x, y, w, h);
    const pixelSize = 8;

    for (let py = 0; py < h; py += pixelSize) {
      for (let px = 0; px < w; px += pixelSize) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
          for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
            const i = ((py + dy) * w + (px + dx)) * 4;
            r += imageData.data[i];
            g += imageData.data[i + 1];
            b += imageData.data[i + 2];
            count++;
          }
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        mainCtx.fillStyle = `rgb(${r},${g},${b})`;
        mainCtx.fillRect(x + px, y + py, pixelSize, pixelSize);
      }
    }
  }

  function applyCrop(endX, endY) {
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    if (w < 10 || h < 10) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      return;
    }

    const imageData = mainCtx.getImageData(x, y, w, h);

    mainCanvas.width = w;
    mainCanvas.height = h;
    overlayCanvas.width = w;
    overlayCanvas.height = h;

    mainCtx.putImageData(imageData, 0, 0);
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    resizeCanvasWrapper();
    saveState();
  }

  function saveState() {
    historyIndex++;
    if (historyIndex < history.length) {
      history = history.slice(0, historyIndex);
    }

    const state = mainCanvas.toDataURL('image/png');
    history.push(state);

    if (history.length > MAX_HISTORY) {
      history.shift();
      historyIndex--;
    }

    updateHistoryButtons();
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restoreState(history[historyIndex]);
    updateHistoryButtons();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreState(history[historyIndex]);
    updateHistoryButtons();
  }

  function restoreState(dataUrl) {
    const img = new Image();
    img.onload = () => {
      mainCanvas.width = img.width;
      mainCanvas.height = img.height;
      overlayCanvas.width = img.width;
      overlayCanvas.height = img.height;
      mainCtx.drawImage(img, 0, 0);
      resizeCanvasWrapper();
    };
    img.src = dataUrl;
  }

  function updateHistoryButtons() {
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
    document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
  }

  function setZoom(newZoom) {
    zoom = Math.max(0.25, Math.min(3, newZoom));
    canvasWrapper.style.transform = `scale(${zoom})`;
    document.getElementById('zoomLevel').textContent = Math.round(zoom * 100) + '%';
  }

  function resizeCanvasWrapper() {
    canvasWrapper.style.width = mainCanvas.width + 'px';
    canvasWrapper.style.height = mainCanvas.height + 'px';
  }

  function loadImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      mainCanvas.width = img.width;
      mainCanvas.height = img.height;
      overlayCanvas.width = img.width;
      overlayCanvas.height = img.height;
      mainCtx.drawImage(img, 0, 0);
      emptyState.style.display = 'none';
      resizeCanvasWrapper();
      history = [];
      historyIndex = -1;
      saveState();
      fitToScreen();
    };
    img.src = dataUrl;
  }

  function fitToScreen() {
    const areaRect = canvasArea.getBoundingClientRect();
    const padding = 80;
    const maxW = areaRect.width - padding;
    const maxH = areaRect.height - padding;

    const scaleX = maxW / mainCanvas.width;
    const scaleY = maxH / mainCanvas.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);

    setZoom(fitZoom);
  }

  function copyToClipboard() {
    mainCanvas.toBlob((blob) => {
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item]).then(() => {
        showToast('Copied to clipboard!');
      }).catch(() => {
        showToast('Failed to copy', true);
      });
    });
  }

  function downloadImage() {
    const link = document.createElement('a');
    link.download = `screenshot_${Date.now()}.png`;
    link.href = mainCanvas.toDataURL('image/png');
    link.click();
    showToast('Downloaded!');
  }

  function openSaveModal() {
    document.getElementById('saveModal').classList.add('open');
  }

  function saveWithSettings() {
    const format = document.getElementById('saveFormat').value;
    const quality = parseInt(document.getElementById('saveQuality').value) / 100;
    const filename = document.getElementById('saveFilename').value || 'screenshot';

    const mimeType = format === 'jpeg' ? 'image/jpeg' :
                     format === 'webp' ? 'image/webp' : 'image/png';

    const dataUrl = mainCanvas.toDataURL(mimeType, quality);
    const link = document.createElement('a');
    link.download = `${filename}.${format}`;
    link.href = dataUrl;
    link.click();

    document.getElementById('saveModal').classList.remove('open');
    showToast(`Saved as ${format.toUpperCase()}!`);
  }

  function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 24px',
      background: isError ? '#ef4444' : 'rgba(22, 33, 62, 0.95)',
      color: '#fff',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '10000',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      animation: 'toastIn 0.2s ease-out'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); }
        else if (e.key === 'y') { e.preventDefault(); redo(); }
        else if (e.key === '=') { e.preventDefault(); setZoom(zoom + 0.1); }
        else if (e.key === '-') { e.preventDefault(); setZoom(zoom - 0.1); }
        else if (e.key === '0') { e.preventDefault(); setZoom(1); }
        else if (e.key === 's') { e.preventDefault(); openSaveModal(); }
        else if (e.key === 'c' && !window.getSelection().toString()) { e.preventDefault(); copyToClipboard(); }
      } else {
        switch (e.key) {
          case 'v': selectTool('select'); break;
          case 'p': selectTool('pen'); break;
          case 'r': selectTool('rectangle'); break;
          case 'c': selectTool('circle'); break;
          case 'a': selectTool('arrow'); break;
          case 'l': selectTool('line'); break;
          case 't': selectTool('text'); break;
          case 'h': selectTool('highlighter'); break;
          case 'b': selectTool('blur'); break;
          case 'x': selectTool('crop'); break;
        }
      }
    });
  }

  function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    updateCursor();
    updateToolOptions();
  }

  function loadSettings() {
    chrome.storage.local.get(['editorSettings'], (result) => {
      if (result.editorSettings) {
        currentColor = result.editorSettings.color || '#ef4444';
        brushSize = result.editorSettings.brushSize || 3;
        fontSize = result.editorSettings.fontSize || 24;

        document.getElementById('colorPicker').value = currentColor;
        document.getElementById('colorPreview').style.background = currentColor;
        document.getElementById('brushSize').value = brushSize;
        document.getElementById('brushSizeValue').textContent = brushSize;
        document.getElementById('fontSize').value = fontSize;
      }
    });
  }

  function saveEditorSettings() {
    chrome.storage.local.set({
      editorSettings: {
        color: currentColor,
        brushSize: brushSize,
        fontSize: fontSize
      }
    });
  }

  function checkForImageMessage() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'loadImage' && message.dataUrl) {
        loadImage(message.dataUrl);
        sendResponse({ success: true });
      }
      return true;
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('image')) {
      loadImage(decodeURIComponent(urlParams.get('image')));
    }
  }

  window.addEventListener('beforeunload', saveEditorSettings);

  init();
})();
