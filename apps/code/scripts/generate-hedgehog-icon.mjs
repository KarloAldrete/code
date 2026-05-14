#!/usr/bin/env node
// Build a hedgehog app icon (PNG + ICO) from a source hedgehog sprite.
// macOS .icns is produced by the sibling generate-icns.sh script.

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPT_DIR, "..");
const BUILD_DIR = resolve(APP_DIR, "build");
const SOURCE_HOG = resolve(
  APP_DIR,
  "src/renderer/assets/images/hedgehogs/builder-hog-03.png",
);
const TMP_DIR = "/tmp/hog-icon";

const BG = { r: 0, g: 0, b: 0, a: 0 };
const CANVAS = 1024;
const HOG_FIT = 1000;
const DOCK_FRAME_SIZE = 256;
const DOCK_FRAME_HOG_FIT = 250;
const DOCK_FRAMES = [
  { name: "wave", source: "happy-hog.png" },
  { name: "build", source: "builder-hog-03.png" },
];

mkdirSync(TMP_DIR, { recursive: true });

function sipsResize(input, output, longEdge) {
  execSync(`sips -Z ${longEdge} "${input}" --out "${output}"`, {
    stdio: "ignore",
  });
}

function readPng(path) {
  return PNG.sync.read(readFileSync(path));
}

function writePng(path, png) {
  writeFileSync(path, PNG.sync.write(png));
}

function newCanvas(size, bg) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = bg.r;
    png.data[i + 1] = bg.g;
    png.data[i + 2] = bg.b;
    png.data[i + 3] = bg.a;
  }
  return png;
}

function compositeCentered(canvas, sprite) {
  const offX = Math.floor((canvas.width - sprite.width) / 2);
  const offY = Math.floor((canvas.height - sprite.height) / 2);
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const si = (sprite.width * y + x) * 4;
      const sa = sprite.data[si + 3] / 255;
      if (sa === 0) continue;
      const dx = x + offX;
      const dy = y + offY;
      const di = (canvas.width * dy + dx) * 4;
      const da = canvas.data[di + 3] / 255;
      const outA = sa + da * (1 - sa);
      if (outA === 0) continue;
      canvas.data[di] =
        (sprite.data[si] * sa + canvas.data[di] * da * (1 - sa)) / outA;
      canvas.data[di + 1] =
        (sprite.data[si + 1] * sa + canvas.data[di + 1] * da * (1 - sa)) /
        outA;
      canvas.data[di + 2] =
        (sprite.data[si + 2] * sa + canvas.data[di + 2] * da * (1 - sa)) /
        outA;
      canvas.data[di + 3] = Math.round(outA * 255);
    }
  }
}

function buildIco(sourcePng, sizes, outPath) {
  const pngs = sizes.map((size) => {
    const tmp = `${TMP_DIR}/ico-${size}.png`;
    sipsResize(sourcePng, tmp, size);
    return { size, data: readFileSync(tmp) };
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries = Buffer.alloc(16 * pngs.length);
  let offset = 6 + 16 * pngs.length;
  for (let i = 0; i < pngs.length; i++) {
    const { size, data } = pngs[i];
    const base = i * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, base);
    entries.writeUInt8(size >= 256 ? 0 : size, base + 1);
    entries.writeUInt8(0, base + 2);
    entries.writeUInt8(0, base + 3);
    entries.writeUInt16LE(1, base + 4);
    entries.writeUInt16LE(32, base + 6);
    entries.writeUInt32LE(data.length, base + 8);
    entries.writeUInt32LE(offset, base + 12);
    offset += data.length;
  }

  writeFileSync(
    outPath,
    Buffer.concat([header, entries, ...pngs.map((p) => p.data)]),
  );
}

const HOG_RESIZED = `${TMP_DIR}/hog-fit.png`;
sipsResize(SOURCE_HOG, HOG_RESIZED, HOG_FIT);

const canvas = newCanvas(CANVAS, BG);
const sprite = readPng(HOG_RESIZED);
compositeCentered(canvas, sprite);

const MAIN_PNG = resolve(BUILD_DIR, "app-icon.png");
writePng(MAIN_PNG, canvas);
console.log(`✓ Wrote ${MAIN_PNG}`);

writePng(resolve(BUILD_DIR, "logo.png"), canvas);
writePng(resolve(BUILD_DIR, "icon.icon/Assets/logo.png"), canvas);
console.log("✓ Wrote logo.png + icon.icon/Assets/logo.png");

const ICON_3X = resolve(BUILD_DIR, "icon@3x.png");
sipsResize(MAIN_PNG, ICON_3X, 3072);
console.log(`✓ Wrote ${ICON_3X}`);

buildIco(MAIN_PNG, [16, 32, 48, 64, 128, 256], resolve(BUILD_DIR, "app-icon.ico"));
console.log("✓ Wrote app-icon.ico");

const FRAMES_DIR = resolve(BUILD_DIR, "dock-frames");
mkdirSync(FRAMES_DIR, { recursive: true });
for (const frame of DOCK_FRAMES) {
  const src = resolve(
    APP_DIR,
    `src/renderer/assets/images/hedgehogs/${frame.source}`,
  );
  const resized = `${TMP_DIR}/frame-${frame.name}-fit.png`;
  sipsResize(src, resized, DOCK_FRAME_HOG_FIT);
  const frameCanvas = newCanvas(DOCK_FRAME_SIZE, BG);
  compositeCentered(frameCanvas, readPng(resized));
  const outPath = resolve(FRAMES_DIR, `${frame.name}.png`);
  writePng(outPath, frameCanvas);
  console.log(`✓ Wrote ${outPath}`);
}
