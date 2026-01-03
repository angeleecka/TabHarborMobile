// UI/BUTTONS.JS — Логика работы с кнопками-ссылками
import { eventBus } from "../core/event-bus.js";
import { storage } from "../core/storage.js";
import { normalizeUrl, isSafeLinkUrl } from "../core/url.js";

let globalDraggingButton = null;

export function addNewButton(sectionId) {
  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  const section = page?.sections?.[sectionId];

  if (!section) {
    eventBus.emit("ui:toast", {
      type: "error",
      message: "Section not found on current page!",
    });
    return;
  }
  if (section.buttons && section.buttons.length >= 500) {
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Maximum 500 buttons per section!",
    });
    return;
  }

  const newButton = {
    id: `button-${Date.now()}`,
    text: "New button",
    href: "",
  };

  storage.update((d) => {
    const p = d.pages[d.currentPageIndex || 0];
    const s = p.sections[sectionId];
    if (!s.buttons) s.buttons = [];
    s.buttons.push(newButton);
  });

  eventBus.emit("buttons:added", { sectionId, button: newButton });
  eventBus.emit("ui:toast", { type: "success", message: "Button added!" });
}

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

export function openEditModal(buttonId, sectionId) {
  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  const section = page?.sections?.[sectionId];
  const button = section?.buttons?.find((b) => b.id === buttonId);

  if (!button) {
    eventBus.emit("ui:toast", { type: "error", message: "Button not found!" });
    return;
  }

  eventBus.emit("modal:edit-button:open", {
    buttonId,
    sectionId,
    text: button.text || "",
    href: button.href || "",
  });
}

export function saveButton({ buttonId, sectionId, text, href }) {
  if (!text.trim()) {
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Button name cannot be empty!",
    });
    return;
  }

  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  const section = page?.sections?.[sectionId];
  const button = section?.buttons?.find((b) => b.id === buttonId);

  if (!button) {
    eventBus.emit("ui:toast", { type: "error", message: "Button not found!" });
    return;
  }

  storage.update((d) => {
    const p = d.pages[d.currentPageIndex || 0];
    const s = p.sections[sectionId];
    const btn = s.buttons.find((b) => b.id === buttonId);
    if (btn) {
      btn.text = text.trim();
      const raw = (href || "").trim();
      btn.href = raw ? normalizeUrl(raw) : "";
    }
  });

  eventBus.emit("buttons:updated", { buttonId, sectionId });
  eventBus.emit("modal:edit-button:close");
  eventBus.emit("ui:toast", { type: "success", message: "Button saved!" });
}

export function deleteButton(buttonId, sectionId) {
  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  const section = page?.sections?.[sectionId];
  const buttonIndex = section?.buttons?.findIndex((b) => b.id === buttonId);

  if (buttonIndex === -1 || buttonIndex === undefined) {
    eventBus.emit("ui:toast", { type: "error", message: "Button not found!" });
    return;
  }

  const button = section.buttons[buttonIndex];

  storage.update((d) => {
    const p = d.pages[d.currentPageIndex || 0];
    const s = p.sections[sectionId];

    // удалить
    s.buttons.splice(buttonIndex, 1);

    // в историю
    if (!d.deletedItemsHistory) d.deletedItemsHistory = [];
    d.deletedItemsHistory.push({
      type: "button",
      pageId: p.id,
      pageName: p.name,
      sectionId,
      sectionName: s.text,
      pageIndex: d.currentPageIndex || 0,
      sectionIndex: Object.keys(p.sections).indexOf(sectionId),
      buttonIndex,
      name: button.text,
      link: button.href,
      deletedAt: new Date().toISOString(),
    });
  });

  eventBus.emit("buttons:deleted", { buttonId, sectionId });
  eventBus.emit("modal:edit-button:close");
  eventBus.emit("ui:toast", {
    type: "info",
    message: "Button deleted. Check History to restore.",
  });
}

export function renderButtons(sectionId, container, opts = {}) {
  const q = (opts.query || "").toLowerCase();

  const data = storage.get();
  const page = data.pages[data.currentPageIndex || 0];
  const section = page?.sections?.[sectionId];
  if (!section || !section.buttons) return;

  // Очистка контейнера
  container.innerHTML = "";

  // === DnD на уровне контейнера (вешаем один раз) ===
  if (!container.dataset.dndBound) {
    container.dataset.dndBound = "1";

    // Создаём маркер-линию для кнопок
    let buttonDropMarker = document.createElement("div");
    buttonDropMarker.className = "button-drop-marker";
    buttonDropMarker.style.cssText = `
      width: 4px;
      height: 60px;
      background: var(--accent);
      border-radius: 2px;
      margin: 0 8px;
      opacity: 1;
      pointer-events: none;
      box-shadow: 0 0 10px var(--accent);
      display: block;
      align-self: center;
    `;

    let buttonDropIndex = null;
    let isDraggingButton = false;

    const computeButtonIndex = (wrap, clientX, clientY) => {
      const items = [...wrap.querySelectorAll(".assignment-button")];
      if (items.length === 0) return 0;

      let idx = items.length;

      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        const middleY = r.top + r.height / 2;
        const middleX = r.left + r.width / 2;

        if (clientY < middleY) {
          idx = i;
          break;
        } else if (clientY < r.bottom && clientX < middleX) {
          idx = i;
          break;
        }
      }

      return idx;
    };

    container.addEventListener(
      "dragstart",
      (e) => {
        if (e.target.classList.contains("drag-handle")) {
          isDraggingButton = true;
          console.log("[DnD Buttons] Drag started (container level)");
        }
      },
      true
    );

    container.addEventListener("dragover", (e) => {
      const types = e.dataTransfer.types;
      if (!types.includes("application/json")) {
        buttonDropMarker.remove();
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const idx = computeButtonIndex(container, e.clientX, e.clientY);
      buttonDropIndex = idx;

      const buttons = [...container.querySelectorAll(".assignment-button")];

      if (idx < buttons.length) {
        container.insertBefore(buttonDropMarker, buttons[idx]);
      } else {
        const addBtn = container.querySelector(".add-button");
        if (addBtn) {
          container.insertBefore(buttonDropMarker, addBtn);
        } else {
          container.appendChild(buttonDropMarker);
        }
      }
    });

    container.addEventListener("dragleave", (e) => {
      if (!container.contains(e.relatedTarget)) {
        buttonDropMarker.remove();
        buttonDropIndex = null;
      }
    });

    container.addEventListener("drop", (e) => {
      let payload = null;
      try {
        payload = JSON.parse(
          e.dataTransfer.getData("application/json") || "{}"
        );
      } catch {}

      if (!payload || payload.kind !== "button") {
        console.warn("[DnD Buttons] Invalid payload:", payload);
        return;
      }

      e.preventDefault();

      const toSectionId = sectionId;
      const targetIndex =
        buttonDropIndex ?? computeButtonIndex(container, e.clientX, e.clientY);

      buttonDropMarker.remove();
      buttonDropIndex = null;
      isDraggingButton = false;

      console.log("[DnD Buttons] Dropping at index:", targetIndex);

      storage.update((d) => {
        const p = d.pages[d.currentPageIndex || 0];
        const fromSection = p.sections[payload.sectionId];
        const toSection = p.sections[toSectionId];
        if (!fromSection || !toSection) return;

        const fromIdx = (fromSection.buttons || []).findIndex(
          (b) => b.id === payload.buttonId
        );
        if (fromIdx < 0) return;

        const [moved] = fromSection.buttons.splice(fromIdx, 1);

        if (!toSection.buttons) toSection.buttons = [];

        let insertAt = targetIndex;
        if (payload.sectionId === toSectionId && fromIdx < targetIndex) {
          insertAt = Math.max(0, targetIndex - 1);
        }
        insertAt = Math.min(Math.max(insertAt, 0), toSection.buttons.length);

        toSection.buttons.splice(insertAt, 0, moved);
      });

      eventBus.emit("ui:toast", {
        type: "info",
        message:
          payload.sectionId === toSectionId
            ? "Button reordered"
            : "Button moved to another section",
      });
    });

    container.addEventListener(
      "dragend",
      () => {
        buttonDropMarker.remove();
        buttonDropIndex = null;
        isDraggingButton = false;
        console.log("[DnD Buttons] Drag ended (cleanup)");
      },
      true
    );
  }

  section.buttons.forEach((button, bIdx) => {
    if (q) {
      const t = (button.text || "").toLowerCase();
      const u = (button.href || "").toLowerCase();
      if (!t.includes(q) && !u.includes(q)) return;
    }

    const btnElement = document.createElement("a");
    btnElement.className = "assignment-button";
    btnElement.dataset.id = button.id;

    btnElement.dataset.buttonId = button.id || `btn-${sectionId}-${bIdx}`;
    btnElement.dataset.buttonIndex = String(bIdx);
    btnElement.dataset.sectionId = sectionId;

    const rawHref = button.href || "";
    const finalHref = rawHref ? normalizeUrl(rawHref) : "";
    // В DOM даём только http/https, иначе "#"
    btnElement.href = isSafeLinkUrl(finalHref) ? finalHref : "#";

    btnElement.setAttribute("draggable", "false");

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.title = "Drag to reorder";
    handle.textContent = "⋮⋮";
    btnElement.appendChild(handle);

    const label = document.createElement("span");
    label.className = "assignment-label";
    if (opts?.query) {
      // highlightText возвращает уже экранированный HTML + <mark>, поэтому innerHTML безопасен
      label.innerHTML = highlightText(button.text || "New button", opts.query);
    } else {
      label.textContent = button.text || "New button";
    }
    btnElement.appendChild(label);

    const editIcon = document.createElement("span");
    editIcon.className = "edit-link";
    editIcon.textContent = "✎";
    editIcon.title = "Edit button";
    editIcon.setAttribute("draggable", "false");
    btnElement.appendChild(editIcon);

    btnElement.addEventListener("dragstart", (e) => {
      if (!e.target.classList.contains("drag-handle")) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    handle.draggable = !q;
    handle.addEventListener("dragstart", (e) => {
      const dataNow = storage.get();
      const pageNow = dataNow.pages[dataNow.currentPageIndex || 0];
      const secNow = pageNow?.sections?.[sectionId];
      const fromIndex = (secNow?.buttons || []).findIndex(
        (b) => b.id === button.id
      );

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          kind: "button",
          sectionId,
          buttonId: button.id,
          fromIndex,
        })
      );

      btnElement.classList.add("dragging");
      globalDraggingButton = { buttonId: button.id, sectionId };
      console.log("[DnD Buttons] Button drag started:", button.text);
    });
    handle.addEventListener("dragend", () => {
      btnElement.classList.remove("dragging");
      globalDraggingButton = null;
    });

    editIcon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditModal(button.id, sectionId);
    });

    btnElement.addEventListener("click", (e) => {
      if (e.target.classList.contains("edit-link")) {
        e.preventDefault();
        return;
      }
      if (!finalHref) {
        e.preventDefault();
        eventBus.emit("ui:toast", {
          type: "info",
          message: "No link set. Click edit to add one.",
        });
        return;
      }
      e.preventDefault();
      eventBus.emit("link:open", { url: finalHref });
    });

    container.appendChild(btnElement);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "add-button ui-plus-btn";
  addBtn.setAttribute("aria-label", "Add new button");
  addBtn.title = "Add new button";
  /* текст '+' оставляем — его всё равно прячет font-size:0, но это fallback для скринридеров */
  addBtn.textContent = "+";
  addBtn.addEventListener("click", () => addNewButton(sectionId));
  container.appendChild(addBtn);
}

export function initButtons() {
  eventBus.on("button:save", saveButton);
  eventBus.on("button:delete", ({ buttonId, sectionId }) =>
    deleteButton(buttonId, sectionId)
  );

  eventBus.on("button:quickAdd", (payload = {}) => {
    const {
      text = "New button",
      href = "",
      targetPageIndex,
      targetPageId,
      targetSectionId, // явный выбор секции
    } = payload;

    const normalizeUrl = (raw) => {
      const s = (raw || "").trim();
      if (!s) return "";
      try {
        const u = new URL(s, s.startsWith("http") ? undefined : "https://");
        return u.href;
      } catch {
        return s;
      }
    };

    const data = storage.get();

    // страница
    let pageIdx =
      typeof targetPageIndex === "number"
        ? targetPageIndex
        : data.currentPageIndex || 0;

    if (targetPageId) {
      const found = (data.pages || []).findIndex((p) => p.id === targetPageId);
      if (found >= 0) pageIdx = found;
    }

    const page = data.pages?.[pageIdx];
    if (!page) {
      eventBus.emit("ui:toast", {
        type: "error",
        message: "Target page not found!",
      });
      return;
    }

    // секция
    let secId =
      targetSectionId && page.sections?.[targetSectionId]
        ? targetSectionId
        : null;

    if (!secId) {
      // ищем/создаём Inbox
      secId = Object.keys(page.sections || {}).find(
        (id) => (page.sections[id]?.text || "").toLowerCase() === "inbox"
      );
      if (!secId) {
        secId = `section-${Date.now()}`;
        storage.update((d) => {
          const p = d.pages[pageIdx];
          if (!p.sections) p.sections = {};
          p.sections[secId] = { text: "Inbox", buttons: [] };
          if (!Array.isArray(p.sectionsOrder)) p.sectionsOrder = [];
          p.sectionsOrder.unshift(secId);
        });
      }
    }

    const finalHref = normalizeUrl(href);
    const newId = `button-${Date.now()}`;
    let added = false;

    storage.update((d) => {
      const p = d.pages[pageIdx];
      const s = p.sections[secId];
      if (!s.buttons) s.buttons = [];

      if (finalHref) {
        const dup = s.buttons.find(
          (b) => (b.href || "").toLowerCase() === finalHref.toLowerCase()
        );
        if (dup) return; // уже есть
      }

      s.buttons.unshift({ id: newId, text, href: finalHref });
      added = true;
    });

    if (!added) {
      eventBus.emit("ui:toast", { type: "info", message: "Already in Inbox" });
      return;
    }

    const s = storage.get().pages[pageIdx].sections[secId];
    const secName = s?.text || "Inbox";

    let host = "";
    try {
      if (finalHref) host = new URL(finalHref).hostname || "";
    } catch {}

    eventBus.emit("ui:toast", {
      type: "success",
      message: `Added to ${secName}${host ? ` — ${host}` : ""}`,
    });

    requestAnimationFrame(() => {
      const el = document.querySelector(
        `.assignment-button[data-id="${newId}"]`
      );
      el?.classList.add("just-added");
      el?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      setTimeout(() => el?.classList.remove("just-added"), 900);
    });
  });

  console.log("✅ Buttons module initialized");
}
