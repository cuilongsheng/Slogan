import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRequire = createRequire(path.join(projectRoot, 'apps/mobile/package.json'));
const expoRequire = createRequire(mobileRequire.resolve('expo/package.json'));
const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'));
const { generateImageAsync, generateImageBackgroundAsync, compositeImagesAsync, getPngInfo } =
  cliRequire('@expo/image-utils');
const brandRoot = path.join(projectRoot, 'assets/brand');
const source = path.join(brandRoot, 'slogan-logo.png');

// Preserve the original artwork; only resize and center it for Android's masks.
async function icon(name, logoSize, backgroundColor) {
  const logo = await generateImageAsync(
    { projectRoot, cacheType: 'slogan-android-icons' },
    { src: source, width: logoSize, height: logoSize, resizeMode: 'contain' },
  );
  const background = await generateImageBackgroundAsync({
    width: 1024,
    height: 1024,
    resizeMode: 'contain',
    backgroundColor,
  });
  const result = await compositeImagesAsync({
    foreground: logo.source,
    background,
    x: (1024 - logoSize) / 2,
    y: (1024 - logoSize) / 2,
  });
  await writeFile(path.join(brandRoot, name), result);
}

await mkdir(brandRoot, { recursive: true });
await icon('android-icon.png', 850, '#FFFFFF');
await icon('android-adaptive-foreground.png', 512, 'transparent');

// Android guarantees a centered 66 dp circle inside the 108 dp foreground layer.
const foreground = await getPngInfo(path.join(brandRoot, 'android-adaptive-foreground.png'));
let radius = 0;
for (let y = 0; y < foreground.height; y++) {
  for (let x = 0; x < foreground.width; x++) {
    if (foreground.data[(y * foreground.width + x) * 4 + 3] > 0) {
      radius = Math.max(radius, Math.hypot(x + 0.5 - 512, y + 0.5 - 512));
    }
  }
}
if (radius > (1024 * 66) / 108 / 2) {
  throw new Error('Android adaptive foreground exceeds the guaranteed circular safe zone');
}
console.log(
  `Generated Slogan Android icons; foreground radius ${radius.toFixed(1)} px fits safe zone.`,
);
