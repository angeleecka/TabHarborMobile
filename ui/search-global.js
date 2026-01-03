// ui/search-global.js
import { eventBus } from "../core/event-bus.js";

let hostEl;
let activeIdx = -1; // какой результат подсвечен с клавиатуры
let srClickBound = false;

// -----------------------------------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// -----------------------------------------------------------------------------

/**
 * Гарантируем существование контейнера для результатов глобального поиска.
 */
function ensureHost() {
  if (!hostEl) {
    hostEl = document.getElementById("globalSearchResults");
  }
  if (!hostEl) {
    hostEl = document.createElement("div");
    hostEl.id = "globalSearchResults";
    hostEl.className = "search-results";
    hostEl.hidden = true;
    document.body.appendChild(hostEl);
  }

  // Базовые стили позиции/слоя (остальное задаётся в positionHost)
  hostEl.style.position = "fixed";
  hostEl.style.zIndex = (
    getComputedStyle(document.documentElement).getPropertyValue(
      "--z-popover"
    ) || "1300"
  )
    .toString()
    .trim();

  hostEl.setAttribute("role", "region");
  hostEl.setAttribute("aria-live", "polite");
  hostEl.setAttribute("aria-label", "Search results");
}

/**
 * Проверяет, виден ли элемент на экране достаточно, чтобы считать его якорём.
 */
function isSearchElementVisible(el) {
  if (!el || el.hidden) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Возвращает прямоугольник якоря и режим:
 * - mobile  — поповер с мобильным инпутом;
 * - desktop — инпут в шапке.
 *
 * Если ни поповера, ни десктопного инпута не видно, возвращает null —
 * это сигнал, что список результатов не должен быть виден.
 */
function getSearchAnchor() {
  // 1) Мобильный поповер поиска
  const mob = document.querySelector(".header-search-popover");
  if (isSearchElementVisible(mob)) {
    return { rect: mob.getBoundingClientRect(), mode: "mobile" };
  }

  // 2) Десктопный инпут в шапке
  const desktop = document.getElementById("searchInput");
  if (isSearchElementVisible(desktop)) {
    return { rect: desktop.getBoundingClientRect(), mode: "desktop" };
  }

  // 3) Нет ни поповера, ни инпута — якоря нет.
  return null;
}

/**
 * Ширина скроллбара у указанного контейнера (нужна, чтобы не прилипать к нему).
 */
function getScrollbarWidthOf(el) {
  if (!el) return 0;
  return Math.max(0, el.offsetWidth - el.clientWidth);
}

/**
 * Константа брейкпоинта, на котором мы считаем layout десктопным.
 * ВАЖНО: должна совпадать с @media (max-width: 1060px) из header.css.
 */
const DESKTOP_BP = 1060;

/**
 * true, если сейчас десктопный layout по ширине окна.
 */
function isDesktopLayout() {
  return window.innerWidth > DESKTOP_BP;
}

/**
 * Синхронизация layout'а поиска при переходе через брейкпоинт:
 * - на десктопе насильно закрываем мобильный поповер, чтобы не было двух инпутов;
 * - по желанию можем копировать значение инпута.
 */
function syncSearchLayoutOnResize() {
  const pop = document.querySelector(".header-search-popover");
  const desktopInput = document.getElementById("searchInput");
  const mobileInput = document.getElementById("searchInputMobile");

  if (!pop && !desktopInput && !mobileInput) return;

  if (isDesktopLayout()) {
    // Переход в десктоп: прячем мобильный поповер,
    // чтобы не было двух инпутов одновременно.
    if (pop && !pop.hidden) {
      pop.hidden = true;
    }

    // Мягко переносим текст из mobile → desktop, если нужно.
    if (
      mobileInput &&
      desktopInput &&
      mobileInput.value &&
      !desktopInput.value
    ) {
      desktopInput.value = mobileInput.value;
      // mobileInput.value не трогаем.
    }
  }

  // Если список результатов открыт — после смены layout'а пересчитаем позицию.
  if (hostEl && !hostEl.hidden) {
    positionHost();
  }
}

/**
 * Позиционируем панель результатов относительно текущего якоря.
 * - на десктопе — центрируем под инпутом в шапке;
 * - в мобильном режиме — крепим под поповером поиска.
 *
 * Если якоря нет (ни поповера, ни инпута не видно) — закрываем список.
 */
function positionHost() {
  ensureHost();

  const anchor = getSearchAnchor();
  if (!anchor) {
    // Нет видимого инпута/поповера → результатов быть не должно.
    closeResultsList();
    return;
  }

  const { rect: anchorRect, mode } = anchor;

  const scrollHost =
    document.getElementById("app-body") ||
    document.querySelector("#linkapp-root") ||
    document.body;

  const sbw = getScrollbarWidthOf(scrollHost);
  const vw = Math.min(
    window.innerWidth,
    document.documentElement.clientWidth || window.innerWidth
  );

  const SIDE_PAD = 8; // минимальные поля слева/справа от экрана
  const MIN_W = 260;
  const MAX_W = 560;

  // Вычисляем желаемую ширину панели
  let w;
  if (mode === "mobile") {
    // На мобильном — примерно ширина поповера, но не шире вьюпорта.
    w = Math.max(MIN_W, Math.min(anchorRect.width, vw - (SIDE_PAD * 2 + sbw)));
  } else {
    // Десктоп — ограничиваем и по вьюпорту, и по MAX_W.
    const maxByViewport = vw - (SIDE_PAD * 2 + sbw);
    w = Math.max(MIN_W, Math.min(MAX_W, maxByViewport));
  }

  // Горизонтальное положение
  let leftPx;
  if (mode === "mobile") {
    // Крепимся к левому краю поповера (он сам центрируется по экрану).
    leftPx = Math.round(anchorRect.left);
  } else {
    // Центрируем под десктопным инпутом.
    leftPx = Math.round(anchorRect.left + (anchorRect.width - w) / 2);
  }

  // Зажимаем панель во вьюпорте
  const leftClamp = SIDE_PAD;
  const rightClamp = vw - SIDE_PAD - w - sbw;
  if (leftPx < leftClamp) leftPx = leftClamp;
  if (leftPx > rightClamp) leftPx = rightClamp;

  // Вертикальное положение: чуть ниже якоря
  const GAP_TOP = 8;
  let topBase = Math.round(anchorRect.bottom);
  const safeTop =
    typeof window.visualViewport?.offsetTop === "number"
      ? window.visualViewport.offsetTop
      : 0;
  const topPx = Math.max(safeTop, topBase + GAP_TOP);

  // Максимальная высота: оставляем “воздух” снизу
  const maxH = Math.max(160, window.innerHeight - topPx - 24);

  Object.assign(hostEl.style, {
    boxSizing: "border-box",
    width: w + "px",
    left: leftPx + "px",
    top: topPx + "px",
    right: "auto",
    transform: "none",
    paddingLeft: SIDE_PAD + "px",
    paddingRight: SIDE_PAD + sbw + "px",
    maxHeight: maxH + "px",
    overflow: "auto",
  });
}

/**
 * Экранирование текста для title/path.
 */
function esc(s = "") {
  return String(s).replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])
  );
}

// -----------------------------------------------------------------------------
// РЕНДЕР ОДНОГО РЕЗУЛЬТАТА
// -----------------------------------------------------------------------------

function itemToHTML(it) {
  const icon = it.type === "section" ? "▦" : "🔗";
  return `<li role="presentation">
    <button class="sr-item"
      role="option"
      data-type="${it.type}"
      data-page-index="${it.pageIndex}"
      data-section-index="${it.sectionIndex ?? ""}"
      data-button-index="${it.buttonIndex ?? ""}"
      data-page-id="${it.pageId || ""}"
      data-section-id="${it.sectionId || ""}"
      data-button-id="${it.buttonId || ""}"
      title="${esc(it.path)}">
      <span class="sr-ico">${icon}</span>
      <span class="sr-title">${esc(it.title)}</span>
      <span class="sr-path">${esc(it.path)}</span>
    </button>
  </li>`;
}

// -----------------------------------------------------------------------------
// INLINE-ПОДСВЕТКА СЕКЦИЙ НА ТЕКУЩЕЙ СТРАНИЦЕ
// -----------------------------------------------------------------------------

function applyInlineHighlight(raw) {
  const q = (raw || "").trim().toLowerCase();
  document.body.classList.toggle("search-active", !!q);
  const sections = document.querySelectorAll("#app-body .section");
  sections.forEach((sec) => {
    let hit = false;
    const title = (
      sec.querySelector(".section-title-text")?.textContent || ""
    ).toLowerCase();
    if (q && title.includes(q)) hit = true;
    if (!hit && q) {
      for (const lbl of sec.querySelectorAll(".assignment-label")) {
        const t = (lbl.textContent || "").toLowerCase();
        if (t.includes(q)) {
          hit = true;
          break;
        }
      }
    }
    if (q && hit) sec.dataset.searchHit = "1";
    else sec.removeAttribute("data-search-hit");
  });
}

function hardClearHighlights() {
  document.body.classList.remove("search-active");
  document
    .querySelectorAll("#app-body .section[data-search-hit]")
    .forEach((sec) => sec.removeAttribute("data-search-hit"));
}

// -----------------------------------------------------------------------------
// УПРАВЛЕНИЕ СПИСКОМ РЕЗУЛЬТАТОВ
// -----------------------------------------------------------------------------

function getItems() {
  return hostEl?.querySelectorAll(".sr-item") || [];
}

function setActiveDescendant(idOrNull) {
  const desktop = document.getElementById("searchInput");
  const mobile = document.getElementById("searchInputMobile");

  if (idOrNull) {
    desktop?.setAttribute("aria-activedescendant", idOrNull);
    mobile?.setAttribute("aria-activedescendant", idOrNull);
  } else {
    desktop?.removeAttribute("aria-activedescendant");
    mobile?.removeAttribute("aria-activedescendant");
  }
}

function setSearchExpanded(expanded) {
  const v = expanded ? "true" : "false";
  document.getElementById("searchInput")?.setAttribute("aria-expanded", v);
  document
    .getElementById("searchInputMobile")
    ?.setAttribute("aria-expanded", v);
}

function setActive(idx) {
  const items = getItems();
  items.forEach((el) => {
    el.classList.remove("is-active");
    el.setAttribute("aria-selected", "false");
  });
  activeIdx = -1;

  if (!items.length) {
    setActiveDescendant(null);
    return;
  }

  if (idx < 0) idx = 0;
  if (idx > items.length - 1) idx = items.length - 1;

  const el = items[idx];
  if (el) {
    el.classList.add("is-active");
    el.setAttribute("aria-selected", "true");
    activeIdx = idx;
    setActiveDescendant(el.id);
    el.scrollIntoView({ block: "nearest" });
  }
}

function moveActive(delta) {
  const items = getItems();
  if (!items.length) return;
  if (activeIdx === -1) return setActive(0);
  setActive(activeIdx + delta);
}

function activateCurrent() {
  const items = getItems();
  if (activeIdx >= 0 && items[activeIdx]) {
    items[activeIdx].click();
  }
}

function closeResultsList() {
  if (!hostEl || hostEl.hidden) return;
  hostEl.hidden = true;
  hostEl.innerHTML = "";
  activeIdx = -1;
  setActiveDescendant(null);
  setSearchExpanded(false);
  hardClearHighlights();

  if (document.activeElement?.classList?.contains("sr-item")) {
    document.activeElement.blur();
  }
}

// -----------------------------------------------------------------------------
// КЛИК ПО РЕЗУЛЬТАТУ
// -----------------------------------------------------------------------------

function onResultsClick(e) {
  const btn = e.target.closest(".sr-item");
  if (!btn || !hostEl?.contains(btn)) return;

  const payload = {
    pageIndex: Number(btn.dataset.pageIndex),
    sectionIndex:
      btn.dataset.sectionIndex === "" ? null : Number(btn.dataset.sectionIndex),
    buttonIndex:
      btn.dataset.buttonIndex === "" ? null : Number(btn.dataset.buttonIndex),
    sectionId: btn.dataset.sectionId || null,
    buttonId: btn.dataset.buttonId || null,
  };

  eventBus.emit("search:goto", payload);
  eventBus.emit("search:clear"); // выключаем фильтр

  closeResultsList();
}

function bindClicksOnce() {
  if (srClickBound) return;
  ensureHost();
  hostEl.addEventListener("click", onResultsClick, { passive: true });
  srClickBound = true;
}

// -----------------------------------------------------------------------------
// ОСНОВНОЙ РЕНДЕР
// -----------------------------------------------------------------------------

function render(q, results) {
  ensureHost();

  if (!q) {
    closeResultsList();
    applyInlineHighlight("");
    return;
  }

  setSearchExpanded(true);

  const listHTML = results.length
    ? `<ul class="sr-list" role="listbox" id="sr-list">
         ${results.map(itemToHTML).join("")}
       </ul>
       <div class="sr-hint" aria-hidden="true">Esc — close list · × — clear search</div>`
    : `<div class="sr-empty" aria-live="polite">No results</div>
       <div class="sr-hint" aria-hidden="true">Esc — close list · × — clear search</div>`;

  hostEl.innerHTML = listHTML;

  activeIdx = -1;
  [...hostEl.querySelectorAll(".sr-item")].forEach((el, i) => {
    el.id = `sr-opt-${i}`;
    el.setAttribute("role", "option");
    el.setAttribute("aria-selected", "false");
  });

  positionHost();
  hostEl.hidden = false;

  bindClicksOnce();
  applyInlineHighlight(q);
}

// -----------------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// -----------------------------------------------------------------------------

export function initGlobalSearchUI() {
  ensureHost();
  positionHost();

  // resize: сначала синхронизация layout'а поиска, потом позиционирование панели
  const handleResize = () => {
    syncSearchLayoutOnResize();
    if (hostEl && !hostEl.hidden) {
      positionHost();
    }
  };
  window.addEventListener("resize", handleResize);

  bindClicksOnce();

  // Click-away: клик вне результатов или поисковых инпутов закрывает только список
  const clickAway = (e) => {
    if (!hostEl || hostEl.hidden) return;

    const inResults = e.target.closest("#globalSearchResults");
    const inInputs =
      e.target.closest("#searchInput, #searchInputMobile") ||
      e.target.closest(".header-search-popover");

    if (!inResults && !inInputs) {
      closeResultsList(); // не трогаем текст в инпутах
    }
  };
  document.addEventListener("pointerdown", clickAway, true);
  document.addEventListener("touchstart", clickAway, true);

  // Клавиатура для списка результатов
  window.addEventListener(
    "keydown",
    (e) => {
      if (!hostEl || hostEl.hidden) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActive(+1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === "Enter") {
        if (activeIdx !== -1) {
          e.preventDefault();
          activateCurrent();
        }
      }
    },
    true
  );

  eventBus.on("search:results", ({ q, results }) => render(q, results));
  eventBus.on("search:clear", () => render("", []));

  // Esc закрывает ТОЛЬКО список результатов
  if (!window.__gsEscBound) {
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && hostEl && !hostEl.hidden) {
          e.preventDefault();
          closeResultsList();
        }
      },
      true
    );
    window.__gsEscBound = true;
  }

  // При первом открытии списка — сразу подсвечиваем первый элемент
  window.addEventListener("linkapp:sr-first", () => {
    if (hostEl && !hostEl.hidden) setActive(0);
  });

  // При скролле любого контейнера — перепозиционируем панель
  document.addEventListener(
    "scroll",
    () => {
      if (hostEl && !hostEl.hidden) positionHost();
    },
    true
  );

  // На всякий случай синхронизируем layout прямо при инициализации.
  syncSearchLayoutOnResize();
}
