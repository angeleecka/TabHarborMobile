// =============================================================================
// UI/HISTORY.JS — Корзина удалённых элементов (кнопок и секций)
// =============================================================================
// Что здесь:
// - Открытие модалки истории (openHistoryModal)
// - Рендеринг списка удалённых элементов (renderHistoryList)
// - Восстановление элемента из истории (restoreItem)
// - Удаление элемента из истории навсегда (deleteFromHistory)
// - Очистка всей истории (clearHistory)
// =============================================================================

import { eventBus } from "../core/event-bus.js";
import { storage } from "../core/storage.js";
import { openModal } from "./modal-service.js";

const HISTORY_TTL_DAYS = 30;
const HISTORY_MAX_ITEMS = 200;

function toTs(v) {
  if (!v) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = Date.parse(v); // поддержит ISO
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function pruneHistory() {
  const cutoff = Date.now() - HISTORY_TTL_DAYS * 24 * 60 * 60 * 1000;

  storage.update((d) => {
    const arr = Array.isArray(d.deletedItemsHistory)
      ? d.deletedItemsHistory
      : [];

    const filtered = arr.filter((it) => {
      const ts = toTs(it.deletedAt);
      return ts == null ? true : ts >= cutoff;
    });

    // оставляем только последние записи (чтобы не пухло)
    d.deletedItemsHistory =
      filtered.length > HISTORY_MAX_ITEMS
        ? filtered.slice(filtered.length - HISTORY_MAX_ITEMS)
        : filtered;
  });
}

function escapeHtml(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[ch])
  );
}

// минимальный санитайзер для href: режем только откровенный XSS (javascript:, data:)
function sanitizeUrl(raw = "") {
  const s = String(raw).trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
    return "";
  }
  return s;
}

// =============================================================================
// ОТКРЫТИЕ МОДАЛКИ ИСТОРИИ УДАЛЕНИЙ
// =============================================================================
/**
 * Открыть модалку с историей удалённых элементов
 */
export function openHistoryModal() {
  pruneHistory();

  const data = storage.get();
  const history = data.deletedItemsHistory || [];

  // Отправляем событие для открытия модалки с данными истории
  eventBus.emit("modal:history:open", { history });
}

// =============================================================================
// РЕНДЕРИНГ СПИСКА УДАЛЁННЫХ ЭЛЕМЕНТОВ
// =============================================================================
/**
 * Отрендерить список удалённых элементов внутри модалки
 * @param {HTMLElement} container - DOM-контейнер для списка
 */
export function renderHistoryList(container) {
  const data = storage.get();
  const history = data.deletedItemsHistory || [];

  // Очищаем контейнер
  container.innerHTML = "";

  // подсказка про авто-очистку
  const hint = document.createElement("div");
  hint.className = "history-hint";
  hint.innerHTML = `<small>Items older than 30 days are removed automatically.</small>`;
  container.appendChild(hint);

  // Если история пустая — показываем сообщение
  if (history.length === 0) {
    container.innerHTML =
      '<p style="color: #666;">Deletion history is empty.</p>';
    return;
  }

  // Разворачиваем массив (последние удалённые — сверху)
  const reversed = [...history].reverse();

  // Рендерим каждый элемент истории
  reversed.forEach((item, idx) => {
    // Вычисляем оригинальный индекс в массиве (для операций restore/delete)
    const originalIndex = history.length - 1 - idx;

    // Создаём контейнер элемента
    const itemDiv = document.createElement("div");
    itemDiv.className = "history-item";

    // Формируем содержимое в зависимости от типа элемента
    let content = "";

    if (item.type === "button") {
      const path = `${item.pageName || "(unknown page)"} / ${
        item.sectionName || "(unknown section)"
      }`;

      const safeName = escapeHtml(item.name || "Unnamed");
      const rawLink = item.link || "";
      const sanitizedHref = sanitizeUrl(rawLink);
      const hrefAttr = sanitizedHref || "#"; // если ссылка подозрительная/пустая — просто "#"
      const safeHref = escapeHtml(hrefAttr);
      const safeLinkText = escapeHtml(rawLink || "No link");
      const safePath = escapeHtml(path);

      content = `
        <p><strong>Button:</strong> ${safeName}</p>
        <p><strong>Link:</strong> <a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLinkText}</a></p>
        <p class="origin-path"><small>From: ${safePath}</small></p>
      `;
    } else if (item.type === "section") {
      const buttonsCount = Array.isArray(item.buttons)
        ? item.buttons.length
        : 0;
      const label = item.sectionName || item.name || "Unnamed";
      const page = item.pageName || "(unknown page)";

      const safeLabel = escapeHtml(label);
      const safePage = escapeHtml(page);

      content = `
        <p><strong>Section:</strong> ${safeLabel}</p>
        <p>(Contains ${buttonsCount} button${buttonsCount !== 1 ? "s" : ""})</p>
        <p class="origin-path"><small>From: ${safePage}</small></p> 
      `;
    } else if (item.type === "page") {
      // page snapshot может храниться по-разному — поддержим оба варианта
      const pageObj = item.page || item.snapshot || null;
      const label = item.pageName || item.name || pageObj?.name || "Unnamed";
      const sectionsObj =
        pageObj && pageObj.sections && !Array.isArray(pageObj.sections)
          ? pageObj.sections
          : item.sections && !Array.isArray(item.sections)
          ? item.sections
          : {};

      const sectionIds = Object.keys(sectionsObj || {});
      const sectionsCount = sectionIds.length;

      let linksCount = 0;
      for (const sid of sectionIds) {
        const sec = sectionsObj[sid];
        if (Array.isArray(sec?.buttons)) linksCount += sec.buttons.length;
      }

      const safeLabel = escapeHtml(label);

      content = `
        <p><strong>Page:</strong> ${safeLabel}</p>
        <p>(Contains ${sectionsCount} section${
        sectionsCount !== 1 ? "s" : ""
      }, ${linksCount} link${linksCount !== 1 ? "s" : ""})</p>
      `;
    }

    // Дата удаления
    const date = item.deletedAt
      ? new Date(item.deletedAt).toLocaleString()
      : "Unknown";
    content += `<p class="deleted-at">Deleted: ${escapeHtml(date)}</p>`;

    itemDiv.innerHTML = content;

    // ===== КНОПКА "RESTORE" (восстановить) =====
    const restoreBtn = document.createElement("button");
    restoreBtn.textContent = "Restore";
    restoreBtn.className = "restore-button";
    restoreBtn.title = "Restore this item";
    restoreBtn.addEventListener("click", () => {
      restoreItem(originalIndex);
    });

    // ===== ИКОНКА "🗑️" (удалить из истории навсегда) =====
    const deleteIcon = document.createElement("span");
    deleteIcon.textContent = "🗑️";
    deleteIcon.className = "delete-from-history-icon";
    deleteIcon.title = "Delete this item from history permanently";
    deleteIcon.addEventListener("click", () => {
      eventBus.emit("modal:confirm:open", {
        title: "Delete from History?",
        message: "Delete this item from history permanently?",
        confirmText: "Delete",
        cancelText: "Cancel",
        onConfirm: () => deleteFromHistory(originalIndex),
      });
    });

    // Контейнер для кнопок действий
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "history-item-actions";
    actionsDiv.appendChild(restoreBtn);
    actionsDiv.appendChild(deleteIcon);

    itemDiv.appendChild(actionsDiv);
    container.appendChild(itemDiv);
  });

  console.log(`[history] Rendered ${history.length} items`);
}

// =============================================================================
// ВОССТАНОВЛЕНИЕ ЭЛЕМЕНТА ИЗ ИСТОРИИ
// =============================================================================
/**
 * Восстановить удалённый элемент (кнопку или секцию)
 * @param {number} historyIndex - Индекс элемента в массиве deletedItemsHistory
 */
export function restoreItem(historyIndex) {
  const data = storage.get();
  const history = data.deletedItemsHistory || [];

  // Проверка индекса
  if (historyIndex < 0 || historyIndex >= history.length) {
    console.error("[history] Invalid restore index:", historyIndex);
    eventBus.emit("ui:toast", {
      type: "error",
      message: "Item not found in history!",
    });
    return;
  }

  const item = history[historyIndex];

  // ====== ХЕЛПЕРЫ (локальные) ======
  const findPageIndexById = (id) =>
    id ? storage.get().pages.findIndex((p) => p.id === id) : -1;

  const ensureRestoredPageIndex = () => {
    let idx = storage
      .get()
      .pages.findIndex((p) => (p.name || "").toLowerCase() === "restored");
    if (idx !== -1) return idx;
    storage.update((d) => {
      d.pages.push({
        id: `page-restored-${Date.now()}`,
        name: "Restored",
        sections: {},
      });
    });
    return storage.get().pages.length - 1;
  };

  const ensureSectionOnPage = (pageIndex, titleHint = "Restored") => {
    let createdId = null;
    storage.update((d) => {
      const page = d.pages[pageIndex];
      if (!page.sections) page.sections = {};
      // Ищем секцию с названием, начинающимся на "Restored"
      const existingId = Object.keys(page.sections).find((id) =>
        (page.sections[id]?.text || "").toLowerCase().startsWith("restored")
      );
      if (existingId) {
        createdId = existingId;
        return;
      }
      createdId = `section-restored-${Date.now()}`;
      page.sections[createdId] = { text: titleHint, buttons: [] };

      // ✅ поддерживаем sectionsOrder
      if (!Array.isArray(page.sectionsOrder)) {
        page.sectionsOrder = Object.keys(page.sections).filter(
          (id) => id !== createdId
        );
      }
      if (!page.sectionsOrder.includes(createdId))
        page.sectionsOrder.push(createdId);
    });
    return createdId;
  };

  const closeHistoryModal = () => eventBus.emit("modal:history:close");

  // ====== ВОССТАНОВЛЕНИЕ КНОПКИ ======
  if (item.type === "button") {
    const pageIdx = findPageIndexById(item.pageId);
    const hasPage = pageIdx !== -1;
    const curData = storage.get();
    const hasSection =
      hasPage &&
      curData.pages[pageIdx].sections &&
      curData.pages[pageIdx].sections[item.sectionId];

    // (A) Тихий возврат "как было"
    if (hasPage && hasSection) {
      let restoredBtn = null;
      storage.update((d) => {
        const page = d.pages[pageIdx];
        const section = page.sections[item.sectionId];
        const btn = {
          id: `button-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
          text: item.name || "Restored button",
          href: item.link || "",
        };
        restoredBtn = btn; // понадобится для Undo
        const at = Number.isInteger(item.buttonIndex)
          ? Math.min(Math.max(item.buttonIndex, 0), section.buttons.length)
          : section.buttons.length;
        section.buttons.splice(at, 0, btn);
        d.deletedItemsHistory.splice(historyIndex, 1);
      });

      closeHistoryModal();
      eventBus.emit("pages:switched", {}); // форсим перерисовку текущей страницы

      eventBus.emit("ui:toast", {
        type: "info", // ⬅️ было "success"
        message: `Button "${item.name || "Restored"}" restored to ${
          item.pageName || "Page"
        } / ${item.sectionName || "Section"}`,
        action: {
          label: "Undo",
          event: "history:undo",
          payload: {
            type: "button",
            pageIdx,
            sectionId: item.sectionId,
            buttonId: restoredBtn.id,
            historyItem: JSON.parse(JSON.stringify(item)),
          },
        },
      });

      return;
    }

    // (B) Предков нет — спрашиваем и отправляем в Restored
    const modal = openModal({
      title: "Restore Button",
      bodyHTML: `
        <p>Parent container not found. What would you like to do?</p>
        <div class="modal-actions">
          <button class="btn" id="btnRecreate">Recreate missing parent(s)</button>
          <button class="btn" id="btnToRestored">To “Restored”</button>
          <button class="btn cancel" id="btnCancel">Cancel</button>
        </div>
      `,
    });

    // (A) Recreate missing page/section по сохранённым данным
    document.getElementById("btnRecreate")?.addEventListener("click", () => {
      // 1) страница по сохранённым данным
      let targetPageIndex = findPageIndexById(item.pageId);
      if (targetPageIndex === -1) {
        storage.update((d) => {
          d.pages.push({
            id: item.pageId || `page-${Date.now()}`,
            name: item.pageName || "Restored",
            sections: {},
          });
        });
        targetPageIndex = storage.get().pages.length - 1;
      }

      // 2) секция на этой странице
      const ensureSection = () => {
        const d = storage.get();
        const page = d.pages[targetPageIndex];
        if (!page.sections) page.sections = {};
        let sid = item.sectionId || `section-${Date.now()}`;
        if (page.sections[sid])
          sid = `${sid}-restored-${Math.floor(Math.random() * 1e3)}`;
        storage.update((dd) => {
          const p = dd.pages[targetPageIndex];
          if (!p.sections[sid]) {
            p.sections[sid] = {
              text: item.sectionName || item.name || "Restored",
              buttons: [],
            };
          }
          // ✅ IMPORTANT: если есть sectionsOrder — секцию надо туда добавить, иначе UI её не покажет
          if (!Array.isArray(p.sectionsOrder)) {
            p.sectionsOrder = Object.keys(p.sections).filter(
              (id) => id !== sid
            );
          }
          p.sectionsOrder = p.sectionsOrder.filter((id) => id !== sid);
          p.sectionsOrder.push(sid);
        });
        return sid;
      };
      const targetSectionId = ensureSection();

      // 3) вставляем кнопку + удаляем из истории
      let restoredBtn = null;
      storage.update((d) => {
        const page = d.pages[targetPageIndex];
        const section = page.sections[targetSectionId];
        const btn = {
          id: `button-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
          text: item.name || "Restored button",
          href: item.link || "",
        };
        restoredBtn = btn;
        const at = Number.isInteger(item.buttonIndex)
          ? Math.min(Math.max(item.buttonIndex, 0), section.buttons.length)
          : section.buttons.length;
        section.buttons.splice(at, 0, btn);
        d.deletedItemsHistory.splice(historyIndex, 1);
      });

      modal?.close?.();
      closeHistoryModal();

      eventBus.emit("ui:toast", {
        type: "info",
        message: `Button "${
          item.name || "Restored"
        }" restored (recreated parents)`,
        action: {
          label: "Undo",
          event: "history:undo",
          payload: {
            type: "button",
            pageIdx: targetPageIndex,
            sectionId: targetSectionId,
            buttonId: restoredBtn.id,
            historyItem: JSON.parse(JSON.stringify(item)),
          },
        },
      });
    });

    // (B) To “Restored” — оставить как было у тебя
    document.getElementById("btnToRestored")?.addEventListener("click", () => {
      const targetPageIdx = ensureRestoredPageIndex();
      const targetSectionId = ensureSectionOnPage(targetPageIdx, "Restored");

      let restoredBtn = null; // NEW
      storage.update((d) => {
        const page = d.pages[targetPageIdx];
        const section = page.sections[targetSectionId];
        const btn = {
          id: `button-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
          text: item.name || "Restored button",
          href: item.link || "",
        };
        restoredBtn = btn; // NEW
        section.buttons.push(btn);
        d.deletedItemsHistory.splice(historyIndex, 1);
      });

      modal?.close?.();
      closeHistoryModal();
      eventBus.emit("pages:switched", {}); // форсим перерисовку текущей страницы

      eventBus.emit("ui:toast", {
        type: "info",
        message: `Button "${item.name || "Restored"}" restored to “Restored”`,
        action: {
          label: "Undo",
          event: "history:undo",
          payload: {
            type: "button",
            pageIdx: targetPageIdx,
            sectionId: targetSectionId,
            buttonId: restoredBtn.id,
            historyItem: JSON.parse(JSON.stringify(item)),
          },
        },
      });
    });

    document
      .getElementById("btnCancel")
      ?.addEventListener("click", () => modal?.close?.());

    return;
  }

  // ====== ВОССТАНОВЛЕНИЕ СТРАНИЦЫ ======
  if (item.type === "page") {
    const pageObj = item.page || item.snapshot || null;

    // если snapshot не передали — хотя бы создадим пустую страницу
    const basePage = pageObj || {
      id: item.pageId || `page-${Date.now()}`,
      name: item.pageName || item.name || "Restored page",
      sections: {},
    };

    let insertedIndex = -1;
    let insertedPageId = null;

    storage.update((d) => {
      if (!Array.isArray(d.pages)) d.pages = [];

      // если такой id уже существует — создадим новый, чтобы не конфликтовать
      const exists = d.pages.some((p) => p?.id === basePage.id);
      const newId = exists ? `page-restored-${Date.now()}` : basePage.id;

      // клонируем page + фиксируем id
      const clone = JSON.parse(JSON.stringify(basePage));
      clone.id = newId;
      if (!clone.sections || Array.isArray(clone.sections)) clone.sections = {};

      // позиция восстановления (если при удалении сохранишь pageIndex — встанет “как было”)
      const at = Number.isInteger(item.pageIndex)
        ? Math.min(Math.max(item.pageIndex, 0), d.pages.length)
        : d.pages.length;

      d.pages.splice(at, 0, clone);
      d.currentPageIndex = at; // показать восстановленную страницу

      insertedIndex = at;
      insertedPageId = newId;

      d.deletedItemsHistory.splice(historyIndex, 1);
    });

    closeHistoryModal();
    eventBus.emit("pages:added", {});
    eventBus.emit("pages:switched", {}); // форсим перерисовку текущей страницы

    eventBus.emit("ui:toast", {
      type: "info",
      message: `Page "${
        item.pageName || basePage?.name || "Restored"
      }" restored`,
      action: {
        label: "Undo",
        event: "history:undo",
        payload: {
          type: "page",
          pageIdx: insertedIndex,
          pageId: insertedPageId,
          historyItem: JSON.parse(JSON.stringify(item)),
        },
      },
    });

    return;
  }

  // ====== ВОССТАНОВЛЕНИЕ СЕКЦИИ ======
  if (item.type === "section") {
    const pageIdx = findPageIndexById(item.pageId);
    const hasPage = pageIdx !== -1;

    // (A) Тихий возврат "как было"
    if (hasPage) {
      let createdSectionId = null; // ← NEW
      storage.update((d) => {
        const page = d.pages[pageIdx];
        if (!page.sections) page.sections = {};

        let newId =
          item.sectionId && !page.sections[item.sectionId]
            ? item.sectionId
            : `section-${Date.now()}`;
        while (page.sections[newId])
          newId = `${newId}-${Math.floor(Math.random() * 1e3)}`;

        const buttons = (item.buttons || []).map((b) => ({
          id:
            b?.id || `button-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
          text: b?.text || b?.name || "Restored button",
          href: b?.href || b?.link || "",
        }));

        page.sections[newId] = {
          text: item.sectionName || item.name || "Restored section",
          buttons,
        };

        // ✅ IMPORTANT: добавить секцию в порядок, иначе UI может её не показывать
        if (!Array.isArray(page.sectionsOrder)) {
          // если порядка не было — создадим из существующих секций (кроме новой)
          page.sectionsOrder = Object.keys(page.sections).filter(
            (id) => id !== newId
          );
        }
        // убрать возможные дубли
        page.sectionsOrder = page.sectionsOrder.filter((id) => id !== newId);

        // индекс восстановления (если невалидный — вставим в конец)
        const rawIdx = item.sectionIndex;
        const at =
          Number.isInteger(rawIdx) && rawIdx >= 0
            ? Math.min(rawIdx, page.sectionsOrder.length)
            : page.sectionsOrder.length;

        page.sectionsOrder.splice(at, 0, newId);

        createdSectionId = newId; // ← NEW
        d.deletedItemsHistory.splice(historyIndex, 1);
      });

      closeHistoryModal();
      eventBus.emit("pages:switched", {}); // форсим перерисовку текущей страницы

      eventBus.emit("ui:toast", {
        type: "success",
        message: `Section "${
          item.sectionName || item.name || ""
        }" restored to page: ${item.pageName || "Page"}`,
        action: {
          // ← NEW — Undo
          label: "Undo",
          event: "history:undo",
          payload: {
            type: "section",
            pageIdx,
            sectionNewId: createdSectionId,
            historyItem: JSON.parse(JSON.stringify(item)),
          },
        },
      });
      return;
    }

    // (B) Страницы нет — спрашиваем и отправляем в Restored
    const modal = openModal({
      title: "Restore Section",
      bodyHTML: `
        <p>Parent page not found. What would you like to do?</p>
        <div class="modal-actions">
          <button class="btn" id="secRecreate">Recreate missing page</button>
          <button class="btn" id="secToRestored">To “Restored” page</button>
          <button class="btn cancel" id="secCancel">Cancel</button>
        </div>
      `,
    });

    // (A) Recreate missing page и вернуть секцию туда
    document.getElementById("secRecreate")?.addEventListener("click", () => {
      // 1) создаём (или берём) страницу по сохранённым данным
      let targetPageIndex = findPageIndexById(item.pageId);
      if (targetPageIndex === -1) {
        storage.update((d) => {
          d.pages.push({
            id: item.pageId || `page-${Date.now()}`,
            name: item.pageName || item.name || "Restored",
            sections: {},
          });
        });
        targetPageIndex = storage.get().pages.length - 1;
      }

      // 2) создаём секцию (пытаемся использовать исходный sectionId/sectionName)
      let createdSectionId = null; // ← NEW
      storage.update((d) => {
        const page = d.pages[targetPageIndex];
        if (!page.sections) page.sections = {};
        let newId = item.sectionId || `section-${Date.now()}`;
        if (page.sections[newId]) {
          newId = `${newId}-restored-${Math.floor(Math.random() * 1e3)}`;
        }

        const buttons = (item.buttons || []).map((b) => ({
          id:
            b?.id || `button-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
          text: b?.text || b?.name || "Restored button",
          href: b?.href || b?.link || "",
        }));

        page.sections[newId] = {
          text: item.sectionName || item.name || "Restored section",
          buttons,
        };
        createdSectionId = newId; // ← NEW
        d.deletedItemsHistory.splice(historyIndex, 1);
      });

      modal?.close?.();
      closeHistoryModal();

      eventBus.emit("ui:toast", {
        type: "success",
        message: `Section "${
          item.sectionName || item.name || ""
        }" restored to page: ${item.pageName || "Page"}`,
        action: {
          // ← кнопка Undo
          label: "Undo",
          event: "history:undo",
          payload: {
            type: "section",
            pageIdx: targetPageIndex, // ← был pageIdx, нужно targetPageIndex
            sectionNewId: createdSectionId,
            historyItem: JSON.parse(JSON.stringify(item)),
          },
        },
      });
    });

    // (B) To “Restored” page — оставить как было
    document.getElementById("secToRestored")?.addEventListener("click", () => {
      const targetPageIdx = ensureRestoredPageIndex();

      let createdSectionId = null; // NEW
      storage.update((d) => {
        const page = d.pages[targetPageIdx];
        if (!page.sections) page.sections = {};
        let newId = `section-${Date.now()}`;
        while (page.sections[newId])
          newId = `${newId}-${Math.floor(Math.random() * 1e3)}`;

        const buttons = (item.buttons || []).map((b) => ({
          id:
            b?.id || `button-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
          text: b?.text || b?.name || "Restored button",
          href: b?.href || b?.link || "",
        }));

        page.sections[newId] = {
          text: item.sectionName || item.name || "Restored section",
          buttons,
        };
        createdSectionId = newId; // NEW
        d.deletedItemsHistory.splice(historyIndex, 1);
      });

      modal?.close?.();
      closeHistoryModal();

      eventBus.emit("ui:toast", {
        type: "success",
        message: `Section "${
          item.sectionName || item.name || ""
        }" restored to “Restored”`,
        action: {
          // NEW — Undo
          label: "Undo",
          event: "history:undo",
          payload: {
            type: "section",
            pageIdx: targetPageIdx,
            sectionNewId: createdSectionId,
            historyItem: JSON.parse(JSON.stringify(item)),
          },
        },
      });
    });

    document
      .getElementById("secCancel")
      ?.addEventListener("click", () => modal?.close?.());
  }
}

// =============================================================================
// УДАЛЕНИЕ ЭЛЕМЕНТА ИЗ ИСТОРИИ НАВСЕГДА
// =============================================================================
/**
 * Удалить элемент из истории навсегда (без восстановления)
 * @param {number} historyIndex - Индекс элемента в массиве deletedItemsHistory
 */
export function deleteFromHistory(historyIndex) {
  const data = storage.get();
  const history = data.deletedItemsHistory || [];

  // Проверка: валидный ли индекс?
  if (historyIndex < 0 || historyIndex >= history.length) {
    console.error("[history] Invalid delete index:", historyIndex);
    return;
  }

  // Удаляем элемент из истории
  storage.update((data) => {
    data.deletedItemsHistory.splice(historyIndex, 1);
  });

  // Обновляем список в модалке (если она открыта)
  eventBus.emit("history:item-deleted", { historyIndex });

  console.log(`[history] Item deleted from history at index ${historyIndex}`);
}

// =============================================================================
// ОЧИСТКА ВСЕЙ ИСТОРИИ
// =============================================================================
/**
 * Очистить всю историю удалений (после подтверждения)
 */
export function clearHistory() {
  // Запрашиваем подтверждение через модалку
  eventBus.emit("modal:confirm:open", {
    title: "Clear History?",
    message:
      "Are you sure you want to clear the deletion history? This action cannot be undone.",
    onConfirm: () => {
      // Очищаем историю
      storage.update((data) => {
        data.deletedItemsHistory = [];
      });

      // Закрываем модалку истории
      eventBus.emit("modal:history:close");

      // Показываем уведомление
      eventBus.emit("ui:toast", {
        type: "info",
        message: "History cleared",
      });

      console.log("[history] History cleared");
    },
  });
}

eventBus.on(
  "history:undo",
  ({
    type,
    pageIdx,
    pageId,
    sectionId,
    buttonId,
    sectionNewId,
    historyItem,
  }) => {
    const d0 = storage.get();
    if (!d0 || !Array.isArray(d0.pages)) return;

    storage.update((d) => {
      const pages = d.pages;

      if (type === "button") {
        const page = pages[pageIdx];
        const section = page?.sections?.[sectionId];
        if (!section) return;
        const idx = section.buttons.findIndex((b) => b.id === buttonId);
        if (idx !== -1) section.buttons.splice(idx, 1);
        // вернуть запись в историю (в конец)
        d.deletedItemsHistory.push(historyItem);
      }

      if (type === "section") {
        const page = pages[pageIdx];
        if (page?.sections?.[sectionNewId]) {
          delete page.sections[sectionNewId];
        }
        if (Array.isArray(page?.sectionsOrder)) {
          const i = page.sectionsOrder.indexOf(sectionNewId);
          if (i >= 0) page.sectionsOrder.splice(i, 1);
        }
        d.deletedItemsHistory.push(historyItem);
      }

      if (type === "page") {
        // удаляем восстановленную страницу
        if (
          Number.isInteger(pageIdx) &&
          pages[pageIdx] &&
          pages[pageIdx].id === pageId
        ) {
          pages.splice(pageIdx, 1);
        } else {
          // fallback: если индекс уже “уехал”
          const i = pages.findIndex((p) => p?.id === pageId);
          if (i !== -1) pages.splice(i, 1);
        }
        d.deletedItemsHistory.push(historyItem);
      }
    });

    eventBus.emit("ui:toast", { type: "info", message: "Undone" });
  }
);

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ МОДУЛЯ
// =============================================================================
/**
 * Инициализировать обработчики событий для работы с историей
 */
export function initHistory() {
  // Слушаем событие открытия истории (кнопка "History" в шапке)
  eventBus.on("history:open", openHistoryModal);

  // Слушаем событие очистки истории (кнопка "Clear History" в модалке)
  eventBus.on("history:clear", clearHistory);

  pruneHistory();
  eventBus.on("storage:loaded", pruneHistory); //  (на всякий случай)
  console.log("✅ History module initialized");

  // ===== DEBUG (временно): быстрый тест page/section в History =====
  window.__LA_DEBUG = window.__LA_DEBUG || {};
  window.__LA_DEBUG.historyTest = () => {
    storage.update((d) => {
      d.deletedItemsHistory = d.deletedItemsHistory || [];

      // test: PAGE
      d.deletedItemsHistory.push({
        type: "page",
        deletedAt: Date.now(),
        pageIndex: 0,
        pageId: `page-test-${Date.now()}`,
        pageName: "Test Page (from history)",
        snapshot: {
          id: `page-test-${Date.now()}`,
          name: "Test Page (from history)",
          sections: {
            "sec-test-1": {
              text: "Test Section",
              buttons: [
                { id: "b1", text: "Google", href: "https://google.com" },
                { id: "b2", text: "GitHub", href: "https://github.com" },
              ],
            },
          },
        },
      });
    });

    // открыть историю стандартным способом
    eventBus.emit("history:open");
  };

  console.log(
    "🧪 Run __LA_DEBUG.historyTest() in DevTools to test page history."
  );
}
