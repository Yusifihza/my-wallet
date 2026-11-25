export interface CompressedImageResult {
  base64: string;
  mimeType: 'image/jpeg';
  previewDataUrl: string;
  width: number;
  height: number;
}

/**
 * Compresses and resizes a receipt image in the browser using Canvas so that
 * camera photos (3-8 MB) become crisp ~60-120 KB JPEGs ideal for fast Gemini Vision OCR
 * even on slower 3G/4G connections.
 */
export function compressReceiptImage(
  file: File,
  maxDimension = 1024,
  quality = 0.76
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia di browser ini.'));
          return;
        }
        // White background so transparent PNG screenshots stay high-contrast
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const previewDataUrl = canvas.toDataURL('image/jpeg', quality);
        const commaIdx = previewDataUrl.indexOf(',');
        const base64 = commaIdx >= 0 ? previewDataUrl.slice(commaIdx + 1) : previewDataUrl;

        resolve({
          base64,
          mimeType: 'image/jpeg',
          previewDataUrl,
          width,
          height,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
