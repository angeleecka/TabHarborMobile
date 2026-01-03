// ui/modals/modal-history.js
// =============================================================================
// Модалка истории удалений
// =============================================================================

import { eventBus } from "../../core/event-bus.js";
import { openModal } from "../modal-service.js";
import { renderHistoryList } from "../history.js";

let currentModal = null;
let isHistoryModalInitialized = false;

// Открытие модалки истории
function openHistoryModal(_payload) {
  // Создаём HTML-содержимое модалки
  const bodyHTML = `
    <div id="historyListContainer" class="history-list-container">
      <!-- Список будет отрендерен через renderHistoryList() -->
    </div>
    
    <div class="modal-actions">
      <button class="btn delete" id="clearHistoryBtn">Clear History</button>
      <button class="btn cancel" id="cancelHistoryBtn">Close</button>
    </div>
  `;

  // Открываем модалку через modal-service
  currentModal = openModal({
    title: "Deletion History",
    bodyHTML,
    onClose: () => {
      currentModal = null;
    },
  });

  // Рендерим список истории сразу после открытия
  const container = document.getElementById("historyListContainer");
  if (container) {
    renderHistoryList(container);
  }

  // ===== ОБРАБОТЧИКИ СОБЫТИЙ ВНУТРИ МОДАЛКИ =====

  // Кнопка "Clear History"
  const clearBtn = document.getElementById("clearHistoryBtn");
  clearBtn?.addEventListener("click", () => {
    eventBus.emit("history:clear");
  });

  // Кнопка "Close"
  const cancelBtn = document.getElementById("cancelHistoryBtn");
  cancelBtn?.addEventListener("click", () => {
    currentModal?.close();
  });

  // Закрытие модалки по событию "modal:history:close"
  eventBus.once("modal:history:close", () => {
    currentModal?.close();
  });
}

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ МОДУЛЯ
// =============================================================================

/**
 * Инициализировать обработчики событий для модалки истории
 */
export function initHistoryModal() {
  if (isHistoryModalInitialized) return;
  isHistoryModalInitialized = true;

  // Слушаем событие открытия модалки
  eventBus.on("modal:history:open", openHistoryModal);

  // Хелпер: перерисовать список истории, если модалка открыта
  const rerenderIfOpen = () => {
    if (!currentModal) return;
    const container = document.getElementById("historyListContainer");
    if (container) {
      renderHistoryList(container);
    }
  };

  // После удаления элемента из истории — обновить список, если модалка открыта
  eventBus.on("history:item-deleted", rerenderIfOpen);

  // При любых изменениях storage — тоже обновляем, если модалка всё ещё открыта
  eventBus.on("storage:updated", rerenderIfOpen);

  console.log("✅ History Modal initialized");
}
