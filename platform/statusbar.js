// web/platform/statusbar.js
// Sync native Android status bar with current app theme (Capacitor)

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/** rgb/rgba/#hex -> {r,g,b} or null */
function parseColorToRgb(input) {
  if (!input) return null;
  const s = String(input).trim();

  // #RGB / #RRGGBB / #RRGGBBAA
  if (s[0] === "#") {
    let hex = s.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    if (hex.length === 8) hex = hex.slice(0, 6); // drop alpha
    if (hex.length !== 6) return null;
    const n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // rgb()/rgba()
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(",").map((x) => x.trim());
    if (parts.length < 3) return null;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  return null;
}

function rgbToHex({ r, g, b }) {
  const to2 = (n) => Math.round(n).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Relative luminance (0..1). Higher = lighter. */
function luminance({ r, g, b }) {
  const srgb = [r, g, b].map((v) => clamp01(v / 255));
  const lin = srgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function pickHeaderBgColor() {
  // 1) Prefer a theme token if you have one
  const rootStyle = getComputedStyle(document.documentElement);
  const token =
    rootStyle.getPropertyValue("--header-bg")?.trim() ||
    rootStyle.getPropertyValue("--header-background")?.trim();

  const tokenRgb = parseColorToRgb(token);
  if (tokenRgb) return rgbToHex(tokenRgb);

  // 2) Fallback: read real header element background
  const header =
    document.querySelector("#app-header") ||
    document.querySelector(".app-header") ||
    document.querySelector("header");

  if (header) {
    const bg = getComputedStyle(header).backgroundColor;
    const bgRgb = parseColorToRgb(bg);
    if (bgRgb) return rgbToHex(bgRgb);
  }

  // 3) Safe fallback
  return "#111111";
}

function isLightHex(hex) {
  const rgb = parseColorToRgb(hex);
  if (!rgb) return false;
  return luminance(rgb) > 0.6;
}

/**
 * Call once on app start.
 * Keeps StatusBar in sync with theme changes (listens to <html> attribute changes).
 */
export function initNativeStatusBarSync() {
  const Cap = window.Capacitor;
  const SB = Cap?.Plugins?.StatusBar;

  if (!Cap?.isNativePlatform?.() || !SB?.setBackgroundColor) return;

  let raf = 0;

  const apply = async () => {
    const color = pickHeaderBgColor();

    try {
      // Prefer non-overlay: avoids “content under statusbar” headaches
      await SB.setOverlaysWebView({ overlay: false });

      await SB.setBackgroundColor({ color });
      await SB.setStyle({ style: isLightHex(color) ? "LIGHT" : "DARK" });
    } catch (e) {
      console.warn("[StatusBar] apply failed:", e);
    }
  };

  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  };

  // Apply now
  schedule();

  // Re-apply when theme changes (usually toggles html attributes/classes)
  const mo = new MutationObserver(schedule);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class", "style"],
  });
}
