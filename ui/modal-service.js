// =============================================================================
// UI/MODAL-SERVICE.JS — Единый сервис для создания модальных окон
// =============================================================================

import { eventBus } from "../core/event-bus.js";

// Храним последний открытый close для события modal:close
let lastModalClose = null;

/**
 * Экранировать HTML-символы для безопасного вывода в заголовке
 * (bodyHTML считается "доверенным" и формируется вызывающим кодом)
 */
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Открыть модальное окно
 * @param {Object} options - Параметры модалки
 * @param {string} options.title - Заголовок модалки (как текст)
 * @param {string} options.bodyHTML - HTML-содержимое тела модалки
 * @param {Function} [options.onClose] - Callback при закрытии
 * @param {boolean} [options.showFooter=false] - Показывать ли footer с кнопкой OK
 * @returns {Object} - Объект с методами/ссылками: { close, overlay, body }
 */
export function openModal({
  title = "",
  bodyHTML = "",
  onClose,
  showFooter = false,
} = {}) {
  const host = document.getElementById("modals-root");
  if (!host) {
    console.error("openModal: #modals-root not found");
    return { close() {} };
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const footerHTML = showFooter
    ? `<div class="modal-footer">
         <button class="btn cancel" data-role="ok">OK</button>
       </div>`
    : "";

  // title экранируем, bodyHTML принимаем как уже подготовленный HTML
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${escapeHtml(title)}</h2>
        <button class="modal-close" title="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML}
    </div>
  `;
  host.appendChild(overlay);

  const modalBody = overlay.querySelector(".modal-body");

  let onKey;

  const close = () => {
    // Снимаем обработчик Escape при любом закрытии
    if (onKey) {
      window.removeEventListener("keydown", onKey);
      onKey = null;
    }
    overlay.remove();
    onClose?.();
    // Если это был "последний" модал, сбрасываем ссылку
    if (lastModalClose === close) {
      lastModalClose = null;
    }
  };

  // Обработчик Escape
  onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  window.addEventListener("keydown", onKey);

  // Кнопка закрытия (крестик)
  overlay.querySelector(".modal-close")?.addEventListener("click", close);

  // Закрытие по клику вне модалки (на overlay)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Кнопка OK в footer (если есть)
  if (showFooter) {
    overlay.querySelector('[data-role="ok"]')?.addEventListener("click", close);
  }

  // Запоминаем последний close, чтобы modal:close мог закрыть "активную" модалку
  lastModalClose = close;

  return { close, overlay, body: modalBody };
}

// =============================================================================
// ПОДКЛЮЧЕНИЕ К EVENT BUS
// =============================================================================

export function initModalService() {
  // Универсальная модалка через eventBus
  eventBus.on("modal:custom:open", ({ title, bodyHTML, onMount, onClose }) => {
    const modal = openModal({ title, bodyHTML, onClose, showFooter: false });

    if (onMount && modal.body) {
      // Даём браузеру время отрендерить модалку
      setTimeout(() => {
        onMount(modal.body);
      }, 0);
    }

    return modal;
  });

  // Закрытие модалки по событию
  eventBus.on("modal:close", () => {
    if (lastModalClose) {
      lastModalClose();
      // lastModalClose сбрасывается внутри close()
    } else {
      // Фолбэк: на всякий случай удалим overlay, если что-то пошло не так
      const overlay = document.querySelector(".modal-overlay");
      overlay?.remove();
    }
  });

  console.log("✅ Modal service initialized and connected to eventBus");
}
