/**
 * core/theme.js — простая и надёжная тема (localStorage и eventBus)
 * -----------------------------------------------------------------
 * Публичный API:
 *   - initThemeFromStorage()  — применяет сохранённую тему и включает watcher
 *   - applyTheme(mode)        — 'system' | 'light' | 'dark'
 *   - getTheme()              — текущее значение
 *   - enableSystemWatcher()   — подписка на смену системной темы (если 'system')
 */
import { eventBus } from "./event-bus.js";

const LS_KEY = "linkapp:theme";
const THEMES = new Set(["system", "light", "sea", "dark"]);

function setAttr(mode) {
  document.documentElement.setAttribute("data-theme", mode);
}

export function applyTheme(mode = "system") {
  if (!THEMES.has(mode)) mode = "system";
  setAttr(mode);
  try {
    localStorage.setItem(LS_KEY, mode);
  } catch (_) {}
  eventBus.emit("ui:theme:changed", { mode });
}

export function getTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (THEMES.has(attr)) return attr;
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (THEMES.has(saved)) return saved;
  } catch (_) {}
  return "system";
}

export function enableSystemWatcher() {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) return () => {};
  const onChange = () => {
    if (getTheme() === "system") {
      // При 'system' просто пересобираем токены (через атрибут)
      setAttr("system");
      eventBus.emit("ui:theme:changed", { mode: "system" });
    }
  };
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}

export function initThemeFromStorage() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    applyTheme(THEMES.has(saved) ? saved : "system");
  } catch (_) {
    applyTheme("system");
  }
  enableSystemWatcher();
}
