// =============================================================================
// UI/MODALS/MODAL-CONFIRM.JS — Универсальная модалка подтверждения действия
// =============================================================================

import { eventBus } from "../../core/event-bus.js";
import { openModal } from "../modal-service.js";

/**
 * Открыть модалку подтверждения действия
 * @param {Object} data - Параметры модалки
 * @param {string} data.title - Заголовок модалки
 * @param {string} data.message - Текст сообщения
 * @param {Function} data.onConfirm - Callback при подтверждении
 * @param {string} [data.confirmText] - Текст кнопки подтверждения (по умолчанию "Yes")
 * @param {string} [data.cancelText] - Текст кнопки отмены (по умолчанию "Cancel")
 */
function openConfirmModal(data) {
  const {
    title = "Confirm Action",
    message = "Are you sure?",
    onConfirm = () => {},
    confirmText = "Yes",
    cancelText = "Cancel",
  } = data;

  const bodyHTML = `
    <div class="confirm-message">
      <p>${escapeHtml(message)}</p>
    </div>
    
    <div class="modal-buttons-group">
      <button class="btn save" id="confirmYesBtn">${escapeHtml(
        confirmText
      )}</button>
      <button class="btn cancel" id="confirmCancelBtn">${escapeHtml(
        cancelText
      )}</button>
    </div>
  `;

  let handleEnter;

  const modal = openModal({
    title,
    bodyHTML,
    onClose: () => {
      // При любом закрытии модалки снимаем обработчик Enter
      if (handleEnter) {
        window.removeEventListener("keydown", handleEnter);
      }
    },
  });

  const yesBtn = document.getElementById("confirmYesBtn");
  const cancelBtn = document.getElementById("confirmCancelBtn");

  // Обработчик Enter для подтверждения
  handleEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm();
      modal.close(); // onClose сам снимет обработчик
    }
  };

  // Вешаем глобальный Enter только на время жизни модалки
  window.addEventListener("keydown", handleEnter);

  // Кнопка "Yes" / "Confirm"
  yesBtn?.addEventListener("click", () => {
    onConfirm();
    modal.close();
  });

  // Кнопка "Cancel"
  cancelBtn?.addEventListener("click", () => {
    modal.close();
  });

  // Фокус на кнопку "Yes" при открытии
  yesBtn?.focus();
}

/**
 * Экранировать HTML-символы для безопасного вывода
 */
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Инициализировать обработчики событий для модалки подтверждения
 */
export function initConfirmModal() {
  eventBus.on("modal:confirm:open", openConfirmModal);
  console.log("✅ Confirm Modal initialized");
}
