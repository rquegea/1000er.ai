/**
 * Compress an image file client-side using canvas resize + JPEG re-encode.
 * Skips files < 500KB or already within dimension bounds.
 * Only returns compressed version if it's actually smaller.
 */
export async function compressImage(
  file: File,
  maxDimension = 1920,
  quality = 0.85
): Promise<File> {
  // Skip small files
  if (file.size < 500 * 1024) return file;

  // Only process image types
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { width, height } = img;

      // Skip if already within bounds
      if (Math.max(width, height) <= maxDimension) {
        resolve(file);
        return;
      }

      // Calculate new dimensions maintaining aspect ratio
      const ratio = maxDimension / Math.max(width, height);
      const newWidth = Math.round(width * ratio);
      const newHeight = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compressed is larger — keep original
            resolve(file);
            return;
          }

          const compressed = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
