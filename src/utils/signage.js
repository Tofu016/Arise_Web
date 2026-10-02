import { SIGNAGE_ASPECT } from "./kioskLayout";

// Signage: the images, GIFs and looping videos rotating in the kiosk's
// bottom band, managed from the admin "Advertisements" page. Pure helpers
// only (crop geometry, rotation order, run-window status, file checks), so
// each is testable by calling it.
//
// Every identifier, endpoint, file path and class name says "signage",
// never "ad": ad blockers hide elements and refuse requests that look like
// advertisements, which would silently blank the band or the admin's own
// previews. (The admin page's route is the exception: page URLs follow
// page names, and in-app navigation isn't a request.)

// ---- Media ----

export const SIGNAGE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const SIGNAGE_VIDEO_TYPES = ["video/mp4", "video/webm"];
// The local XAMPP php.ini default; production allows more (see the API's
// DEPLOY.md). Checked here only to fail fast with a clear message instead
// of after a long upload; the server's own limit is the real one.
export const SIGNAGE_MAX_BYTES = 40 * 1024 * 1024;

export function isVideoPath(path) {
  return /\.(mp4|webm)$/i.test(path || "");
}

// Why a picked file can't be used, or null when it can.
export function signageFileProblem(file) {
  if (!file) return "No file was picked.";
  if (![...SIGNAGE_IMAGE_TYPES, ...SIGNAGE_VIDEO_TYPES].includes(file.type)) {
    return "Use a JPG, PNG, GIF or WebP image, or an MP4 or WebM video.";
  }
  if (file.size > SIGNAGE_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `That file is ${mb} MB; the limit is ${SIGNAGE_MAX_BYTES / (1024 * 1024)} MB. Shorten or compress it first.`;
  }
  return null;
}

// A fresh, storage-safe name per upload, so a new file never overwrites
// one another slide still shows. Only the base: the server picks the
// extension from the file's real contents.
export function signageFilename(title, now = Date.now()) {
  const slug = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "slide"}-${now.toString(36)}`;
}

// ---- Time on screen ----
//
// Seconds in tenths (7.5, not 7.25), the same rule as the API's
// decimal(4,1) columns: more precision is refused, not silently rounded.

export const SIGNAGE_MIN_SECONDS = 3;
export const SIGNAGE_MAX_SECONDS = 600;

// The typed value as seconds, or null when it isn't a valid time on screen.
export function parseDuration(text) {
  const value = Number(String(text ?? "").trim());
  if (String(text ?? "").trim() === "" || !Number.isFinite(value)) return null;
  const tenths = value * 10;
  if (Math.abs(tenths - Math.round(tenths)) > 1e-6) return null;
  const seconds = Math.round(tenths) / 10;
  return seconds >= SIGNAGE_MIN_SECONDS && seconds <= SIGNAGE_MAX_SECONDS ? seconds : null;
}

export const DURATION_RULE = `Use ${SIGNAGE_MIN_SECONDS} to ${SIGNAGE_MAX_SECONDS} seconds, with at most one decimal (like 7.5).`;

// A video's length rounded up to the next tenth, within the allowed range,
// so "match the video" never cuts its last frames off.
export function durationForVideo(seconds) {
  const up = Math.ceil(seconds * 10 - 1e-6) / 10;
  return Math.min(SIGNAGE_MAX_SECONDS, Math.max(SIGNAGE_MIN_SECONDS, up));
}

// Seconds for display: "10", "7.5" (never "7.50" or float noise).
export function formatSeconds(seconds) {
  return String(Math.round(seconds * 10) / 10);
}

// ---- Crop geometry ----
//
// A crop is { x, y, w, h } in fractions (0..1) of the media's own width and
// height. Its shape on screen must match the band's (SIGNAGE_ASPECT), which
// in fraction space means h = w * k, where k = mediaAspect / targetAspect.

// Smallest crop side, as a fraction of the media. Stops a slip of the
// handle from collapsing the crop to a few unreadable pixels.
export const MIN_CROP_FRACTION = 0.05;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function shapeFactor(mediaAspect, targetAspect) {
  return mediaAspect / targetAspect;
}

// The largest band-shaped crop that fits the media, centered: what a new
// slide starts with.
export function defaultCrop(mediaAspect, targetAspect = SIGNAGE_ASPECT) {
  const k = shapeFactor(mediaAspect, targetAspect);
  if (k >= 1) {
    const w = 1 / k;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  return { x: 0, y: (1 - k) / 2, w: 1, h: k };
}

// Whether a stored crop already has the band's shape. One that doesn't (a
// slide saved before the media was replaced, or the server's 0,0,1,1
// default) is reset to defaultCrop when edited.
export function cropMatchesShape(crop, mediaAspect, targetAspect = SIGNAGE_ASPECT, tolerance = 0.01) {
  if (!crop || !(crop.w > 0) || !(crop.h > 0)) return false;
  const k = shapeFactor(mediaAspect, targetAspect);
  return Math.abs(crop.h / (crop.w * k) - 1) <= tolerance && crop.x + crop.w <= 1 + 1e-6 && crop.y + crop.h <= 1 + 1e-6;
}

// The crop moved by (dx, dy), kept inside the media.
export function moveCrop(crop, dx, dy) {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.w),
    y: clamp(crop.y + dy, 0, 1 - crop.h),
  };
}

// The crop resized by dragging one corner handle ("nw", "ne", "sw", "se")
// to `point` (fractions of the media), keeping the band's shape and the
// opposite corner fixed, and never leaving the media.
export function resizeCrop(crop, handle, point, mediaAspect, targetAspect = SIGNAGE_ASPECT) {
  const k = shapeFactor(mediaAspect, targetAspect);
  const east = handle.includes("e");
  const south = handle.includes("s");
  const ax = east ? crop.x : crop.x + crop.w;
  const ay = south ? crop.y : crop.y + crop.h;

  // Follow whichever axis the pointer has moved further along, so the
  // corner tracks the pointer instead of lagging behind on one axis.
  const fromX = east ? point.x - ax : ax - point.x;
  const fromY = (south ? point.y - ay : ay - point.y) / k;
  const maxW = Math.min(east ? 1 - ax : ax, (south ? 1 - ay : ay) / k);
  const minW = Math.min(Math.max(MIN_CROP_FRACTION, MIN_CROP_FRACTION / k), maxW);
  const w = clamp(Math.max(fromX, fromY), minW, maxW);
  const h = w * k;

  return { x: east ? ax : ax - w, y: south ? ay : ay - h, w, h };
}

// The crop scaled by `factor` around its own center (zoom buttons and the
// keyboard), keeping the band's shape; at an edge it slides inward rather
// than overhanging, and it never passes the media's size or the minimum.
export function scaleCrop(crop, factor, mediaAspect, targetAspect = SIGNAGE_ASPECT) {
  const k = shapeFactor(mediaAspect, targetAspect);
  const maxW = Math.min(1, 1 / k);
  const minW = Math.min(Math.max(MIN_CROP_FRACTION, MIN_CROP_FRACTION / k), maxW);
  const w = clamp(crop.w * factor, minW, maxW);
  const h = w * k;
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}

// The crop as the API stores it: six decimals, never overhanging an edge.
export function roundCrop(crop) {
  const r = (v) => Math.round(v * 1e6) / 1e6;
  const x = clamp(r(crop.x), 0, 1);
  const y = clamp(r(crop.y), 0, 1);
  return { x, y, w: Math.min(r(crop.w), 1 - x), h: Math.min(r(crop.h), 1 - y) };
}

// Where to draw the whole media element (px, relative to the box) so the
// crop fills a box of boxW x boxH: scaled to cover the box with the crop,
// centered on the crop, then nudged so the media never leaves a gap. A box
// with exactly the crop's shape shows exactly the crop; a slightly
// different one (another kiosk's band) shows a little more or less of it.
export function cropLayout(crop, mediaW, mediaH, boxW, boxH) {
  const s = Math.max(boxW / (crop.w * mediaW), boxH / (crop.h * mediaH));
  const width = mediaW * s;
  const height = mediaH * s;
  const left = clamp(boxW / 2 - (crop.x + crop.w / 2) * width, boxW - width, 0);
  const top = clamp(boxH / 2 - (crop.y + crop.h / 2) * height, boxH - height, 0);
  return { left, top, width, height };
}

// ---- Rotation ----

// One full pass over `count` slides, as slide indices: in order, or
// shuffled. A shuffled pass never opens with the slide that just closed
// the previous one (`previous`), so a slide is never shown twice in a row.
export function rotationPass(count, order, previous = null, random = Math.random) {
  const indices = Array.from({ length: count }, (_, i) => i);
  if (order !== "shuffle") return indices;
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  if (count > 1 && indices[0] === previous) {
    [indices[0], indices[1]] = [indices[1], indices[0]];
  }
  return indices;
}

// ---- Run window ----
//
// Dates are the server's local "YYYY-MM-DD HH:MM:SS" strings, compared as
// strings (they sort chronologically). "now" should come from the server's
// clock (see serverClock) so the admin page agrees with what the kiosk is
// actually showing.

// "off" (switched off), "scheduled" (not started), "ended", or "live".
export function slideStatus(slide, now) {
  if (!slide.active) return "off";
  if (slide.startsAt && slide.startsAt > now) return "scheduled";
  if (slide.endsAt && slide.endsAt <= now) return "ended";
  return "live";
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function parseLocal(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value || "");
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

// A function returning the server's current time, given one server
// reading: the reading plus however long it has been since. Both are read
// as the same (local) timezone, so only the elapsed time matters and the
// browser's own timezone never does.
export function serverClock(serverTime, readAt = Date.now(), nowFn = Date.now) {
  const base = parseLocal(serverTime);
  if (!base) return () => formatLocal(new Date(nowFn()));
  return () => formatLocal(new Date(base.getTime() + (nowFn() - readAt)));
}

// "2026-10-01 08:30:00" <-> "2026-10-01T08:30" (a datetime-local input's
// value). Blank means no date.
export function toDateTimeInput(value) {
  return value ? value.slice(0, 16).replace(" ", "T") : "";
}

export function fromDateTimeInput(value) {
  if (!value) return null;
  const date = parseLocal(value);
  return date ? formatLocal(date) : null;
}

const DATE_FORMAT = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };

function formatWhen(value) {
  const date = parseLocal(value);
  return date ? date.toLocaleString(undefined, DATE_FORMAT) : value;
}

// The run window in words, for the slide list.
export function describeWindow(startsAt, endsAt) {
  if (startsAt && endsAt) return `${formatWhen(startsAt)} to ${formatWhen(endsAt)}`;
  if (startsAt) return `From ${formatWhen(startsAt)}`;
  if (endsAt) return `Until ${formatWhen(endsAt)}`;
  return "No end date";
}
