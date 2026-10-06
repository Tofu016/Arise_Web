import { describe, it, expect } from "vitest";
import { isCompactScreen, pickViewLayout } from "./compactLayout";

describe("isCompactScreen", () => {
  it("covers the first kiosk and the ways it gets reported", () => {
    expect(isCompactScreen(1080, 1920)).toBe(true); // native
    expect(isCompactScreen(864, 1536)).toBe(true); // Windows 125% scaling
    expect(isCompactScreen(1080, 1720)).toBe(true); // windowed, browser chrome and taskbar taking height
    expect(isCompactScreen(1440, 2560)).toBe(true); // a larger 9:16 screen
    expect(isCompactScreen(2160, 3840)).toBe(true); // 4K portrait
  });

  it("covers other portrait touchscreens, tablets and phones", () => {
    expect(isCompactScreen(768, 1024)).toBe(true); // portrait tablet
    expect(isCompactScreen(820, 1180)).toBe(true); // portrait tablet, ratio just under 1.44
    expect(isCompactScreen(390, 844)).toBe(true); // phone
    expect(isCompactScreen(360, 640)).toBe(true); // small Android phone
  });

  it("covers phones turned sideways", () => {
    expect(isCompactScreen(932, 430)).toBe(true); // large iPhone
    expect(isCompactScreen(844, 390)).toBe(true);
    expect(isCompactScreen(915, 412)).toBe(true); // Pixel
  });

  it("keeps ordinary desktop and landscape screens on the desktop layout", () => {
    expect(isCompactScreen(1920, 1080)).toBe(false);
    expect(isCompactScreen(1366, 768)).toBe(false);
    expect(isCompactScreen(1024, 768)).toBe(false); // landscape tablet
    expect(isCompactScreen(1280, 1400)).toBe(false); // slightly portrait window
  });

  it("uses the width and height limits inclusively and the aspect ratio exclusively", () => {
    expect(isCompactScreen(768, 600)).toBe(true);
    expect(isCompactScreen(769, 600)).toBe(false);
    expect(isCompactScreen(1200, 500)).toBe(true);
    expect(isCompactScreen(1200, 501)).toBe(false);
    expect(isCompactScreen(1000, 1300)).toBe(false); // exactly 1.3
    expect(isCompactScreen(1000, 1301)).toBe(true);
  });
});

describe("pickViewLayout", () => {
  it("gives a wide screen the desktop layout, paired or not", () => {
    expect(pickViewLayout({ compactScreen: false, paired: false })).toBe("desktop");
    expect(pickViewLayout({ compactScreen: false, paired: true })).toBe("desktop");
  });

  it("gives a compact screen the kiosk layout only once paired", () => {
    expect(pickViewLayout({ compactScreen: true, paired: false })).toBe("mobile");
    expect(pickViewLayout({ compactScreen: true, paired: true })).toBe("kiosk");
  });
});
