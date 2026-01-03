/** platform/launcher-web.js
 * LinkApp — Web Launcher (временный адаптер платформы)
 * ----------------------------------------------------
 * Роль: единая точка открытия ссылок из приложения.
 * В веб-режиме мы можем только открыть URL в новой вкладке.
 * В desktop-хосте (Electron/Tauri) этот файл будет заменён
 * на реализацию, которая открывает ссылку в выбранном браузере системы.
 *
 * Публичный API:
 *   - launcher.openUrl(url, browser?)
 *   - launcher.detectInstalledBrowsers()
 *
 * Где используется:
 *   - main.js → подписка на событие "link:open"
 */

// platform/launcher-web.js

// Разрешаем только http/https. Всё остальное (javascript:, file:, data:) — блокируем.
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Проверяем, что URL безопасен:
 *  - корректно парсится через new URL
 *  - имеет протокол http: или https:
 */
function isSafeExternalUrl(raw) {
  if (typeof raw !== "string") return false;

  try {
    // Используем текущий origin как базу для относительных URL,
    // но нам всё равно — мы разрешаем только http/https.
    const u = new URL(raw, window.location.href);
    return SAFE_PROTOCOLS.has(u.protocol);
  } catch {
    // new URL бросит ошибку, если строка невалидная
    return false;
  }
}

export const launcher = {
  /**
   * Открыть ссылку. В вебе игнорируем выбор браузера и открываем в новой вкладке.
   * @param {string} url — ожидаем абсолютный http/https-URL
   * @param {'system'|'chrome'|'firefox'|'edge'|'custom'} [browser='system']
   */
  openUrl(url, browser = "system") {
    if (!isSafeExternalUrl(url)) {
      console.warn("[security] launcher.openUrl blocked unsafe url:", url);
      return;
    }

    // Безопасные флаги для новой вкладки
    window.open(url, "_blank", "noopener,noreferrer");
  },

  /**
   * Определить установленные браузеры.
   * В вебе — вернуть только «system», т.к. проверка недоступна.
   * @returns {Promise<Array<{id:string,name:string}>>}
   */
  async detectInstalledBrowsers() {
    return [{ id: "system", name: "System default" }];
  },
};
