// =============================================================================
// MAIN.JS — Точка входа приложения
// =============================================================================

import { eventBus } from "./core/event-bus.js";
import { config } from "./core/config.js";
import { storage } from "./core/storage.js";
import { app } from "./core/app.js";

import { initModalService } from "./ui/modal-service.js";
import { initStatusBar } from "./ui/statusbar.js";

import { sniffLinkAppText } from "./core/import-sniff.js";

import { isSafeLinkUrl } from "./core/url.js";

import { maybeShowTemplateChooserOnStart } from "./ui/modals/modal-template-chooser.js";

// Модули темы
import {
  initThemeFromStorage,
  getTheme,
  applyTheme,
  enableSystemWatcher,
} from "./core/theme.js";

import { initNativeStatusBarSync } from "./platform/statusbar.js";

// UI-модули
import { initUI } from "./ui/skeleton.js";
import { initHeader } from "./ui/header.js";
import { initPages } from "./ui/pages.js";
import { initButtons } from "./ui/buttons.js";
import { initSections } from "./ui/sections.js";
import { initPagination } from "./ui/pagination.js";
import { initHistory } from "./ui/history.js";
import { initToast } from "./ui/toast.js";
import { initSearchService } from "./ui/search-service.js";
import { initGlobalSearchUI } from "./ui/search-global.js";

// import { initStudyPanel } from "./ui/panel-study.js";

// Модули модалок
import { initAboutModal } from "./ui/modal-about.js";
import { initEditButtonModal } from "./ui/modals/modal-edit-button.js";
import { initEditSectionModal } from "./ui/modals/modal-edit-section.js";
import { initHistoryModal } from "./ui/modals/modal-history.js";
import { initConfirmModal } from "./ui/modals/modal-confirm.js";
import { initSettingsModal } from "./ui/modals/modal-settings.js";
import { initSessionsModal } from "./ui/sessions-modal.js";

// Платформенный адаптер (для открытия ссылок)
import { launcher } from "./platform/launcher-web.js";

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Bootstrapping LinkApp v2...");

  // ===== ШАГ 1: ЗАГРУЗКА КОНФИГУРАЦИИ =====
  config.load();
  console.log("✅ Config loaded");

  // ===== ШАГ 2: ИНИЦИАЛИЗАЦИЯ ТЕМЫ =====
  initThemeFromStorage();
  console.log("✅ Theme initialized");

  // ===== ШАГ 3: СОЗДАНИЕ КАРКАСА UI =====
  initUI("#linkapp-root");
  console.log("✅ UI skeleton created");

  // ===== ШАГ 4: ИНИЦИАЛИЗАЦИЯ СИСТЕМНЫХ МОДУЛЕЙ =====
  initToast();
  storage.init();
  console.log("✅ Storage initialized");

  // ===== ШАГ 5: ИНИЦИАЛИЗАЦИЯ UI-МОДУЛЕЙ =====
  initModalService();
  initHeader();
  initButtons();
  initSections();
  initPages();
  initPagination();
  initHistory();
  initSearchService();
  initGlobalSearchUI();

  // ===== ШАГ 6: ИНИЦИАЛИЗАЦИЯ МОДАЛОК =====
  initAboutModal();
  initEditButtonModal();
  initEditSectionModal();
  initHistoryModal();
  initConfirmModal();
  initSettingsModal();
  initSessionsModal();

  initStatusBar();
  // initStudyPanel();

  // ===== ШАГ 7: ИНИЦИАЛИЗАЦИЯ CORE APP =====
  app.init();

  maybeShowTemplateChooserOnStart();

  console.log("✅ LinkApp v2 fully initialized");
});

// =============================================================================
// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ СОБЫТИЙ
// =============================================================================

// ===== ОТКРЫТИЕ ССЫЛОК ЧЕРЕЗ ПЛАТФОРМЕННЫЙ ЛАУНЧЕР =====
eventBus.on("link:open", ({ url, browser }) => {
  if (!isSafeLinkUrl(url)) {
    console.warn("[security] Blocked link:open for url:", url);
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Invalid or unsafe URL",
    });
    return;
  }

  const choice = browser || config.get("defaultBrowser") || "system";
  launcher.openUrl(url, choice);
  console.log(`[main] Opening link: ${url} (browser: ${choice})`);
});

// ===== ЭКСПОРТ ДАННЫХ В JSON =====

eventBus.on("storage:exportJSON", () => {
  try {
    const jsonData = storage.exportJSON();
    if (!jsonData) return;

    // читаемая дата + имя файла
    const iso = new Date().toISOString().slice(0, 10);
    const fileName = `linkapp-backup-${iso}.json`;

    // скачать
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    // тост с точным именем (в вебе папку открыть нельзя — пишем про «Downloads»)
    eventBus.emit("ui:toast", {
      type: "success",
      message: `Exported: ${fileName} · Check your Downloads folder`,
    });

    // на будущее (для desktop-хоста): событие с именем файла
    eventBus.emit("file:export:done", { fileName });

    console.log("[main] Data exported to JSON:", fileName);
  } catch (err) {
    console.error("[main] Export failed:", err);
    eventBus.emit("ui:toast", { type: "error", message: "Export failed" });
  }
});

// ===== ИМПОРТ ДАННЫХ ИЗ JSON =====
/*eventBus.on("storage:importJSON", ({ fileContent }) => {
  const success = storage.importJSON(fileContent);
  if (success) {
    console.log("[main] Data imported from JSON");
  }
});*/

// ===== ЭКСПОРТ ДАННЫХ (кнопка "Save") =====
/*eventBus.on("file:export", () => {
  eventBus.emit("storage:exportJSON");
});*/

// ===== ИМПОРТ ДАННЫХ (кнопка "Open") =====
eventBus.on("file:import", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const fileContent = String(ev.target?.result || "");
      const ok = storage.importJSON(fileContent); // ← вызываем напрямую

      if (ok) {
        console.log("[main] Data imported from JSON");

        // 💡 NEW: обновляем имя workspace по имени файла
        const fullName = file.name || "";
        const baseName = fullName.replace(/\.[^.]+$/, "") || "Imported data";

        if (storage.saves?.setActiveName) {
          storage.saves.setActiveName(baseName);
        }
      }
    };

    reader.readAsText(file);
  });

  input.click();
});

// =============================================================================
// ГОРЯЧИЕ КЛАВИШИ
// =============================================================================

// ===== ALT+T — ПЕРЕКЛЮЧЕНИЕ ТЕМЫ =====
if (!window.__linkapp_themeHotkeyBound) {
  window.__linkapp_themeHotkeyBound = true;

  window.addEventListener("keydown", (e) => {
    if (
      e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      (e.key === "t" || e.key === "T")
    ) {
      e.preventDefault();

      const order = ["system", "light", "sea", "dark"];
      const cur = getTheme();
      const next = order[(order.indexOf(cur) + 1) % order.length];

      applyTheme(next);

      console.log(`[main] Theme switched to: ${next}`);
    }
  });

  console.log("✅ Hotkeys initialized (Alt+T for theme toggle)");
}

// хоткей Alt+P — открыть/закрыть панель - включим, когда добавим панели
// TODO: re-enable when Study panel is implemented
/*window.addEventListener("keydown", (e) => {
  if (
    e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey &&
    (e.key === "p" || e.key === "P")
  ) {
    e.preventDefault();
    eventBus.emit("study:toggle");
  }
});*/
initNativeStatusBarSync();
