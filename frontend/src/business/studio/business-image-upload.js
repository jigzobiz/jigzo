export const BUSINESS_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const BUSINESS_IMAGE_TARGET_BYTES = Math.floor(1.5 * 1024 * 1024);
export const BUSINESS_IMAGE_MAX_DIMENSION = 1600;

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

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Could not prepare image.')),
    type,
    quality
  ));
}

function hasMeaningfulTransparency(context, width, height) {
  const pixels = context.getImageData(0, 0, width, height).data;
  const threshold = Math.max(16, Math.floor((pixels.length / 4) * 0.001));
  let transparent = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 250 && ++transparent >= threshold) return true;
  }
  return false;
}

export async function prepareBusinessImage(file, adapters = {}) {
  const startedAt = performance.now();
  const imageLoader = adapters.loadImage || loadImage;
  const canvasFactory = adapters.createCanvas || (() => document.createElement('canvas'));
  const dataUrlReader = adapters.readDataUrl || readDataUrl;
  if (!SUPPORTED_TYPES.has(file?.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  const image = await imageLoader(file);
  const before = { width: image.naturalWidth, height: image.naturalHeight };
  if (!before.width || !before.height) throw new Error('Could not read image dimensions.');
  let scale = businessImageScale(image.naturalWidth, image.naturalHeight);
  if (scale === 1 && file.size <= BUSINESS_IMAGE_TARGET_BYTES) {
    return { blob: file, previewUrl: await dataUrlReader(file), before, after: before, durationMs: performance.now() - startedAt };
  }

  let quality = 0.82;
  let preserveTransparency = false;

  for (let attempt = 0; attempt < 9; attempt += 1) {
    const canvas = canvasFactory();
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare image.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (attempt === 0 && file.type === 'image/png') preserveTransparency = hasMeaningfulTransparency(context, canvas.width, canvas.height);
    const outputType = preserveTransparency ? 'image/png' : 'image/webp';
    let blob = await canvasBlob(canvas, outputType, preserveTransparency ? undefined : quality);
    if (!preserveTransparency && blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', quality);
    if (blob.size <= BUSINESS_IMAGE_TARGET_BYTES && blob.size <= BUSINESS_IMAGE_MAX_BYTES) {
      return {
        blob,
        previewUrl: await dataUrlReader(blob),
        before,
        after: { width: canvas.width, height: canvas.height },
        durationMs: performance.now() - startedAt
      };
    }
    scale *= preserveTransparency ? 0.78 : 0.86;
    quality = Math.max(0.66, quality - 0.04);
  }

  throw new Error('Could not optimize this image below the safe 1.5 MB upload size. Choose a smaller image.');
}
