// ui/sessions-modal.js
import { eventBus } from "../core/event-bus.js";
import { storage } from "../core/storage.js";

function esc(s = "") {
  return String(s).replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])
  );
}

export function initSessionsModal() {
  // Открытие модалки по сигналу из хедера
  eventBus.on("ui:sessions:open", () => renderOpenModal());
}

// Рендер основной «Open»-модалки
function renderOpenModal() {
  const work = storage.sessions.listWorkspaces(); // только workspace
  const snaps = storage.sessions.listSnapshots(); // только snapshot

  const liWorkspace = (it) => `
    <li class="row" data-id="${it.id}">
      <div class="info">
        <div class="name">${esc(it.name)}</div>
        <div class="meta">${new Date(it.updatedAt).toLocaleString()}</div>
      </div>
      <div class="actions">
        <button class="btn save" data-act="activate">Activate</button>
        <button class="btn rename" data-act="rename">Rename</button>
        <button class="btn delete" data-act="delete">Delete</button>
      </div>
    </li>`;

  const liSnapshot = (it) => `
    <li class="row" data-id="${it.id}">
      <div class="info">
        <div class="name">${esc(it.name)}</div>
        <div class="meta">${new Date(it.updatedAt).toLocaleString()}</div>
      </div>
      <div class="actions">
        <button class="btn save" data-act="restore">Restore</button>
        <button class="btn delete" data-act="delete">Delete</button>
      </div>
    </li>`;

  const bodyHTML = `
    <div class="modal-form sessions-modal">
      <section>
        <h3>Workspaces</h3>
        <ul class="list">
          ${
            work.length
              ? work.map(liWorkspace).join("")
              : `<li class="empty" style="opacity:.7;">No workspaces yet</li>`
          }
        </ul>
      </section>
      <hr />
      <section>
        <h3>Snapshots</h3>
        <ul class="list">
          ${
            snaps.length
              ? snaps.map(liSnapshot).join("")
              : `<li class="empty" style="opacity:.7;">No snapshots yet</li>`
          }
        </ul>
      </section>
    </div>
  `;

  eventBus.emit("modal:custom:open", {
    title: "Open",
    bodyHTML,
    onMount: (root) => {
      root.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;

        const row = btn.closest("li.row");
        const id = row?.dataset.id;
        const act = btn.dataset.act;
        if (!id) return;

        if (act === "activate") {
          const store = storage.sessions._read();
          const entry = store[id];
          storage.sessions.load(id);
          storage.saves.setActiveName(entry?.name || "");
          eventBus.emit("modal:close");
          return;
        }

        if (act === "rename") {
          // 1) закрываем текущую модалку
          eventBus.emit("modal:close");
          // 2) даём DOM закрыться и открываем модалку переименования
          setTimeout(() => {
            const store = storage.sessions._read();
            const current = store[id]?.name || "";
            openRenameModal(id, current, () => renderOpenModal());
          }, 0);
          return;
        }

        if (act === "restore") {
          // создаст workspace и откроет его
          storage.sessions.restoreToWorkspace(id);
          eventBus.emit("modal:close");
          return;
        }

        if (act === "delete") {
          // 1) закрываем текущую модалку
          eventBus.emit("modal:close");
          // 2) открываем confirm поверх пустого фона
          setTimeout(() => {
            openConfirmModal("Delete this item?", () => {
              storage.sessions.delete(id);
              // после удаления возвращаемся к списку
              renderOpenModal();
            });
          }, 0);
          return;
        }
      });
    },
  });
}

// маленькая confirm-модалка
function openConfirmModal(message, onYes) {
  const body = `
      <div class="modal-form">
        <div>${esc(message)}</div>
        <div class="actions">
          <button type="button" class="btn cancel" data-act="cancel">Cancel</button>
          <button type="button" class="btn save" data-act="ok">Delete</button>
        </div>
      </div>`;
  eventBus.emit("modal:custom:open", {
    title: "Confirm",
    bodyHTML: body,
    onMount: (root) => {
      // делегирование: один обработчик на всю модалку
      root.addEventListener(
        "click",
        (e) => {
          const okBtn = e.target.closest('[data-act="ok"]');
          const cancelBtn = e.target.closest('[data-act="cancel"]');
          if (okBtn) {
            e.preventDefault();
            e.stopPropagation();
            eventBus.emit("modal:close");
            onYes?.();
          } else if (cancelBtn) {
            e.preventDefault();
            e.stopPropagation();
            eventBus.emit("modal:close");
          }
        },
        { passive: false }
      );
    },
  });
}

// модалка Rename для workspace
function openRenameModal(id, currentName, onDone) {
  const body = `
      <div class="modal-form">
        <label for="renameInput">New name</label>
        <input id="renameInput" type="text" value="${esc(currentName)}" />
        <div class="actions">
          <button type="button" class="btn cancel" data-act="cancel">Cancel</button>
          <button type="button" class="btn save" data-act="ok">Rename</button>
        </div>
      </div>`;
  eventBus.emit("modal:custom:open", {
    title: "Rename",
    bodyHTML: body,
    onMount: (root) => {
      const inp = root.querySelector("#renameInput");
      setTimeout(() => {
        inp?.focus();
        inp?.select();
      }, 0);

      const submit = () => {
        const v = (inp?.value || "").trim();
        if (!v) return;
        storage.sessions.rename(id, v);
        storage.saves.setActiveName(v);
        eventBus.emit("modal:close");
        onDone?.(); // перерисуем список «Open»
      };

      // делегирование кликов по кнопкам
      root.addEventListener(
        "click",
        (e) => {
          const okBtn = e.target.closest('[data-act="ok"]');
          const cancelBtn = e.target.closest('[data-act="cancel"]');
          if (okBtn) {
            e.preventDefault();
            e.stopPropagation();
            submit();
          }
          if (cancelBtn) {
            e.preventDefault();
            e.stopPropagation();
            eventBus.emit("modal:close");
          }
        },
        { passive: false }
      );

      // Enter в поле — тоже «Rename»
      inp?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
    },
  });
}
