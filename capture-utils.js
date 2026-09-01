const CaptureUtils = {
  cropRegion(imageData, rect, devicePixelRatio = 1) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
          img,
          rect.left / devicePixelRatio,
          rect.top / devicePixelRatio,
          rect.width / devicePixelRatio,
          rect.height / devicePixelRatio,
          0,
          0,
          rect.width,
          rect.height
        );

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = imageData;
    });
  },

  cropRegionAbsolute(imageData, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
          img,
          rect.left,
          rect.top,
          rect.width,
          rect.height,
          0,
          0,
          rect.width,
          rect.height
        );

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = imageData;
    });
  },

  convertFormat(dataUrl, format, quality = 0.92) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const mimeType = format === 'jpeg' ? 'image/jpeg' :
                         format === 'webp' ? 'image/webp' : 'image/png';
        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  resizeImage(dataUrl, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  getImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          element: img
        });
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then(res => res.blob());
  },

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  createThumbnail(dataUrl, maxSize = 120) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  addWatermark(dataUrl, text = 'SnapShot Pro', position = 'bottom-right') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        const fontSize = Math.max(14, Math.min(img.width / 40, 32));
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;

        const metrics = ctx.measureText(text);
        const padding = fontSize;

        let x, y;
        switch (position) {
          case 'top-left':
            x = padding;
            y = padding + fontSize;
            break;
          case 'top-right':
            x = img.width - metrics.width - padding;
            y = padding + fontSize;
            break;
          case 'bottom-left':
            x = padding;
            y = img.height - padding;
            break;
          case 'bottom-right':
          default:
            x = img.width - metrics.width - padding;
            y = img.height - padding;
            break;
        }

        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  applyBrightness(dataUrl, amount) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, data[i] + amount));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + amount));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + amount));
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  applyGrayscale(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  generateFilename(prefix = 'screenshot', format = 'png') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}_${timestamp}.${format}`;
  },

  downloadDataUrl(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async copyToClipboard(dataUrl) {
    try {
      const blob = await fetch(dataUrl).then(res => res.blob());
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaptureUtils;
}
