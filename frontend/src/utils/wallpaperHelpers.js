/**
 * Pure helper to calculate device-ratio wallpaper dimensions.
 */
export function getDeviceWallpaperDimensions(screenWidth, screenHeight) {
  const defaultW = 1080;
  const defaultH = 1920;

  const parsedW = Number(screenWidth);
  const parsedH = Number(screenHeight);

  if (
    isNaN(parsedW) ||
    isNaN(parsedH) ||
    !isFinite(parsedW) ||
    !isFinite(parsedH) ||
    parsedW <= 0 ||
    parsedH <= 0
  ) {
    return { width: defaultW, height: defaultH };
  }

  const w = Math.min(parsedW, parsedH);
  const h = Math.max(parsedW, parsedH);

  let height = Math.round((defaultW * h) / w);
  if (isNaN(height) || !isFinite(height)) {
    return { width: defaultW, height: defaultH };
  }

  // Clamp height between 1620 and 2400
  if (height < 1620) {
    height = 1620;
  } else if (height > 2400) {
    height = 2400;
  }

  return { width: defaultW, height };
}

/**
 * Shared composition rules for rendering wallpaper components.
 */
export function getCompositionRules(width, height) {
  const S = width / 340; // Scale factor based on baseline 340px card width

  // Proportional safe areas
  const topSafe = Math.round(height * 0.18);
  const bottomSafe = Math.round(height * 0.18);
  const horizontalPadding = Math.round(width * 0.10);

  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.42);
  const R = Math.round(Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) * 1.02);

  return {
    S,
    topSafe,
    bottomSafe,
    horizontalPadding,
    contentW: width - 2 * horizontalPadding,
    cx,
    cy,
    R,
    recipient: {
      fontSize: 12.5 * S,
      lineHeight: 12.5 * S * 1.3,
      gap: 18 * S
    },
    message: {
      fontSize: 20 * S,
      lineHeight: 20 * S * 1.32,
      gap: 18 * S
    },
    separator: {
      height: 2 * S,
      width: 44 * S,
      gap: 14 * S
    },
    sender: {
      fontSize: 11.5 * S,
      lineHeight: 11.5 * S * 1.3
    }
  };
}
