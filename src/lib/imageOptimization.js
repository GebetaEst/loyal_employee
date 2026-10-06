/**
 * Image Optimization Utility for Receipts and Proof of Payment
 *
 * Slashes image upload payload by ~70-90% before uploading to backend / Cloudinary.
 * Complies with backend requirements: WebP format, quality 0.8, max dimension 1600px.
 */

/**
 * Validates that the selected file is a valid image under 10MB
 * @param {File|Blob} file 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateReceiptImage(file) {
  if (!file) {
    return { valid: false, error: 'No image file selected.' };
  }

  // Check MIME type
  if (!file.type || !file.type.startsWith('image/')) {
    return { valid: false, error: 'Please select a valid image (JPEG, PNG, WebP, etc.).' };
  }

  // Check 10MB size limit
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'Please select a valid image under 10MB.' };
  }

  return { valid: true };
}

/**
 * Formats bytes to human-readable size string
 * @param {number} bytes 
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Browser-side WebP converter (Client-side HTML5 Canvas alternative to sharp.js)
 * 
 * @param {File|Blob} file - Original image file from camera or file input
 * @param {number} maxDimension - Max width/height in px (default 1600)
 * @param {number} quality - WebP compression quality 0.0 - 1.0 (default 0.8)
 * @returns {Promise<File>} - Optimized WebP File object ('receipt.webp')
 */
export function convertBrowserFileToWebP(file, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided for conversion'));
    }

    const validation = validateReceiptImage(file);
    if (!validation.valid) {
      return reject(new Error(validation.error));
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
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
          return reject(new Error('Canvas context initialization failed'));
        }

        // Draw image resized on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('WebP conversion failed in browser canvas'));
            }

            const webpFile = new File([blob], 'receipt.webp', {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read image source. Please try another image.'));
    };

    img.src = objectUrl;
  });
}
