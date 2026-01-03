// ui/header.js

import { eventBus } from "../core/event-bus.js";
import { storage } from "../core/storage.js";
import { headerHTML } from "./header.view.js";
import { openQaNewSectionModal } from "./modals/modal-qa-new-section.js";

import { normalizeUrl } from "../core/url.js";

export function initHeader() {
  const el = document.getElementById("app-header");
  if (!el) {
    console.error("initHeader: #app-header not found");
    return;
  }

  el.innerHTML = headerHTML();

  // ЛОГО → модалка «О приложении»
  el.querySelector(".logo-btn")?.addEventListener("click", () => {
    eventBus.emit("ui:about:open");
  });

  // ===== Helpers =====

  const esc = (s = "") =>
    String(s).replace(
      /[&<>"]/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])
    );

  function openSaveAsModal(defaultName = "") {
    const body = `
          <div class="modal-form">
            <label for="saveAsName">Name</label>
            <input id="saveAsName" type="text" placeholder="e.g. My links" value="${esc(
              defaultName
            )}"/>
            <div class="modal-actions">
              <button class="btn save" data-act="ok">Save</button>
              <button class="btn cancel" data-act="cancel">Cancel</button>
            </div>
          </div>`;

    eventBus.emit("modal:custom:open", {
      title: "Save As…",
      bodyHTML: body,
      onMount: (root) => {
        const input = root.querySelector("#saveAsName");
        input?.focus();
        input?.select();

        const submit = () => {
          const name = (input?.value || "").trim();
          if (!name) return;

          const maybePromise = storage.saves.upsert(name);

          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(() => {
              eventBus.emit("storage:saved", { at: Date.now(), by: "saveAs" });
              eventBus.emit("modal:close");
            });
          } else {
            eventBus.emit("storage:saved", { at: Date.now(), by: "saveAs" });
            eventBus.emit("modal:close");
          }
        };

        root
          .querySelector('[data-act="ok"]')
          ?.addEventListener("click", submit);
        root
          .querySelector('[data-act="cancel"]')
          ?.addEventListener("click", () => eventBus.emit("modal:close"));
        input?.addEventListener("keydown", (e) => {
          if (e.key === "Enter") submit();
        });
      },
    });
  }

  function openSnapshotModal() {
    const body = `
      <div class="modal-form">
        <label for="snapshotName">Snapshot name</label>
        <input id="snapshotName" type="text" placeholder="e.g. Backup – ${new Date().toLocaleString()}"/>
        <div class="modal-actions">
  <button class="btn save" data-act="ok">Create</button>
  <button class="btn cancel" data-act="cancel">Cancel</button>
</div>

      </div>`;

    eventBus.emit("modal:custom:open", {
      title: "Create Snapshot",
      bodyHTML: body,
      onMount: (root) => {
        const input = root.querySelector("#snapshotName");
        input?.focus();

        const submit = () => {
          const name = (input?.value || "").trim();
          storage.sessions.save(name);
          eventBus.emit("modal:close");
        };

        root
          .querySelector('[data-act="ok"]')
          ?.addEventListener("click", submit);
        root
          .querySelector('[data-act="cancel"]')
          ?.addEventListener("click", () => eventBus.emit("modal:close"));
        input?.addEventListener("keydown", (e) => {
          if (e.key === "Enter") submit();
        });
      },
    });
  }

  // ===== Селекторы элементов =====

  const burgerBtn = el.querySelector(".burger-btn");
  const burgerPop = el.querySelector(".header-burger-popover");
  const qaInput = el.querySelector("#quickAddInput");
  const qaBtn = el.querySelector(".qa-go");

  const searchInput = el.querySelector("#searchInput");
  const searchTrigger = el.querySelector(".search-trigger");
  const searchPop = el.querySelector(".header-search-popover");
  const searchInputMobile = el.querySelector("#searchInputMobile");
  const searchClears = el.querySelectorAll(".search-clear");

  // ARIA: объявим поля как комбобоксы, связанные со списком результатов
  searchInput?.setAttribute("role", "combobox");
  searchInput?.setAttribute("aria-autocomplete", "list");
  searchInput?.setAttribute("aria-controls", "globalSearchResults");
  searchInput?.setAttribute("aria-expanded", "false");

  searchInputMobile?.setAttribute("role", "combobox");
  searchInputMobile?.setAttribute("aria-autocomplete", "list");
  searchInputMobile?.setAttribute("aria-controls", "globalSearchResults");
  searchInputMobile?.setAttribute("aria-expanded", "false");

  // ===== SEARCH (desktop и mobile) =====

  // единый помощник: держим оба поля синхронными и шлём событие
  const emitSearchValue = (raw) => {
    const q = (raw || "").trim();
    console.log("[header] search:", q);

    if (searchInput && searchInput.value !== q) {
      searchInput.value = q;
    }
    if (searchInputMobile && searchInputMobile.value !== q) {
      searchInputMobile.value = q;
    }

    if (q) {
      eventBus.emit("search:query", { q });
    } else {
      eventBus.emit("search:clear");
    }
  };

  const debounce = (fn, ms = 120) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };
  const emitSearchValueDebounced = debounce(emitSearchValue, 120);

  // --- десктопное поле
  searchInput?.addEventListener("input", () => {
    emitSearchValueDebounced(searchInput.value);
  });

  // Esc в ДЕСКТОПНОМ поле: очистить фильтр и снять фокус
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      emitSearchValue("");
      searchInput.blur();
    }
  });

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      // попросим global search выбрать первый пункт
      window.dispatchEvent(new CustomEvent("linkapp:sr-first"));
    }
  });

  // --- мобильное поле во всплывашке
  searchInputMobile?.addEventListener("input", (e) => {
    emitSearchValueDebounced(e.target.value);
  });

  searchInputMobile?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      emitSearchValue(e.target.value);
      searchPop.hidden = true;
    } else if (e.key === "Escape") {
      e.stopPropagation();
      emitSearchValue(""); // 🔹 сброс фильтра
      searchPop.hidden = true; // закрыть поповер
      searchInputMobile.blur(); // снять фокус
    }
  });

  // Крестики очистки (десктоп и мобильный поповер)
  searchClears.forEach((btn) => {
    btn.addEventListener("click", () => {
      // сбрасываем значение и в десктопном, и в мобильном поле
      emitSearchValue("");

      // фокус — туда, где сейчас логичнее
      if (!searchPop?.hidden && searchInputMobile) {
        searchInputMobile.focus();
      } else if (searchInput) {
        searchInput.focus();
      }
    });
  });

  // Внешняя очистка из поискового оверлея (клик по результату и т.п.)
  window.addEventListener("linkapp:search-clear", () => {
    console.log("[header] external clear");
    // emitSearchValue(""); // сбрасываем фильтр и синхронизируем поля
    if (searchPop && !searchPop.hidden) searchPop.hidden = true; // закрыть поповер
    searchInput?.blur(); // снять фокус, чтобы не «залипал»
    searchInputMobile?.blur();
  });

  // ===== Геометрия для мобильного поискового поповера =====
  function getHeaderStripRect() {
    const host =
      document.querySelector("#app-header .header-inner") ||
      document.getElementById("app-header");

    if (!host) {
      // фолбэк на всякий случай, чтобы не падать
      return {
        top: 48,
        left: 12,
        width: Math.max(0, window.innerWidth - 24),
      };
    }

    const r = host.getBoundingClientRect();
    const GAP_LR = 8;

    return {
      top: Math.round(r.bottom),
      left: Math.round(r.left) + GAP_LR,
      width: Math.max(0, Math.round(r.width) - GAP_LR * 2),
    };
  }

  function getScrollbarWidthOf(el) {
    if (!el) return 0;
    return Math.max(0, el.offsetWidth - el.clientWidth);
  }

  // Иконка-лупа → мобильный поповер поиска
  searchTrigger?.addEventListener("click", () => {
    if (!searchPop) return;

    // если открыт бургер — закрываем
    if (burgerPop && !burgerPop.hidden) {
      burgerPop.hidden = true;
    }

    const willShow = !!searchPop.hidden; // true, если сейчас скрыт

    if (willShow) {
      // ОТКРЫВАЕМ поповер
      if (searchPop.parentElement !== document.body) {
        document.body.appendChild(searchPop);
      }

      const rect = getHeaderStripRect();
      const scrollHost =
        document.getElementById("app-body") ||
        document.querySelector("#linkapp-root") ||
        document.body;
      const sbw = getScrollbarWidthOf(scrollHost);
      const SIDE_PAD = 8;

      const maxW = rect.width - (SIDE_PAD * 2 + sbw);
      const w = Math.max(240, Math.min(420, maxW));

      let leftPx = Math.round(rect.left + (rect.width - w) / 2);
      const leftClamp = rect.left;
      const rightClamp = rect.left + rect.width - w - sbw;
      if (leftPx < leftClamp) leftPx = leftClamp;
      if (leftPx > rightClamp) leftPx = rightClamp;

      Object.assign(searchPop.style, {
        position: "fixed",
        boxSizing: "border-box",
        width: w + "px",
        left: leftPx + "px",
        top: Math.round(rect.top + 8) + "px",
        right: "auto",
        transform: "none",
        paddingLeft: SIDE_PAD + "px",
        paddingRight: SIDE_PAD + sbw + "px",
      });

      searchPop.hidden = false;

      // подтягиваем текущий текст из десктопного поля
      if (searchInput && searchInput.value && searchInputMobile) {
        searchInputMobile.value = searchInput.value;
      }
      searchInputMobile?.focus();
      searchInputMobile?.select();
    } else {
      // ЗАКРЫТИЕ поповера по клику на лупу → полностью сбрасываем поиск
      searchPop.hidden = true;
      emitSearchValue("");
    }
  });

  // Клик вне поповера поиска → закрыть и сбросить фильтр
  document.addEventListener("click", (e) => {
    if (!searchPop || searchPop.hidden) return;
    const clickedInsidePopover = e.target.closest(".header-search-popover");
    const clickedTrigger = e.target.closest(".search-trigger");
    if (!clickedInsidePopover && !clickedTrigger) {
      searchPop.hidden = true;
      // emitSearchValue("");
    }
  });

  // ===== Основной Save =====
  el.querySelector(".primary-save")?.addEventListener("click", () => {
    const hasActive = !!storage.saves?.getActiveName?.();
    if (hasActive) {
      storage.saves.saveActive();
      eventBus.emit("storage:saved", { at: Date.now(), by: "toolbar" });
    } else {
      openSaveAsModal("");
    }
  });

  el.querySelector(".save-as-btn")?.addEventListener("click", () => {
    openSaveAsModal(storage.saves?.getActiveName?.() || "");
  });

  el.querySelector(".snapshot-btn")?.addEventListener(
    "click",
    openSnapshotModal
  );

  el.querySelector(".workspaces-btn")?.addEventListener("click", () =>
    eventBus.emit("ui:sessions:open")
  );

  // Toolbar-иконки
  el.querySelector('[data-action="open"]')?.addEventListener("click", () =>
    eventBus.emit("file:import")
  );
  el.querySelector('[data-action="export"]')?.addEventListener("click", () =>
    eventBus.emit("storage:exportJSON")
  );
  el.querySelector('[data-action="history"]')?.addEventListener("click", () =>
    eventBus.emit("history:open")
  );
  el.querySelector('[data-action="settings"]')?.addEventListener("click", () =>
    eventBus.emit("ui:settings:open")
  );
  // ===== Quick Add =====
  function normalizeUrlForQa(raw) {
    const s = (raw || "").trim();
    if (!s) return "";
    try {
      const u = new URL(s, s.startsWith("http") ? undefined : "https://");
      return u.href;
    } catch {
      return s;
    }
  }

  const parseQuickAddValue = (raw) => {
    const s = (raw || "").trim();
    if (!s) return null;

    // Формат "Название | адрес"
    if (s.includes("|")) {
      const [t, u] = s.split("|");
      const title = (t || "").trim();
      const href = (u || "").trim();
      return { text: title, href: href ? normalizeUrlForQa(href) : "" };
    }

    // Одиночный ввод: пробуем как URL → иначе это просто название
    try {
      const norm = normalizeUrlForQa(s);
      const url = new URL(norm);
      return { text: url.hostname.replace(/^www\./, ""), href: url.href };
    } catch {
      return { text: s, href: "" };
    }
  };

  // === Quick Add: контекстный выбор секции (виден только при вводе) ===
  let qaTarget = { pageIndex: null, sectionId: null, name: "Inbox" };

  const QA_NEW_SECTION = "__new_section__";

  // Контейнер, привязываем к body (позиционируем под инпутом)
  const qaPickWrap = document.createElement("div");
  qaPickWrap.className = "qa-target-wrap";
  qaPickWrap.hidden = true;
  qaPickWrap.innerHTML = `
  <div class="qa-inline">
    <button type="button" class="qa-inline-btn">
      To: <span class="qa-inline-name">Inbox</span> ▾
    </button>
  </div>
  <!-- добавили page-jumper-popover -->
  <div class="qa-target-popover page-jumper-popover" hidden></div>
`;

  document.body.appendChild(qaPickWrap);

  const qaInlineBtn = qaPickWrap.querySelector(".qa-inline-btn");
  const qaInlineName = qaPickWrap.querySelector(".qa-inline-name");
  const qaPop = qaPickWrap.querySelector(".qa-target-popover");

  function positionQaWrap() {
    if (!qaInput) return;
    const r = qaInput.getBoundingClientRect();
    qaPickWrap.style.position = "fixed";
    qaPickWrap.style.left = `${r.left}px`;
    qaPickWrap.style.top = `${r.bottom + 6}px`;
    qaPickWrap.style.width = `${r.width}px`;
  }

  function makeId() {
    return (
      crypto?.randomUUID?.() ??
      `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
    );
  }

  /**
   * Создаём секцию в storage в указанной странице.
   * Возвращаем id созданной секции.
   * ⚠️ Структуру секции делаем максимально совместимой: text + buttons/buttonsOrder.
   */
  /*function createSectionOnPage(pageIndex, title) {
    let newId = makeId();

    storage.update((d) => {
      const page = d.pages?.[pageIndex];
      if (!page) return;

      page.sections =
        page.sections && typeof page.sections === "object" ? page.sections : {};
      page.sectionsOrder = Array.isArray(page.sectionsOrder)
        ? page.sectionsOrder
        : [];

      // на всякий: не перезатираем если вдруг совпало
      while (page.sections[newId]) newId = makeId();

      page.sections[newId] = {
        text: title,
        buttons: {}, // если у вас другое имя (links), позже поправим
        buttonsOrder: [], // чтобы рендер не падал на пустой секции
      };

      page.sectionsOrder.push(newId);
    });

    return newId;
  }*/

  function toInt(v) {
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  }

  /**
   * Нормализуем структуру секций на странице:
   * - sections всегда объект (не массив)
   * - sectionsOrder всегда массив и согласован с sections
   */
  function ensureSectionsShape(page) {
    // 1) sections
    if (!page.sections || typeof page.sections !== "object") page.sections = {};

    // ВАЖНО: массив — это тоже object, поэтому обрабатываем отдельно
    if (Array.isArray(page.sections)) {
      const arr = page.sections;
      const obj = {};
      const order = [];

      for (const s of arr) {
        if (!s || typeof s !== "object") continue;
        const sid = s.id || makeId();
        obj[sid] = { ...s };
        // на всякий: приводим к text, если где-то было title
        if (!obj[sid].text && obj[sid].title) obj[sid].text = obj[sid].title;
        order.push(sid);
      }

      page.sections = obj;

      // если sectionsOrder не было — берём порядок из массива
      if (
        !Array.isArray(page.sectionsOrder) ||
        page.sectionsOrder.length === 0
      ) {
        page.sectionsOrder = order;
      }
    }

    // 2) sectionsOrder
    const keys = Object.keys(page.sections || {});
    if (!Array.isArray(page.sectionsOrder)) page.sectionsOrder = [...keys];

    // удаляем “мертвые” id
    page.sectionsOrder = page.sectionsOrder.filter((id) => page.sections[id]);

    // добавляем отсутствующие
    for (const id of keys) {
      if (!page.sectionsOrder.includes(id)) page.sectionsOrder.push(id);
    }
  }

  // === Repair legacy sections shape (one-time) ===
  function normalizeButtonsInSection(sec) {
    if (!sec || typeof sec !== "object") return;

    // Если кто-то когда-то создал buttons как объект {} → приводим к массиву []
    if (sec.buttons && !Array.isArray(sec.buttons)) {
      sec.buttons = Object.values(sec.buttons).filter(Boolean);
    }

    // Если buttons отсутствует → делаем пустой массив
    if (!sec.buttons) sec.buttons = [];

    // На всякий случай: buttonsOrder должен быть массивом
    if (!Array.isArray(sec.buttonsOrder)) sec.buttonsOrder = [];
  }

  function repairLegacySectionsOnce() {
    const KEY = "linkapp_repair_sections_v1";
    if (localStorage.getItem(KEY) === "1") return;

    try {
      storage.update((d) => {
        (d.pages || []).forEach((p) => {
          if (!p) return;
          ensureSectionsShape(p);
          Object.values(p.sections || {}).forEach((sec) =>
            normalizeButtonsInSection(sec)
          );
        });
      });
      localStorage.setItem(KEY, "1");
      eventBus.emit("ui:toast", {
        type: "info",
        message: "Data repaired (sections/buttons)",
      });
    } catch (e) {
      console.warn("[repairLegacySectionsOnce] failed:", e);
      // не ставим флаг — чтобы можно было повторить после фикса
    }
  }

  repairLegacySectionsOnce();

  function detectSectionStorageMode(page) {
    // если в первой секции есть links/linksOrder — придерживаемся links-схемы
    const ids = page?.sections ? Object.keys(page.sections) : [];
    const any = ids.length ? page.sections[ids[0]] : null;
    return any && ("links" in any || "linksOrder" in any) ? "links" : "buttons";
  }

  /**
   * Создаём секцию в указанной странице.
   * Возвращаем id секции ИЛИ null, если создать не удалось.
   */
  function createSectionOnPage(pageIndexRaw, titleRaw) {
    const pageIndex = toInt(pageIndexRaw);
    const title = String(titleRaw || "").trim() || "New Section";

    let newId = makeId();
    let createdId = null;

    storage.update((d) => {
      const page = d.pages?.[pageIndex];
      if (!page) return;

      ensureSectionsShape(page);

      while (page.sections[newId]) newId = makeId();

      const mode = detectSectionStorageMode(page);
      page.sections[newId] = {
        id: newId,
        text: title,

        // ВАЖНО: массив, иначе renderButtons падает на forEach
        buttons: [],

        // оставляем для совместимости, даже если сейчас не используется
        buttonsOrder: [],
      };

      page.sectionsOrder.push(newId);
      createdId = newId;
    });

    return createdId;
  }

  function buildQaList() {
    const d = storage.get();
    const p = d.pages[d.currentPageIndex || 0] || {};
    const order = Array.isArray(p.sectionsOrder)
      ? p.sectionsOrder
      : Object.keys(p.sections || {});

    const items = [{ id: null, label: "Inbox (default)" }];
    for (const sid of order) {
      const name = p.sections?.[sid]?.text || "Section";
      items.push({ id: sid, label: name });
    }

    items.push({ id: QA_NEW_SECTION, label: "New Section…" });

    qaPop.innerHTML = "";
    for (const it of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qa-target-item page-jumper-item";
      b.textContent = it.label;
      if (it.id === qaTarget.sectionId) b.classList.add("is-current");
      b.addEventListener("click", async () => {
        const dNow = storage.get();
        const currentIdx = dNow.currentPageIndex || 0;

        // 1) New Section… → открываем модалку
        if (it.id === QA_NEW_SECTION) {
          qaPop.hidden = true;

          // 🔹 ИСПРАВЛЕНИЕ: передаём актуальные данные из storage
          const dNow = storage.get();
          const currentIdx = dNow.currentPageIndex || 0;

          console.log("[QA dest] Передаём в модалку страницы:", dNow.pages);

          const res = await openQaNewSectionModal({
            pages: dNow.pages, // 🔹 передаём массив страниц из storage
            defaultPageIndex: currentIdx,
          });

          if (!res) {
            // Cancel: ничего не меняем
            qaInput?.focus();
            return;
          }

          const {
            pageIndex: pageIndexRaw,
            mode,
            sectionId,
            sectionTitle,
            sectionLabel,
          } = res;

          const pageIndex = toInt(pageIndexRaw);
          if (pageIndex === null) {
            eventBus.emit("ui:toast", {
              type: "error",
              message: "Invalid page selected",
            });
            qaInput?.focus();
            return;
          }

          let targetSectionId = null;
          let targetName = "Inbox";

          if (mode === "new") {
            const created = createSectionOnPage(pageIndex, sectionTitle);
            if (!created) {
              eventBus.emit("ui:toast", {
                type: "error",
                message: "Failed to create section",
              });
              qaInput?.focus();
              return;
            }
            targetSectionId = created;
            targetName = sectionTitle || "New section";
          } else if (mode === "existing") {
            targetSectionId = sectionId || null;
            targetName = sectionLabel || "Section";
          } else {
            // inbox
            targetSectionId = null;
            targetName = "Inbox";
          }

          qaTarget.pageIndex = pageIndex;
          qaTarget.sectionId = targetSectionId;
          qaTarget.name = targetName;
          qaInlineName.textContent = qaTarget.name;

          // если выбрали другую страницу — переключаемся
          if (pageIndex !== currentIdx) {
            eventBus.emit("page:switch", { pageIndex });
          }

          // если в Quick Add уже есть текст — сразу вставляем
          const parsed = parseQuickAddValue(qaInput?.value || "");
          if (parsed) {
            const d2 = storage.get();
            const pid = d2.pages?.[pageIndex]?.id || null;

            eventBus.emit("button:quickAdd", {
              ...parsed,
              targetPageIndex: pageIndex,
              targetPageId: pid,
              targetSectionId: targetSectionId || undefined, // inbox => undefined
            });

            if (qaInput) qaInput.value = "";
            qaPickWrap.hidden = true;
            qaPop.hidden = true;
          }

          qaInput?.focus();
          return;
        }

        // 2) обычный выбор секции на текущей странице
        qaTarget.pageIndex = currentIdx;
        qaTarget.sectionId = it.id; // null => Inbox
        qaTarget.name = it.label.replace(" (default)", "");
        qaInlineName.textContent = qaTarget.name;
        qaPop.hidden = true;
        qaInput?.focus();
      });

      qaPop.appendChild(b);
    }
  }

  qaInlineBtn.addEventListener("click", () => {
    positionQaWrap();
    buildQaList();
    qaPop.hidden = !qaPop.hidden;
  });

  function maybeShowQa() {
    const hasText = !!(qaInput?.value || "").trim();
    if (!hasText) {
      qaPickWrap.hidden = true;
      qaPop.hidden = true;
      return;
    }
    positionQaWrap();
    qaPickWrap.hidden = false;
  }

  qaInput?.addEventListener("focus", maybeShowQa);
  qaInput?.addEventListener("input", maybeShowQa);
  qaInput?.addEventListener("blur", () => {
    setTimeout(() => {
      if (!qaPickWrap.contains(document.activeElement)) {
        qaPickWrap.hidden = true;
        qaPop.hidden = true;
      }
    }, 120);
  });

  window.addEventListener(
    "resize",
    () => {
      if (!qaPickWrap.hidden) positionQaWrap();
    },
    { passive: true }
  );
  document.addEventListener(
    "scroll",
    () => {
      if (!qaPickWrap.hidden) positionQaWrap();
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !qaPop.hidden) qaPop.hidden = true;
  });

  // Финальная версия handleQuickAdd (учитывает выбранную секцию)
  function handleQuickAdd() {
    const parsed = parseQuickAddValue(qaInput?.value || "");
    if (!parsed) return;

    const d = storage.get();
    const idx = (qaTarget.pageIndex ?? d.currentPageIndex) || 0;

    const pid = d.pages[idx]?.id || null;

    eventBus.emit("button:quickAdd", {
      ...parsed,
      targetPageIndex: idx,
      targetPageId: pid,
      targetSectionId: qaTarget.sectionId || undefined,
    });

    if (qaInput) qaInput.value = "";
    qaPickWrap.hidden = true;
    qaPop.hidden = true;
  }

  // биндим слушатели здесь, чтобы точно указывали на финальную функцию
  qaBtn?.addEventListener("click", handleQuickAdd);
  qaInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleQuickAdd();
  });

  // ===== Бургер =====
  if (burgerPop && burgerPop.parentElement !== document.body) {
    document.body.appendChild(burgerPop);
  }

  burgerBtn?.addEventListener("click", (e) => {
    e.stopPropagation();

    // если открыт поиск — закрываем и сбрасываем
    if (searchPop && !searchPop.hidden) {
      searchPop.hidden = true;
      // emitSearchValue("");
    }

    const headerRect = document
      .getElementById("app-header")
      ?.getBoundingClientRect();
    const btnRect = burgerBtn.getBoundingClientRect();
    burgerPop.style.position = "fixed";
    burgerPop.style.top =
      (headerRect ? Math.round(headerRect.bottom + 8) : 64) + "px";
    burgerPop.style.right =
      Math.max(12, window.innerWidth - btnRect.right) + "px";
    burgerPop.style.left = "auto";
    burgerPop.hidden = !burgerPop.hidden;
  });

  document.addEventListener("click", (e) => {
    if (
      !burgerPop?.hidden &&
      !burgerPop.contains(e.target) &&
      !burgerBtn.contains(e.target)
    ) {
      burgerPop.hidden = true;
    }
  });

  window.addEventListener("resize", () => {
    if (burgerPop) burgerPop.hidden = true;
  });

  burgerPop?.addEventListener("mousedown", (e) => e.stopPropagation());

  // Команды поповера бургера
  burgerPop?.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    burgerPop.hidden = true;

    if (act === "save") {
      const hasActive = !!storage.saves?.getActiveName?.();
      if (hasActive) {
        storage.saves.saveActive();
        eventBus.emit("storage:saved", { at: Date.now(), by: "toolbar" });
      } else {
        openSaveAsModal(storage.saves?.getActiveName?.() || "");
      }
      return;
    }
    if (act === "saveAs") {
      openSaveAsModal(storage.saves?.getActiveName?.() || "");
      return;
    }
    if (act === "snapshot") {
      openSnapshotModal();
      return;
    }
    if (act === "workspaces") {
      eventBus.emit("ui:sessions:open");
      return;
    }
    if (act === "open") {
      eventBus.emit("file:import");
      return;
    }
    if (act === "export") {
      eventBus.emit("storage:exportJSON");
      return;
    }
    if (act === "history") {
      eventBus.emit("history:open");
      return;
    }
    if (act === "settings") {
      eventBus.emit("ui:settings:open");
      return;
    }

    if (act === "openData") {
      if (window.desktop?.platform?.openDataFolder) {
        await window.desktop.platform.openDataFolder();
      } else {
        eventBus.emit("ui:toast", { type: "info", message: "Desktop only" });
      }
      return;
    }
    if (act === "revealState") {
      if (window.desktop?.platform?.revealStateFile) {
        await window.desktop.platform.revealStateFile();
      } else {
        eventBus.emit("ui:toast", { type: "info", message: "Desktop only" });
      }
      return;
    }
  });

  // Скрыть desktop-only команды, если не Electron
  const isDesktop = !!window.desktop?.platform;
  if (!isDesktop) {
    burgerPop?.querySelector('[data-act="openData"]')?.remove();
    burgerPop?.querySelector('[data-act="revealState"]')?.remove();
  }

  // ===== Хоткеи =====
  // Save (Ctrl/Cmd+S)
  function onGlobalSaveHotkey(e) {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if (mod && !e.shiftKey && !e.altKey && e.code === "KeyS") {
      e.preventDefault();
      e.stopPropagation();

      const hasActive = !!storage.saves?.getActiveName?.();
      if (hasActive) {
        const maybe = storage.saves?.saveActive?.();
        Promise.resolve(maybe).then(() => {
          eventBus.emit("storage:saved", { at: Date.now(), by: "hotkey" });
        });
      } else {
        openSaveAsModal("");
      }
    }
  }

  window.addEventListener("keydown", onGlobalSaveHotkey, true);

  // Быстрый фокус: "/" → поиск, Ctrl/Cmd+Shift+N → Quick Add
  window.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing =
      t &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable);
    if (!typing && e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      searchInput?.focus();
    }
    if (!typing) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl && e.shiftKey && (e.key === "N" || e.key === "n")) {
        e.preventDefault();
        qaInput?.focus();
      }
    }
  });

  console.log("✅ Header initialized");
}

// Глобальное делегирование по data-action (study-toggle и прочее)
document.addEventListener(
  "click",
  (e) => {
    const actBtn = e.target.closest("[data-action]");
    if (!actBtn) return;
    switch (
      actBtn.dataset.action
      // TODO: re-enable when Study panel is implemented
      //    case "study-toggle":
      //      e.preventDefault();
      //     eventBus.emit("study:toggle");
      //     break;
      // добавляй другие data-action при необходимости
    ) {
    }
  },
  true
);

// === LinkApp viewport vars for модалки/поповеры ===
function updateLinkAppViewportVars() {
  const host =
    document.getElementById("app-body") ||
    document.getElementById("linkapp-root") ||
    document.body;

  const r = host.getBoundingClientRect();
  const cs = getComputedStyle(document.documentElement);
  const gutter = parseInt(cs.getPropertyValue("--page-gutter")) || 12;

  const left = Math.round(r.left + gutter);
  const width = Math.max(0, Math.round(r.width - gutter * 2));

  document.documentElement.style.setProperty("--linkapp-left", left + "px");
  document.documentElement.style.setProperty("--linkapp-width", width + "px");
}

updateLinkAppViewportVars();
window.addEventListener("resize", updateLinkAppViewportVars);

// Панель / модалки могут менять доступное пространство — пересчитываем
// TODO: re-enable when Study panel is implemented
/*eventBus.on("study:toggle", () => {
  requestAnimationFrame(() => updateLinkAppViewportVars());
  setTimeout(updateLinkAppViewportVars, 0);
});*/

[
  "modal:custom:open",
  "ui:settings:open",
  "ui:sessions:open",
  "history:open",
  "ui:about:open",
].forEach((ev) =>
  eventBus.on(ev, () => {
    updateLinkAppViewportVars();
    requestAnimationFrame(updateLinkAppViewportVars);
  })
);
