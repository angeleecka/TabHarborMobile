// core/import-sniff.js
export function isLikelyLinkAppObject(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!Array.isArray(obj.pages)) return false;
  // мягкая проверка структуры страниц/секций
  const okPages = obj.pages.every((p) => {
    if (!p || typeof p !== "object") return false;
    // sections либо объект, либо отсутствует
    if (p.sections && typeof p.sections !== "object") return false;
    return true;
  });
  return okPages;
}

export function sniffLinkAppText(text) {
  try {
    const obj = JSON.parse(String(text || ""));
    const hasSignature = obj && (obj.__app === "LinkApp" || obj.__schema >= 1);
    return hasSignature || isLikelyLinkAppObject(obj);
  } catch {
    return false;
  }
}
