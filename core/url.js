// core/url.js
export function hasScheme(u = "") {
  return /^[a-z][a-z0-9+.+-]*:\/\//i.test(String(u).trim());
}

export function normalizeUrl(u) {
  const s = String(u || "").trim();
  if (!s) return s;
  if (hasScheme(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  return "https://" + s;
}

export function isSafeLinkUrl(raw) {
  try {
    const u = new URL(normalizeUrl(raw), window.location.href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
