// =============================================================================
// UI/PAGINATION.JS — Пагинатор для переключения между страницами --- изменялась!!!
// =============================================================================
// Что здесь:
// - Рендеринг пагинатора (кнопки переключения страниц)
// - Кнопки "назад" / "вперёд"
// - Кнопка "+ Add page"
// - Кнопка "Delete current page"
// - Подсветка активной страницы
// =============================================================================

import { eventBus } from "../core/event-bus.js";
import { storage } from "../core/storage.js";

// =============================================================================
// РЕНДЕРИНГ ПАГИНАТОРА
// =============================================================================
/**
 * Отрендерить пагинатор с кнопками переключения страниц
 */

function bindSwipePages() {
  const host =
    document.getElementById("app-body") ||
    document.getElementById("linkapp-root") ||
    document.body;

  if (!host || host.__linkappSwipeBound) return;
  host.__linkappSwipeBound = true;

  let startX = 0;
  let startY = 0;
  let tracking = false;

  host.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    },
    { passive: true }
  );

  host.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking) return;
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // если вертикали много — считаем, что человек скроллит
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) {
        return;
      }

      // это уже свайп: гасим дальнейшие движения
      e.preventDefault();
      tracking = false;

      const d = storage.get() || {};
      const total = d.pages?.length || 0;
      if (!total) return;
      const cur = d.currentPageIndex || 0;

      if (dx > 0 && cur > 0) {
        eventBus.emit("page:switch", { pageIndex: cur - 1 });
      } else if (dx < 0 && cur < total - 1) {
        eventBus.emit("page:switch", { pageIndex: cur + 1 });
      }
    },
    { passive: false }
  );

  host.addEventListener(
    "touchend",
    () => {
      tracking = false;
    },
    { passive: true }
  );
  host.addEventListener(
    "touchcancel",
    () => {
      tracking = false;
    },
    { passive: true }
  );
}

function ensurePaginationContainer() {
  const root = document.getElementById("linkapp-root");
  const status = document.getElementById("app-status");

  // Удаляем дубликаты (если вдруг появились)
  const nodes = document.querySelectorAll("#pagination");
  let el = nodes[0] || null;
  for (let i = 1; i < nodes.length; i++) nodes[i].remove();

  // Если контейнера нет — создаём
  if (!el) {
    el = document.createElement("div");
    el.id = "pagination";
    el.className = "pagination";
  }

  // Обеспечиваем правильное место: ВНУТРИ root, ПЕРЕД статусбаром
  if (root) {
    const needBefore = status && status.parentElement === root ? status : null;
    if (el.parentElement !== root) {
      root.insertBefore(el, needBefore);
    } else if (needBefore && el.nextSibling !== needBefore) {
      root.insertBefore(el, needBefore);
    }
  }
  return el;
}

// === Global hotkeys for pages & sections ===
let hotkeysBound = false;

function isTypingTarget(el) {
  const t = el?.closest?.("input, textarea, select, [contenteditable='true']");
  return !!t;
}

function reorderCurrentPageBy(delta) {
  storage.update((d) => {
    const arr = d.pages || [];
    if (arr.length < 2) return;

    const from = Number(d.currentPageIndex || 0);
    const to = from + delta;

    if (to < 0 || to >= arr.length) return;

    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);

    d.currentPageIndex = to;
  });

  eventBus.emit("ui:toast", { type: "info", message: "Page reordered" });
}

function onGlobalKeydown(e) {
  const t = e.target;
  if (isTypingTarget(t)) return; // не мешаем вводу в полях

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

  // Alt + Shift + ↑/↓ — reorder current page
  if (
    e.altKey &&
    e.shiftKey &&
    (e.key === "ArrowUp" || e.key === "ArrowDown")
  ) {
    if (isTypingTarget(e.target)) return; // не мешаем вводу в инпутах/модалках
    e.preventDefault();

    const delta = e.key === "ArrowUp" ? -1 : +1;
    reorderCurrentPageBy(delta);
    return;
  }

  // Alt + ← / → : переключение страниц
  if (e.altKey && !cmdOrCtrl && !e.shiftKey) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const d = storage.get();
      const total = d.pages?.length || 0;
      if (total <= 1) return;

      const cur = d.currentPageIndex || 0;
      let next = cur;
      if (e.key === "ArrowLeft" && cur > 0) next = cur - 1;
      if (e.key === "ArrowRight" && cur < total - 1) next = cur + 1;

      if (next !== cur) {
        e.preventDefault();
        eventBus.emit("page:switch", { pageIndex: next });
      }
    }
  }

  // Alt + Shift + ←/→ : поменять местами текущую страницу с соседней
  if (
    e.altKey &&
    e.shiftKey &&
    !cmdOrCtrl &&
    (e.key === "ArrowLeft" || e.key === "ArrowRight")
  ) {
    e.preventDefault();
    const d = storage.get();
    const total = d.pages?.length || 0;
    if (total <= 1) return;

    const cur = d.currentPageIndex || 0;
    const dir = e.key === "ArrowLeft" ? -1 : 1;
    const to = cur + dir;
    if (to < 0 || to >= total) return;

    storage.update((data) => {
      const arr = data.pages;
      const [moved] = arr.splice(cur, 1);
      arr.splice(to, 0, moved);
      data.currentPageIndex = to;
    });
    return;
  }

  // Ctrl/Cmd + N : добавить секцию на текущую страницу
  if (
    cmdOrCtrl &&
    !e.shiftKey &&
    !e.altKey &&
    (e.key === "n" || e.key === "N")
  ) {
    e.preventDefault();
    eventBus.emit("section:add");
  }

  // Ctrl/Cmd + P : фокус на селектор страниц (jumper)
  if (cmdOrCtrl && (e.key === "p" || e.key === "P")) {
    const j = document.getElementById("page-jumper");
    if (j) {
      e.preventDefault();
      j.focus();
      // если это input — выделим номер, чтобы можно было сразу набрать новый
      if (typeof j.select === "function") {
        j.select();
      }
    }
  }
}

let bottomRO = null;

function computeBottomVars() {
  const root = document.documentElement;
  const header = document.getElementById("app-header");
  const status = document.getElementById("app-status");
  const pag = document.getElementById("pagination");

  const headerH = header?.offsetHeight || 0;
  const statusH = status?.offsetHeight || 0;
  const pagH = pag?.offsetHeight || 0;

  // 1) реальные значения в переменные (никаких «угаданных»)
  root.style.setProperty("--statusbar-h", `${statusH}px`);
  root.style.setProperty("--pagination-h", `${pagH}px`);

  // 2) #app-body должен дотягиваться до низа окна
  const minH = Math.max(0, window.innerHeight - headerH - statusH - pagH);
  root.style.setProperty("--computed-body-min-h", `${minH}px`);
}

function startBottomObservers() {
  if (bottomRO) bottomRO.disconnect();
  bottomRO = new ResizeObserver(() => {
    // Немного отложим, чтобы дождаться перерисовки кнопок в пагинаторе
    requestAnimationFrame(computeBottomVars);
  });

  const header = document.getElementById("app-header");
  const status = document.getElementById("app-status");
  const pag = document.getElementById("pagination");

  if (header) bottomRO.observe(header);
  if (status) bottomRO.observe(status);
  if (pag) bottomRO.observe(pag);

  window.addEventListener("resize", computeBottomVars);
  // Первичный расчёт после первого рендера
  requestAnimationFrame(computeBottomVars);
}

export function renderPagination() {
  const paginationContainer = ensurePaginationContainer();
  if (!paginationContainer) {
    console.warn("[pagination] container not found/created");
    return;
  }
  // Не трогаем visibility/styling отсюда — пусть управляет CSS
  paginationContainer.innerHTML = "";

  const data = storage.get();
  const totalPages = data.pages?.length || 0;
  const currentIndex = data.currentPageIndex || 0;

  // ===== КНОПКА "НАЗАД" (◀) =====
  // === стрелки/кнопки создаём СНАЧАЛА (чтобы не было "before initialization")
  const prevBtn = document.createElement("button");
  const pageStep = () => Math.max(120, (strip?.clientWidth || 0) - 120);

  prevBtn.className = "pagination-btn";
  prevBtn.textContent = "◀";
  prevBtn.title = "Previous page";
  prevBtn.disabled = currentIndex === 0;
  prevBtn.addEventListener("click", () => {
    if (!strip) return;
    strip.scrollBy({ left: -pageStep(), behavior: "smooth" });
  });

  const nextBtn = document.createElement("button");
  nextBtn.className = "pagination-btn";
  nextBtn.textContent = "▶";
  nextBtn.title = "Next page";
  nextBtn.disabled = totalPages === 0 || currentIndex === totalPages - 1;
  nextBtn.addEventListener("click", () => {
    if (!strip) return;
    strip.scrollBy({ left: +pageStep(), behavior: "smooth" });
  });

  const addPageBtn = document.createElement("button");
  addPageBtn.className = "pagination-btn ui-plus-btn pagination-add-btn";
  addPageBtn.setAttribute("aria-label", "Create a new page");
  addPageBtn.title = "Create a new page";
  addPageBtn.textContent = "";
  addPageBtn.addEventListener("click", () => {
    eventBus.emit("page:add");
  });

  // HINT: больше НЕ создаём общую кнопку удаления — удаляем «крестиком» на ярлыке.

  // === Лента (горизонтальный скролл)
  const strip = document.createElement("div");
  strip.className = "pagination-scroll";
  strip.setAttribute("tabindex", "0");

  // порядок в контейнере: ◀ [лента] ▶ [+]
  paginationContainer.appendChild(prevBtn);
  paginationContainer.appendChild(strip);
  paginationContainer.appendChild(nextBtn);
  paginationContainer.appendChild(addPageBtn);

  // --- DnD: подготовка ---
  let dropMarker = document.createElement("span");
  dropMarker.className = "page-drop-marker";
  let dropIndex = null;
  let isDraggingPage = false;

  // Вычисляем индекс вставки по X-координате курсора
  const computeIndex = (clientX) => {
    const items = [...strip.querySelectorAll(".page-number")];
    if (items.length === 0) return 0;
    let idx = items.length;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      const mid = r.left + r.width / 2;
      if (clientX < mid) {
        idx = i;
        break;
      }
    }
    return idx;
  };

  // Автоскролл ленты, если «подносим» к краям во время драга
  const maybeAutoScroll = (e) => {
    const EDGE = 36; // «горячая» зона у краёв
    const { left, right } = strip.getBoundingClientRect();
    if (e.clientX - left < EDGE)
      strip.scrollBy({ left: -24, behavior: "auto" });
    if (right - e.clientX < EDGE)
      strip.scrollBy({ left: +24, behavior: "auto" });
  };

  // DnD — события на ленте
  strip.addEventListener("dragover", (e) => {
    if (!isDraggingPage) return;
    e.preventDefault();
    maybeAutoScroll(e);

    const idx = computeIndex(e.clientX);
    dropIndex = idx;

    const nodes = [...strip.querySelectorAll(".page-number")];
    if (idx < nodes.length) {
      strip.insertBefore(dropMarker, nodes[idx]);
    } else {
      strip.appendChild(dropMarker);
    }
  });

  strip.addEventListener("dragleave", (e) => {
    if (!strip.contains(e.relatedTarget)) {
      dropMarker.remove();
      dropIndex = null;
    }
  });

  strip.addEventListener("drop", (e) => {
    if (!isDraggingPage) return;
    e.preventDefault();

    let payload = null;
    try {
      payload = JSON.parse(e.dataTransfer.getData("application/json") || "{}");
    } catch {}

    if (!payload || payload.kind !== "page") return;

    const target = dropIndex ?? computeIndex(e.clientX);

    dropMarker.remove();
    dropIndex = null;
    isDraggingPage = false;

    // Меняем порядок страниц в storage
    storage.update((d) => {
      const arr = d.pages || [];
      const from = payload.fromIndex;
      if (from < 0 || from >= arr.length) return;

      const [moved] = arr.splice(from, 1);
      // сдвиг индекса, если «вынимаем» слева от места вставки
      let insertAt = target;
      if (from < insertAt) insertAt = Math.max(0, insertAt - 1);
      insertAt = Math.min(Math.max(insertAt, 0), arr.length);
      arr.splice(insertAt, 0, moved);

      // корректируем currentPageIndex
      const cur = d.currentPageIndex || 0;
      if (cur === from) d.currentPageIndex = insertAt;
      else if (from < cur && insertAt >= cur) d.currentPageIndex = cur - 1;
      else if (from > cur && insertAt <= cur) d.currentPageIndex = cur + 1;
    });

    eventBus.emit("ui:toast", { type: "info", message: "Page reordered" });
  });

  // === Ярлыки страниц (с "крестиком")
  for (let i = 0; i < totalPages; i++) {
    const page = data.pages[i];
    const fullName =
      page && typeof page.name === "string" && page.name.trim()
        ? page.name.trim()
        : `Page ${i + 1}`;
    const short = fullName.length > 8 ? fullName.slice(0, 8) + "…" : fullName;

    const pageBtn = document.createElement("button");
    pageBtn.className = "pagination-btn page-number";
    // --- ручка для DnD
    const handle = document.createElement("span");
    handle.className = "page-handle";
    handle.title = "Drag page";
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "⋮⋮"; // тот же символ, что в секциях

    // --- текст ярлыка
    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = `${i + 1}: ${short}`;

    // Собираем кнопку: [handle][label][close]
    pageBtn.appendChild(handle);
    // Тянуть только за ручку
    handle.draggable = true;
    handle.addEventListener("dragstart", (e) => {
      e.stopPropagation(); // чтобы не кликался таб
      isDraggingPage = true;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({ kind: "page", fromIndex: i })
      );
      pageBtn.classList.add("dragging");
    });
    handle.addEventListener("dragend", () => {
      isDraggingPage = false;
      dropMarker.remove();
      pageBtn.classList.remove("dragging");
    });
    // клик по ручке не должен переключать страницу
    handle.addEventListener("click", (e) => e.stopPropagation());

    pageBtn.appendChild(label);

    pageBtn.title = fullName;

    pageBtn.dataset.index = i;

    // Не дизейблим активный — иначе нельзя будет нажать на «крестик» внутри
    if (i === currentIndex) {
      //  pageBtn.classList.add("active"); // ❌ pageBtn тут не виден --- плохо, заменить
      pageBtn.setAttribute("aria-current", "page");
    }

    pageBtn.addEventListener("click", () => {
      eventBus.emit("page:switch", { pageIndex: i });
    });

    // Крестик удаления
    const close = document.createElement("span");
    close.className = "page-close";
    close.textContent = "✕";
    close.title = "Delete this page";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      eventBus.emit("page:deleteAt", { pageIndex: i });
    });

    pageBtn.appendChild(close); // ❌ pageBtn тут не виден --- плохо, заменить
    strip.appendChild(pageBtn);
  }

  // Вертикальное колесо — в горизонтальный скролл ленты
  strip.addEventListener("wheel", (e) => {
    const dx = Math.abs(e.deltaX);
    const dy = Math.abs(e.deltaY);
    if (dy > dx) {
      strip.scrollBy({ left: e.deltaY, behavior: "smooth" });
      e.preventDefault();
    }
  });

  // автопрокрутка к активной вкладке (или по индексу)
  requestAnimationFrame(() => {
    // strip у тебя объявлен выше: const strip = document.createElement("div");
    // он уже добавлен в DOM
    const target =
      strip.querySelector(`.page-number[data-index="${currentIndex}"]`) ||
      strip.querySelector(".page-number.active");
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  });

  function updateArrows() {
    if (!strip) return;
    const atStart = strip.scrollLeft <= 0;
    const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
  }

  // подписываемся один раз
  strip.addEventListener("scroll", updateArrows);

  // инициализируем состояние стрелок после первого рендера
  requestAnimationFrame(updateArrows);
}

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ МОДУЛЯ
// =============================================================================
/**
 * Инициализировать пагинатор и подписаться на события
 */
export function initPagination() {
  // Рендерим пагинатор при загрузке
  renderPagination();

  // пересчитываем при любых изменениях данных/страниц
  eventBus.on("storage:updated", () => {
    renderPagination();
  });
  eventBus.on("pages:switched", () => {
    renderPagination();
  });
  eventBus.on("pages:added", () => {
    renderPagination();
  });
  eventBus.on("pages:deleted", () => {
    renderPagination();
  });

  eventBus.on("pagination:scrollTo", ({ pageIndex }) => {
    const root = document.getElementById("pagination");
    if (!root) return;
    const scroller = root.querySelector(".pagination-scroll") || root;
    const target = scroller.querySelector(
      `.page-number[data-index="${pageIndex}"]`
    );
    if (!target) return;
    // мягко докрутить так, чтобы ярлык был виден
    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  });

  if (!hotkeysBound) {
    window.addEventListener("keydown", onGlobalKeydown, { passive: false });
    hotkeysBound = true;
  }

  startBottomObservers();
  bindSwipePages();
  console.log("✅ Pagination module initialized");
}
