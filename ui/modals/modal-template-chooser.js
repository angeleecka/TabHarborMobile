// web/ui/modals/modal-template-chooser.js
import { openModal } from "../modal-service.js";
import { config } from "../../core/config.js";
import { templateChooserHTML } from "./modal-template-chooser.view.js";

const DEMO_URL = new URL(
  "../../assets/store/demo_workspace.json",
  import.meta.url
);

// чтобы после выбора и reload() модалка НЕ открылась второй раз
const BYPASS_ONCE_KEY = "tabharbor:tpl-chooser-bypass-once";

// ключи твоего текущего storage (НЕ переименовываем!)
const ACTIVE_SAVE_KEY = "linkapp-active-save-name";
const SESSIONS_KEY = "linkapp-sessions";

// --- helpers ---
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();

function getSkipFlag() {
  return !!config?.data?.onboarding?.skipTemplateChooser;
}

function setSkipFlag(v) {
  config.data.onboarding = config.data.onboarding || {};
  config.data.onboarding.skipTemplateChooser = !!v;
  config.save();
}

function shouldBypassOnce() {
  const v = sessionStorage.getItem(BYPASS_ONCE_KEY) === "1";
  if (v) sessionStorage.removeItem(BYPASS_ONCE_KEY);
  return v;
}

function bypassOnce() {
  sessionStorage.setItem(BYPASS_ONCE_KEY, "1");
}

function hasLastSession() {
  if (localStorage.getItem(ACTIVE_SAVE_KEY)) return true;

  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return false;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0;
  } catch {
    // если вдруг мусор в JSON — считаем что что-то было
    return true;
  }
}

export function requestTemplateChooserNextStart() {
  config.data.onboarding = config.data.onboarding || {};
  config.data.onboarding.forceTemplateChooserOnce = true;
  config.save();
}

export async function applyDemoTemplate() {
  const res = await fetch(DEMO_URL, { cache: "no-store" });
  const demo = await res.json();

  localStorage.setItem("linkapp-data", JSON.stringify(demo));

  // NEW: чтобы статусбар показал имя воркспейса после reload
  localStorage.setItem(ACTIVE_SAVE_KEY, "demo_workspace");
}

// чтобы после reload не выскочила стартовая модалка сразу же (один раз)
export function bypassTemplateChooserOnce() {
  sessionStorage.setItem("tabharbor:tpl-chooser-bypass-once", "1");
}

/**
 * Показываем выбор при старте:
 * - если НЕ стоит "больше не показывать"
 * - и если это не "bypass once" (чтобы после reload не показалось повторно)
 *
 * Важно: мы НЕ проверяем linkapp-data, потому что оно может создаваться автоматически.
 */
export function maybeShowTemplateChooserOnStart() {
  if (shouldBypassOnce()) return false;

  // если в Settings попросили показать 1 раз – показываем даже если skip=true
  const forceOnce = !!config?.data?.onboarding?.forceTemplateChooserOnce;
  if (forceOnce) {
    config.data.onboarding.forceTemplateChooserOnce = false;
    config.save();
    openTemplateChooserModal({ lastSessionAvailable: hasLastSession() });
    return true;
  }

  // обычный режим: показывать КАЖДЫЙ запуск, пока пользователь не отключит
  if (getSkipFlag()) return false;

  openTemplateChooserModal({ lastSessionAvailable: hasLastSession() });
  return true;
}

function makeEmptyTemplateFromDemo(demo) {
  // стараемся сохранить общую структуру/поля демо, но заменить pages на "пустое"
  const out = structuredClone
    ? structuredClone(demo)
    : JSON.parse(JSON.stringify(demo));

  const mkButton = () => ({
    id: uid(),
    title: "New link",
    url: "https://",
  });

  const mkSection = (title) => ({
    id: uid(),
    title,
    buttons: [mkButton()],
  });

  const mkPage = (title) => ({
    id: uid(),
    title,
    sections: [mkSection("Section 1")],
  });

  out.pages = [
    mkPage("Workspace 1"),
    mkPage("Workspace 2"),
    mkPage("Workspace 3"),
  ];

  // если в демо есть корзина/история — чистим
  if (Array.isArray(out.history)) out.history = [];
  if (Array.isArray(out.trash)) out.trash = [];

  // сигнатуру можно потом переименовать с совместимостью; сейчас оставляем как есть
  return out;
}

export function openTemplateChooserModal({
  lastSessionAvailable = false,
} = {}) {
  const bodyHTML = templateChooserHTML({ lastSessionAvailable });

  // ВАЖНО: сохраняем то, что вернул openModal (обычно overlay или modal)
  const el = openModal({ title: "Welcome to Tab Harbor", bodyHTML });

  // Находим overlay/modal и вешаем классы для “красивого” fullscreen-стиля
  const overlay = el?.classList?.contains("modal-overlay")
    ? el
    : el?.closest?.(".modal-overlay") ||
      document.querySelector(".modal-overlay:last-of-type");

  const modal = el?.classList?.contains("modal")
    ? el
    : overlay?.querySelector(".modal") ||
      document.querySelector(".modal:last-of-type");

  overlay?.classList.add("welcome-overlay");
  modal?.classList.add("welcome-modal");

  // Корень для обработчиков (внутри модалки)
  const modalRoot = modal || overlay || document.body;

  const skipEl = modalRoot.querySelector("#tplSkip");

  modalRoot.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest("[data-choice]");
      if (!btn) return;

      const choice = btn.getAttribute("data-choice");
      if (choice === "last" && !hasLastSession()) return;

      const skip = !!skipEl?.checked;
      setSkipFlag(skip);

      // Чтобы после reload welcome не показался мгновенно второй раз
      bypassOnce();

      if (choice === "last") {
        location.reload();
        return;
      }

      if (choice === "demo") {
        await applyDemoTemplate();
        location.reload();
        return;
      }

      if (choice === "empty") {
        // берём demo как “схему”, чтобы сделать корректную пустую структуру
        const res = await fetch(DEMO_URL, { cache: "no-store" });
        const demo = await res.json();

        const data = makeEmptyTemplateFromDemo(demo);
        localStorage.setItem("linkapp-data", JSON.stringify(data));
        localStorage.setItem(ACTIVE_SAVE_KEY, "empty_workspace");

        location.reload();
        return;
      }
    },
    { passive: true }
  );
}
