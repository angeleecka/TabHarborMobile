// ui/layout.js
/**
 * ui/layout.js — SAFE версия (не перезаписывает root)
 * ---------------------------------------------------
 * Роль: предоставляет функцию initLayout(target),
 *       которая наполняет ТОЛЬКО область контента (#app-body),
 *       не трогая #app-header и #app-status.
 *
 * Почему так: раньше файл переписывал #linkapp-root, из-за чего исчезал header.
 * Теперь это модуль без автозапуска и без побочных эффектов.
 */

console.log("[layout] module loaded (safe/no-op)");

/**
 * Инициализация/наполнение центральной области приложения.
 * Вставляет простой плейсхолдер, если нужно.
 *
 * @param {string} targetSelector CSS-селектор контейнера (по умолчанию #app-body)
 */
export function initLayout(targetSelector = "#app-body") {
  const target = document.querySelector(targetSelector);
  if (!target) {
    console.warn("[layout] target not found:", targetSelector);
    return;
  }

  // Не трогаем, если там уже есть содержимое (скелет мог вставить свой плейсхолдер)
  const alreadyHasContent =
    target.children.length > 0 || target.textContent.trim().length > 0;
  if (alreadyHasContent) {
    console.log("[layout] body already has content — skip");
    return;
  }

  // Мягкий плейсхолдер — только внутри #app-body
  target.innerHTML = `
    <div class="body-empty">
      <p>Тут появятся страницы → секции → кнопки.</p>
      <p>Сейчас тестируем шапку и модалку «О приложении».</p>
    </div>
  `;
  console.log("[layout] content inserted into", targetSelector);
}
