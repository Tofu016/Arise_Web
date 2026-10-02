import { describe, it, expect } from "vitest";
import {
  defaultCrop,
  cropMatchesShape,
  moveCrop,
  resizeCrop,
  scaleCrop,
  roundCrop,
  cropLayout,
  rotationPass,
  slideStatus,
  serverClock,
  toDateTimeInput,
  fromDateTimeInput,
  signageFileProblem,
  signageFilename,
  isVideoPath,
  MIN_CROP_FRACTION,
  parseDuration,
  durationForVideo,
  formatSeconds,
} from "./signage";
import { SIGNAGE_ASPECT, SIGNAGE_REFERENCE_SIZE } from "./kioskLayout";
import { toSignageSlide, signageSlideBody, toSignageSettings, signageSettingsBody } from "./entities";

// Pixel aspect of a fraction-space crop on media of the given aspect.
const pixelAspect = (crop, mediaAspect) => (crop.w * mediaAspect) / crop.h;

describe("the signage band", () => {
  it("is 1080 x 336 on the reference kiosk", () => {
    expect(SIGNAGE_REFERENCE_SIZE).toEqual({ width: 1080, height: 336 });
    expect(SIGNAGE_ASPECT).toBeCloseTo(1080 / 336);
  });
});

describe("defaultCrop", () => {
  it("takes the full height of media wider than the band, centered", () => {
    const crop = defaultCrop(4, 2);
    expect(crop).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
    expect(pixelAspect(crop, 4)).toBeCloseTo(2);
  });

  it("takes the full width of media narrower than the band, centered", () => {
    const crop = defaultCrop(16 / 9);
    expect(crop.x).toBe(0);
    expect(crop.w).toBe(1);
    expect(crop.y).toBeCloseTo((1 - crop.h) / 2);
    expect(pixelAspect(crop, 16 / 9)).toBeCloseTo(SIGNAGE_ASPECT);
  });

  it("is the whole media when it already has the band's shape", () => {
    expect(defaultCrop(SIGNAGE_ASPECT)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe("cropMatchesShape", () => {
  it("accepts a band-shaped crop and refuses the API's whole-media default on other media", () => {
    expect(cropMatchesShape(defaultCrop(16 / 9), 16 / 9)).toBe(true);
    expect(cropMatchesShape({ x: 0, y: 0, w: 1, h: 1 }, 16 / 9)).toBe(false);
    expect(cropMatchesShape(null, 16 / 9)).toBe(false);
  });
});

describe("moveCrop", () => {
  const crop = { x: 0.2, y: 0.2, w: 0.5, h: 0.3 };

  it("moves by the given fractions", () => {
    const moved = moveCrop(crop, 0.1, -0.1);
    expect(moved.x).toBeCloseTo(0.3);
    expect(moved.y).toBeCloseTo(0.1);
  });

  it("stops at the media's edges without changing size", () => {
    expect(moveCrop(crop, 5, 5)).toEqual({ x: 0.5, y: 0.7, w: 0.5, h: 0.3 });
    expect(moveCrop(crop, -5, -5)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.3 });
  });
});

describe("resizeCrop", () => {
  const aspect = 16 / 9;
  const start = { x: 0.2, y: 0.3, w: 0.4, h: 0.4 * (aspect / SIGNAGE_ASPECT) };

  it("keeps the band's shape and the opposite corner fixed", () => {
    const resized = resizeCrop(start, "se", { x: 0.7, y: 0.3 }, aspect);
    expect(resized.x).toBe(0.2);
    expect(resized.y).toBe(0.3);
    expect(resized.w).toBeCloseTo(0.5);
    expect(pixelAspect(resized, aspect)).toBeCloseTo(SIGNAGE_ASPECT);
  });

  it("anchors the bottom-right corner when dragging the top-left one", () => {
    const resized = resizeCrop(start, "nw", { x: 0.1, y: 0.4 }, aspect);
    expect(resized.x + resized.w).toBeCloseTo(start.x + start.w);
    expect(resized.y + resized.h).toBeCloseTo(start.y + start.h);
    expect(resized.w).toBeCloseTo(0.5);
  });

  it("never grows past the media's edge", () => {
    const resized = resizeCrop(start, "se", { x: 5, y: 5 }, aspect);
    expect(resized.x + resized.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(resized.y + resized.h).toBeLessThanOrEqual(1 + 1e-9);
    expect(pixelAspect(resized, aspect)).toBeCloseTo(SIGNAGE_ASPECT);
  });

  it("never shrinks either side below the minimum, even when dragged past the anchor", () => {
    const resized = resizeCrop(start, "se", { x: 0, y: 0 }, aspect);
    expect(Math.min(resized.w, resized.h)).toBeCloseTo(MIN_CROP_FRACTION);
    expect(resized.x).toBe(0.2);
  });
});

describe("scaleCrop", () => {
  const aspect = 16 / 9;
  const k = aspect / SIGNAGE_ASPECT;

  it("zooms around the crop's center, keeping the band's shape", () => {
    const crop = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 * k };
    const zoomed = scaleCrop(crop, 0.5, aspect);
    expect(zoomed.w).toBeCloseTo(0.2);
    expect(zoomed.x + zoomed.w / 2).toBeCloseTo(0.5);
    expect(zoomed.y + zoomed.h / 2).toBeCloseTo(crop.y + crop.h / 2);
    expect(pixelAspect(zoomed, aspect)).toBeCloseTo(SIGNAGE_ASPECT);
  });

  it("slides inward at an edge and stops at the whole media", () => {
    const crop = { x: 0.6, y: 0, w: 0.4, h: 0.4 * k };
    const grown = scaleCrop(crop, 10, aspect);
    expect(grown.w).toBe(1);
    expect(grown.h).toBeCloseTo(k);
    expect(grown.x).toBe(0);
    expect(grown.y).toBe(0); // pinned to the top edge it started against
  });
});

describe("roundCrop", () => {
  it("rounds to six decimals and absorbs float overhang at an edge", () => {
    expect(roundCrop({ x: 0.3333333333, y: 0, w: 0.6666671, h: 1.0000002 })).toEqual({
      x: 0.333333,
      y: 0,
      w: 0.666667,
      h: 1,
    });
  });
});

describe("cropLayout", () => {
  it("shows exactly the crop in a box of the crop's shape", () => {
    // 2000 x 1000 media, crop the right half's top 0.25 x 0.25 region.
    const crop = { x: 0.5, y: 0.25, w: 0.25, h: 0.25 }; // 500 x 250 px
    const layout = cropLayout(crop, 2000, 1000, 1000, 500);
    expect(layout.width).toBe(4000);
    expect(layout.height).toBe(2000);
    expect(layout.left).toBe(-2000);
    expect(layout.top).toBe(-500);
  });

  it("covers a box of another shape, centered on the crop", () => {
    const crop = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }; // 1000 x 500 px of 2000 x 1000
    const layout = cropLayout(crop, 2000, 1000, 1000, 1000);
    // Height decides the scale (500 px -> 1000 px), so the sides get cut.
    expect(layout.height).toBe(2000);
    expect(layout.width).toBe(4000);
    expect(layout.left).toBe(500 - 0.5 * 4000);
    expect(layout.top).toBe(500 - 0.5 * 2000);
  });

  it("never leaves a gap when the crop sits at an edge", () => {
    const crop = { x: 0, y: 0, w: 0.5, h: 0.5 };
    const layout = cropLayout(crop, 1000, 1000, 400, 200); // box wider than the crop
    expect(layout.left).toBeLessThanOrEqual(0);
    expect(layout.top).toBeLessThanOrEqual(0);
    expect(layout.left + layout.width).toBeGreaterThanOrEqual(400);
    expect(layout.top + layout.height).toBeGreaterThanOrEqual(200);
  });
});

describe("rotationPass", () => {
  it("is every slide in order by default", () => {
    expect(rotationPass(4, "sequence")).toEqual([0, 1, 2, 3]);
  });

  it("shuffles every slide exactly once", () => {
    const pass = rotationPass(5, "shuffle", null, () => 0);
    expect([...pass].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(pass).not.toEqual([0, 1, 2, 3, 4]);
  });

  it("never repeats the previous pass's last slide back to back", () => {
    // random() = 0.999 leaves the identity order, which would open with 0.
    const pass = rotationPass(3, "shuffle", 0, () => 0.999);
    expect(pass[0]).not.toBe(0);
    expect([...pass].sort()).toEqual([0, 1, 2]);
  });

  it("handles one slide and none", () => {
    expect(rotationPass(1, "shuffle", 0)).toEqual([0]);
    expect(rotationPass(0, "shuffle")).toEqual([]);
  });
});

describe("slideStatus", () => {
  const now = "2026-10-15 12:00:00";
  const slide = { active: true, startsAt: "2026-10-01 08:00:00", endsAt: "2026-10-31 17:00:00" };

  it("is live inside its window", () => {
    expect(slideStatus(slide, now)).toBe("live");
    expect(slideStatus({ active: true, startsAt: null, endsAt: null }, now)).toBe("live");
  });

  it("is off when switched off, whatever the window", () => {
    expect(slideStatus({ ...slide, active: false }, now)).toBe("off");
  });

  it("is scheduled before and ended after its window, with an exclusive end", () => {
    expect(slideStatus(slide, "2026-09-30 23:59:59")).toBe("scheduled");
    expect(slideStatus(slide, "2026-10-01 08:00:00")).toBe("live");
    expect(slideStatus(slide, "2026-10-31 17:00:00")).toBe("ended");
  });
});

describe("serverClock", () => {
  it("advances the server's reading by the time elapsed since", () => {
    let t = 1_000_000;
    const now = serverClock("2026-10-01 23:59:30", 1_000_000, () => t);
    expect(now()).toBe("2026-10-01 23:59:30");
    t += 45_000;
    expect(now()).toBe("2026-10-02 00:00:15");
  });
});

describe("datetime-local conversion", () => {
  it("round-trips a stored date", () => {
    expect(toDateTimeInput("2026-10-01 08:30:00")).toBe("2026-10-01T08:30");
    expect(fromDateTimeInput("2026-10-01T08:30")).toBe("2026-10-01 08:30:00");
  });

  it("treats blank as no date", () => {
    expect(toDateTimeInput(null)).toBe("");
    expect(fromDateTimeInput("")).toBe(null);
  });
});

describe("files", () => {
  it("accepts images and MP4/WebM video only", () => {
    expect(signageFileProblem({ type: "image/gif", size: 10 })).toBe(null);
    expect(signageFileProblem({ type: "video/webm", size: 10 })).toBe(null);
    expect(signageFileProblem({ type: "video/quicktime", size: 10 })).toMatch(/MP4 or WebM/);
    expect(signageFileProblem({ type: "image/heic", size: 10 })).toMatch(/JPG, PNG, GIF or WebP/);
  });

  it("refuses a file over the size limit before uploading it", () => {
    expect(signageFileProblem({ type: "video/mp4", size: 50 * 1024 * 1024 })).toMatch(/50\.0 MB/);
  });

  it("names uploads uniquely from a storage-safe title", () => {
    expect(signageFilename("Enrollment: Now Open!", 36 ** 3)).toBe("enrollment-now-open-1000");
    expect(signageFilename("", 35)).toBe("slide-z");
  });

  it("tells videos from images by extension", () => {
    expect(isVideoPath("signage/a.MP4")).toBe(true);
    expect(isVideoPath("signage/a.webm")).toBe(true);
    expect(isVideoPath("signage/a.gif")).toBe(false);
  });
});

describe("time on screen", () => {
  it("accepts whole seconds and tenths within range", () => {
    expect(parseDuration("10")).toBe(10);
    expect(parseDuration("7.5")).toBe(7.5);
    expect(parseDuration(7.3)).toBe(7.3); // 7.3 * 10 is 72.999... in binary
    expect(parseDuration("3")).toBe(3);
    expect(parseDuration("600.0")).toBe(600);
  });

  it("refuses blanks, extra decimals and out-of-range values", () => {
    for (const bad of ["", "  ", "abc", "7.25", "2.9", "600.1", null, undefined]) {
      expect(parseDuration(bad)).toBe(null);
    }
  });

  it("rounds a video's length up to the next tenth, within range", () => {
    expect(durationForVideo(12.43)).toBe(12.5);
    expect(durationForVideo(12.4)).toBe(12.4);
    expect(durationForVideo(1.2)).toBe(3);
    expect(durationForVideo(900)).toBe(600);
  });

  it("displays without trailing zeros or float noise", () => {
    expect(formatSeconds(10)).toBe("10");
    expect(formatSeconds(7.5)).toBe("7.5");
    expect(formatSeconds(0.1 + 0.2)).toBe("0.3");
  });
});

describe("signage entity mapping", () => {
  const row = {
    id: 4,
    title: "Enrollment",
    media_path: "signage/enroll.mp4",
    crop_x: "0.100000",
    crop_y: "0.200000",
    crop_w: "0.500000",
    crop_h: "0.300000",
    duration_seconds: "15.5",
    sort_order: "2",
    is_active: "1",
    starts_at: null,
    ends_at: "2026-10-31 17:00:00",
  };

  it("maps a row to a slide", () => {
    expect(toSignageSlide(row)).toEqual({
      id: "4",
      title: "Enrollment",
      mediaPath: "signage/enroll.mp4",
      crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 },
      durationSeconds: 15.5,
      sortOrder: 2,
      active: true,
      startsAt: null,
      endsAt: "2026-10-31 17:00:00",
    });
    expect(toSignageSlide({ ...row, is_active: "0" }).active).toBe(false);
  });

  it("sends only the given fields, the crop as all four, and null to clear a date", () => {
    expect(signageSlideBody({ active: false, startsAt: null })).toEqual({ is_active: false, starts_at: null });
    expect(signageSlideBody({ crop: { x: 0, y: 0.1, w: 1, h: 0.5 } })).toEqual({
      crop_x: 0,
      crop_y: 0.1,
      crop_w: 1,
      crop_h: 0.5,
    });
  });

  it("maps settings both ways", () => {
    const settings = toSignageSettings({ rotation_order: "shuffle", transition: "cut", default_duration_seconds: "8" });
    expect(settings).toEqual({ rotationOrder: "shuffle", transition: "cut", defaultDurationSeconds: 8 });
    expect(signageSettingsBody({ transition: "fade" })).toEqual({ transition: "fade" });
  });
});
