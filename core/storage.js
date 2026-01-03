// =============================================================================
// CORE/STORAGE.JS — Хранилище данных приложения (localStorage и platform)
// =============================================================================
// Что здесь:
// - Инициализация данных (двухфазная: localStorage → затем platform override)
// - Сохранение (localStorage и platform.saveAppState)
// - get / update / exportJSON / importJSON / reset
// - Workspaces/Snapshots: sessions и «дружественная» обёртка saves
// - События для UI: storage:loaded, storage:updated, sessions:updated,
//   saves:activeChanged, тосты об успехах/ошибках
// =============================================================================

import { eventBus } from "./event-bus.js";
import { platform } from "./platform.js";

const DEBUG_STORAGE_LOGS = false;

// ---------- Stable stringify (отсортированные ключи) ----------
function stableStringify(val) {
  const seen = new WeakSet();
  const sorter = (k, v) => {
    if (v && typeof v === "object") {
      if (seen.has(v)) return; // защита от циклов
      seen.add(v);
      if (Array.isArray(v)) return v.map((x) => x);
      // сортируем ключи объекта
      return Object.keys(v)
        .sort()
        .reduce((acc, key) => {
          acc[key] = v[key];
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(val, sorter);
}

// ---------- Канонизация контента (только то, что едет в экспорт) ----------
const CONTENT_KEYS = ["pages", "deletedItemsHistory"];

const HISTORY_TTL_DAYS = 30;
const HISTORY_MAX_ITEMS = 200;
const HISTORY_TTL_MS = HISTORY_TTL_DAYS * 24 * 60 * 60 * 1000;

function toTs(v) {
  if (!v) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = Date.parse(v); // поддержит ISO
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function pruneDeletedItemsHistoryInPlace(state) {
  if (!state) return;

  const arr = Array.isArray(state.deletedItemsHistory)
    ? state.deletedItemsHistory
    : [];
  const cutoff = Date.now() - HISTORY_TTL_MS;

  const filtered = arr.filter((it) => {
    const ts = toTs(it.deletedAt);
    return ts == null ? true : ts >= cutoff;
  });

  // держим только последние N, чтобы не разрасталось
  state.deletedItemsHistory =
    filtered.length > HISTORY_MAX_ITEMS
      ? filtered.slice(filtered.length - HISTORY_MAX_ITEMS)
      : filtered;
}

/** отбираем только «контентные» ветки state */
function pickContent(state) {
  const out = {};
  for (const k of CONTENT_KEYS) out[k] = state?.[k];
  return out;
}

/** нормализуем порядок и поля, не тащим UI-мета (collapsed и т.п.) */
function canonContent(state) {
  const s = pickContent(state) || {};
  const pages = Array.isArray(s.pages) ? s.pages : [];

  const canonPages = pages.map((p) => {
    const secOrder = Array.isArray(p.sectionsOrder)
      ? p.sectionsOrder.slice()
      : Object.keys(p.sections || {});

    const sections = {};
    for (const sid of secOrder) {
      const sec = (p.sections || {})[sid] || {};
      sections[sid] = {
        text: sec.text || "",
        buttons: Array.isArray(sec.buttons)
          ? sec.buttons.map((b) => ({
              id: b.id || null,
              text: b.text || "",
              href: b.href || "",
              // icon, color, note, tags — оставляем, если они заданы
              ...(b.icon && { icon: b.icon }),
              ...(b.color && { color: b.color }),
              ...(b.note && { note: b.note }),
              ...(Array.isArray(b.tags) &&
                b.tags.length > 0 && { tags: b.tags.slice() }),
            }))
          : [],
        // ❌ НЕ включаем collapsed — это UI-состояние, не контент!
      };
    }

    return {
      id: p.id || null,
      name: p.name || "",
      sectionsOrder: secOrder,
      sections,
      // ❌ НЕ включаем другие UI-мета (например, isVisible, expanded и т.п.)
    };
  });

  const canonHistory = Array.isArray(s.deletedItemsHistory)
    ? s.deletedItemsHistory.map((h) => ({
        type: h.type || "",
        pageId: h.pageId || null,
        pageName: h.pageName || "",
        sectionId: h.sectionId || null,
        sectionName: h.sectionName || "",
        buttons: Array.isArray(h.buttons)
          ? h.buttons.map((b) => ({
              id: b.id || null,
              text: b.text || "",
              href: b.href || "",
            }))
          : [],
      }))
    : [];

  return { pages: canonPages, deletedItemsHistory: canonHistory };
}

/** стабильный снэпшот контента (строка) */
function contentSnapshot(state) {
  return stableStringify(canonContent(state));
}

// --- ключи локального стора
const SESSIONS_KEY = "linkapp-sessions";
const ACTIVE_SAVE_KEY = "linkapp-active-save-name";

// --- утилиты/константы
const deepClone = (x) => JSON.parse(JSON.stringify(x));
const KIND_WORKSPACE = "workspace";
const KIND_SNAPSHOT = "snapshot";

let __dirtyContent = false;
export const isContentDirty = () => __dirtyContent;
function setDirty(flag) {
  const next = !!flag;
  if (next !== __dirtyContent) {
    __dirtyContent = next;
    eventBus.emit("storage:dirty", { dirty: __dirtyContent });
  }
}
// При сохранении/загрузке гасим индикатор
eventBus.on("storage:saved", () => setDirty(false));
eventBus.on("storage:loaded", () => setDirty(false));

// =============================================================================
// ДАННЫЕ ПО УМОЛЧАНИЮ
// =============================================================================
const DEFAULT_DATA = {
  currentPageIndex: 0,
  pages: [
    {
      id: "page-1",
      name: "Page 1",
      sections: {
        "section-1": {
          text: "New Section",
          buttons: [{ id: "button-1", text: "New button", href: "" }],
        },
      },
    },
    {
      id: "page-2",
      name: "Page 2",
      sections: {
        "section-2": {
          text: "New Section",
          buttons: [{ id: "button-2", text: "New button", href: "" }],
        },
      },
    },
    {
      id: "page-3",
      name: "Page 3",
      sections: {
        "section-3": {
          text: "New Section",
          buttons: [{ id: "button-3", text: "New button", href: "" }],
        },
      },
    },
  ],
  deletedItemsHistory: [],
};

// =============================================================================
// НОРМАЛИЗАЦИЯ ИМПОРТИРУЕМОГО JSON
// =============================================================================

function normalizeImportedSnapshot(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Import failed: JSON root is not an object");
  }

  // Строгая проверка: нужен массив pages
  if (!Array.isArray(raw.pages)) {
    throw new Error("Invalid data structure: 'pages' array not found");
  }

  // Базовые дефолты
  const base = deepClone(DEFAULT_DATA);

  // Мержим: дефолты и то, что пришло из файла
  const merged = {
    ...base, // чтобы были currentPageIndex, deletedItemsHistory и т.п.
    ...raw, // но pages/другие поля — из файла
  };

  // Страхуем currentPageIndex
  if (
    typeof merged.currentPageIndex !== "number" ||
    merged.currentPageIndex < 0 ||
    merged.currentPageIndex >= merged.pages.length
  ) {
    merged.currentPageIndex = 0;
  }

  // deletedItemsHistory — гарантированно массив
  if (!Array.isArray(merged.deletedItemsHistory)) {
    merged.deletedItemsHistory = [];
  }

  return merged;
}

// =============================================================================
/** ГЛАВНОЕ ХРАНИЛИЩЕ */
// =============================================================================
export const storage = {
  /** текущее состояние приложения */
  data: null,

  // ===========================================================================
  // ИНИЦИАЛИЗАЦИЯ (двухфазная)
  // ===========================================================================
  init() {
    // Фаза A: быстрый старт из localStorage (UI оживает сразу)
    try {
      const stored = localStorage.getItem("linkapp-data");
      if (stored) {
        this.data = JSON.parse(stored);
        this.migrateData?.();
        console.log("[storage] Data loaded from localStorage");
      } else {
        this.data = deepClone(DEFAULT_DATA);
        console.log("[storage] No saved data found, using defaults");
      }
    } catch (e) {
      console.error("[storage] Failed to load data:", e);
      this.data = deepClone(DEFAULT_DATA);
    }

    // Синхронизируем и оповещаем UI
    this.save();
    eventBus.emit("storage:loaded", this.data);

    // Фаза B: догрузка из platform (например, Electron userData/state.json)
    platform
      ?.loadAppState?.()
      .then((raw) => {
        if (!raw) return;
        try {
          const fromPlatform = JSON.parse(raw);
          if (JSON.stringify(fromPlatform) !== JSON.stringify(this.data)) {
            this.data = fromPlatform;
            this.migrateData?.();
            this.save(); // записать обратно и в localStorage, и в платформу
            eventBus.emit("storage:loaded", this.data);
            console.log("[storage] Data loaded from platform (override)");
          }
        } catch (e) {
          console.warn("[storage] platform state is invalid JSON, skip.", e);
        }
      })
      .catch((err) => {
        console.warn("[storage] loadAppState failed:", err);
      });
  },

  // ===========================================================================
  // МИГРАЦИИ
  // ===========================================================================
  migrateData() {
    // pages
    if (!Array.isArray(this.data.pages)) {
      console.warn("[storage] Invalid pages structure, resetting...");
      this.data.pages = deepClone(DEFAULT_DATA.pages);
    }
    if (this.data.pages.length === 0) {
      console.warn("[storage] No pages found, creating default page...");
      this.data.pages.push(deepClone(DEFAULT_DATA.pages[0]));
    }

    // currentPageIndex
    if (typeof this.data.currentPageIndex !== "number") {
      this.data.currentPageIndex = 0;
    }
    if (this.data.currentPageIndex >= this.data.pages.length) {
      this.data.currentPageIndex = 0;
    }

    // deletedItemsHistory
    if (!Array.isArray(this.data.deletedItemsHistory)) {
      this.data.deletedItemsHistory = [];
    }

    // Нормализация страниц
    this.data.pages.forEach((p, idx) => {
      if (!p.sections) p.sections = {};
      if (!Array.isArray(p.sectionsOrder)) {
        p.sectionsOrder = Object.keys(p.sections);
      }
      if (typeof p.name !== "string" || p.name.trim() === "") {
        p.name = `Page ${idx + 1}`;
      }
    });

    // Миграция со старой плоской схемы (на всякий случай)
    if (this.data.sections && !this.data.pages[0].sections) {
      console.log("[storage] Migrating old structure...");
      this.data.pages[0].sections = this.data.sections;
      delete this.data.sections;
    }

    console.log("[storage] Data migration completed");
  },

  save() {
    try {
      // ✅ сначала чистим именно то, что будем сохранять
      pruneDeletedItemsHistoryInPlace(this.data);

      // ✅ затем сериализуем уже очищенное
      const json = JSON.stringify(this.data);

      localStorage.setItem("linkapp-data", json);
      platform?.saveAppState?.(json);
    } catch (e) {
      console.error("[storage] Failed to save:", e);
    }
  },

  // ===========================================================================
  // GET / UPDATE
  // ===========================================================================
  get() {
    return this.data;
  },

  update(mutator) {
    try {
      const before = contentSnapshot(this.data);

      // Мутируем state
      mutator(this.data);

      const after = contentSnapshot(this.data);

      // Помечаем «грязным» только если контент реально изменился
      if (before !== after) {
        setDirty(true);
      }

      this.save();
      eventBus.emit("storage:updated", this.data);
    } catch (e) {
      console.error("[storage] Failed to update data:", e);
      eventBus.emit("ui:toast", {
        type: "error",
        message: "Failed to update data",
      });
    }
  },

  // Загружаем СТЕЙТ «как из файла/снэпшота».
  // Важно: это НЕ помечает состояние как грязное и гасит индикатор.
  // Полная загрузка состояния (как из файла/снэпшота)
  load(next) {
    try {
      // Принимаем уже нормализованный снапшот
      this.data = next || {
        pages: [],
        currentPageIndex: 0,
        deletedItemsHistory: [],
      };

      pruneDeletedItemsHistoryInPlace(this.data);

      // Прогоняем миграции (sectionsOrder и т.п.), если у тебя есть метод
      if (typeof this.migrateData === "function") {
        this.migrateData();
      }

      // Персистим (localStorage/Electron)
      this.save();

      // Сообщаем системе: состояние обновлено И это была именно «загрузка»
      eventBus.emit("storage:updated", this.data);
      eventBus.emit("storage:loaded", this.data);
      setDirty(false); // ⬅️ загрузка = чистое состояние
      return true;
    } catch (e) {
      console.error("[storage] Failed to load data:", e);
      eventBus.emit("ui:toast", {
        type: "error",
        message: "Failed to load data",
      });
      return false;
    }
  },

  // ===========================================================================
  // ЭКСПОРТ / ИМПОРТ / СБРОС
  // ===========================================================================
  exportJSON() {
    try {
      const payload = {
        ...this.data,
        __app: "LinkApp",
        __schema: 2,
        __exportedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(payload, null, 2);
      console.log("[storage] Data exported to JSON");
      return json;
    } catch (e) {
      console.error("[storage] Failed to export data:", e);
      eventBus.emit("ui:toast", {
        type: "error",
        message: "Failed to export data",
      });
      return null;
    }
  },

  importJSON(jsonString) {
    try {
      const raw = JSON.parse(jsonString);
      const snapshot = normalizeImportedSnapshot(raw);

      const ok = this.load(snapshot); // 👈 единая точка входа
      // Успех — тихий: пользователь и так видит изменившиеся страницы/секции,
      // статусбар показывает "All changes saved", а индикатор гасит "dirty".
      return ok;
    } catch (e) {
      console.error("[storage] Failed to import data:", e);
      eventBus.emit("ui:toast", {
        type: "error",
        message: "Failed to import data: " + e.message,
      });
      return false;
    }
  },
  reset() {
    this.data = deepClone(DEFAULT_DATA);
    this.save();
    console.log("[storage] Data reset to defaults");

    eventBus.emit("storage:loaded", this.data);
    eventBus.emit("storage:updated", this.data);
    eventBus.emit("ui:toast", {
      type: "info",
      message: "Data reset to defaults",
    });
    setDirty(false);
  },

  // ===========================================================================
  // SESSIONS (Workspaces и Snapshots)
  // ===========================================================================
  sessions: {
    _read() {
      try {
        const raw = localStorage.getItem(SESSIONS_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    },

    _write(obj) {
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(obj));
        eventBus.emit("sessions:updated");
      } catch (e) {
        console.error("[sessions] write failed:", e);
        eventBus.emit("ui:toast", {
          type: "error",
          message: "Failed to save session list",
        });
      }
    },

    /**
     * Сохранить слепок текущего состояния
     * @param {string} name
     * @param {'workspace'|'snapshot'} kind
     */
    save(name = "", kind = KIND_SNAPSHOT) {
      const id = `sess-${Date.now()}`;
      const store = this._read();
      store[id] = {
        id,
        kind,
        name:
          String(name || "").trim() ||
          (kind === KIND_SNAPSHOT
            ? `Snapshot ${new Date().toLocaleString()}`
            : `Workspace ${new Date().toLocaleString()}`),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: deepClone(storage.data),
      };
      this._write(store);
      eventBus.emit("ui:toast", {
        type: "success",
        message:
          kind === KIND_SNAPSHOT ? "Snapshot created" : "Workspace saved",
      });
      return id;
    },

    /** Полный список */
    list() {
      const store = this._read();
      return Object.values(store).sort((a, b) => b.updatedAt - a.updatedAt);
    },

    /** Списки по типу */
    listByKind(kind) {
      const store = this._read();
      return Object.values(store)
        .filter((x) => !x.deletedAt && (x.kind || KIND_WORKSPACE) === kind)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    listWorkspaces() {
      return this.listByKind(KIND_WORKSPACE);
    },
    listSnapshots() {
      return this.listByKind(KIND_SNAPSHOT);
    },

    /** Переименовать */
    rename(id, newName) {
      const store = this._read();
      if (!store[id]) return false;
      store[id].name = String(newName || "").trim() || store[id].name;
      store[id].updatedAt = Date.now();
      this._write(store);
      eventBus.emit("ui:toast", { type: "info", message: "Session renamed" });
      return true;
    },

    /** Удалить */
    delete(id) {
      const store = this._read();
      if (!store[id]) return false;
      // Мягкое удаление: помечаем
      store[id].deletedAt = Date.now();
      this._write(store);
      eventBus.emit("ui:toast", { type: "info", message: "Moved to trash" });
      return true;
    },

    /**
     * Загрузить запись: заменить текущие данные приложения
     * и инициировать перерендер (storage:updated/loaded).
     */
    load(id) {
      const store = this._read();
      const snap = store[id];
      if (!snap) {
        eventBus.emit("ui:toast", {
          type: "error",
          message: "Session not found",
        });
        return false;
      }

      // заменить данные и мигрировать
      storage.data = deepClone(snap.data);
      storage.migrateData?.();

      // запомнить активное имя (для «Save»)
      storage.saves.setActiveName(snap.name);

      // сохранить и разослать события для UI
      storage.save(); // localStorage и platform
      eventBus.emit("storage:updated", storage.data); // большинство модулей слушают это
      eventBus.emit("storage:loaded", storage.data); // совместимость со старыми слушателями
      setDirty(false);

      eventBus.emit("ui:toast", {
        type: "success",
        message: `Session loaded: ${snap.name}`,
      });
      return true;
    },

    /**
     * Восстановить snapshot в НОВЫЙ workspace и сразу его открыть.
     */
    restoreToWorkspace(id, newName = "") {
      const store = this._read();
      const snap = store[id];
      if (!snap) {
        eventBus.emit("ui:toast", {
          type: "error",
          message: "Snapshot not found",
        });
        return null;
      }
      const title =
        String(newName || "").trim() ||
        `${snap.name} (restored ${new Date().toLocaleDateString()})`;

      // создать новую запись типа workspace
      const newId = this.save(title, KIND_WORKSPACE);

      // заменить её данными снапшота
      const after = this._read();
      if (after[newId]) {
        after[newId].data = deepClone(snap.data);
        after[newId].createdAt = Date.now();
        after[newId].updatedAt = Date.now();
        this._write(after);

        // сделать активной и загрузить
        storage.saves.setActiveName(title);
        this.load(newId);
      }
      return newId;
    },
  },

  // ===========================================================================
  // «Дружественная» обёртка «сохранений» над sessions
  // (работаем только с WORKSPACE, снапшоты не показываем тут)
  // ===========================================================================
  saves: {
    getActiveName() {
      return localStorage.getItem(ACTIVE_SAVE_KEY) || "";
    },

    setActiveName(name) {
      const val = String(name || "").trim();
      localStorage.setItem(ACTIVE_SAVE_KEY, val);
      eventBus.emit("saves:activeChanged", { name: val });
    },

    list() {
      // используем уже готовый helper sessions.listByKind
      return storage.sessions.listByKind(KIND_WORKSPACE);
    },

    /**
     * Сохранить в workspace с указанным именем (создать/перезаписать).
     */
    upsert(name) {
      const target = String(name || "").trim();
      if (!target) return false;

      const store = storage.sessions._read();

      // ищем по имени среди всех (workspace/snapshot), перезапишем как workspace
      const existingId = Object.keys(store).find(
        (id) => (store[id]?.name || "").toLowerCase() === target.toLowerCase()
      );

      if (existingId) {
        const entry = store[existingId];
        entry.kind = KIND_WORKSPACE; // важный штрих
        entry.data = deepClone(storage.data);
        entry.updatedAt = Date.now();
        storage.sessions._write(store);
        storage.saves.setActiveName(target);
        eventBus.emit("ui:toast", {
          type: "success",
          message: `Saved to “${target}”`,
        });
        return true;
      } else {
        storage.sessions.save(target, KIND_WORKSPACE); // создаём новый workspace
        storage.saves.setActiveName(target);
        return true;
      }
    },

    saveActive() {
      const name = storage.saves.getActiveName();
      if (!name) return false;
      return storage.saves.upsert(name);
    },

    openByName(name) {
      const all = storage.sessions.list();
      const found = all.find(
        (s) => s.name.toLowerCase() === String(name || "").toLowerCase()
      );
      if (!found) return false;
      storage.sessions.load(found.id);
      storage.saves.setActiveName(found.name);
      return true;
    },
  },
};

// =============================================================================
// DevTools удобства (не ломают SSR/тесты)
// =============================================================================
if (typeof window !== "undefined") {
  window.storage = storage;
  window.eventBus = eventBus;
}
