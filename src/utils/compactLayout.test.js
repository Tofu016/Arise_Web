import { describe, it, expect } from "vitest";
import { isCompactLayout } from "./compactLayout";

describe("isCompactLayout", () => {
  it("covers the first kiosk and the ways it gets reported", () => {
    expect(isCompactLayout(1080, 1920)).toBe(true); // native
    expect(isCompactLayout(864, 1536)).toBe(true); // Windows 125% scaling
    expect(isCompactLayout(1080, 1720)).toBe(true); // windowed, browser chrome and taskbar taking height
    expect(isCompactLayout(1440, 2560)).toBe(true); // a larger 9:16 screen
    expect(isCompactLayout(2160, 3840)).toBe(true); // 4K portrait
  });

  it("covers other portrait touchscreens, tablets and phones", () => {
    expect(isCompactLayout(768, 1024)).toBe(true); // portrait tablet
    expect(isCompactLayout(820, 1180)).toBe(true); // portrait tablet, ratio just under 1.44
    expect(isCompactLayout(390, 844)).toBe(true); // phone
  });

  it("keeps ordinary desktop and landscape screens on the desktop layout", () => {
    expect(isCompactLayout(1920, 1080)).toBe(false);
    expect(isCompactLayout(1366, 768)).toBe(false);
    expect(isCompactLayout(1280, 1400)).toBe(false); // slightly portrait window
  });

  it("uses the width limit inclusively and the aspect ratio exclusively", () => {
    expect(isCompactLayout(768, 500)).toBe(true);
    expect(isCompactLayout(769, 500)).toBe(false);
    expect(isCompactLayout(1000, 1300)).toBe(false); // exactly 1.3
    expect(isCompactLayout(1000, 1301)).toBe(true);
  });
});
