// =============================================================================
// UI/SECTIONS.JS — Логика работы с секциями
// =============================================================================
// Что здесь:
// - Добавление новой секции (addNewSection)
// - Открытие модалки редактирования секции (openEditModal)
// - Сохранение изменений секции (saveSection)
// - Удаление секции с записью в историю (deleteSection)
// - Рендеринг секций на странице (renderSections)
// =============================================================================

import { eventBus } from "../core/event-bus.js";
import { storage } from "../core/storage.js";
import { renderButtons } from "./buttons.js";

let currentSearchQuery = "";

eventBus.on("search:results", ({ q }) => {
  currentSearchQuery = q || "";
});
eventBus.on("search:clear", () => {
  currentSearchQuery = "";
});

// =============================================================================
// ДОБАВЛЕНИЕ НОВОЙ СЕКЦИИ
// =============================================================================
/**
 * Добавить новую секцию на текущую страницу
 */
export function addNewSection() {
  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];

  // Проверка: страница существует?
  if (!page) {
    eventBus.emit("ui:toast", {
      type: "error",
      message: "Please create a page first!",
    });
    return;
  }

  // Создаём новую секцию с уникальным ID
  const newSectionId = `section-${Date.now()}`;
  const newSection = {
    text: "New Section",
    buttons: [],
  };

  // Обновляем данные через storage
  storage.update((data) => {
    const page = data.pages[data.currentPageIndex || 0];
    if (!page.sections) page.sections = {};

    // Инициализируем порядок из уже существующих секций (до добавления новой)
    if (!Array.isArray(page.sectionsOrder)) {
      page.sectionsOrder = Object.keys(page.sections);
    }

    page.sections[newSectionId] = newSection;
    page.sectionsOrder.push(newSectionId);
  });

  // Уведомляем систему о добавлении секции
  eventBus.emit("sections:added", { sectionId: newSectionId });

  // Показываем уведомление пользователю
  eventBus.emit("ui:toast", {
    type: "success",
    message: "Section added!",
  });
}

// =============================================================================
// ОТКРЫТИЕ МОДАЛКИ РЕДАКТИРОВАНИЯ СЕКЦИИ
// =============================================================================
/**
 * Открыть модалку для редактирования секции
 * @param {string} sectionId - ID секции для редактирования
 */
export function openEditModal(sectionId) {
  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  const section = page?.sections?.[sectionId];

  if (!section) {
    eventBus.emit("ui:toast", {
      type: "error",
      message: "Section not found!",
    });
    return;
  }

  // Отправляем событие для открытия модалки с данными секции
  eventBus.emit("modal:edit-section:open", {
    sectionId,
    text: section.text || "",
  });
}

// =============================================================================
// СОХРАНЕНИЕ ИЗМЕНЕНИЙ СЕКЦИИ
// =============================================================================
/**
 * Сохранить изменения секции (название)
 * @param {Object} params - Параметры сохранения
 * @param {string} params.sectionId - ID секции
 * @param {string} params.text - Новое название секции
 */
export function saveSection({ sectionId, text }) {
  // Проверка: заполнено ли название
  if (!text.trim()) {
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Section name cannot be empty!",
    });
    return;
  }

  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  const section = page?.sections?.[sectionId];

  if (!section) {
    eventBus.emit("ui:toast", {
      type: "error",
      message: "Section not found!",
    });
    return;
  }

  // Обновляем название секции
  storage.update((data) => {
    const page = data.pages[data.currentPageIndex || 0];
    const section = page.sections[sectionId];
    if (section) {
      section.text = text.trim();
    }
  });

  // Уведомляем систему об изменениях
  eventBus.emit("sections:updated", { sectionId });

  // Закрываем модалку
  eventBus.emit("modal:edit-section:close");

  // Показываем уведомление
  eventBus.emit("ui:toast", {
    type: "success",
    message: "Section saved!",
  });
}

// =============================================================================
// УДАЛЕНИЕ СЕКЦИИ (с записью в историю)
// =============================================================================
/**
 * Удалить секцию и добавить её в историю удалений
 * @param {string} sectionId - ID секции для удаления
 */
export function deleteSection(sectionId) {
  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  const section = page?.sections?.[sectionId];

  if (!section) {
    eventBus.emit("ui:toast", {
      type: "error",
      message: "Section not found!",
    });
    return;
  }

  // Обновляем данные: удаляем секцию и добавляем в историю
  storage.update((data) => {
    const page = data.pages[data.currentPageIndex || 0];
    const section = page.sections[sectionId];

    // Добавляем в историю удалений (сохраняем все кнопки внутри)
    if (!data.deletedItemsHistory) data.deletedItemsHistory = [];
    data.deletedItemsHistory.push({
      type: "section",
      // — контекст страницы/секции
      pageId: page.id, // NEW
      pageName: page.name, // NEW
      sectionId: sectionId, // NEW
      sectionName: section.text, // NEW
      pageIndex: data.currentPageIndex || 0, // NEW
      sectionIndex: Object.keys(page.sections).indexOf(sectionId), // NEW
      // — состав секции на момент удаления
      buttons: section.buttons || [],
      deletedAt: new Date().toISOString(),
    });

    // Удаляем секцию со страницы
    delete page.sections[sectionId];
    const i = page.sectionsOrder?.indexOf(sectionId);
    if (i >= 0) page.sectionsOrder.splice(i, 1);
  });

  // Уведомляем систему об удалении
  eventBus.emit("sections:deleted", { sectionId });

  // Закрываем модалку
  eventBus.emit("modal:edit-section:close");

  // Показываем уведомление
  eventBus.emit("ui:toast", {
    type: "info",
    message: "Section deleted. Check History to restore.",
  });
}
// =============================================================================
// РЕНДЕРИНГ СЕКЦИЙ (создание DOM-элементов)
// =============================================================================
/**
 * Отрендерить все секции текущей страницы
 * @param {HTMLElement} container - DOM-контейнер для секций
 */
// Фрагмент для замены в sections.js (строки ~130-220)
// Вставь этот блок вместо старого обработчика DnD

function escHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function highlightText(text = "", query = "") {
  if (!query) return escHtml(text);
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(safe, "gi");
  let i = 0,
    out = "",
    m;
  while ((m = re.exec(text))) {
    out += escHtml(text.slice(i, m.index));
    out += `<mark class="search-hl">${escHtml(m[0])}</mark>`;
    i = re.lastIndex;
  }
  out += escHtml(text.slice(i));
  return out;
}

export function renderSections(container, opts = {}) {
  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  if (!page || !page.sections) return;

  // ✅ создаём/находим отдельный контейнер только для секций
  let wrap = container.querySelector(".sections-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "sections-wrap";
    container.appendChild(wrap);
  }

  // ✅ чистим только секции, не трогая заголовок и прочее содержимое страницы
  wrap.innerHTML = "";

  const rawQuery = (currentSearchQuery || "").trim();
  const query = rawQuery.toLowerCase();

  // === DnD на уровне контейнера секций (вешаем один раз) ===
  if (!wrap.dataset.dndSectionsBound) {
    wrap.dataset.dndSectionsBound = "1";

    let dropMarker = document.createElement("div");
    dropMarker.className = "section-drop-marker";
    dropMarker.style.cssText = `/* твои стили */`;

    let sectionDropIndex = null;
    let isDraggingSection = false;

    const computeIndex = (host, clientY) => {
      const items = [...host.querySelectorAll(".section")];
      if (items.length === 0) return 0;
      let idx = items.length;
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        const middle = r.top + r.height / 2;
        if (clientY < middle) {
          idx = i;
          break;
        }
      }
      return idx;
    };

    wrap.addEventListener(
      "dragstart",
      (e) => {
        if (e.target.classList.contains("section-handle")) {
          isDraggingSection = true;
        }
      },
      true
    );

    wrap.addEventListener("dragover", (e) => {
      if (!isDraggingSection) {
        dropMarker.remove();
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const idx = computeIndex(wrap, e.clientY);
      sectionDropIndex = idx;

      const sections = [...wrap.querySelectorAll(".section")];
      if (idx < sections.length) {
        wrap.insertBefore(dropMarker, sections[idx]);
      } else {
        // ✅ теперь просто кладём маркер в конец «коробки секций»
        wrap.appendChild(dropMarker);
      }
    });

    wrap.addEventListener("dragleave", (e) => {
      if (!wrap.contains(e.relatedTarget)) {
        dropMarker.remove();
        sectionDropIndex = null;
      }
    });

    wrap.addEventListener("drop", (e) => {
      if (!isDraggingSection) return;
      let payload = null;
      try {
        payload = JSON.parse(
          e.dataTransfer.getData("application/json") || "{}"
        );
      } catch {}
      if (!payload || payload.kind !== "section") return;

      e.preventDefault();

      const targetIndex = sectionDropIndex ?? computeIndex(wrap, e.clientY);
      dropMarker.remove();
      sectionDropIndex = null;
      isDraggingSection = false;

      storage.update((d) => {
        const p = d.pages[d.currentPageIndex || 0];
        if (!Array.isArray(p.sectionsOrder))
          p.sectionsOrder = Object.keys(p.sections || {});
        const order = p.sectionsOrder;
        const fromIdx = order.indexOf(payload.sectionId);
        if (fromIdx < 0) return;

        const [movedId] = order.splice(fromIdx, 1);
        let insertAt = targetIndex;
        if (fromIdx < targetIndex) insertAt = Math.max(0, targetIndex - 1);
        insertAt = Math.min(Math.max(insertAt, 0), order.length);
        order.splice(insertAt, 0, movedId);
      });

      eventBus.emit("ui:toast", { type: "info", message: "Section reordered" });
    });

    wrap.addEventListener(
      "dragend",
      () => {
        dropMarker.remove();
        sectionDropIndex = null;
        isDraggingSection = false;
      },
      true
    );
  }

  // --- helper: toggle collapsed flag and persist ---
  const toggleCollapsed = (sid) => {
    let next;
    storage.update((d) => {
      const p = d.pages[d.currentPageIndex || 0];
      const s = p?.sections?.[sid];
      if (!s) return;
      next = !s.collapsed; // ← вычисляем будущее состояние один раз
      s.collapsed = next; //   и сохраняем
    });

    const secEl = document.querySelector(
      `.section[data-section-id="${CSS.escape(sid)}"]`
    );
    if (secEl) applyCollapsedState(secEl, next); // мгновенно обновляем UI
  };

  /** Находим «контейнер контента» секции (универсально для tiles/rows) */
  function findSectionContentEl(secEl) {
    return secEl.querySelector(
      '.assignments-grid, .assignments-list, [id^="assignments-grid-"], .section-content'
    );
  }

  /** Применяем состояние «свернуто/развернуто» к DOM секции */
  function applyCollapsedState(secEl, collapsed) {
    secEl.classList.toggle("collapsed", !!collapsed);

    const content = findSectionContentEl(secEl);
    if (content) {
      // делаем мгновенно и надёжно
      content.hidden = !!collapsed;
    }

    const chev = secEl.querySelector(".section-chevron");
    if (chev) chev.textContent = collapsed ? "▸" : "▾";
  }

  // Порядок секций
  const sectionIds = Array.isArray(page.sectionsOrder)
    ? page.sectionsOrder
    : Object.keys(page.sections);

  // === Рендер каждой секции ===
  sectionIds.forEach((sectionId, sIdx) => {
    const section = page.sections[sectionId];

    if (!section) return;

    // Контейнер секции
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "section";
    sectionDiv.dataset.id = sectionId;
    // 👇 атрибуты для глобального поиска/навигации
    sectionDiv.dataset.sectionId = sectionId;
    sectionDiv.dataset.sectionIndex = String(sIdx);

    // Заголовок секции
    const titleDiv = document.createElement("div");
    titleDiv.className = "section-title";
    titleDiv.dataset.id = sectionId;

    if (section.collapsed) sectionDiv.classList.add("collapsed");

    // ✅ Ручка секции (тянем ТОЛЬКО за неё)
    const sectionHandle = document.createElement("span");
    sectionHandle.className = "section-handle";
    sectionHandle.title = "Drag section";
    sectionHandle.textContent = "⋮⋮";
    titleDiv.prepend(sectionHandle);

    // Кнопка сворачивания/разворачивания
    const chevron = document.createElement("button");
    chevron.type = "button";
    chevron.className = "section-chevron ui-icon-btn ui-icon-16";
    chevron.title = "Collapse/expand";
    chevron.textContent = section.collapsed ? "▸" : "▾";
    // ставим после ручки и ПЕРЕД текстом
    titleDiv.appendChild(chevron);

    chevron.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCollapsed(sectionId);
    });

    // Alt+клик по заголовку секции — тоже переключает
    titleDiv.addEventListener("click", (e) => {
      if (e.altKey) {
        e.stopPropagation();
        toggleCollapsed(sectionId);
      }
    });

    if (!query) {
      sectionHandle.draggable = true;

      sectionHandle.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({
            kind: "section",
            sectionId,
          })
        );
        sectionDiv.classList.add("dragging");
        console.log("[DnD Sections] Section drag started:", sectionId);
      });

      sectionHandle.addEventListener("dragend", () => {
        sectionDiv.classList.remove("dragging");
      });
    }

    // Название секции
    const titleText = document.createElement("span");
    titleText.className = "section-title-text";
    if (rawQuery) {
      titleText.innerHTML = highlightText(section.text || "Section", rawQuery);
    } else {
      titleText.textContent = section.text || "Section";
    }
    titleDiv.appendChild(titleText);

    // Иконка редактирования секции
    const editIcon = document.createElement("button");
    editIcon.type = "button";
    editIcon.className = "section-edit-icon ui-icon-btn ui-icon-16";
    editIcon.setAttribute("aria-label", "Edit section");
    editIcon.textContent = "✎";
    editIcon.title = "Rename section";
    editIcon.dataset.sectionId = sectionId;
    titleDiv.appendChild(editIcon);

    editIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(sectionId);
    });

    sectionDiv.appendChild(titleDiv);

    // Контейнер для кнопок
    const buttonsGrid = document.createElement("div");
    buttonsGrid.className = "assignments-grid";
    buttonsGrid.id = `assignments-grid-${sectionId}`;
    sectionDiv.appendChild(buttonsGrid);

    // Рендерим кнопки (с учётом поиска)
    renderButtons(sectionId, buttonsGrid, { query: rawQuery });

    applyCollapsedState(sectionDiv, !!section.collapsed);
    // При активном поиске не показываем пустые секции
    // При глобальном поиске секции не скрываем — «приглушаем» стилями
    wrap.appendChild(sectionDiv);
  });
}

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ МОДУЛЯ
// =============================================================================
/**
 * Инициализировать обработчики событий для работы с секциями
 */
export function initSections() {
  const getCurrentPage = () => {
    const data = storage.get();
    return data.pages[data.currentPageIndex || 0] || null;
  };

  // Сохранение секции из модалки
  eventBus.on("section:save", saveSection);

  // Удаление секции (с сохранением в History)
  eventBus.on("section:delete", ({ sectionId }) => {
    storage.update((d) => {
      const pageIdx = d.currentPageIndex || 0;
      const page = d.pages?.[pageIdx];
      const section = page?.sections?.[sectionId];
      if (!page || !section) return;

      d.deletedItemsHistory = d.deletedItemsHistory || [];

      const sectionIndex = Array.isArray(page.sectionsOrder)
        ? page.sectionsOrder.indexOf(sectionId)
        : Object.keys(page.sections || {}).indexOf(sectionId);

      // В history кладём "снимок" секции (лучше клонировать, чтобы ничего не ссылалось)
      d.deletedItemsHistory.push({
        type: "section",
        deletedAt: Date.now(), // лучше число, чем ISO
        pageId: page.id,
        pageName: page.name,
        pageIndex: pageIdx,
        sectionId,
        sectionName: section.text,
        sectionIndex,
        buttons: Array.isArray(section.buttons)
          ? section.buttons.map((b) => ({
              id: b?.id,
              text: b?.text ?? b?.name ?? "",
              href: b?.href ?? b?.link ?? "",
            }))
          : [],
      });

      // Удаляем секцию + порядок
      delete page.sections[sectionId];
      if (Array.isArray(page.sectionsOrder)) {
        const i = page.sectionsOrder.indexOf(sectionId);
        if (i >= 0) page.sectionsOrder.splice(i, 1);
      }
    });

    eventBus.emit("modal:edit-section:close");
    eventBus.emit("ui:toast", {
      type: "info",
      message: "Section moved to History (you can restore it).",
    });
  });

  // Добавление новой секции ("+ Add section")
  eventBus.on("section:add", () => {
    storage.update((d) => {
      const page = d.pages[d.currentPageIndex || 0];
      if (!page.sections) page.sections = {};

      if (!Array.isArray(page.sectionsOrder)) {
        page.sectionsOrder = Object.keys(page.sections);
      } else {
        for (const sid of Object.keys(page.sections)) {
          if (!page.sectionsOrder.includes(sid)) page.sectionsOrder.push(sid);
        }
      }

      const newId = `section-${Date.now()}`;
      page.sections[newId] = { text: "New Section", buttons: [] };
      page.sectionsOrder.push(newId);
    });
  });

  // 🔥 ПЕРЕРИСОВКА ПРИ ИЗМЕНЕНИИ ПОИСКА (вынесено из section:add)
  eventBus.on("search:query", ({ q }) => {
    currentSearchQuery = q || "";
    const container =
      document.querySelector("#app-body") || document.getElementById("content");
    if (container) renderSections(container);
  });

  eventBus.on("search:clear", () => {
    currentSearchQuery = "";
    const container =
      document.querySelector("#app-body") || document.getElementById("content");
    if (container) renderSections(container);
  });

  eventBus.on(
    "search:focus-section",
    ({ sectionId, sectionIndex, buttonId, buttonIndex }) => {
      let secEl = null;

      // 1) пробуем найти секцию по id
      if (sectionId) {
        secEl = document.querySelector(
          `.section[data-section-id="${CSS.escape(sectionId)}"]`
        );
      }

      // 2) запасной вариант — по индексу
      if (!secEl && sectionIndex != null) {
        const sections = document.querySelectorAll(".section");
        secEl = sections[sectionIndex] || null;
      }

      // 3) если пришёл buttonId, находим кнопку и берём её секцию
      if (!secEl && buttonId) {
        const btnEl = document.querySelector(
          `[data-button-id="${CSS.escape(buttonId)}"]`
        );
        if (btnEl) {
          secEl = btnEl.closest(".section");
        }
      }

      if (!secEl) return;

      // --- Разворачиваем секцию, если вдруг есть логика "collapse" ---
      secEl.classList.remove("collapsed", "is-collapsed");
      secEl.dataset.collapsed = "false";

      // Снимаем possible hidden с контента
      const contentEl =
        secEl.querySelector(".assignments-grid") ||
        secEl.querySelector(".assignments-list") ||
        secEl.querySelector(".section-content");

      if (contentEl) {
        contentEl.hidden = false;
      }

      // Если переход был по секции (а не по кнопке) — фокус на первую кнопку
      if (!buttonId) {
        const firstBtn =
          secEl.querySelector(".assignment-button") ||
          secEl.querySelector(".link-card button, .button-card button");

        firstBtn?.focus?.();
      }
    }
  );

  console.log("✅ Sections module initialized");
}
/*
перестраховаться от крайне редкого совпадения Date.now() (например, при множественных авто-созданиях в один и тот же миллисекундный тик), можно генерировать id так:

const newId = `section-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

Но для ручных кликов это избыточно.
*/
