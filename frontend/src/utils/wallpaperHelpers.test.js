import assert from 'assert';
import { getDeviceWallpaperDimensions, getCompositionRules } from './wallpaperHelpers.js';

console.log('Running JIGZO Wallpaper Helper unit tests...');

// 1. Fallback for invalid / zero / missing dimensions
const fallback = getDeviceWallpaperDimensions();
assert.strictEqual(fallback.width, 1080);
assert.strictEqual(fallback.height, 1920);

const zeroDim = getDeviceWallpaperDimensions(0, 0);
assert.strictEqual(zeroDim.width, 1080);
assert.strictEqual(zeroDim.height, 1920);

const nanDim = getDeviceWallpaperDimensions(NaN, 'invalid');
assert.strictEqual(nanDim.width, 1080);
assert.strictEqual(nanDim.height, 1920);

const infDim = getDeviceWallpaperDimensions(Infinity, 300);
assert.strictEqual(infDim.width, 1080);
assert.strictEqual(infDim.height, 1920);

// 2. Standard 9:16 screen (e.g. 360 x 640)
const std916 = getDeviceWallpaperDimensions(360, 640);
assert.strictEqual(std916.width, 1080);
assert.strictEqual(std916.height, 1920);

// 3. Modern tall iPhone (e.g. 390 x 844)
// Ratio: 844 / 390 = 2.164 -> Target height: 1080 * 2.164 = 2337
const tallIphone = getDeviceWallpaperDimensions(390, 844);
assert.strictEqual(tallIphone.width, 1080);
assert.strictEqual(tallIphone.height, 2337);

// 4. Tall Android (e.g. 412 x 915)
// Ratio: 915 / 412 = 2.22 -> Target height: Math.round(1080 * 915 / 412) = 2399
const tallAndroid = getDeviceWallpaperDimensions(412, 915);
assert.strictEqual(tallAndroid.width, 1080);
assert.strictEqual(tallAndroid.height, 2399);

// 5. Landscape inputs normalized to portrait (e.g. 640 x 360)
const landscape = getDeviceWallpaperDimensions(640, 360);
assert.strictEqual(landscape.width, 1080);
assert.strictEqual(landscape.height, 1920);

// 6. Extreme short ratio clamped to 1620 (e.g. 3:4 screen, 300 x 400)
// Ratio: 400 / 300 = 1.33 -> Target height: 1080 * 1.33 = 1440 -> Clamp to 1620
const shortClamp = getDeviceWallpaperDimensions(300, 400);
assert.strictEqual(shortClamp.width, 1080);
assert.strictEqual(shortClamp.height, 1620);

// 7. Extreme tall ratio clamped to 2400 (e.g. 300 x 750)
// Ratio: 750 / 300 = 2.50 -> Target height: 1080 * 2.5 = 2700 -> Clamp to 2400
const tallClamp = getDeviceWallpaperDimensions(300, 750);
assert.strictEqual(tallClamp.width, 1080);
assert.strictEqual(tallClamp.height, 2400);

// 8. Verify preview/export composition parity and safe bounds
const rules = getCompositionRules(1080, 1920);
assert.ok(rules.topSafe >= 1920 * 0.15 && rules.topSafe <= 1920 * 0.20, 'Top safe area should be within 15-20%');
assert.ok(rules.bottomSafe >= 1920 * 0.15 && rules.bottomSafe <= 1920 * 0.20, 'Bottom safe area should be within 15-20%');
assert.strictEqual(rules.cx, 540);
assert.strictEqual(rules.cy, Math.round(1920 * 0.42));

console.log('All JIGZO Wallpaper Helper unit tests passed successfully!');
