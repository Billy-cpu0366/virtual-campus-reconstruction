#!/usr/bin/env node
// capture-public-build.mjs
// Deterministic capture of the approved public map URLs from
// https://peteroravec.com into sample/original-public-build/mirror/.
// Only the exact URL paths listed below are requested; nothing else is
// fetched, guessed, or written outside the mirror and the three manifests.
// Batch 1: 6 map JSON whitelist entries. Batch 2: 19 tileset assets
// (png/webp/tsx) referenced by the mirrored map JSONs. Batch 3: the
// tileset PNG referenced by the mirrored TSX. Batch 4: the site root
// HTML only, uniquely mapped to mirror/index.html; no sub-resources.
// Batch 5: 47 same-origin resources directly declared by the root HTML.
// Batch 6: 12 same-origin url(...) resources referenced by the mirrored
// styles-DVTBSD34.css (card foil/pattern, sparkles, cable-handler,
// cables3, monitor). CSS data URLs are inline content and never fetched.
// Batch 7: 14 same-origin resources referenced by explicit string
// literals in the mirrored main-RV3Z53H4.js (lazy game chunks, hover-tilt
// script, under-the-hood debug/tiled images, card foil/pattern variants,
// portfolio screenshots, mini-map). Phaser vendor, source maps and
// dynamic/concatenated paths are never requested.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://peteroravec.com';
const URL_PATHS = [
  // Batch 1: map JSON whitelist.
  '/assets/maps/final_map.json',
  '/assets/maps/final_map_small.json',
  '/assets/maps/walls-layer.json',
  '/assets/maps/footsteps-layer.json',
  '/assets/maps/particle-trajectories.json',
  '/assets/maps/chunks/master.json',
  // Batch 2: tileset assets referenced by the mirrored map JSONs.
  '/assets/maps/exterior.png',
  '/assets/maps/collisions-objects.png',
  '/assets/maps/tileset-particles.tsx',
  '/assets/maps/exterior-small.webp',
  '/assets/maps/exterior-small-2.webp',
  '/assets/maps/exterior-small-3.webp',
  '/assets/maps/exterior-small-4.webp',
  '/assets/maps/exterior-small-5.webp',
  '/assets/maps/exterior-small-6.webp',
  '/assets/maps/exterior-small-7.webp',
  '/assets/maps/exterior-small-8.webp',
  '/assets/maps/exterior-small-9.webp',
  '/assets/maps/exterior-small-10.webp',
  '/assets/maps/exterior-small-11.webp',
  '/assets/maps/exterior-small-12.webp',
  '/assets/maps/exterior-small-13.webp',
  '/assets/maps/exterior-small-14.webp',
  '/assets/maps/exterior-small-15.webp',
  '/assets/maps/exterior-small-16.webp',
  // Batch 3: tileset image referenced by the mirrored tileset-particles.tsx.
  '/assets/maps/tileset-particles.png',
  // Batch 5: same-origin resources directly declared by the mirrored root
  // HTML (card images, favicons, logos, og-image, UI assets, JS/CSS
  // bundles, big-map). External hosts are never requested.
  '/assets/images/cards/card1_base.webp',
  '/assets/images/cards/card2_base.webp',
  '/assets/images/cards/card3_base.webp',
  '/assets/images/cards/card4_base.webp',
  '/assets/images/cards/card5_base.webp',
  '/assets/images/cards/card6_base.webp',
  '/assets/images/favicon/apple-touch-icon-114x114.png',
  '/assets/images/favicon/apple-touch-icon-120x120.png',
  '/assets/images/favicon/apple-touch-icon-144x144.png',
  '/assets/images/favicon/apple-touch-icon-152x152.png',
  '/assets/images/favicon/apple-touch-icon-57x57.png',
  '/assets/images/favicon/apple-touch-icon-60x60.png',
  '/assets/images/favicon/apple-touch-icon-72x72.png',
  '/assets/images/favicon/apple-touch-icon-76x76.png',
  '/assets/images/favicon/favicon-128.png',
  '/assets/images/favicon/favicon-16x16.png',
  '/assets/images/favicon/favicon-196x196.png',
  '/assets/images/favicon/favicon-32x32.png',
  '/assets/images/favicon/favicon-96x96.png',
  '/assets/images/favicon/favicon.ico',
  '/assets/images/favicon/mstile-144x144.png',
  '/assets/images/favicon/mstile-150x150.png',
  '/assets/images/favicon/mstile-310x150.png',
  '/assets/images/favicon/mstile-310x310.png',
  '/assets/images/favicon/mstile-70x70.png',
  '/assets/images/logos/cv-bethereum.webp',
  '/assets/images/logos/cv-gamo.webp',
  '/assets/images/logos/cv-kremsa.webp',
  '/assets/images/logos/cv-scr.webp',
  '/assets/images/logos/cv-vub.webp',
  '/assets/images/logos/dev-angular.webp',
  '/assets/images/logos/dev-expressjs.webp',
  '/assets/images/logos/dev-javascript.webp',
  '/assets/images/logos/dev-nodejs.webp',
  '/assets/images/og-image.png',
  '/assets/images/peter-oravec.gif',
  '/assets/images/peter-oravec.webp',
  '/assets/images/peteroravec-logo.webp',
  '/assets/images/ui/pointer-hand.webp',
  '/assets/images/ui/rotate-device.svg',
  '/assets/js/phaser.min.js',
  '/assets/maps/big-map.webp',
  '/chunk-JI7HG47Y.js',
  '/chunk-RA2FASQA.js',
  '/main-RV3Z53H4.js',
  '/polyfills-A7F7OIKC.js',
  '/styles-DVTBSD34.css',
  // Batch 6: same-origin url(...) resources referenced by the mirrored
  // CSS (styles-DVTBSD34.css); data URLs inside the CSS are inline and
  // never requested.
  '/assets/images/cards/card1_foil.webp',
  '/assets/images/cards/card1_pattern.webp',
  '/assets/images/cards/card4_foil.webp',
  '/assets/images/cards/card4_pattern.webp',
  '/assets/images/cards/card5_foil.webp',
  '/assets/images/cards/card5_pattern.webp',
  '/assets/images/cards/card6_foil.webp',
  '/assets/images/cards/card6_pattern.webp',
  '/assets/images/cards/sparkles.webp',
  '/assets/images/ui/cable-handler.webp',
  '/assets/images/ui/cables3.png',
  '/assets/images/ui/monitor.webp',
  // Batch 7: same-origin resources referenced by explicit literals in
  // the mirrored main-RV3Z53H4.js.
  '/chunk-WMFY56ZM.js',
  '/chunk-VANY4YOC.js',
  '/assets/js/hover-tilt.min.js',
  '/assets/images/under-the-hood/debug1.webp',
  '/assets/images/under-the-hood/debug2.webp',
  '/assets/images/under-the-hood/tiled1.webp',
  '/assets/images/under-the-hood/tiled2.webp',
  '/assets/images/cards/card2_pattern.webp',
  '/assets/images/cards/card2_foil.webp',
  '/assets/images/cards/card3_pattern.webp',
  '/assets/images/portfolio/portfolio-eutxo.webp',
  '/assets/images/portfolio/portfolio-angularsk.webp',
  '/assets/images/portfolio/peteroravec-v1.webp',
  '/assets/maps/mini-map.webp',
  // Batch 8: 141 exact static resources referenced by explicit
  // string literals in the mirrored chunk-WMFY56ZM.js (maps, sprites,
  // cars, NPCs, UI, logos). The dynamic template prefix /assets/maps/
  // is excluded; no path is guessed, no map tiles or source maps are
  // requested. Sorted for determinism.
  '/assets/images/logos/dev-css.webp',
  '/assets/images/logos/dev-lotus-notes.webp',
  '/assets/images/logos/dev-php.webp',
  '/assets/images/logos/dev-wordpress.webp',
  '/assets/images/ui/instructions-keyboard.webp',
  '/assets/images/ui/joystick-ball.webp',
  '/assets/images/ui/joystick-base.webp',
  '/assets/maps/collisions-objects.webp',
  '/assets/maps/exterior-final.webp',
  '/assets/maps/full-map.webp',
  '/assets/maps/tileset-particles.webp',
  '/assets/sprites/ai-transparent.webp',
  '/assets/sprites/ai-transparent2.webp',
  '/assets/sprites/bird.webp',
  '/assets/sprites/butterfly.webp',
  '/assets/sprites/car-holding.webp',
  '/assets/sprites/cars/car-police-brakes-side.webp',
  '/assets/sprites/cars/car-police-brakes.webp',
  '/assets/sprites/cars/car-police-wheel.webp',
  '/assets/sprites/cars/car-police.webp',
  '/assets/sprites/cars/car1-brakes-side.webp',
  '/assets/sprites/cars/car1-brakes.webp',
  '/assets/sprites/cars/car1-wheel.webp',
  '/assets/sprites/cars/car1.webp',
  '/assets/sprites/cars/car10-brakes-side.webp',
  '/assets/sprites/cars/car10-brakes.webp',
  '/assets/sprites/cars/car10-wheel.webp',
  '/assets/sprites/cars/car10.webp',
  '/assets/sprites/cars/car11-brakes-side.webp',
  '/assets/sprites/cars/car11-brakes.webp',
  '/assets/sprites/cars/car11-wheel.webp',
  '/assets/sprites/cars/car11.webp',
  '/assets/sprites/cars/car2-brakes-side.webp',
  '/assets/sprites/cars/car2-brakes.webp',
  '/assets/sprites/cars/car2-wheel.webp',
  '/assets/sprites/cars/car2.webp',
  '/assets/sprites/cars/car3-brakes-side.webp',
  '/assets/sprites/cars/car3-brakes.webp',
  '/assets/sprites/cars/car3-wheel.webp',
  '/assets/sprites/cars/car3.webp',
  '/assets/sprites/cars/car4-brakes.webp',
  '/assets/sprites/cars/car4-wheel.webp',
  '/assets/sprites/cars/car4.webp',
  '/assets/sprites/cars/car5-brakes-side.webp',
  '/assets/sprites/cars/car5-brakes.webp',
  '/assets/sprites/cars/car5-wheel.webp',
  '/assets/sprites/cars/car5.webp',
  '/assets/sprites/cars/car6-brakes-side.webp',
  '/assets/sprites/cars/car6-brakes.webp',
  '/assets/sprites/cars/car6-wheel.webp',
  '/assets/sprites/cars/car6.webp',
  '/assets/sprites/cars/car7-brakes-side.webp',
  '/assets/sprites/cars/car7-brakes.webp',
  '/assets/sprites/cars/car7-wheel.webp',
  '/assets/sprites/cars/car7.webp',
  '/assets/sprites/cars/car8-brakes-side.webp',
  '/assets/sprites/cars/car8-brakes.webp',
  '/assets/sprites/cars/car8-wheel.webp',
  '/assets/sprites/cars/car8.webp',
  '/assets/sprites/cars/car9-brakes-side.webp',
  '/assets/sprites/cars/car9-brakes.webp',
  '/assets/sprites/cars/car9-wheel.webp',
  '/assets/sprites/cars/car9.webp',
  '/assets/sprites/cloud.webp',
  '/assets/sprites/cloud2.webp',
  '/assets/sprites/duck.webp',
  '/assets/sprites/fish.webp',
  '/assets/sprites/flares.webp',
  '/assets/sprites/lizard.webp',
  '/assets/sprites/npc-bug.webp',
  '/assets/sprites/npc-bug2.webp',
  '/assets/sprites/npc-cat.webp',
  '/assets/sprites/npc-cat2.webp',
  '/assets/sprites/npc-dj1.webp',
  '/assets/sprites/npc-dj2.webp',
  '/assets/sprites/npc-dog.webp',
  '/assets/sprites/npc-dog2.webp',
  '/assets/sprites/npc-ghost.webp',
  '/assets/sprites/npc-hazmat-suit.webp',
  '/assets/sprites/npc-helicopter-high-resolution.webp',
  '/assets/sprites/npc-helicopter-rotor-back.webp',
  '/assets/sprites/npc-helicopter-rotor-main.webp',
  '/assets/sprites/npc-helicopter.webp',
  '/assets/sprites/npc-holding.webp',
  '/assets/sprites/npc-man-beach.webp',
  '/assets/sprites/npc-man-beach2.webp',
  '/assets/sprites/npc-man.webp',
  '/assets/sprites/npc-man10.webp',
  '/assets/sprites/npc-man2.webp',
  '/assets/sprites/npc-man3.webp',
  '/assets/sprites/npc-man4.webp',
  '/assets/sprites/npc-man5.webp',
  '/assets/sprites/npc-man6.webp',
  '/assets/sprites/npc-man7.webp',
  '/assets/sprites/npc-man8.webp',
  '/assets/sprites/npc-man9.webp',
  '/assets/sprites/npc-monk.webp',
  '/assets/sprites/npc-scientist.webp',
  '/assets/sprites/npc-scientist2.webp',
  '/assets/sprites/npc-sprayer-running.webp',
  '/assets/sprites/npc-sprayer.webp',
  '/assets/sprites/npc-woman-beach.webp',
  '/assets/sprites/npc-woman-beach2.webp',
  '/assets/sprites/npc-woman.webp',
  '/assets/sprites/npc-woman2.webp',
  '/assets/sprites/npc-woman3.webp',
  '/assets/sprites/npc-woman4.webp',
  '/assets/sprites/npc-woman5-idle.webp',
  '/assets/sprites/npc-woman5.webp',
  '/assets/sprites/npc-woman6.webp',
  '/assets/sprites/npc-woman7.webp',
  '/assets/sprites/npc-woman8.webp',
  '/assets/sprites/npc_footballer_blue.webp',
  '/assets/sprites/npc_footballer_red.webp',
  '/assets/sprites/npc_protester_rising.webp',
  '/assets/sprites/player-beach.webp',
  '/assets/sprites/player-clothes-off.webp',
  '/assets/sprites/player-eating.webp',
  '/assets/sprites/player-holding.webp',
  '/assets/sprites/player-scratching.webp',
  '/assets/sprites/player-sitting.webp',
  '/assets/sprites/player-tying-shoe.webp',
  '/assets/sprites/player.webp',
  '/assets/sprites/rabbit.webp',
  '/assets/sprites/rat.webp',
  '/assets/sprites/smoke-blue.webp',
  '/assets/sprites/smoke-green.webp',
  '/assets/sprites/smoke-white.webp',
  '/assets/sprites/snake.webp',
  '/assets/sprites/special/npc-cat-licking.webp',
  '/assets/sprites/special/npc-dancing-down.webp',
  '/assets/sprites/special/npc-dancing-left.webp',
  '/assets/sprites/special/npc-dancing-right.webp',
  '/assets/sprites/special/npc-dancing-up.webp',
  '/assets/sprites/special/npc-special-eating.webp',
  '/assets/sprites/special/npc-special-reading.webp',
  '/assets/sprites/sunburn.png',
  '/assets/sprites/train.webp',
  '/assets/sprites/vortex.png',
  '/assets/sprites/waves.webp',
  '/assets/sprites/windturbine.webp',
  // Batch 9: 27 real runtime responses not yet mirrored, taken from the
  // isolated Chrome/CDP runtime Network capture (navigation, ready, play,
  // four-direction movement). All are same-origin, HTTP 200, no query
  // string. Netlify RUM, external hosts and any path absent from the
  // runtime trace are never requested. Sorted for determinism.
  '/assets/images/ui/cable-handler2.webp',
  '/assets/images/ui/map-holder-mini3.webp',
  '/assets/maps/chunks/chunk0.json',
  '/assets/maps/chunks/chunk1.json',
  '/assets/maps/chunks/chunk10.json',
  '/assets/maps/chunks/chunk11.json',
  '/assets/maps/chunks/chunk12.json',
  '/assets/maps/chunks/chunk13.json',
  '/assets/maps/chunks/chunk14.json',
  '/assets/maps/chunks/chunk15.json',
  '/assets/maps/chunks/chunk16.json',
  '/assets/maps/chunks/chunk17.json',
  '/assets/maps/chunks/chunk18.json',
  '/assets/maps/chunks/chunk19.json',
  '/assets/maps/chunks/chunk2.json',
  '/assets/maps/chunks/chunk20.json',
  '/assets/maps/chunks/chunk21.json',
  '/assets/maps/chunks/chunk22.json',
  '/assets/maps/chunks/chunk23.json',
  '/assets/maps/chunks/chunk24.json',
  '/assets/maps/chunks/chunk3.json',
  '/assets/maps/chunks/chunk4.json',
  '/assets/maps/chunks/chunk5.json',
  '/assets/maps/chunks/chunk6.json',
  '/assets/maps/chunks/chunk7.json',
  '/assets/maps/chunks/chunk8.json',
  '/assets/maps/chunks/chunk9.json',
];

// Snapshot protection: by default the existing manifests are authoritative.
// URLs that already succeeded and whose local mirror file exists are never
// re-requested or rewritten, and their manifest/resource-index metadata is
// carried over unchanged. URLs already recorded in unavailable.json are
// likewise never re-requested; their existing request and unavailable
// metadata are carried into the output unchanged. Only new paths, locally
// missing successes, and explicitly refreshed entries are fetched. Pass
// --refresh to re-request every entry (including previously failed URLs).

// Batch 4: the original site root page. This is the single explicit root
// whitelist entry: '/' is uniquely mapped to mirror/index.html. No CSS,
// JS, font, icon, or Netlify resource referenced by the HTML is requested.
const ROOT_PAGE = {
  urlPath: '/',
  localRel: 'index.html',
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_ROOT = path.resolve(HERE, '..');
const BUILD_DIR = path.join(SAMPLE_ROOT, 'original-public-build');
const MIRROR_DIR = path.join(BUILD_DIR, 'mirror');
const MANIFEST_FILE = path.join(BUILD_DIR, 'manifest.json');
const RESOURCE_INDEX_FILE = path.join(BUILD_DIR, 'network', 'resource-index.json');
const UNAVAILABLE_FILE = path.join(BUILD_DIR, 'network', 'unavailable.json');

const REQUEST_TIMEOUT_MS = 30000;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: '*/*',
};

// Map a root-relative URL path to a mirror-relative path, rejecting any
// absolute form, '..' traversal, query string, or fragment.
function assertSafeUrlPath(urlPath) {
  if (typeof urlPath !== 'string' || urlPath.length === 0) {
    throw new Error('reject: empty URL path');
  }
  if (urlPath.includes('://')) {
    throw new Error(`reject absolute URL: ${urlPath}`);
  }
  if (urlPath.includes('?')) {
    throw new Error(`reject query string: ${urlPath}`);
  }
  if (urlPath.includes('#')) {
    throw new Error(`reject fragment: ${urlPath}`);
  }
  if (!urlPath.startsWith('/') || urlPath.startsWith('//')) {
    throw new Error(`reject non-root-relative path: ${urlPath}`);
  }
  const rel = urlPath.slice(1);
  if (rel.length === 0) {
    throw new Error(`reject root-only path: ${urlPath}`);
  }
  if (/^[a-zA-Z]:[\\/]/.test(rel)) {
    throw new Error(`reject drive-absolute path: ${urlPath}`);
  }
  const segments = rel.split('/');
  for (const seg of segments) {
    if (seg === '..') {
      throw new Error(`reject '..' segment: ${urlPath}`);
    }
    if (seg === '' || seg === '.') {
      throw new Error(`reject empty/dot segment: ${urlPath}`);
    }
  }
  return rel;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  // Only an explicit --refresh may re-request URLs that already have a
  // successful snapshot; by default previously captured entries are kept.
  const refresh = process.argv.includes('--refresh');

  // Load the existing snapshot state (best effort). Missing or unreadable
  // files degrade to a fresh capture.
  let priorManifest = null;
  try {
    priorManifest = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'));
  } catch {
    priorManifest = null;
  }
  let priorResourceIndex = null;
  try {
    priorResourceIndex = JSON.parse(await readFile(RESOURCE_INDEX_FILE, 'utf8'));
  } catch {
    priorResourceIndex = null;
  }
  let priorUnavailable = null;
  try {
    priorUnavailable = JSON.parse(await readFile(UNAVAILABLE_FILE, 'utf8'));
  } catch {
    priorUnavailable = null;
  }

  const priorFilesByUrl = new Map();
  if (priorManifest && Array.isArray(priorManifest.files)) {
    for (const file of priorManifest.files) {
      priorFilesByUrl.set(file.url, file);
    }
  }
  const priorRequestsByUrl = new Map();
  if (priorResourceIndex && Array.isArray(priorResourceIndex.requests)) {
    for (const req of priorResourceIndex.requests) {
      priorRequestsByUrl.set(req.url, req);
    }
  }
  const priorUnavailableByUrl = new Map();
  if (priorUnavailable && Array.isArray(priorUnavailable.resources)) {
    for (const rec of priorUnavailable.resources) {
      priorUnavailableByUrl.set(rec.url, rec);
    }
  }

  const requests = [];
  const files = [];
  const unavailable = [];
  let fetched = 0;
  let preserved = 0;
  let preservedUnavailable = 0;

  for (const urlPath of [...URL_PATHS, ROOT_PAGE.urlPath]) {
    // The root page is an explicit whitelist entry with its own hard-coded
    // mirror mapping (index.html); every other path must still pass the
    // existing URL safety validation unchanged.
    const rel =
      urlPath === ROOT_PAGE.urlPath ? ROOT_PAGE.localRel : assertSafeUrlPath(urlPath);
    const url = ORIGIN + urlPath;
    const localPath = 'mirror/' + rel;
    const target = path.join(MIRROR_DIR, ...rel.split('/'));

    // Snapshot protection: when a successful snapshot already exists on
    // disk, neither the URL is re-requested nor the file rewritten; the
    // existing manifest/resource-index metadata is carried over unchanged.
    const priorFile = priorFilesByUrl.get(url);
    const priorStatus = priorFile ? Number(priorFile.status) : NaN;
    let keep = false;
    if (
      !refresh &&
      priorFile &&
      Number.isInteger(priorStatus) &&
      priorStatus >= 200 &&
      priorStatus < 300
    ) {
      let exists = false;
      try {
        await access(target);
        exists = true;
      } catch {
        exists = false;
      }
      keep = exists;
    }
    if (keep) {
      const priorRequest = priorRequestsByUrl.get(url);
      requests.push(
        priorRequest ?? {
          url,
          finalUrl: priorFile.finalUrl,
          status: priorFile.status,
          contentType: priorFile.contentType,
          bytes: priorFile.bytes,
          sha256: priorFile.sha256,
          localPath: priorFile.localPath,
          time: priorFile.capturedAt,
        },
      );
      files.push(priorFile);
      preserved += 1;
      continue;
    }

    // Snapshot protection for unavailable records: in default mode a URL
    // already recorded in unavailable.json is not re-requested; its prior
    // request and unavailable metadata are carried into the output
    // unchanged. Only --refresh retries previously failed URLs. This check
    // only runs after the success-preserve branch above, so missing
    // success files still fall through to the fetch (auto-recovery).
    const priorUnavailableRec = priorUnavailableByUrl.get(url);
    if (!refresh && priorUnavailableRec) {
      const priorRequest = priorRequestsByUrl.get(url);
      requests.push(
        priorRequest ?? {
          url,
          finalUrl: priorUnavailableRec.finalUrl ?? url,
          status: priorUnavailableRec.status ?? 0,
          contentType: priorUnavailableRec.contentType ?? null,
          bytes: null,
          sha256: null,
          localPath,
          time: priorUnavailableRec.time,
        },
      );
      unavailable.push(priorUnavailableRec);
      preservedUnavailable += 1;
      continue;
    }

    const entry = {
      url,
      finalUrl: null,
      status: null,
      contentType: null,
      bytes: null,
      sha256: null,
      localPath,
      time: new Date().toISOString(),
    };
    requests.push(entry);
    fetched += 1;

    let response;
    try {
      response = await fetch(url, {
        headers: HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      entry.status = 0;
      entry.finalUrl = url;
      unavailable.push({
        url,
        finalUrl: url,
        status: null,
        error: `${err.name}: ${err.message}`,
        time: entry.time,
      });
      continue;
    }

    entry.finalUrl = response.url || url;
    entry.status = response.status;
    entry.contentType = response.headers.get('content-type') ?? null;

    const buffer = Buffer.from(await response.arrayBuffer());
    entry.bytes = buffer.length;
    entry.sha256 = sha256(buffer);

    if (!response.ok) {
      unavailable.push({
        url,
        finalUrl: entry.finalUrl,
        status: response.status,
        contentType: entry.contentType,
        error: `HTTP ${response.status}`,
        time: entry.time,
      });
      continue;
    }

    await mkdir(path.dirname(target), { recursive: true });
    // Keep existing mirror bytes untouched when the fetched content is
    // byte-identical; only write when the file is missing or differs.
    let existing = null;
    try {
      existing = await readFile(target);
    } catch {
      existing = null;
    }
    if (existing === null || !existing.equals(buffer)) {
      await writeFile(target, buffer);
    }
    files.push({
      url: entry.url,
      finalUrl: entry.finalUrl,
      status: entry.status,
      contentType: entry.contentType,
      localPath: entry.localPath,
      bytes: entry.bytes,
      sha256: entry.sha256,
      capturedAt: entry.time,
    });
  }

  // The snapshot's top-level capture time stays unchanged when no file was
  // newly captured this run; only real captures advance it.
  let capturedAt = new Date().toISOString();
  if (
    files.length - preserved === 0 &&
    priorManifest &&
    typeof priorManifest.capturedAt === 'string'
  ) {
    capturedAt = priorManifest.capturedAt;
  }

  const manifest = {
    schemaVersion: 1,
    source: ORIGIN,
    capturedAt,
    files,
  };
  const resourceIndex = {
    schemaVersion: 1,
    requests,
  };
  const unavailableDoc = {
    schemaVersion: 1,
    resources: unavailable,
  };

  await mkdir(path.join(BUILD_DIR, 'network'), { recursive: true });
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(RESOURCE_INDEX_FILE, JSON.stringify(resourceIndex, null, 2) + '\n');
  await writeFile(UNAVAILABLE_FILE, JSON.stringify(unavailableDoc, null, 2) + '\n');

  console.log(
    JSON.stringify(
      {
        capturedAt,
        requested: fetched,
        preserved,
        preservedUnavailable,
        saved: files.length,
        unavailable: unavailable.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
