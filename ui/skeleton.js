// =============================================================================
// UI/SKELETON.JS — Создание базового каркаса UI приложения
// =============================================================================
// Что здесь:
// - Создание структуры: header, body, pagination, status-bar
// - Вставка заглушки "нет данных" в body (до загрузки контента)
// =============================================================================

/**
 * Инициализировать базовый каркас UI приложения
 * @param {string} rootSelector - CSS-селектор корневого элемента
 */
export function initUI(rootSelector) {
  const root = document.querySelector(rootSelector);
  if (!root) {
    console.error("initUI: root not found:", rootSelector);
    return;
  }

  // Создаём базовую структуру приложения
  root.innerHTML = `
    <header id="app-header" class="app-header"></header>
    <div id="globalSearchResults" class="search-results" hidden></div>
    <main id="app-body" class="app-body"></main>
    <div id="pagination"></div>
    <div id="app-status" class="app-status"></div>

    <!-- Корень для оверлея глобального поиска -->
  <div id="search-results-root" class="search-results-root"></div>
  `;

  // Добавляем заглушку в body (до загрузки данных)
  const body = document.getElementById("app-body");
  body.innerHTML = `
    <div class="body-empty">
      <p>Загрузка данных...</p>
      <p>Если эта надпись не исчезает — проверьте консоль (F12)</p>
    </div>
  `;

  console.log("[skeleton] UI structure created");
}
