// web/ui/modals/modal-qa-new-section.js
import { eventBus } from "../../core/event-bus.js";
import { openModal } from "../modal-service.js";

/**
 * Pick destination for Quick Add:
 * - page
 * - inbox / existing section / new section
 *
 * @param {{pages:Array, defaultPageIndex:number}} opts
 * @returns {Promise<
 *  { pageIndex:number, mode:"inbox"|"existing"|"new", sectionId?:string|null, sectionTitle?:string, sectionLabel?:string } | null
 * >}
 */
export function openQaNewSectionModal({
  pages = [],
  defaultPageIndex = 0,
} = {}) {
  // --- helpers ---
  const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getPageLabel = (p, i) =>
    String(p?.name || p?.text || p?.title || `Page ${i + 1}`);

  const safeIdx = (() => {
    const maxIdx = Math.max(0, (pages?.length || 1) - 1);
    return Math.min(Math.max(0, toInt(defaultPageIndex)), maxIdx);
  })();

  const getSectionsOfPage = (p) => {
    const out = [];
    if (!p) return out;

    // object-map schema: sections = {id: {...}}
    if (
      p.sections &&
      typeof p.sections === "object" &&
      !Array.isArray(p.sections)
    ) {
      const order = Array.isArray(p.sectionsOrder)
        ? p.sectionsOrder
        : Object.keys(p.sections);
      for (const id of order) {
        const s = p.sections?.[id];
        if (!s) continue;
        const label = s.text || s.title || s.name || "Section";
        out.push({ id: String(id), label: String(label) });
      }
      return out;
    }

    // array schema fallback: sections = [{id,...}]
    if (Array.isArray(p.sections)) {
      p.sections.forEach((s, i) => {
        if (!s) return;
        const id = s.id != null ? String(s.id) : String(i);
        const label = s.text || s.title || s.name || `Section ${i + 1}`;
        out.push({ id, label: String(label) });
      });
      return out;
    }

    return out;
  };

  const esc = (s = "") =>
    String(s).replace(
      /[&<>"]/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])
    );

  const buildDestOptionsHTML = (pageIndex) => {
    const p = pages?.[pageIndex];
    const secs = getSectionsOfPage(p);

    let html = "";
    html += `<option value="__inbox__">Inbox (default)</option>`;
    html += `<option value="__sep1__" disabled>— Existing sections —</option>`;

    if (secs.length) {
      html += secs
        .map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`)
        .join("");
    } else {
      html += `<option value="__none__" disabled>(no sections on this page)</option>`;
    }

    html += `<option value="__sep2__" disabled>— Create new —</option>`;
    html += `<option value="__new__">New section…</option>`;
    return html;
  };

  const pagesOptionsHTML = (pages || [])
    .map((p, i) => {
      const sel = i === safeIdx ? " selected" : "";
      const label = getPageLabel(p, i);
      return `<option value="${i}"${sel}>${esc(label)}</option>`;
    })
    .join("");

  return new Promise((resolve) => {
    const bodyHTML = `
      <div class="modal-field">
        <label for="qaNewSectionPage">Page</label>
        <select id="qaNewSectionPage">
          ${pagesOptionsHTML}
        </select>
      </div>

      <div class="modal-field">
        <label for="qaNewSectionDest">Save to…</label>
        <select id="qaNewSectionDest">
          ${buildDestOptionsHTML(safeIdx)}
        </select>
      </div>

      <div class="modal-field" id="qaNewSectionNameField" hidden>
        <label for="qaNewSectionName">Section name</label>
        <input id="qaNewSectionName" type="text" placeholder="New section" />
      </div>

      <div class="modal-buttons-group">
        <button class="btn cancel" data-act="cancel">Cancel</button>
        <button class="btn save" data-act="ok">Save</button>
      </div>
    `;

    openModal({
      title: "Quick Add destination",
      bodyHTML,
      showFooter: false,
    });

    // Ищем элементы после рендера модалки
    setTimeout(() => {
      const selPage = document.getElementById("qaNewSectionPage");
      const selDest = document.getElementById("qaNewSectionDest");
      const nameField = document.getElementById("qaNewSectionNameField");
      const inpName = document.getElementById("qaNewSectionName");
      const btnOk = document.querySelector('.modal [data-act="ok"]');
      const btnCancel = document.querySelector('.modal [data-act="cancel"]');

      if (
        !selPage ||
        !selDest ||
        !nameField ||
        !inpName ||
        !btnOk ||
        !btnCancel
      ) {
        console.error("[QA dest modal] Required elements not found");
        return;
      }

      const close = () => eventBus.emit("modal:close");

      const rebuildDest = () => {
        const pageIndex = Number(selPage.value) || 0;
        selDest.innerHTML = buildDestOptionsHTML(pageIndex);
        selDest.value = "__inbox__";
        nameField.hidden = true;
      };

      const syncNameVisibility = () => {
        const isNew = selDest.value === "__new__";
        nameField.hidden = !isNew;
        if (isNew) {
          inpName.focus();
          inpName.select?.();
        }
      };

      // События
      selPage.addEventListener("change", () => {
        rebuildDest();
        selDest.focus();
      });

      selDest.addEventListener("change", syncNameVisibility);

      const submit = () => {
        const pageIndex = Number(selPage.value) || 0;
        const dest = String(selDest.value || "__inbox__");

        if (dest === "__new__") {
          const sectionTitle = (inpName.value || "").trim() || "New section";
          resolve({ pageIndex, mode: "new", sectionTitle });
          close();
          return;
        }

        if (dest === "__inbox__") {
          resolve({ pageIndex, mode: "inbox", sectionId: null });
          close();
          return;
        }

        if (dest === "__sep1__" || dest === "__sep2__" || dest === "__none__")
          return;

        const selectedText =
          selDest.options?.[selDest.selectedIndex]?.textContent || "Section";

        resolve({
          pageIndex,
          mode: "existing",
          sectionId: dest,
          sectionLabel: selectedText,
        });
        close();
      };

      btnOk.addEventListener("click", submit);

      // Исправленная кнопка Cancel
      btnCancel.addEventListener("click", () => {
        resolve(null);
        close();
      });

      inpName.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });

      // Начальное состояние
      selDest.value = "__inbox__";
      nameField.hidden = true;
      selPage.focus();
    }, 50);
  });
}
