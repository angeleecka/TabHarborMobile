// =============================================================================
// UI/PAGES.JS — Рендеринг текущей страницы
// =============================================================================
// Что здесь:
// - Рендеринг текущей страницы (renderCurrentPage)
// - Переключение между страницами (switchPage)
// - Добавление новой страницы (addNewPage)
// - Инициализация модуля (initPages)
// =============================================================================

import { eventBus } from "../core/event-bus.js";
import { storage } from "../core/storage.js";
import { renderSections } from "./sections.js";

let currentSearchQuery = "";

function mountPageTitleBar(container, page) {
  const d = storage.get();

  const bar = document.createElement("div");
  bar.className = "page-titlebar";

  // ===== Go to (jumper) =====
  const jumperWrap = document.createElement("div");
  jumperWrap.className = "goto-wrap page-jumper-wrap";

  const jumperInput = document.createElement("input");
  jumperInput.type = "text";
  jumperInput.id = "page-jumper";
  jumperInput.className = "page-jumper-input";
  jumperInput.placeholder = "Go to… (№ or name)";
  jumperInput.autocomplete = "off";

  const pages = (d.pages || []).map((p, i) => ({
    index: i,
    name:
      typeof p.name === "string" && p.name.trim()
        ? p.name.trim()
        : `Page ${i + 1}`,
  }));

  // ✅ Поповер в body
  const pop = document.createElement("div");
  pop.className = "page-jumper-popover";
  pop.hidden = true;
  pop.id = "page-jumper-popover";

  // ✅ Всплывающий инпут для мобайла/compact (как у search)
  const mobileInputWrap = document.createElement("div");
  mobileInputWrap.className = "page-jumper-mobile-wrap";
  mobileInputWrap.hidden = true;

  const mobileInput = document.createElement("input");
  mobileInput.type = "text";
  mobileInput.className = "page-jumper-mobile-input";
  mobileInput.placeholder = "Go to… (№ or name)";
  mobileInput.autocomplete = "off";

  mobileInputWrap.appendChild(mobileInput);
  document.body.appendChild(mobileInputWrap);

  let activeIdx = -1;

  const setActive = (newIdx) => {
    const items = pop.querySelectorAll(".page-jumper-item");
    items.forEach((el, idx) => el.classList.toggle("active", idx === newIdx));
    activeIdx = newIdx;
    if (activeIdx >= 0 && items[activeIdx]) {
      items[activeIdx].scrollIntoView({ block: "nearest" });
    }
  };

  // ✅ Позиционирование в зависимости от режима
  const positionMobileInput = () => {
    const isMobile = window.innerWidth <= 900;
    const isCompact =
      document.body.classList.contains("compact-900") ||
      document.body.classList.contains("study-overlay");

    if (isMobile) {
      // Мобайл: по центру viewport
      mobileInputWrap.style.left = "50%";
      mobileInputWrap.style.transform = "translateX(-50%)";
      mobileInputWrap.style.width = "min(420px, calc(100vw - 24px))";
    } else if (isCompact) {
      // Compact: по центру доступной области (справа от панели)

      // Ищем панель по разным возможным селекторам
      const panel =
        document.getElementById("study-panel") ||
        document.querySelector(".study-panel") ||
        document.querySelector('[class*="panel"]') ||
        document.querySelector("aside");

      let leftOffset = 0;
      let availableWidth = window.innerWidth;

      if (panel) {
        const panelRect = panel.getBoundingClientRect();
        leftOffset = panelRect.right; // правый край панели
        availableWidth = window.innerWidth - leftOffset;
      } else {
        // Фолбэк: используем #app-header для определения доступной области
        const header = document.getElementById("app-header");
        if (header) {
          const headerRect = header.getBoundingClientRect();
          leftOffset = headerRect.left;
          availableWidth = headerRect.width;
        }
      }

      // Центр доступной области
      const centerX = leftOffset + availableWidth / 2;
      mobileInputWrap.style.left = `${centerX}px`;
      mobileInputWrap.style.transform = "translateX(-50%)";
      mobileInputWrap.style.width = `min(420px, ${availableWidth - 24}px)`;
    }
  };

  const positionPopover = () => {
    const isMobile = window.innerWidth <= 900;
    const isCompact =
      document.body.classList.contains("compact-900") ||
      document.body.classList.contains("study-overlay");

    const POP_WIDTH = 320; // желаемая ширина поповера
    const SIDE_PAD = 8;

    if (isMobile || isCompact) {
      // Мобайл/Compact: под всплывающим инпутом
      if (!mobileInputWrap.hidden) {
        const rect = mobileInput.getBoundingClientRect();

        // Центрируем под инпутом с проверкой границ
        let leftPx = rect.left;
        const maxLeft = window.innerWidth - POP_WIDTH - SIDE_PAD;

        if (leftPx < SIDE_PAD) leftPx = SIDE_PAD;
        if (leftPx > maxLeft) leftPx = maxLeft;

        pop.style.position = "fixed";
        pop.style.left = `${leftPx}px`;
        pop.style.top = `${rect.bottom + 6}px`;
        pop.style.width = `${Math.min(POP_WIDTH, rect.width)}px`;
        pop.style.transform = "none";
        pop.style.right = "auto";
      } else {
        pop.hidden = true;
      }
    } else {
      // Десктоп: под инпутом в titlebar
      const rect = jumperInput.getBoundingClientRect();

      let leftPx = rect.left;
      const maxLeft = window.innerWidth - POP_WIDTH - SIDE_PAD;

      if (leftPx < SIDE_PAD) leftPx = SIDE_PAD;
      if (leftPx > maxLeft) leftPx = maxLeft;

      pop.style.position = "fixed";
      pop.style.left = `${leftPx}px`;
      pop.style.top = `${rect.bottom + 6}px`;
      pop.style.width = `min(${POP_WIDTH}px, 90vw)`;
      pop.style.transform = "none";
      pop.style.right = "auto";
    }
  };

  const openMobileInput = () => {
    positionMobileInput();
    mobileInputWrap.hidden = false;
    mobileInput.value = "";
    mobileInput.focus();
  };

  const closeMobileInput = () => {
    mobileInputWrap.hidden = true;
    mobileInput.value = "";
    closePopover();
  };

  const openPopover = () => {
    pop.hidden = false;
    positionPopover();
    setActive(-1);
  };

  const closePopover = () => {
    pop.hidden = true;
    activeIdx = -1;
  };

  const resolvePageIndex = (q) => {
    const s = (q || "").trim();
    if (!s) return null;

    if (/^\d+$/.test(s)) {
      const idx = Math.max(
        0,
        Math.min((d.pages?.length || 1) - 1, parseInt(s, 10) - 1)
      );
      return idx;
    }

    const m = s.match(/^(\d+)\s*:/);
    if (m) {
      const idx = Math.max(
        0,
        Math.min((d.pages?.length || 1) - 1, parseInt(m[1], 10) - 1)
      );
      return idx;
    }

    const lower = s.toLowerCase();
    const found = (d.pages || []).findIndex((pp, ii) => {
      const nm =
        typeof pp.name === "string" && pp.name.trim()
          ? pp.name.trim()
          : `Page ${ii + 1}`;
      return nm.toLowerCase().includes(lower);
    });
    return found >= 0 ? found : null;
  };

  const jumpTo = (idx) => {
    if (idx == null) {
      eventBus.emit("ui:toast", { type: "warning", message: "Page not found" });
      return;
    }
    eventBus.emit("page:switch", { pageIndex: idx });
    eventBus.emit("pagination:scrollTo", { pageIndex: idx });
    jumperInput.blur();
    mobileInput.blur();
    closeMobileInput();
  };

  const buildList = (q) => {
    const s = (q || "").trim().toLowerCase();
    let list = pages;

    if (s) {
      if (/^\d+$/.test(s)) {
        const want = parseInt(s, 10) - 1;
        list = pages.filter((p) => p.index === want);
      } else {
        list = pages.filter((p) => p.name.toLowerCase().includes(s));
      }
    }

    pop.innerHTML = "";

    list.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "page-jumper-item";
      btn.dataset.index = String(p.index);

      // вместо innerHTML — создаём элементы и задаём безопасный текст
      const numSpan = document.createElement("span");
      numSpan.className = "num";
      numSpan.textContent = String(p.index + 1);

      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = p.name; // любое содержимое станет просто текстом

      btn.appendChild(numSpan);
      btn.appendChild(nameSpan);

      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        jumpTo(p.index);
      });

      pop.appendChild(btn);
    });

    openPopover();
  };

  // ===== События для десктоп-инпута =====
  jumperInput.addEventListener("focus", () => buildList(jumperInput.value));
  jumperInput.addEventListener("input", () => buildList(jumperInput.value));
  jumperInput.addEventListener("click", () => {
    if (pop.hidden) buildList(jumperInput.value);
  });

  jumperInput.addEventListener("blur", () => setTimeout(closePopover, 120));

  const handleKeydown = (e, inputEl) => {
    const items = pop.querySelectorAll(".page-jumper-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (pop.hidden) buildList(inputEl.value);
      else setActive(Math.min(items.length - 1, activeIdx + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(-1, activeIdx - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!pop.hidden && activeIdx >= 0 && items[activeIdx]) {
        const idx = parseInt(items[activeIdx].dataset.index, 10);
        jumpTo(idx);
      } else {
        const idx = resolvePageIndex(inputEl.value);
        jumpTo(idx);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (inputEl === mobileInput) {
        closeMobileInput();
      } else {
        closePopover();
      }
      return;
    }
  };

  jumperInput.addEventListener("keydown", (e) => handleKeydown(e, jumperInput));

  // ===== События для мобильного инпута =====
  mobileInput.addEventListener("input", () => buildList(mobileInput.value));
  mobileInput.addEventListener("focus", () => buildList(mobileInput.value));
  mobileInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement !== mobileInput) {
        closeMobileInput();
      }
    }, 120);
  });
  mobileInput.addEventListener("keydown", (e) => handleKeydown(e, mobileInput));

  jumperWrap.appendChild(jumperInput);
  document.body.appendChild(pop);

  // Пересчёт позиций
  window.addEventListener("resize", () => {
    if (!mobileInputWrap.hidden) {
      positionMobileInput();
      if (!pop.hidden) positionPopover();
    }
    if (!pop.hidden && mobileInputWrap.hidden) {
      positionPopover();
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!pop.hidden) positionPopover();
    },
    true
  );

  // ===== Мобильная иконка-триггер =====
  const gotoTrigger = document.createElement("button");
  gotoTrigger.type = "button";
  gotoTrigger.className = "icon-btn goto-trigger";
  gotoTrigger.title = "Go to page";
  gotoTrigger.setAttribute("aria-label", "Go to page");
  gotoTrigger.textContent = "➜";

  gotoTrigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!mobileInputWrap.hidden) {
      closeMobileInput();
      return;
    }

    openMobileInput();
  });

  // Закрытие при клике вне
  document.addEventListener("click", (e) => {
    if (
      !pop.hidden &&
      !pop.contains(e.target) &&
      !jumperInput.contains(e.target) &&
      !mobileInput.contains(e.target) &&
      !mobileInputWrap.contains(e.target) &&
      !gotoTrigger.contains(e.target)
    ) {
      closePopover();
      closeMobileInput();
    }
  });

  // ===== Заголовок и редактирование =====
  const titleWrap = document.createElement("div");
  titleWrap.className = "page-title-wrap";

  const title = document.createElement("span");
  title.className = "page-title page-title-text";
  const nm = (page?.name || "").trim();
  title.textContent = nm ? nm : `Page ${page.index + 1}`;

  const edit = document.createElement("button");
  edit.className = "page-edit-icon ui-icon-btn ui-icon-16";
  edit.title = "Rename page";
  edit.type = "button";
  edit.textContent = "✎";

  const enterEdit = () => {
    const wrap = document.createElement("div");
    wrap.className = "page-title-edit";

    const input = document.createElement("input");
    input.className = "page-title-input";
    input.value = page.name || "";
    input.placeholder = "Page name";
    wrap.appendChild(input);

    const commit = () => {
      const next = (input.value || "").trim();
      if (!next) {
        eventBus.emit("ui:toast", {
          type: "warning",
          message: "Page name cannot be empty!",
        });
        input.focus();
        return;
      }
      storage.update((d) => {
        const idx = d.currentPageIndex || 0;
        if (d.pages[idx]) d.pages[idx].name = next;
      });
    };
    const cancel = () => {
      renderCurrentPage();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") cancel();
    });
    input.addEventListener("blur", commit);

    bar.innerHTML = "";
    bar.appendChild(wrap);
    input.focus();
    input.select();
  };

  edit.addEventListener("click", (e) => {
    e.preventDefault();
    enterEdit();
  });
  title.addEventListener("dblclick", enterEdit);

  titleWrap.appendChild(title);
  titleWrap.appendChild(edit);

  // ===== Свернуть/развернуть все =====
  const computeAllCollapsed = () => {
    const dnow = storage.get();
    const p = dnow.pages[dnow.currentPageIndex || 0];
    const list = Object.values(p.sections || {});
    if (list.length === 0) return false;
    return list.every((s) => !!s.collapsed);
  };

  const setAllCollapsed = (next) => {
    storage.update((d) => {
      const p = d.pages[d.currentPageIndex || 0];
      Object.values(p.sections || {}).forEach((s) => (s.collapsed = !!next));
    });
  };

  const allToggle = document.createElement("button");
  allToggle.type = "button";
  allToggle.className = "page-fold-toggle ui-icon-btn ui-icon-16";

  const refreshAllToggle = () => {
    const all = computeAllCollapsed();
    allToggle.textContent = all ? "▸▸" : "▾▾";
    allToggle.title = all ? "Expand all sections" : "Collapse all sections";
  };
  refreshAllToggle();

  allToggle.addEventListener("click", (e) => {
    e.preventDefault();
    const next = !computeAllCollapsed();
    setAllCollapsed(next);
    refreshAllToggle();
  });

  // ===== Сборка бара =====
  bar.appendChild(allToggle);
  bar.appendChild(titleWrap);
  bar.appendChild(jumperWrap);
  bar.appendChild(gotoTrigger);

  container.appendChild(bar);
}

export function renderCurrentPage() {
  const container = document.getElementById("app-body");
  if (!container) {
    console.error("[pages] #app-body not found");
    return;
  }

  // Очищаем контейнер
  container.innerHTML = "";

  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];

  // Проверка: есть ли страницы вообще?
  if (!data.pages || data.pages.length === 0) {
    container.innerHTML = `
      <div class="body-empty">
        <p>No pages found. Please create a page first.</p>
      </div>
    `;
    return;
  }

  // Проверка: существует ли текущая страница?
  if (!page) {
    container.innerHTML = `
      <div class="body-empty">
        <p>Current page not found.</p>
      </div>
    `;
    return;
  }

  // Заголовок страницы (по центру) и иконка редактирования
  mountPageTitleBar(container, {
    name: page.name,
    index: data.currentPageIndex || 0,
  });

  // Создаём кнопку "Добавить секцию" (будет внизу, после всех секций)
  const addSectionBtn = document.createElement("button");
  addSectionBtn.className = "add-section ui-plus-labeled"; // ← новый универсальный класс
  addSectionBtn.id = "addSectionBtn";
  addSectionBtn.textContent = "Add section"; // плюс рисуем псевдо-элементом
  addSectionBtn.addEventListener("click", () => {
    eventBus.emit("section:add");
  });

  // перед рендером секции:
  const rawQuery = currentSearchQuery;
  const query = (rawQuery || "").trim().toLowerCase();

  // Рендерим все секции страницы (через модуль sections.js)
  renderSections(container, { query: currentSearchQuery });

  // Добавляем кнопку "+ Add section" в конец
  container.appendChild(addSectionBtn);

  console.log(`[pages] Rendered page ${data.currentPageIndex + 1}`);
}

/**
 * Переключиться на указанную страницу
 * @param {number} pageIndex - Индекс страницы (начиная с 0)
 */
export function switchPage(pageIndex) {
  const data = storage.get();

  // Проверка: валидный ли индекс?
  if (pageIndex < 0 || pageIndex >= data.pages.length) {
    eventBus.emit("ui:toast", {
      type: "error",
      message: "Page not found!",
    });
    return;
  }

  // Обновляем текущий индекс страницы
  storage.update((data) => {
    data.currentPageIndex = pageIndex;
  });

  // Перерисовываем содержимое
  renderCurrentPage();

  // Уведомляем систему о переключении страницы
  eventBus.emit("pages:switched", { pageIndex });

  console.log(`[pages] Switched to page ${pageIndex + 1}`);
}

/**
 * Добавить новую страницу с дефолтной секцией и кнопкой
 */
export function addNewPage() {
  const data = storage.get();

  // Генерируем уникальные ID для новой страницы, секции и кнопки
  const timestamp = Date.now();
  const newPageId = `page-${timestamp}`;
  const newSectionId = `section-${timestamp}`;
  const newButtonId = `button-${timestamp}`;

  // Создаём структуру новой страницы
  const newPage = {
    id: newPageId,
    name: `Page ${data.pages.length + 1}`,
    sections: {
      [newSectionId]: {
        text: "New Section",
        buttons: [
          {
            id: newButtonId,
            text: "New button",
            href: "",
          },
        ],
      },
    },
  };

  // Добавляем страницу в данные
  storage.update((data) => {
    data.pages.push(newPage);
    // Переключаемся на новую страницу
    data.currentPageIndex = data.pages.length - 1;
  });

  // Перерисовываем содержимое
  renderCurrentPage();

  // Уведомляем систему о добавлении страницы
  eventBus.emit("pages:added", { pageId: newPageId });

  // Показываем уведомление
  eventBus.emit("ui:toast", {
    type: "success",
    message: `Page ${data.pages.length} created!`,
  });

  console.log(`[pages] Added new page: ${newPage.name}`);
}

/**
 * Удалить текущую страницу
 * (ВАЖНО: не удаляем последнюю страницу — должна остаться хотя бы одна)
 */
export function deleteCurrentPage() {
  const data = storage.get();

  // Проверка: это последняя страница?
  if (data.pages.length <= 1) {
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Cannot delete the last page!",
    });
    return;
  }

  const currentIndex = data.currentPageIndex || 0;
  const page = data.pages[currentIndex];

  // Подтверждение удаления
  eventBus.emit("modal:confirm:open", {
    title: "Delete Page?",
    message: `Are you sure you want to delete "${page.name}"? This page will be moved to History and can be restored later. To remove it permanently, delete it from History.`,
    onConfirm: () => {
      // Удаляем страницу
      storage.update((data) => {
        const page = data.pages[currentIndex];
        if (!page) return;

        if (!data.deletedItemsHistory) data.deletedItemsHistory = [];
        data.deletedItemsHistory.push({
          type: "page",
          deletedAt: Date.now(),
          pageId: page.id,
          pageName: page.name,
          pageIndex: currentIndex,
          snapshot: JSON.parse(JSON.stringify(page)), // page целиком: секции+кнопки
        });

        data.pages.splice(currentIndex, 1);

        // если удалили последнюю страницу — оставим хотя бы одну
        if (data.pages.length === 0) {
          data.pages.push({
            id: `page-${Date.now()}`,
            name: "Main",
            sections: {},
            sectionsOrder: [],
          });
          data.currentPageIndex = 0;
          return;
        }

        if (data.currentPageIndex >= data.pages.length) {
          data.currentPageIndex = data.pages.length - 1;
        }
      });

      // Перерисовываем содержимое
      renderCurrentPage();

      // Уведомляем систему об удалении
      eventBus.emit("pages:deleted", { pageIndex: currentIndex });

      // Показываем уведомление
      eventBus.emit("ui:toast", {
        type: "info",
        message: "Moved to History.",
      });
    },
  });
}

export function deletePageAt(index) {
  const data = storage.get();
  if (data.pages.length <= 1) {
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Cannot delete the last page!",
    });
    return;
  }
  if (index < 0 || index >= data.pages.length) {
    eventBus.emit("ui:toast", { type: "error", message: "Page not found!" });
    return;
  }
  const page = data.pages[index];

  eventBus.emit("modal:confirm:open", {
    title: "Delete Page?",
    message: `Are you sure you want to delete "${page.name}"? Page moved to History (you can restore it).`,
    onConfirm: () => {
      storage.update((d) => {
        const page = d.pages[index];
        if (!page) return;

        if (!d.deletedItemsHistory) d.deletedItemsHistory = [];
        d.deletedItemsHistory.push({
          type: "page",
          deletedAt: Date.now(),
          pageId: page.id,
          pageName: page.name,
          pageIndex: index,
          snapshot: JSON.parse(JSON.stringify(page)),
        });

        d.pages.splice(index, 1);

        if (d.pages.length === 0) {
          d.pages.push({
            id: `page-${Date.now()}`,
            name: "Main",
            sections: {},
            sectionsOrder: [],
          });
          d.currentPageIndex = 0;
          return;
        }

        if (d.currentPageIndex >= d.pages.length) {
          d.currentPageIndex = d.pages.length - 1;
        }
      });

      renderCurrentPage();
      eventBus.emit("pages:deleted", { pageIndex: index });
      eventBus.emit("ui:toast", {
        type: "info",
        message: "Page moved to History.",
      });
    },
  });
}

export function renameCurrentPage() {
  const data = storage.get();
  const currentIndex = data.currentPageIndex || 0;
  const page = data.pages[currentIndex];

  if (!page) {
    eventBus.emit("ui:toast", {
      type: "error",
      message: "Current page not found",
    });
    return;
  }

  const oldName =
    typeof page.name === "string" && page.name.trim()
      ? page.name.trim()
      : `Page ${currentIndex + 1}`;

  const input = prompt("Page name:", oldName);
  if (input === null) return; // cancel

  const newName = input.trim();
  if (!newName) {
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Name cannot be empty",
    });
    return;
  }

  storage.update((d) => {
    d.pages[currentIndex].name = newName;
  });

  // перерендерим текущую страницу (и пагинатор обновится через storage:updated)
  renderCurrentPage();

  eventBus.emit("ui:toast", { type: "success", message: "Page renamed" });
  console.log(`[pages] Renamed page ${currentIndex + 1} → "${newName}"`);
}

/**
 * Инициализировать обработчики событий для работы со страницами
 */
export function initPages() {
  // Слушаем изменения в storage — перерисовываем страницу
  eventBus.on("storage:updated", () => {
    renderCurrentPage();
  });

  // Слушаем событие переключения страницы
  eventBus.on("page:switch", ({ pageIndex }) => {
    switchPage(pageIndex);
  });

  // Слушаем событие добавления новой страницы
  eventBus.on("page:add", addNewPage);

  // Слушаем событие удаления текущей страницы
  eventBus.on("page:delete", deleteCurrentPage);

  // Первичный рендер при загрузке
  renderCurrentPage();

  console.log("✅ Pages module initialized");

  // Когда сервис выдаёт новые результаты — запоминаем строку и перерисовываем страницу
  eventBus.on("search:results", ({ q }) => {
    currentSearchQuery = q || "";
    eventBus.emit("pages:render");
  });

  // Когда поиск очищен — тоже перерисовываем без подсветки
  eventBus.on("search:clear", () => {
    currentSearchQuery = "";
    eventBus.emit("pages:render");
  });

  eventBus.on("page:deleteAt", ({ pageIndex }) => deletePageAt(pageIndex));

  eventBus.on("pages:render", renderCurrentPage);
}

eventBus.on(
  "search:goto",
  ({ pageIndex, sectionId, buttonId, sectionIndex, buttonIndex }) => {
    // 1) Переключаем страницу через storage.update
    storage.update((d) => {
      if (!Array.isArray(d.pages)) return;
      const maxIdx = d.pages.length - 1;
      d.currentPageIndex = Math.max(0, Math.min(pageIndex ?? 0, maxIdx));
    });

    // 2) После перерисовки — находим элементы, скроллим и подсвечиваем
    requestAnimationFrame(() => {
      let targetButton = null;
      let targetSection = null;

      // --- ищем кнопку ---
      if (buttonId) {
        targetButton = document.querySelector(
          `[data-button-id="${CSS.escape(buttonId)}"]`
        );

        // запасной вариант по индексам
        if (!targetButton && sectionIndex != null && buttonIndex != null) {
          const sections = document.querySelectorAll(".section");
          const sEl = sections[sectionIndex];
          if (sEl) {
            targetButton =
              sEl.querySelectorAll(
                ".link-card, .button-card, .assignment-button"
              )[buttonIndex] || null;
          }
        }
      }

      // --- ищем секцию ---
      if (sectionId) {
        targetSection = document.querySelector(
          `.section[data-section-id="${CSS.escape(sectionId)}"]`
        );
      }
      if (!targetSection && sectionIndex != null) {
        const sections = document.querySelectorAll(".section");
        targetSection = sections[sectionIndex] || null;
      }

      const scrollTarget = targetButton || targetSection;

      if (scrollTarget) {
        // для кнопки — центр, для секции — от верха, чтобы были видны и кнопки
        const block = targetButton ? "center" : "start";
        scrollTarget.scrollIntoView({ block, behavior: "smooth" });
        scrollTarget.classList.add("flash-hit");
        setTimeout(() => scrollTarget.classList.remove("flash-hit"), 1200);
      }

      // 3) просим секции развернуться и показать содержимое
      eventBus.emit("search:focus-section", {
        sectionId,
        sectionIndex,
        buttonId,
        buttonIndex,
      });
    });
  }
);
