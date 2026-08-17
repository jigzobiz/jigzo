export const BUSINESS_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const BUSINESS_IMAGE_MAX_DIMENSION = 2048;

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function businessImageScale(width, height, maxDimension = BUSINESS_IMAGE_MAX_DIMENSION) {
  const longest = Math.max(width, height);
  return longest > maxDimension ? maxDimension / longest : 1;
}

function readDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image.')); };
    image.src = url;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Could not prepare image.')),
    'image/jpeg',
    quality
  ));
}

export async function prepareBusinessImage(file) {
  if (!SUPPORTED_TYPES.has(file?.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size <= BUSINESS_IMAGE_MAX_BYTES) return { blob: file, previewUrl: await readDataUrl(file) };

  const image = await loadImage(file);
  let scale = businessImageScale(image.naturalWidth, image.naturalHeight);
  let quality = 0.9;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare image.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= BUSINESS_IMAGE_MAX_BYTES) return { blob, previewUrl: await readDataUrl(blob) };
    scale *= 0.82;
    quality = Math.max(0.68, quality - 0.06);
  }

  throw new Error('Image is too large to upload.');
}
